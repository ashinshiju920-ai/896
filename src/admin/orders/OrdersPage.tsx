import React, { useState, useCallback, useRef } from 'react';
import {
  Search,
  RefreshCw,
  ShoppingBag,
  Eye,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  X,
} from 'lucide-react';
import { OrderDetailModal } from './OrderDetailModal';

interface OrdersPageProps {
  orders: any[];
  isLoading: boolean;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filterStatus: string;
  onFilterStatusChange: (status: string) => void;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  onSearch?: (search: string) => void;
}

// Fulfillment state helpers
function getFulfillmentSummary(order: any): { label: string; color: string } {
  const items: any[] = Array.isArray(order.items) ? order.items : [];
  let expectedCount = 0;
  for (const item of items) {
    const fmt = item.format || item.deliveryOption || 'digital';
    if (fmt === 'digital') expectedCount += 1;
    const addons: any[] = Array.isArray(item.addOns) ? item.addOns : (Array.isArray(item.selectedAddons) ? item.selectedAddons : []);
    for (const addon of addons) {
      if ((addon.deliveryOption || 'digital') === 'digital') {
        const rawId = addon.addOnId || addon.id;
        if (rawId && rawId !== 'digital' && rawId !== 'physical') expectedCount += 1;
      }
    }
  }

  if (order.status !== 'PAID') return { label: '—', color: 'text-slate-400' };
  if (expectedCount === 0) return { label: 'COMPLETE', color: 'text-emerald-600 font-bold' };
  return { label: `? / ${expectedCount}`, color: 'text-amber-500' };
}

function getStatusStyle(status: string): string {
  switch (status) {
    case 'PAID': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'PENDING': return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'FAILED': return 'bg-red-50 text-red-700 border border-red-200';
    case 'USER_DROPPED': return 'bg-slate-100 text-slate-600 border border-slate-200';
    default: return 'bg-slate-100 text-slate-600 border border-slate-200';
  }
}

function getStatusDot(status: string): string {
  switch (status) {
    case 'PAID': return 'bg-emerald-500';
    case 'PENDING': return 'bg-amber-500';
    case 'FAILED': return 'bg-red-500';
    case 'USER_DROPPED': return 'bg-slate-400';
    default: return 'bg-slate-400';
  }
}

export const OrdersPage: React.FC<OrdersPageProps> = ({
  orders,
  isLoading,
  pagination,
  filterStatus,
  onFilterStatusChange,
  onPageChange,
  onRefresh,
  onSearch,
}) => {
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const statuses = [
    { id: 'all', label: 'All Orders' },
    { id: 'PAID', label: 'Paid' },
    { id: 'PENDING', label: 'Pending' },
    { id: 'FAILED', label: 'Failed' },
    { id: 'USER_DROPPED', label: 'Dropped' },
  ];

  // Server-side search with debounce
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
      searchDebounce.current = setTimeout(() => {
        if (onSearch) {
          onSearch(value);
        }
      }, 400);
    },
    [onSearch]
  );

  const clearSearch = () => {
    setSearch('');
    if (onSearch) onSearch('');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Server-side Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            id="admin-order-search"
            type="text"
            placeholder="Search by Order ID, Cashfree ID, email, name…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all shadow-2xs"
            aria-label="Search orders"
          />
          {search && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer self-start sm:self-auto"
          aria-label="Refresh orders"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter by status">
        {statuses.map((st) => (
          <button
            key={st.id}
            role="tab"
            aria-selected={filterStatus === st.id}
            onClick={() => onFilterStatusChange(st.id)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer ${
              filterStatus === st.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* Search info */}
      {search && (
        <div className="text-[11px] text-slate-500 font-medium px-1">
          Server-side search: <span className="font-bold text-slate-700">"{search}"</span>
          {' '}— {pagination.total} result{pagination.total !== 1 ? 's' : ''}
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {orders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" role="grid" aria-label="Orders list">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3 px-5" scope="col">Order ID</th>
                  <th className="py-3 px-5" scope="col">Customer</th>
                  <th className="py-3 px-5" scope="col">Amount</th>
                  <th className="py-3 px-5" scope="col">Payment</th>
                  <th className="py-3 px-5" scope="col">Fulfillment</th>
                  <th className="py-3 px-5" scope="col">Date</th>
                  <th className="py-3 px-5 text-right" scope="col">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {orders.map((order) => {
                  const status = order.status || 'PENDING';
                  const amount = order.amount !== undefined ? order.amount : Math.round((Number(order.amount_paise) || 0) / 100);
                  const itemsCount = Array.isArray(order.items) ? order.items.length : 1;
                  const fulfillment = getFulfillmentSummary(order);

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Order ID */}
                      <td className="py-3.5 px-5 font-mono font-bold text-slate-900">
                        <div>#{order.id}</div>
                        {order.cf_payment_id && (
                          <div className="text-[10px] text-slate-400 font-mono">CF: {order.cf_payment_id}</div>
                        )}
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-slate-900">
                          {order.customer_name || order.shipping?.fullName || 'Guest Student'}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {order.customer_email || order.shipping?.email || '—'}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-5 font-bold text-slate-900">
                        ₹{amount.toLocaleString('en-IN')}
                        <div className="text-[10px] text-slate-400 font-normal">{itemsCount} item{itemsCount > 1 ? 's' : ''}</div>
                      </td>

                      {/* Payment Status */}
                      <td className="py-3.5 px-5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wide ${getStatusStyle(status)}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(status)}`} />
                          {status}
                        </span>
                        {order.reconciliation_state && order.reconciliation_state !== 'UNKNOWN' && (
                          <div className={`text-[10px] mt-0.5 font-bold ${order.reconciliation_state === 'MATCHED' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {order.reconciliation_state}
                          </div>
                        )}
                      </td>

                      {/* Fulfillment */}
                      <td className={`py-3.5 px-5 font-mono text-[11px] font-bold ${fulfillment.color}`}>
                        {fulfillment.label}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-5 text-slate-500 font-mono text-[11px]">
                        {order.created_at
                          ? new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : 'Recent'}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                          aria-label={`Inspect order ${order.id}`}
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-600" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center space-y-3">
            <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800">
              {isLoading ? 'Loading orders from D1 database…' : search ? `No orders found for "${search}"` : 'No orders found matching filter.'}
            </h4>
          </div>
        )}

        {/* Server Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <div>
              Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong>
              {' '}({pagination.total} total)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1 || isLoading}
                aria-label="Previous page"
                className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || isLoading}
                aria-label="Next page"
                className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      <OrderDetailModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  );
};
