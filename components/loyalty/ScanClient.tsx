"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, CameraOff, Check, Loader2, RotateCcw, Search } from "lucide-react";

/**
 * Scan a customer's card and register loyalty without a POS order.
 *
 * Decoding runs on the client so nothing but the token ever leaves the device.
 * `BarcodeDetector` is used where it exists (native, cheap); everywhere else —
 * Safari on iOS included, which is most counters in Mexico — jsQR reads frames
 * off a canvas. Without that fallback the scanner would work on Android and
 * silently not on iPhone.
 */

interface Summary {
  id: string;
  name: string;
  phone?: string;
  mechanic: "sellos" | "cashback";
  stamps: number;
  required: number;
  rewardsPending: number;
  rewardDescription: string;
  unitPlural: string;
  cashbackBalance: number;
  cashbackRedeemable: boolean;
  cashbackThreshold: number;
  recentlyStamped?: boolean;
}

type Status = { kind: "idle" } | { kind: "error"; message: string } | { kind: "done"; message: string };

/** The card encodes the full /c/<token> URL; older ones may hold a bare token. */
function tokenFrom(raw: string): string | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/\/c\/([A-Za-z0-9_-]+)/);
  if (match) return match[1];
  return /^[A-Za-z0-9_-]{16,}$/.test(trimmed) ? trimmed : null;
}

export default function ScanClient({ businessName }: { businessName: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);

  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Summary | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [manual, setManual] = useState("");

  const stop = useCallback(() => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current);
    loopRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const load = useCallback(async (next: string) => {
    setBusy(true);
    setStatus({ kind: "idle" });
    try {
      const res = await fetch(`/api/loyalty/scan/${next}`);
      const data = await res.json();
      if (!res.ok) {
        setStatus({ kind: "error", message: data.error ?? "No se pudo leer la tarjeta" });
        return;
      }
      setToken(next);
      setCustomer(data);
    } finally {
      setBusy(false);
    }
  }, []);

  const start = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
    } catch {
      // Denied, unavailable, or an insecure origin — the manual box below is
      // the way through, so say that rather than leaving a dead viewfinder.
      setCameraError(
        "No pudimos abrir la cámara. Revisa el permiso, o escribe el código de la tarjeta abajo."
      );
    }
  }, []);

  // The decode loop. Kept in an effect so it tears down with the component and
  // never leaves the camera light on.
  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Detector = (window as any).BarcodeDetector;
    const detector = Detector ? new Detector({ formats: ["qr_code"] }) : null;

    const tick = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        let raw: string | null = null;

        if (detector) {
          try {
            const [hit] = await detector.detect(video);
            raw = hit?.rawValue ?? null;
          } catch {
            raw = null;
          }
        } else {
          const w = (canvas.width = video.videoWidth);
          const h = (canvas.height = video.videoHeight);
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx && w && h) {
            ctx.drawImage(video, 0, 0, w, h);
            const hit = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, {
              inversionAttempts: "dontInvert",
            });
            raw = hit?.data ?? null;
          }
        }

        const found = raw ? tokenFrom(raw) : null;
        if (found) {
          cancelled = true;
          stop();
          void load(found);
          return;
        }
      }
      loopRef.current = requestAnimationFrame(tick);
    };

    loopRef.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (loopRef.current) cancelAnimationFrame(loopRef.current);
    };
  }, [scanning, stop, load]);

  useEffect(() => stop, [stop]);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (!token) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/loyalty/scan/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();

      if (res.status === 409 && data.code === "RECENTLY_STAMPED") {
        // Not an error — a double scan is the common case, so offer the
        // override rather than refusing outright.
        if (confirm(`${data.error}. ¿Registrar otra vez?`)) {
          return act(action, { ...extra, force: true });
        }
        return;
      }
      if (!res.ok) {
        setStatus({ kind: "error", message: data.error ?? "No se pudo completar" });
        return;
      }

      setCustomer(data);
      setAmount("");
      setStatus({
        kind: "done",
        message:
          action === "accrue"
            ? data.justEarnedReward
              ? "¡Premio completado!"
              : "Registrado"
            : "Listo",
      });
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setToken(null);
    setCustomer(null);
    setStatus({ kind: "idle" });
    setAmount("");
    setManual("");
  }

  const isCashback = customer?.mechanic === "cashback";

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      {!customer ? (
        <>
          <div className="overflow-hidden rounded-2xl bg-gray-900 aspect-[4/3] relative">
            <video
              ref={videoRef}
              playsInline
              muted
              className={`h-full w-full object-cover ${scanning ? "" : "opacity-0"}`}
            />
            <canvas ref={canvasRef} className="hidden" />
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400">
                <CameraOff size={28} />
                <button
                  onClick={start}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
                >
                  <Camera size={16} /> Abrir cámara
                </button>
              </div>
            )}
            {scanning && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-44 w-44 rounded-2xl border-2 border-white/80 shadow-[0_0_0_100vmax_rgba(0,0,0,.35)]" />
              </div>
            )}
          </div>

          {cameraError && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              {cameraError}
            </p>
          )}

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
              O escribe el código
            </label>
            <div className="mt-2 flex gap-2">
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="Pega el código o el link de la tarjeta"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
              />
              <button
                onClick={() => {
                  const t = tokenFrom(manual);
                  if (t) void load(t);
                  else setStatus({ kind: "error", message: "Ese código no es válido" });
                }}
                disabled={busy || !manual}
                className="shrink-0 rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400">{businessName}</p>
        </>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-lg font-extrabold tracking-tight text-gray-900">{customer.name}</p>
            {customer.phone && <p className="text-xs text-gray-400">{customer.phone}</p>}

            <div className="mt-4">
              {isCashback ? (
                <>
                  <p className="text-3xl font-extrabold tabular-nums text-gray-900">
                    ${customer.cashbackBalance.toLocaleString("es-MX")}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {customer.cashbackRedeemable
                      ? "Saldo disponible para usar"
                      : `Mínimo para usar: $${customer.cashbackThreshold.toLocaleString("es-MX")}`}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-3xl font-extrabold tabular-nums text-gray-900">
                    {customer.stamps} <span className="text-gray-300">/ {customer.required}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {customer.rewardsPending > 0
                      ? `${customer.rewardsPending} premio(s) por entregar: ${customer.rewardDescription}`
                      : `Le faltan ${customer.required - customer.stamps} ${customer.unitPlural}`}
                  </p>
                </>
              )}
            </div>
          </div>

          {isCashback && (
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Total de la compra"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
            />
          )}

          <div className="space-y-2">
            <button
              onClick={() => act("accrue", { amount: Number(amount) || 0 })}
              disabled={busy}
              className="w-full rounded-xl bg-emerald-500 px-4 py-3.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              {busy ? "…" : isCashback ? "Acumular saldo" : "Registrar visita"}
            </button>

            {!isCashback && customer.rewardsPending > 0 && (
              <button
                onClick={() => act("redeemReward")}
                disabled={busy}
                className="w-full rounded-xl bg-gray-900 px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Entregar premio
              </button>
            )}

            {isCashback && customer.cashbackRedeemable && (
              <button
                onClick={() => act("redeemCashback", { amount: Number(amount) || 0 })}
                disabled={busy || !(Number(amount) > 0)}
                className="w-full rounded-xl bg-gray-900 px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                Usar saldo en esta compra
              </button>
            )}

            <button
              onClick={reset}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-sm font-semibold text-gray-500 hover:text-gray-900"
            >
              <RotateCcw size={14} /> Escanear otra
            </button>
          </div>
        </div>
      )}

      {status.kind === "error" && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {status.message}
        </p>
      )}
      {status.kind === "done" && (
        <p className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <Check size={15} /> {status.message}
        </p>
      )}
    </div>
  );
}
