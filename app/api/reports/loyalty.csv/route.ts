import { headers } from 'next/headers';
import mongoose from 'mongoose';
import { auth } from '@/lib/auth';
import dbConnect from '@/lib/db';
import Customer from '@/models/Customer';
import Visit from '@/models/Visit';
import { businessRepository } from '@/repositories/business.repository';
import { loyaltyConfig, stampState } from '@/lib/loyalty';
import { analyticsService, type ReportPeriod } from '@/services/analytics.service';

/** Excel in es-MX splits on `;`, and a leading BOM keeps accents intact. */
const SEP = ';';

function cell(value: unknown): string {
  const s = value == null ? '' : String(value);
  // A leading =, +, - or @ is executed as a formula on open — neutralise it.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

const row = (cells: unknown[]) => cells.map(cell).join(SEP);

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.businessId) return new Response('Unauthorized', { status: 401 });
  if (!['OWNER', 'ADMIN'].includes(session.user.role)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const raw = new URL(req.url).searchParams.get('period');
  const period: ReportPeriod = raw === 'today' || raw === 'week' ? raw : 'month';

  await dbConnect();
  const bId = new mongoose.Types.ObjectId(session.user.businessId);

  const [business, report, customers, lastAccruals] = await Promise.all([
    businessRepository.findById(session.user.businessId),
    analyticsService.getLoyaltyReport(session.user.businessId, period),
    Customer.find({ businessId: bId }).sort({ 'stats.totalVisits': -1 }).lean(),
    Visit.aggregate([
      { $match: { businessId: bId, type: 'ACCRUAL' } },
      { $group: { _id: '$customerId', last: { $max: '$createdAt' } } },
    ]),
  ]);

  const config = loyaltyConfig(business);
  const lastById = new Map(lastAccruals.map((r) => [String(r._id), r.last as Date]));
  const fmtDate = (d?: Date) =>
    d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';

  const lines: string[] = [];

  lines.push(row([`Reporte de fidelización — ${business?.name ?? ''}`]));
  lines.push(row([`Periodo`, { today: 'Hoy', week: '7 días', month: '30 días' }[period]]));
  lines.push(row([`Generado`, new Date().toLocaleString('es-MX')]));
  lines.push('');

  lines.push(row(['RESUMEN']));
  lines.push(row(['Ticket promedio con tarjeta', report.avgWithCard.toFixed(2)]));
  lines.push(row(['Ticket promedio sin tarjeta', report.avgAnonymous.toFixed(2)]));
  lines.push(row(['Diferencia %', (report.uplift * 100).toFixed(1)]));
  lines.push(row(['Órdenes con tarjeta', report.ordersWithCard]));
  lines.push(row(['Órdenes sin tarjeta', report.ordersAnonymous]));
  lines.push(row(['Clientes totales', report.totalCustomers]));
  lines.push(row(['Altas esta semana', report.signupsThisWeek]));
  lines.push(row(['Tasa de regreso %', (report.returnRate * 100).toFixed(1)]));
  lines.push(row(['Premios entregados', report.rewardsDelivered]));
  lines.push(row(['Cashback acumulado', report.cashbackAccrued.toFixed(2)]));
  lines.push(row(['Cashback canjeado', report.cashbackRedeemed.toFixed(2)]));
  lines.push(row(['Pasivo vivo de cashback', report.cashbackLiability.toFixed(2)]));
  lines.push('');

  lines.push(row(['CLIENTES']));
  lines.push(
    row([
      'Nombre',
      'Teléfono',
      'Email',
      config.sellos.unitPlural,
      'Premios por canjear',
      'Saldo',
      'Total histórico',
      'Alta',
      'Última acumulación',
    ])
  );

  for (const c of customers) {
    const state = stampState(c.stats?.currentVisits ?? 0, config.sellos.required);
    lines.push(
      row([
        c.name,
        c.phone ?? '',
        c.email ?? '',
        state.stamps,
        state.rewardsPending,
        (c.stats?.cashbackBalance ?? 0).toFixed(2),
        c.stats?.totalVisits ?? 0,
        fmtDate(c.createdAt),
        fmtDate(lastById.get(String(c._id))),
      ])
    );
  }

  const filename = `fidelizacion-${period}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(`\ufeff${lines.join('\r\n')}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
