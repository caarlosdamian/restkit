"use client";

import { useState } from "react";
import { Save, Printer, CheckCircle2 } from "lucide-react";
import { printReceipt } from "@/lib/receipt-html";

interface BusinessData {
  name: string;
  branding: { primaryColor: string; logo?: string };
  settings: { requiredVisits: number; rewardDescription: string };
  ticket: {
    fiscalName?: string;
    rfc?: string;
    phone?: string;
    address?: string;
    fiscalAddress?: string;
    website?: string;
    footerMessage?: string;
    iva?: number;
  };
}

export default function SettingsForm({ initial }: { initial: BusinessData }) {
  const [data, setData] = useState<BusinessData>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function setField(path: string, value: string | number) {
    setData((prev) => {
      const next = structuredClone(prev);
      const keys = path.split(".");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let obj: any = next;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      return next;
    });
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  function handlePreview() {
    printReceipt({
      ticketNumber: "A1B2C3",
      businessName: data.name,
      fiscalName: data.ticket.fiscalName,
      rfc: data.ticket.rfc,
      phone: data.ticket.phone,
      address: data.ticket.address,
      fiscalAddress: data.ticket.fiscalAddress,
      website: data.ticket.website,
      footerMessage: data.ticket.footerMessage,
      iva: data.ticket.iva,
      tableName: "Mesa 1",
      staffName: "Demo",
      items: [
        { name: "Tacos de pastor", quantity: 3, price: 40 },
        { name: "Agua mineral", quantity: 2, price: 15 },
      ],
      total: 150,
      paymentMethod: "CASH",
      amountReceived: 200,
      change: 50,
      closedAt: new Date(),
    });
  }

  return (
    <div className="space-y-8 max-w-2xl">

      {/* ── Negocio ── */}
      <Section title="Información del negocio" desc="Nombre y apariencia de tu restaurante.">
        <Field label="Nombre del restaurante *">
          <input
            value={data.name}
            onChange={(e) => setField("name", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Color principal">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={data.branding.primaryColor}
              onChange={(e) => setField("branding.primaryColor", e.target.value)}
              className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer p-0.5"
            />
            <input
              value={data.branding.primaryColor}
              onChange={(e) => setField("branding.primaryColor", e.target.value)}
              placeholder="#10b981"
              className={`${inputCls} font-mono`}
            />
          </div>
        </Field>
        <Field label="URL del logo">
          <input
            value={data.branding.logo ?? ""}
            onChange={(e) => setField("branding.logo", e.target.value)}
            placeholder="https://turestaurante.com/logo.png"
            className={inputCls}
          />
        </Field>
      </Section>

      {/* ── Ticket / Facturación ── */}
      <Section
        title="Datos del ticket"
        desc="Esta información aparece impresa en todos los comprobantes."
        action={
          <button
            onClick={handlePreview}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors"
          >
            <Printer size={13} /> Ver ticket de prueba
          </button>
        }
      >
        <Field label="Razón social" hint="Nombre fiscal del negocio (si es diferente al nombre comercial)">
          <input
            value={data.ticket.fiscalName ?? ""}
            onChange={(e) => setField("ticket.fiscalName", e.target.value)}
            placeholder="Ej. Tacos El Norte S.A. de C.V."
            className={inputCls}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="RFC">
            <input
              value={data.ticket.rfc ?? ""}
              onChange={(e) => setField("ticket.rfc", e.target.value.toUpperCase())}
              placeholder="Ej. TEN200101ABC"
              maxLength={13}
              className={`${inputCls} font-mono uppercase`}
            />
          </Field>
          <Field label="Teléfono">
            <input
              value={data.ticket.phone ?? ""}
              onChange={(e) => setField("ticket.phone", e.target.value)}
              placeholder="55 1234 5678"
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="Dirección comercial">
          <input
            value={data.ticket.address ?? ""}
            onChange={(e) => setField("ticket.address", e.target.value)}
            placeholder="Av. Insurgentes 123, Col. Roma, CDMX"
            className={inputCls}
          />
        </Field>
        <Field label="Domicilio fiscal" hint="Si es diferente a la dirección comercial">
          <input
            value={data.ticket.fiscalAddress ?? ""}
            onChange={(e) => setField("ticket.fiscalAddress", e.target.value)}
            placeholder="Domicilio registrado ante SAT"
            className={inputCls}
          />
        </Field>
        <Field label="Sitio web">
          <input
            value={data.ticket.website ?? ""}
            onChange={(e) => setField("ticket.website", e.target.value)}
            placeholder="www.turestaurante.com"
            className={inputCls}
          />
        </Field>
        <Field label="Mensaje de pie de página">
          <input
            value={data.ticket.footerMessage ?? ""}
            onChange={(e) => setField("ticket.footerMessage", e.target.value)}
            placeholder="¡Gracias por su visita!"
            className={inputCls}
          />
        </Field>
        <Field
          label="IVA (%)"
          hint="Los precios ya incluyen IVA; se muestra desglosado en el ticket. Usa 0 para ocultarlo."
        >
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={data.ticket.iva ?? 16}
            onChange={(e) => setField("ticket.iva", e.target.value === "" ? 0 : parseFloat(e.target.value))}
            className={inputCls}
          />
        </Field>
      </Section>

      {/* ── Fidelización ── */}
      <Section title="Programa de fidelización" desc="Configura las reglas de tu tarjeta de lealtad.">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Visitas para premio">
            <input
              type="number"
              min={1}
              max={100}
              value={data.settings.requiredVisits}
              onChange={(e) => setField("settings.requiredVisits", parseInt(e.target.value) || 10)}
              className={inputCls}
            />
          </Field>
          <Field label="Descripción del premio">
            <input
              value={data.settings.rewardDescription}
              onChange={(e) => setField("settings.rewardDescription", e.target.value)}
              placeholder="Un café gratis"
              className={inputCls}
            />
          </Field>
        </div>
      </Section>

      {/* Save button */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm"
        >
          <Save size={16} />
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
            <CheckCircle2 size={16} /> Guardado
          </span>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all";

function Section({
  title,
  desc,
  action,
  children,
}: {
  title: string;
  desc: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-gray-900">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
        </div>
        {action}
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
