"use client";

import { useState } from "react";
import { Check, Copy, Printer } from "lucide-react";

/**
 * The QR the business prints and puts on the table.
 *
 * Printing goes through the browser dialog, the same way receipts do — no
 * driver, no app, and the owner picks whatever printer is already there.
 */
export default function JoinPoster({
  url,
  qrDataUrl,
  businessName,
  headline,
  subline,
}: {
  url: string;
  qrDataUrl: string;
  businessName: string;
  headline: string;
  subline: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked outside a secure context — the link is on screen
      // and selectable, so this is a convenience, not the only way through.
    }
  }

  function print() {
    const w = window.open("", "_blank", "width=800,height=1000");
    if (!w) return;
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${businessName} — tarjeta de fidelidad</title>
<style>
  @page { size: A5; margin: 12mm; }
  body { margin:0; font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
         text-align:center; color:#141a21; display:flex; flex-direction:column;
         align-items:center; justify-content:center; min-height:90vh; }
  h1 { font-size:26px; margin:0 0 6px; letter-spacing:-.02em; }
  p  { margin:0; color:#5e6874; font-size:14px; }
  .qr { margin:26px 0 18px; }
  .qr img { width:250px; height:250px; }
  .step { font-size:13px; color:#8b95a1; }
  .name { margin-top:22px; font-size:12px; letter-spacing:.14em;
          text-transform:uppercase; color:#8b95a1; }
</style></head><body>
  <h1>${headline}</h1>
  <p>${subline}</p>
  <div class="qr"><img src="${qrDataUrl}" alt=""></div>
  <p class="step">Escanea con la cámara de tu teléfono</p>
  <div class="name">${businessName}</div>
</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-bold text-gray-900">Que se registren solos</p>
      <p className="mt-0.5 text-xs text-gray-500">
        Imprime este código y ponlo en la mesa o el mostrador. El cliente lo
        escanea, deja su teléfono y su tarjeta queda lista — sin que nadie del
        equipo tenga que capturarlo.
      </p>

      <div className="mt-4 flex items-start gap-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrDataUrl}
          alt="Código para registrarse"
          className="h-32 w-32 shrink-0 rounded-xl border border-gray-200 bg-white p-1.5"
        />

        <div className="min-w-0 flex-1 space-y-2">
          <code className="block truncate rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs text-gray-600">
            {url}
          </code>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={print}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-gray-800"
            >
              <Printer size={14} /> Imprimir
            </button>
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              {copied ? "Copiado" : "Copiar liga"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
