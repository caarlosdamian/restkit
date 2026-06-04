import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { customerService } from '@/services/customer.service';
import { businessRepository } from '@/repositories/business.repository';
import RecordVisitButton from '@/components/dashboard/RecordVisitButton';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppleWallet } from '@/components/appleWallet/AppleWallet';

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

  const required = business.settings.requiredVisits;
  const current = customer.stats.currentVisits;
  const progressPct = Math.min((current / required) * 100, 100);

  const passUrl = `/api/passes/apple/${customer._id.toString()}`;

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/customers"
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            ← Clientes
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            {customer.name}
          </h1>
          <p className="text-sm text-gray-500">
            {customer.email || customer.phone || 'Sin contacto'}
          </p>
        </div>
        <RecordVisitButton customerId={customer._id.toString()} />
      </div>

      {/* Loyalty progress */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Progreso de fidelidad
        </h2>
        <div className="mt-4 flex items-end gap-3">
          <span className="text-5xl font-bold text-gray-900">{current}</span>
          <span className="mb-1 text-lg text-gray-400">
            / {required} visitas
          </span>
        </div>
        <div className="mt-4 h-3 w-full rounded-full bg-gray-100">
          <div
            className="h-3 rounded-full bg-indigo-600 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Premio:{' '}
          <span className="font-medium text-gray-700">
            {business.settings.rewardDescription}
          </span>
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Total de visitas
          </p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {customer.stats.totalVisits}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Puntos
          </p>
          <p className="mt-1 text-3xl font-bold text-gray-900">
            {customer.stats.points}
          </p>
        </div>
      </div>

      {/* Apple Wallet */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Tarjeta Digital</h2>
        <p className="mt-1 text-sm text-gray-500">
          Comparte este enlace con el cliente para que guarde su tarjeta en
          Apple Wallet.
        </p>
        <AppleWallet passUrl={passUrl} />
      </div>
    </div>
  );
}
