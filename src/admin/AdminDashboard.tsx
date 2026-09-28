import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  ShoppingBag,
  TrendingUp,
  CheckCircle2,
  Clock,
  FileText,
  ArrowRight,
  Plus,
  RefreshCw,
  Layers,
  Sparkles,
  Calendar,
  Eye,
  CreditCard,
  Percent,
  Tag,
  ArrowDown,
  AlertCircle,
} from 'lucide-react';
import { Book, AnalyticsDateFilter, AnalyticsDashboardResponse } from '../types';
import { AdminSection } from './AdminSidebar';

interface AdminDashboardProps {
  books: Book[];
  serverOrders: any[];
  ordersTotal: number;
  ordersLoading: boolean;
  dashboardStats?: {
    totalOrders: number;
    paidOrders: number;
    pendingOrders: number;
    failedOrders: number;
    userDroppedOrders: number;
    paidRevenuePaise: number;
    paidRevenue: number;
    fulfillmentIssues: number;
  } | null;
  onNavigateSection: (section: AdminSection) => void;
  onOpenNewProduct: () => void;
  onRefreshOrders: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  books,
  serverOrders,
  ordersTotal,
  ordersLoading,
  dashboardStats,
  onNavigateSection,
  onOpenNewProduct,
  onRefreshOrders,
}) => {
  // Phase 11: Analytics State & Date Filters
  const [dateFilter, setDateFilter] = useState<AnalyticsDateFilter>('7d');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsDashboardResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      let url = `/api/admin/analytics?filter=${encodeURIComponent(dateFilter)}`;
      if (dateFilter === 'custom' && customStart && customEnd) {
        url += `&startDate=${encodeURIComponent(customStart)}&endDate=${encodeURIComponent(customEnd)}`;
      }
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data: AnalyticsDashboardResponse = await res.json();
        setAnalyticsData(data);
      } else {
        const err = await res.json().catch(() => ({}));
        setAnalyticsError(err.error || 'Failed to load analytics.');
      }
    } catch {
      setAnalyticsError('Network error connecting to analytics service.');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [dateFilter, customStart, customEnd]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Fallback metrics if analytics API is loading or unavailable
  const totalProducts = books.length;
  const digitalProducts = books.filter((b) => b.prices?.digital?.price > 0).length;
  const physicalProducts = books.filter((b) => b.prices?.physical?.price > 0).length;
  const fulfillmentIssues = dashboardStats ? dashboardStats.fulfillmentIssues : 0;

  // Use analytics data when loaded; fallback to dashboardStats
  const overview = analyticsData?.overview;
  const funnel = analyticsData?.funnel;

  const paidRevenue = overview ? overview.paidRevenue : (dashboardStats ? dashboardStats.paidRevenue : 0);
  const paidOrders = overview ? overview.paidOrders : (dashboardStats ? dashboardStats.paidOrders : 0);
  const totalOrders = overview
    ? (overview.paidOrders + overview.pendingOrders + overview.failedOrders + overview.userDroppedOrders)
    : (dashboardStats ? dashboardStats.totalOrders : ordersTotal);
  const aov = overview ? overview.averageOrderValue : (paidOrders > 0 ? Math.round(paidRevenue / paidOrders) : 0);
  const checkoutConversion = overview ? overview.checkoutConversionRate : 0;

  const getCustomerName = (order: any) =>
    order.customer_name || order.shipping?.fullName || order.shipping?.name || 'Guest Student';
  const getCustomerEmail = (order: any) =>
    order.customer_email || order.shipping?.email || '';
  const getCustomerPhone = (order: any) =>
    order.customer_phone || order.shipping?.phone || '';

  const escapeCsv = (value: any) => {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };

  const exportRecentOrders = () => {
    const rows = serverOrders.map((order) => {
      const amount = order.amount !== undefined ? order.amount : Math.round((Number(order.amount_paise) || 0) / 100);
      const itemsCount = Array.isArray(order.items) ? order.items.length : 0;
      return {
        orderId: order.id || '',
        cashfreeOrderId: order.cf_order_id || '',
        paymentId: order.cf_payment_id || '',
        customerName: getCustomerName(order),
        customerEmail: getCustomerEmail(order),
        customerPhone: getCustomerPhone(order),
        amount,
        currency: order.currency || 'INR',
        status: order.status || 'PENDING',
        itemsCount,
        createdAt: order.created_at || '',
      };
    });

    const headers = [
      'Order ID',
      'Cashfree Order ID',
      'Payment ID',
      'Customer Name',
      'Customer Email',
      'Customer Phone',
      'Amount',
      'Currency',
      'Status',
      'Items Count',
      'Created At',
    ];
    const csv = [
      headers.map(escapeCsv).join(','),
      ...rows.map((row) => [
        row.orderId,
        row.cashfreeOrderId,
        row.paymentId,
        row.customerName,
        row.customerEmail,
        row.customerPhone,
        row.amount,
        row.currency,
        row.status,
        row.itemsCount,
        row.createdAt,
      ].map(escapeCsv).join(',')),
    ].join('\r\n');

    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `recent-server-orders-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#0a2540] via-[#0f345c] to-emerald-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full text-[11px] font-bold tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Store Operations & Analytics</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold font-['Plus_Jakarta_Sans',sans-serif]">
            Xylem Learning E-Commerce CMS
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Monitor real-time sales funnel metrics, product and add-on conversion rates, and server-verified Cashfree order reconciliation.
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

        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Date Filter Bar — Section 19 & Section 20 */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Reporting Period
            </span>
            <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              Asia/Kolkata (IST)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { fetchAnalytics(); onRefreshOrders(); }}
              disabled={analyticsLoading || ordersLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${analyticsLoading ? 'animate-spin text-emerald-600' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: '7d', label: 'Last 7 Days' },
              { id: '30d', label: 'Last 30 Days' },
              { id: 'month', label: 'This Month' },
              { id: 'custom', label: 'Custom Range' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setDateFilter(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                dateFilter === item.id
                  ? 'bg-[#0a2540] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Custom Date Range Selector */}
        {dateFilter === 'custom' && (
          <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-medium">From:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 focus:outline-emerald-600"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-medium">To:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 focus:outline-emerald-600"
              />
            </div>
            <button
              onClick={fetchAnalytics}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
            >
              Apply Filter
            </button>
          </div>
        )}

        {analyticsData?.dateRange && (
          <p className="text-[11px] text-slate-500 pt-1">
            Displaying server metrics from <span className="font-semibold text-slate-700">{analyticsData.dateRange.startDate}</span> to <span className="font-semibold text-slate-700">{analyticsData.dateRange.endDate}</span>.
          </p>
        )}
      </div>

      {/* Error state */}
      {analyticsError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-between text-xs text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{analyticsError}</span>
          </div>
          <button
            onClick={fetchAnalytics}
            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg font-bold cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Section 21: SALES OVERVIEW */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
            Sales Overview
          </h3>
          <span className="text-xs text-slate-500">Financial authority: orders with status PAID</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Metric 1: Verified Revenue */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Paid Revenue</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
              ₹{paidRevenue.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{paidOrders} Paid Order{paidOrders !== 1 ? 's' : ''}</span>
            </p>
          </div>

          {/* Metric 2: Total Orders Breakdown */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Total Orders Created</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
              {totalOrders}
            </div>
            <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>{overview ? overview.pendingOrders : 0} Pending · {overview ? overview.failedOrders : 0} Failed · {overview ? overview.userDroppedOrders : 0} Dropped</span>
            </p>
          </div>

          {/* Metric 3: Average Order Value */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Average Order Value</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
              ₹{aov.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-500">
              Calculated as Paid Revenue ÷ Paid Orders
            </p>
          </div>

          {/* Metric 4: Checkout → Paid Conversion */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Checkout → Paid</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif]">
              {checkoutConversion}%
            </div>
            <p className="text-[11px] text-slate-500">
              Paid Orders ÷ Checkout Starts
            </p>
          </div>
        </div>
      </div>

      {/* Section 21: CHECKOUT FUNNEL */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              First-Party Sales Funnel
            </h3>
            <p className="text-xs text-slate-500">Measured step-by-step conversion across active customer journey</p>
          </div>
          {funnel && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              Overall View → Paid: {funnel.overallConversionRate}%
            </span>
          )}
        </div>

        {funnel ? (
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
            {/* Step 1: Views */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
                <Eye className="w-3.5 h-3.5 text-slate-600" />
                <span>1. Product Views</span>
              </div>
              <div className="text-xl font-extrabold text-slate-900">
                {funnel.productViews.toLocaleString()}
              </div>
              <p className="text-[10px] text-slate-400">Total catalog visits</p>
            </div>

            {/* Step 2: Add to Cart */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
                <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
                <span>2. Add to Cart</span>
              </div>
              <div className="text-xl font-extrabold text-slate-900">
                {funnel.addToCart.toLocaleString()}
              </div>
              <p className="text-[10px] text-blue-600 font-medium">
                {funnel.productViews > 0 ? `${Math.round((funnel.addToCart / funnel.productViews) * 1000) / 10}% from views` : '—'}
              </p>
            </div>

            {/* Step 3: Checkout Started */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
                <CreditCard className="w-3.5 h-3.5 text-purple-600" />
                <span>3. Checkout</span>
              </div>
              <div className="text-xl font-extrabold text-slate-900">
                {funnel.checkoutStarts.toLocaleString()}
              </div>
              <p className="text-[10px] text-purple-600 font-medium">
                {funnel.cartToCheckoutRate}% from cart
              </p>
            </div>

            {/* Step 4: Payment Initiated */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>4. Payment Initiated</span>
              </div>
              <div className="text-xl font-extrabold text-slate-900">
                {funnel.paymentInitiated.toLocaleString()}
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                Server order created
              </p>
            </div>

            {/* Step 5: Paid Orders */}
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-800 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>5. Order Paid</span>
              </div>
              <div className="text-xl font-extrabold text-emerald-900">
                {funnel.orderPaid.toLocaleString()}
              </div>
              <p className="text-[10px] text-emerald-700 font-bold">
                {funnel.checkoutToPaidRate}% of checkouts
              </p>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-500">
            {analyticsLoading ? 'Loading funnel statistics...' : 'No funnel data for this period.'}
          </div>
        )}
      </div>

      {/* Section 21: TOP PRODUCTS PERFORMANCE */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              Product Performance
            </h3>
            <p className="text-xs text-slate-500">Sorted objectively by verified paid order volume</p>
          </div>
          <button
            onClick={() => onNavigateSection('products')}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
          >
            <span>All Products</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {analyticsData?.topProducts && analyticsData.topProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3 px-6">Product Title</th>
                  <th className="py-3 px-4 text-center">Views</th>
                  <th className="py-3 px-4 text-center">Add to Cart</th>
                  <th className="py-3 px-4 text-center">Checkouts</th>
                  <th className="py-3 px-4 text-center">Paid Orders</th>
                  <th className="py-3 px-4 text-center">Conversion</th>
                  <th className="py-3 px-6 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {analyticsData.topProducts.map((p) => (
                  <tr key={p.productId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-6 font-semibold text-slate-900 max-w-xs truncate">
                      {p.title}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-slate-600">
                      {p.views.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-slate-600">
                      {p.addToCart.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-slate-600">
                      {p.checkoutStarts.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-900 font-mono">
                      {p.paidOrders.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-emerald-700">
                      {p.conversionRate}%
                    </td>
                    <td className="py-3.5 px-6 text-right font-extrabold text-slate-900 font-mono">
                      ₹{p.revenue.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-500">
            {analyticsLoading ? 'Loading product metrics...' : 'No product sales recorded in this period.'}
          </div>
        )}
      </div>

      {/* Section 21 & Section 14: ADD-ON PERFORMANCE */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              Add-On Performance & Attachment
            </h3>
            <p className="text-xs text-slate-500">
              Attachment Rate = Paid Add-on Purchases ÷ Eligible Paid Base-Product Purchases
            </p>
          </div>
        </div>

        {analyticsData?.addOnPerformance && analyticsData.addOnPerformance.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3 px-6">Add-On Material</th>
                  <th className="py-3 px-4 text-center">Selections</th>
                  <th className="py-3 px-4 text-center">Paid Purchases</th>
                  <th className="py-3 px-4 text-center">Eligible Base Purchases</th>
                  <th className="py-3 px-4 text-center">Attachment Rate</th>
                  <th className="py-3 px-6 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {analyticsData.addOnPerformance.map((a) => (
                  <tr key={a.addOnId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-6 font-semibold text-slate-900">
                      {a.name}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-slate-600">
                      {a.selections.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-900 font-mono">
                      {a.paidPurchases.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-slate-500">
                      {a.eligibleBasePurchases.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-purple-700">
                      {a.attachmentRate}%
                    </td>
                    <td className="py-3.5 px-6 text-right font-extrabold text-slate-900 font-mono">
                      ₹{a.revenue.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-500">
            {analyticsLoading ? 'Loading add-on metrics...' : 'No add-on purchases recorded in this period.'}
          </div>
        )}
      </div>

      {/* Section 24: PROMOTION & COUPON PERFORMANCE */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
              Promotion & Coupon Performance
            </h3>
            <p className="text-xs text-slate-500">Historical discount impact from verified paid orders</p>
          </div>
          <button
            onClick={() => onNavigateSection('offers')}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
          >
            <span>Manage Offers</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {analyticsData?.promotions && analyticsData.promotions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3 px-6">Coupon Code</th>
                  <th className="py-3 px-4 text-center">Paid Uses</th>
                  <th className="py-3 px-4 text-center">Discount Value Given</th>
                  <th className="py-3 px-6 text-right">Paid Revenue Generated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {analyticsData.promotions.map((pr) => (
                  <tr key={pr.code} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-6 font-mono font-bold text-slate-900">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <Tag className="w-3 h-3" />
                        <span>{pr.code}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-900 font-mono">
                      {pr.timesUsed.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono text-rose-700 font-semibold">
                      -₹{pr.discountGiven.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-6 text-right font-extrabold text-slate-900 font-mono">
                      ₹{pr.revenueGenerated.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-500">
            {analyticsLoading ? 'Loading coupon statistics...' : 'No coupon redemptions recorded in this period.'}
          </div>
        )}
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
          onClick={() => onNavigateSection('offers')}
          className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-emerald-500 transition-all cursor-pointer group shadow-2xs hover:shadow-md"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <Tag className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif] group-hover:text-emerald-700 transition-colors">
            Coupons & Bundles
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Create promotional discount codes, manage usage ceilings, and configure bundle upsells.
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
            <p className="text-xs text-slate-500">Live order events from Cloudflare D1 with customer contact details</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportRecentOrders}
              disabled={ordersLoading || serverOrders.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Export recent server orders to an Excel-compatible CSV"
            >
              <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Excel</span>
            </button>
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
                  <th className="py-3 px-6">Customer Details</th>
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
                  const customerName = getCustomerName(order);
                  const customerEmail = getCustomerEmail(order);
                  const customerPhone = getCustomerPhone(order);

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-6 font-mono font-bold text-slate-900">
                        #{order.id}
                      </td>
                      <td className="py-3.5 px-6">
                        <div className="font-semibold text-slate-900">{customerName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{customerEmail || 'No email'}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{customerPhone || 'No phone'}</div>
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
