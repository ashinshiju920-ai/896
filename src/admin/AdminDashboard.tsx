import React from 'react';
import {
  BookOpen,
  ShoppingBag,
  TrendingUp,
  CheckCircle2,
  Clock,
  Star,
  FileText,
  ArrowRight,
  Plus,
  RefreshCw,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Book } from '../types';
import { AdminSection } from './AdminSidebar';

interface AdminDashboardProps {
  books: Book[];
  serverOrders: any[];
  ordersTotal: number;
  ordersLoading: boolean;
  onNavigateSection: (section: AdminSection) => void;
  onOpenNewProduct: () => void;
  onRefreshOrders: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  books,
  serverOrders,
  ordersTotal,
  ordersLoading,
  onNavigateSection,
  onOpenNewProduct,
  onRefreshOrders,
}) => {
  // Real Calculated Metrics
  const totalProducts = books.length;
  const digitalProducts = books.filter((b) => b.prices?.digital?.price > 0).length;
  const physicalProducts = books.filter((b) => b.prices?.physical?.price > 0).length;
  const totalPdfs = books.filter((b) => Boolean(b.pdfUrl)).length;

  const paidOrders = serverOrders.filter((o) => o.status === 'PAID');
  const pendingOrders = serverOrders.filter((o) => o.status === 'PENDING' || !o.status);

  // Authoritative Paid Revenue from verified orders
  const paidRevenue = paidOrders.reduce((sum, o) => {
    const amt = o.amount !== undefined ? Number(o.amount) : Math.round((Number(o.amount_paise) || 0) / 100);
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);

  const totalReviews = books.reduce((sum, b) => sum + (Array.isArray(b.reviews) ? b.reviews.length : 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#0a2540] via-[#0f345c] to-emerald-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full text-[11px] font-bold tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Store Administration</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold font-['Plus_Jakarta_Sans',sans-serif]">
            Xylem Learning E-Commerce CMS
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Manage your official IELTS, OET, PTE, and German preparation materials, inspect live student orders, and maintain server-verified fulfillment delivery.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={onOpenNewProduct}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Product</span>
            </button>
            <button
              onClick={() => onNavigateSection('orders')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              <span>View All Orders</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Decorative circle glow */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Verified Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Verified Paid Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
            ₹{paidRevenue.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{paidOrders.length} Paid Transactions</span>
          </p>
        </div>

        {/* Metric 2: Total Orders */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Orders Logged</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
            {ordersTotal > 0 ? ordersTotal : serverOrders.length}
          </div>
          <p className="text-[11px] text-slate-500 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{pendingOrders.length} Pending Verification</span>
          </p>
        </div>

        {/* Metric 3: Total Products */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Catalog Guides</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
            {totalProducts}
          </div>
          <p className="text-[11px] text-slate-500">
            {digitalProducts} Digital • {physicalProducts} Physical
          </p>
        </div>

        {/* Metric 4: PDF Assets & Reviews */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Connected PDFs</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
            {totalPdfs} / {totalProducts}
          </div>
          <p className="text-[11px] text-slate-500 flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span>{totalReviews} Student Reviews</span>
          </p>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => onNavigateSection('products')}
          className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-emerald-500 transition-all cursor-pointer group shadow-2xs hover:shadow-md"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <BookOpen className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif] group-hover:text-emerald-700 transition-colors">
            Manage Products
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Update pricing, book covers, TOC curriculum, and attach authentic PDF assets.
          </p>
        </div>

        <div
          onClick={() => onNavigateSection('orders')}
          className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-emerald-500 transition-all cursor-pointer group shadow-2xs hover:shadow-md"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif] group-hover:text-emerald-700 transition-colors">
            Orders & Shipments
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Inspect customer receipts, Cashfree verification status, and physical delivery details.
          </p>
        </div>

        <div
          onClick={() => onNavigateSection('categories')}
          className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-emerald-500 transition-all cursor-pointer group shadow-2xs hover:shadow-md"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif] group-hover:text-emerald-700 transition-colors">
            Exam Categories & Hero
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Configure IELTS, OET, PTE, and German homepage hero cards and featured badges.
          </p>
        </div>
      </div>

      {/* Recent Orders Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              Recent Server Orders
            </h3>
            <p className="text-xs text-slate-500">Live order events from Cloudflare D1</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefreshOrders}
              disabled={ordersLoading}
              className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              title="Refresh Orders"
            >
              <RefreshCw className={`w-4 h-4 ${ordersLoading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
            <button
              onClick={() => onNavigateSection('orders')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {serverOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3 px-6">Order ID</th>
                  <th className="py-3 px-6">Customer</th>
                  <th className="py-3 px-6">Items</th>
                  <th className="py-3 px-6">Amount</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {serverOrders.slice(0, 5).map((order) => {
                  const isPaid = order.status === 'PAID';
                  const amount = order.amount !== undefined ? order.amount : Math.round((Number(order.amount_paise) || 0) / 100);
                  const itemsCount = Array.isArray(order.items) ? order.items.length : 1;

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-6 font-mono font-bold text-slate-900">
                        #{order.id}
                      </td>
                      <td className="py-3.5 px-6">
                        <div className="font-semibold text-slate-900">{order.customer_name || 'Guest Student'}</div>
                        <div className="text-[11px] text-slate-400">{order.customer_email || '—'}</div>
                      </td>
                      <td className="py-3.5 px-6">
                        <span className="font-medium text-slate-700">{itemsCount} guide{itemsCount > 1 ? 's' : ''}</span>
                      </td>
                      <td className="py-3.5 px-6 font-bold text-slate-900">
                        ₹{amount}
                      </td>
                      <td className="py-3.5 px-6">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wide ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          {order.status || 'PENDING'}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right text-slate-500 font-mono text-[11px]">
                        {order.created_at ? new Date(order.created_at).toLocaleDateString() : 'Today'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-slate-500">
            {ordersLoading ? 'Loading live orders...' : 'No orders recorded yet.'}
          </div>
        )}
      </div>
    </div>
  );
};
