import React from 'react';
import { Package, DownloadCloud, BookOpen, Clock, ChevronRight } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { BookCover } from '../components/BookCover';

export const OrdersHistoryView: React.FC = () => {
  const {
    orders,
    setCurrentView,
    openPdfViewer,
    downloadBookPdf,
  } = useShop();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
            My Orders & Downloads
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Access and re-download your digital study guides, or track physical shipments.
          </p>
        </div>
        <button
          onClick={() => setCurrentView('catalog')}
          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
        >
          <span>Browse Store</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {orders.length > 0 ? (
        <div className="space-y-6">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
            >
              {/* Order Meta Header */}
              <div className="bg-slate-50 p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-4 text-slate-600">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Order ID</span>
                    <span className="font-bold text-slate-900 font-mono">#{order.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Date</span>
                    <span className="font-semibold text-slate-900">{order.date}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Total</span>
                    <span className="font-bold text-slate-900">₹{order.total}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold text-[11px] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Paid & Confirmed
                  </span>
                </div>
              </div>

              {/* Items in this Order */}
              <div className="divide-y divide-slate-100 p-4 sm:p-6 space-y-4 sm:space-y-0">
                {order.items.map((item) => (
                  <div
                    key={`${order.id}-${item.bookId}-${item.format}`}
                    className="pt-4 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="shrink-0">
                        <BookCover book={item.book} size="sm" showShadow={false} />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
                          {item.book.title}
                        </h4>
                        <p className="text-xs text-slate-500">
                          Format: {item.format === 'digital' ? 'Digital eBook (PDF)' : 'Physical Printed Book'} • Qty: {item.quantity}
                        </p>
                        <span className="text-xs font-bold text-slate-900 mt-1 block">
                          ₹{item.price * item.quantity}
                        </span>
                      </div>
                    </div>

                    {/* Actions if digital and order is PAID */}
                    {item.format === 'digital' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openPdfViewer(item.book)}
                          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-slate-600" />
                          <span>Read Online</span>
                        </button>

                        <button
                          onClick={() => downloadBookPdf(item.book, order.id)}
                          className="px-4 py-2 bg-[#00875a] hover:bg-[#00734c] text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <DownloadCloud className="w-3.5 h-3.5" />
                          <span>Download PDF</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-20 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
          <Package className="w-12 h-12 text-slate-300 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800">No orders placed yet</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Once you purchase digital or physical study materials, they will appear here with instant download links.
          </p>
          <button
            onClick={() => setCurrentView('catalog')}
            className="px-6 py-2.5 bg-[#00875a] hover:bg-[#00734c] text-white text-xs font-semibold rounded-xl"
          >
            Explore Books & Guides
          </button>
        </div>
      )}
    </div>
  );
};
