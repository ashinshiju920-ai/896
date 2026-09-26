import React from 'react';
import {
  X,
  ShieldCheck,
  Package,
  FileText,
  ExternalLink,
  DownloadCloud,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';

interface OrderDetailModalProps {
  order: any | null;
  onClose: () => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ order, onClose }) => {
  if (!order) return null;

  const isPaid = order.status === 'PAID';
  const amount = order.amount !== undefined ? order.amount : Math.round((Number(order.amount_paise) || 0) / 100);
  const items = Array.isArray(order.items) ? order.items : [];
  const shipping = typeof order.shipping === 'object' ? order.shipping : {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/70">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Order Record</span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                  isPaid
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {isPaid ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                <span>{order.status || 'PENDING'}</span>
              </span>
            </div>
            <h3 className="text-lg font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif] font-mono">
              #{order.id}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
          {/* Customer & Shipping Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Student Customer
              </h4>
              <div className="space-y-1">
                <div><span className="text-slate-400">Name:</span> <strong className="text-slate-900">{order.customer_name || shipping.fullName || '—'}</strong></div>
                <div><span className="text-slate-400">Email:</span> <span className="font-mono text-slate-800">{order.customer_email || shipping.email || '—'}</span></div>
                <div><span className="text-slate-400">Phone:</span> <span className="font-mono text-slate-800">{order.customer_phone || shipping.phone || '—'}</span></div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                Shipping Address
              </h4>
              <div className="space-y-0.5 text-slate-600">
                <div className="font-semibold text-slate-800">{shipping.fullName || '—'}</div>
                <div>{shipping.addressLine1 || shipping.address || ''} {shipping.addressLine2 || ''}</div>
                <div>{shipping.city || ''} {shipping.state ? `, ${shipping.state}` : ''} {shipping.pinCode ? `- ${shipping.pinCode}` : ''}</div>
                {shipping.deliveryOption && (
                  <div className="pt-1 text-[11px] font-bold text-emerald-800">
                    Option: {shipping.deliveryOption === 'digital' ? 'Instant Digital Download' : 'Physical Printed Courier'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Purchased Line Items */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              Purchased Materials ({items.length} item{items.length > 1 ? 's' : ''})
            </h4>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
              {items.map((item: any, idx: number) => {
                const isDigital = item.format === 'digital' || item.deliveryOption === 'digital';
                const itemTotal = item.totalPrice || (item.unitPrice ? item.unitPrice * (item.quantity || 1) : null);

                return (
                  <div key={idx} className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDigital ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {isDigital ? <FileText className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-900">{item.title || item.name || 'Study Material'}</h5>
                        <p className="text-[11px] text-slate-500">
                          Format: {isDigital ? 'Digital PDF eBook' : 'Physical Printed Book'} • Qty: {item.quantity || 1}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-slate-900">₹{itemTotal || item.price || 199}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Payment & Audit Info */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[11px] text-slate-500 block uppercase font-bold">Total Paid</span>
              <span className="text-xl font-extrabold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                ₹{amount}
              </span>
              <span className="text-[10px] text-slate-400 block font-mono">
                Amount Paise: {order.amount_paise || amount * 100}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-500 block uppercase font-bold">Cashfree Order Reference</span>
              <span className="font-mono text-slate-700">{order.cf_order_id || order.id}</span>
            </div>

            <div>
              <span className="text-[11px] text-slate-500 block uppercase font-bold">Created Date</span>
              <span className="text-slate-700">{order.created_at ? new Date(order.created_at).toLocaleString() : 'Recent'}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
