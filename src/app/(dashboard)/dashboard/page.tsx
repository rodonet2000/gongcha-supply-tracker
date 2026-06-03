export const dynamic = 'force-dynamic'
import { getWeeklySummary, getTopItemsByWeek, getOrdersStats } from '@/features/orders/actions/order-actions'
import { getScrapingSessions } from '@/features/scraper/actions/scrape-actions'
import { formatWeekLabel, formatCurrency, toISODateString, getWeekRange } from '@/shared/lib/utils'
import { TrendingUp, ShoppingBag, DollarSign, Clock } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  let sessions: Awaited<ReturnType<typeof getScrapingSessions>> = []
  let summary: Awaited<ReturnType<typeof getWeeklySummary>> = []
  try {
    ;[sessions, summary] = await Promise.all([
      getScrapingSessions(),
      getWeeklySummary(),
    ])
  } catch {
    // Supabase schema not yet available - show empty state
  }

  const currentWeek = toISODateString(getWeekRange(new Date()).start)
  const latestWeek = summary[0]?.week_start ?? currentWeek
  let stats: Awaited<ReturnType<typeof getOrdersStats>> = null
  let topItems: Awaited<ReturnType<typeof getTopItemsByWeek>> = []
  try {
    ;[stats, topItems] = await Promise.all([
      getOrdersStats(latestWeek),
      getTopItemsByWeek(latestWeek),
    ])
  } catch { /* schema not ready */ }

  const completedSessions = sessions.filter((s) => s.status === 'completed').length
  const lastSession = sessions[0]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          Semana activa: <span className="font-medium text-slate-700">{formatWeekLabel(latestWeek)}</span>
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Pedidos esta semana"
          value={stats?.totalOrders ?? 0}
          icon={<ShoppingBag size={18} className="text-brand-600" />}
          sub={`${completedSessions} semanas extraídas`}
        />
        <StatCard
          label="Ingresos semana"
          value={formatCurrency(stats?.totalRevenue)}
          icon={<DollarSign size={18} className="text-brand-600" />}
          sub={`Promedio: ${formatCurrency(stats?.avgOrderValue)}`}
        />
        <StatCard
          label="Ticket promedio"
          value={formatCurrency(stats?.avgOrderValue)}
          icon={<TrendingUp size={18} className="text-brand-600" />}
          sub="por pedido"
        />
        <StatCard
          label="Última extracción"
          value={lastSession ? (lastSession.status === 'completed' ? 'Completada' : lastSession.status) : 'Ninguna'}
          icon={<Clock size={18} className="text-brand-600" />}
          sub={lastSession ? formatWeekLabel(lastSession.week_start) : 'Ir al extractor'}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Top productos */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Top productos</h2>
            <span className="text-xs text-slate-400">{formatWeekLabel(latestWeek)}</span>
          </div>
          {topItems.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              No hay datos. <Link href="/extractor" className="text-brand-600 hover:underline">Extraer datos →</Link>
            </p>
          ) : (
            <div className="space-y-3">
              {topItems.slice(0, 8).map((item, i) => (
                <div key={item.item_name} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-400 w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{item.item_name}</p>
                    <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full"
                        style={{ width: `${Math.min(100, (item.total_quantity / topItems[0].total_quantity) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-slate-700 w-8 text-right">{item.total_quantity}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Canal de ventas */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">Por canal</h2>
            <span className="text-xs text-slate-400">{formatWeekLabel(latestWeek)}</span>
          </div>
          {!stats?.byChannel || Object.keys(stats.byChannel).length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Sin datos aún</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(stats.byChannel)
                .sort(([, a], [, b]) => b - a)
                .map(([channel, count]) => (
                  <div key={channel} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ChannelDot channel={channel} />
                      <span className="text-sm text-slate-700">{channel}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 rounded-full"
                          style={{ width: `${(count / (stats?.totalOrders ?? 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-700 w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Historial de sesiones */}
      {sessions.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-4">Historial de extracciones</h2>
          <div className="space-y-2">
            {sessions.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-800">{formatWeekLabel(s.week_start)}</p>
                  <p className="text-xs text-slate-400">{s.orders_processed} pedidos extraídos</p>
                </div>
                <StatusBadge status={s.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon, sub }: { label: string; value: string | number; icon: React.ReactNode; sub: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-500">{label}</p>
        <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center">{icon}</div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  )
}

function ChannelDot({ channel }: { channel: string }) {
  const colors: Record<string, string> = {
    POS: 'bg-blue-400',
    UberEats: 'bg-emerald-400',
    Rappi: 'bg-orange-400',
    Foodbot: 'bg-brand-500',
    Kiosk: 'bg-purple-400',
  }
  return <span className={`w-2 h-2 rounded-full ${colors[channel] ?? 'bg-slate-400'}`} />
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: 'bg-emerald-50 text-emerald-700',
    running: 'bg-blue-50 text-blue-700',
    error: 'bg-red-50 text-red-700',
    pending: 'bg-slate-50 text-slate-600',
  }
  return (
    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${map[status] ?? map.pending}`}>
      {status}
    </span>
  )
}
