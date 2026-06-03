import { getOrderDetail } from '@/features/orders/actions/order-actions'
import { formatDateEs, formatCurrency } from '@/shared/lib/utils'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params
  const data = await getOrderDetail(id)

  if (!data) notFound()

  const { order, items } = data

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/pedidos" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4 w-fit">
          <ArrowLeft size={15} />
          Volver a pedidos
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Pedido #{order.external_id}</h1>
        <p className="text-slate-500 text-sm mt-1">{order.brand} · {order.order_type}</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <InfoCard label="Estado" value={order.order_status ?? 'N/A'} />
        <InfoCard label="Canal" value={order.channel ?? 'N/A'} />
        <InfoCard label="Pago" value={order.payment_method ?? 'N/A'} />
        <InfoCard label="Fecha/Hora" value={order.order_timestamp ? formatDateEs(order.order_timestamp) : 'N/A'} />
        <InfoCard label="Código de entrada" value={order.entry_code ?? 'N/A'} />
        <InfoCard label="Cliente" value={order.customer_name || 'Anónimo'} />
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-slate-200 bg-brand-600">
          <h2 className="font-semibold text-white text-sm">Detalles de artículo</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Artículo</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Instrucciones</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Cant.</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Precio Unit.</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Impuesto</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <>
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">{item.item_name}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{item.instructions || '--'}</td>
                  <td className="px-4 py-3 text-center text-slate-700">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(item.unit_price)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(item.tax)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatCurrency(item.total)}</td>
                </tr>
                {item.modifiers.map((mod) => (
                  <tr key={mod.id} className="bg-slate-50">
                    <td className="px-4 py-1.5 pl-8 text-xs text-slate-500" colSpan={6}>
                      {mod.quantity}x {mod.modifier_name}
                    </td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totales */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-xs ml-auto">
        <div className="space-y-2 text-sm">
          {order.discount != null && order.discount > 0 && (
            <Row label="Descuento" value={`-${formatCurrency(order.discount)}`} />
          )}
          {order.service_charge != null && order.service_charge > 0 && (
            <Row label="Cargo por servicio" value={formatCurrency(order.service_charge)} />
          )}
          {order.tip != null && order.tip > 0 && (
            <Row label="Propina" value={formatCurrency(order.tip)} />
          )}
          {order.delivery_fee != null && order.delivery_fee > 0 && (
            <Row label="Envío" value={formatCurrency(order.delivery_fee)} />
          )}
          <div className="border-t border-slate-200 pt-2 flex justify-between font-semibold text-slate-900">
            <span>Total</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-600">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
