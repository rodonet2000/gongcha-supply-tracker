import { getOrdersByWeek } from '@/features/orders/actions/order-actions'
import { getScrapingSessions } from '@/features/scraper/actions/scrape-actions'
import { formatWeekLabel, formatDateEs, formatCurrency, getWeekRange, toISODateString } from '@/shared/lib/utils'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

interface Props {
  searchParams: Promise<{ week?: string }>
}

export default async function PedidosPage({ searchParams }: Props) {
  const params = await searchParams
  const sessions = await getScrapingSessions()
  const availableWeeks = sessions.filter((s) => s.status === 'completed').map((s) => s.week_start)

  const selectedWeek = params.week ?? availableWeeks[0] ?? toISODateString(getWeekRange(new Date()).start)
  const orders = selectedWeek ? await getOrdersByWeek(selectedWeek) : []

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pedidos</h1>
          <p className="text-slate-500 text-sm mt-1">{orders.length} pedidos en la semana seleccionada</p>
        </div>

        {/* Selector de semana */}
        <form>
          <select
            name="week"
            defaultValue={selectedWeek}
            onChange={(e) => {
              const url = new URL(window.location.href)
              url.searchParams.set('week', e.target.value)
              window.location.href = url.toString()
            }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {availableWeeks.map((w) => (
              <option key={w} value={w}>{formatWeekLabel(w)}</option>
            ))}
            {availableWeeks.length === 0 && (
              <option value={selectedWeek}>{formatWeekLabel(selectedWeek)}</option>
            )}
          </select>
        </form>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <p className="text-slate-400 text-sm">No hay pedidos para esta semana.</p>
          <Link href="/extractor" className="text-brand-600 text-sm hover:underline mt-2 inline-block">
            Extraer datos →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">ID Pedido</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha/Hora</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Canal</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Pago</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-brand-600 font-medium">#{order.external_id}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    {order.order_timestamp ? formatDateEs(order.order_timestamp) : '--'}
                  </td>
                  <td className="px-4 py-3">
                    <ChannelBadge channel={order.channel ?? '--'} />
                  </td>
                  <td className="px-4 py-3 text-slate-600 capitalize text-xs">
                    {order.order_type ?? '--'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    {order.payment_method ?? '--'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {order.order_status ?? 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">
                    {formatCurrency(order.total)}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/pedidos/${order.id}`} className="text-slate-400 hover:text-brand-600 transition-colors">
                      <ChevronRight size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ChannelBadge({ channel }: { channel: string }) {
  const map: Record<string, string> = {
    POS: 'bg-blue-50 text-blue-700',
    UberEats: 'bg-emerald-50 text-emerald-700',
    Rappi: 'bg-orange-50 text-orange-700',
    Foodbot: 'bg-brand-50 text-brand-700',
    Kiosk: 'bg-purple-50 text-purple-700',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[channel] ?? 'bg-slate-50 text-slate-600'}`}>
      {channel}
    </span>
  )
}
