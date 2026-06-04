import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { customerService } from '@/services/customer.service';
import { businessRepository } from '@/repositories/business.repository';
import RecordVisitButton from '@/components/dashboard/RecordVisitButton';
import { AppleWallet } from '@/components/appleWallet/AppleWallet';
import GoogleWallet from '@/components/dashboard/GoogleWallet';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ScanLine, Star, QrCode } from 'lucide-react';

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.businessId) {
    return <div>No se encontró configuración de negocio.</div>;
  }

  const [customer, business] = await Promise.all([
    customerService.getCustomerById(id, session.user.businessId),
    businessRepository.findById(session.user.businessId),
  ]);

  if (!customer || !business) notFound();

  const customerId = customer._id.toString();
  const required = business.settings.requiredVisits;
  const current = customer.stats.currentVisits;
  const progressPct = Math.min((current / required) * 100, 100);

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const publicUrl = `${appUrl}/c/${customerId}`;
  const passUrl = `/api/passes/apple/${customerId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&format=svg&data=${encodeURIComponent(publicUrl)}`;

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/customers"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4"
        >
          <ArrowLeft size={15} />
          Clientes
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-extrabold text-xl shrink-0">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">{customer.name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {customer.email || customer.phone || 'Sin contacto'}
              </p>
            </div>
          </div>
          <RecordVisitButton customerId={customerId} />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <ScanLine size={18} />
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total visitas</p>
          </div>
          <p className="text-4xl font-extrabold tracking-tight text-gray-900">{customer.stats.totalVisits}</p>
        </div>
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Star size={18} />
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Puntos</p>
          </div>
          <p className="text-4xl font-extrabold tracking-tight text-gray-900">{customer.stats.points}</p>
        </div>
      </div>

      {/* Loyalty progress */}
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Progreso de fidelidad</p>
        <div className="flex items-end gap-3">
          <span className="text-5xl font-extrabold tracking-tight text-gray-900">{current}</span>
          <span className="mb-1.5 text-lg text-gray-400 font-medium">/ {required} visitas</span>
        </div>
        <div className="mt-4 h-2.5 w-full rounded-full bg-gray-100">
          <div
            className="h-2.5 rounded-full bg-emerald-500 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Premio:{' '}
          <span className="font-semibold text-gray-900">{business.settings.rewardDescription}</span>
        </p>
      </div>

      {/* Digital card / QR */}
      <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <QrCode size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Tarjeta Digital</p>
            <p className="text-xs text-gray-500">Muestra el QR al cliente para que guarde su tarjeta.</p>
          </div>
        </div>

        {/* QR code */}
        <div className="flex flex-col items-center gap-3 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrUrl}
            alt="QR tarjeta de fidelidad"
            width={180}
            height={180}
            className="rounded-2xl border border-gray-100 p-2"
          />
          <p className="text-xs text-gray-400 text-center">{publicUrl}</p>
        </div>

        {/* Direct wallet links */}
        <div className="border-t border-gray-100 pt-5 space-y-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">O comparte directamente</p>
          <GoogleWallet customerId={customerId} />
          <AppleWallet passUrl={passUrl} />
        </div>
      </div>
    </div>
  );
}
