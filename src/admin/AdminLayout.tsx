import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useShop } from '../context/ShopContext';
import { Book } from '../types';
import { AdminSidebar, AdminSection } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';
import { AdminLogin } from './AdminLogin';
import { AdminDashboard } from './AdminDashboard';
import { ProductsPage } from './products/ProductsPage';
import { ProductEditor } from './products/ProductEditor';
import { ProductReorder } from './products/ProductReorder';
import { OrdersPage } from './orders/OrdersPage';
import { ReviewsPage } from './reviews/ReviewsPage';
import { TestimonialsPage } from './testimonials/TestimonialsPage';
import { CategoriesPage } from './categories/CategoriesPage';
import { OffersPage } from './offers/OffersPage';
import { MediaPage } from './media/MediaPage';
import { SettingsPage } from './settings/SettingsPage';

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    books,
    addBook,
    updateBook,
    deleteBook,
    resetBooksToDefault,
    reorderBooks,
    examPaths,
    updateExamPath,
    resetExamPathsToDefault,
    testimonials,
    addTestimonial,
    updateTestimonial,
    deleteTestimonial,
    resetTestimonialsToDefault,
    addReview,
    openPdfViewer,
    showToast,
    isCloudSyncing,
    lastCloudSync,
    refreshProductsFromCloud,
    syncBooksToCloud,
  } = useShop();

  // Authentication State
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Mobile sidebar drawer state
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  // Active product editor state (null = list, 'new' = new product, Book = edit)
  const [activeEditingBook, setActiveEditingBook] = useState<Book | 'new' | null>(null);

  // Server Orders State
  const [serverOrders, setServerOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersFilterStatus, setOrdersFilterStatus] = useState<string>('all');
  const [ordersSearch, setOrdersSearch] = useState('');
  const [ordersPagination, setOrdersPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }>({ page: 1, limit: 15, total: 0, totalPages: 1 });

  // Dashboard Stats State
  const [dashboardStats, setDashboardStats] = useState<any>(null);

  // Map current URL path to AdminSection
  const getSectionFromPath = (pathname: string): AdminSection => {
    if (pathname.includes('/admin/products/reorder')) return 'reorder';
    if (pathname.includes('/admin/products')) return 'products';
    if (pathname.includes('/admin/orders')) return 'orders';
    if (pathname.includes('/admin/reviews')) return 'reviews';
    if (pathname.includes('/admin/testimonials')) return 'testimonials';
    if (pathname.includes('/admin/categories')) return 'categories';
    if (pathname.includes('/admin/offers')) return 'offers';
    if (pathname.includes('/admin/media')) return 'media';
    if (pathname.includes('/admin/settings')) return 'settings';
    return 'dashboard';
  };

  const currentSection = getSectionFromPath(location.pathname);

  // Check Admin Session on mount
  useEffect(() => {
    let isMounted = true;
    async function checkAuth() {
      try {
        const res = await fetch('/api/admin/session', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (isMounted) setIsAuthenticated(Boolean(data?.authenticated));
        } else {
          if (isMounted) setIsAuthenticated(false);
        }
      } catch {
        if (isMounted) setIsAuthenticated(false);
      } finally {
        if (isMounted) setIsCheckingAuth(false);
      }
    }
    checkAuth();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch Server-Authoritative Orders from Cloudflare D1 (with search)
  const fetchOrders = useCallback(async (page = 1, status = ordersFilterStatus, search = ordersSearch) => {
    setOrdersLoading(true);
    try {
      const statusParam = status !== 'all' ? `&status=${encodeURIComponent(status)}` : '';
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
      const res = await fetch(`/api/admin/orders?page=${page}&limit=15${statusParam}${searchParam}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data && Array.isArray(data.orders)) {
          setServerOrders(data.orders);
          if (data.pagination) {
            setOrdersPagination(data.pagination);
            setOrdersPage(data.pagination.page);
          }
        }
      } else if (res.status === 401) {
        setIsAuthenticated(false);
        showToast('Admin session expired. Please sign in again.', 'warning');
      }
    } catch (err) {
      console.warn('Failed to fetch server orders:', err);
    } finally {
      setOrdersLoading(false);
    }
  }, [ordersFilterStatus, ordersSearch, showToast]);

  // Fetch consolidated dashboard statistics
  const fetchDashboardStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/dashboard', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.stats) setDashboardStats(data.stats);
      }
    } catch {
      // Non-fatal — dashboard stats are supplementary
    }
  }, []);

  // Load orders + dashboard stats when authenticated
  useEffect(() => {
    if (isAuthenticated && (currentSection === 'orders' || currentSection === 'dashboard')) {
      fetchOrders(ordersPage, ordersFilterStatus, ordersSearch);
    }
    if (isAuthenticated && currentSection === 'dashboard') {
      fetchDashboardStats();
    }
  }, [isAuthenticated, currentSection]);

  // Logout handler
  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {}
    setIsAuthenticated(false);
    showToast('Logged out successfully', 'info');
    navigate('/admin/login');
  };

  // Section navigation
  const handleSelectSection = (section: AdminSection) => {
    setActiveEditingBook(null);
    if (section === 'dashboard') {
      navigate('/admin');
    } else if (section === 'reorder') {
      navigate('/admin/products/reorder');
    } else {
      navigate(`/admin/${section}`);
    }
  };

  // Loading state while checking session
  if (isCheckingAuth) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-3 bg-slate-50">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        <p className="text-xs font-semibold text-slate-500">Verifying admin session credentials...</p>
      </div>
    );
  }

  // If not authenticated, render Login view
  if (!isAuthenticated) {
    return (
      <AdminLogin
        onLoginSuccess={() => {
          setIsAuthenticated(true);
          refreshProductsFromCloud();
          if (location.pathname === '/admin/login') {
            navigate('/admin');
          }
        }}
        showToast={showToast}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-['DM_Sans',sans-serif] flex">
      {/* Reusable Sidebar */}
      <AdminSidebar
        currentSection={currentSection}
        onSelectSection={handleSelectSection}
        isOpenMobile={isOpenMobile}
        onCloseMobile={() => setIsOpenMobile(false)}
        productsCount={books.length}
        ordersCount={ordersPagination.total}
      />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header */}
        <AdminHeader
          currentSection={currentSection}
          onOpenMobileSidebar={() => setIsOpenMobile(true)}
          onLogout={handleLogout}
          isCloudSyncing={isCloudSyncing}
          lastCloudSync={lastCloudSync}
          onRefreshCloud={refreshProductsFromCloud}
        />

        {/* Section View Container */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {/* DASHBOARD */}
          {currentSection === 'dashboard' && (
            <AdminDashboard
              books={books}
              serverOrders={serverOrders}
              ordersTotal={ordersPagination.total}
              ordersLoading={ordersLoading}
              dashboardStats={dashboardStats}
              onNavigateSection={handleSelectSection}
              onOpenNewProduct={() => {
                handleSelectSection('products');
                setActiveEditingBook('new');
              }}
              onRefreshOrders={() => { fetchOrders(1, ordersFilterStatus, ordersSearch); fetchDashboardStats(); }}
            />
          )}

          {/* PRODUCTS (List or Editor) */}
          {currentSection === 'products' && (
            activeEditingBook ? (
              <ProductEditor
                initialBook={activeEditingBook === 'new' ? null : activeEditingBook}
                onSave={(bookData, id) => {
                  if (id) {
                    updateBook(id, bookData);
                  } else {
                    const newId = `book_${Date.now()}`;
                    addBook({ id: newId, ...bookData });
                  }
                  setActiveEditingBook(null);
                }}
                onCancel={() => setActiveEditingBook(null)}
                showToast={showToast}
                openPdfViewer={openPdfViewer}
              />
            ) : (
              <ProductsPage
                books={books}
                onOpenNewProduct={() => setActiveEditingBook('new')}
                onOpenEditProduct={(book) => setActiveEditingBook(book)}
                onDeleteProduct={(id) => deleteBook(id)}
                onNavigateToReorder={() => handleSelectSection('reorder')}
                showToast={showToast}
              />
            )
          )}

          {/* REORDER */}
          {currentSection === 'reorder' && (
            <ProductReorder
              books={books}
              onReorderBooks={(reordered) => reorderBooks(reordered)}
              onBack={() => handleSelectSection('products')}
              showToast={showToast}
            />
          )}

          {/* ORDERS */}
          {currentSection === 'orders' && (
            <OrdersPage
              orders={serverOrders}
              isLoading={ordersLoading}
              pagination={ordersPagination}
              filterStatus={ordersFilterStatus}
              onFilterStatusChange={(status) => {
                setOrdersFilterStatus(status);
                setOrdersSearch('');
                fetchOrders(1, status, '');
              }}
              onPageChange={(page) => fetchOrders(page, ordersFilterStatus, ordersSearch)}
              onRefresh={() => fetchOrders(ordersPage, ordersFilterStatus, ordersSearch)}
              onSearch={(search) => {
                setOrdersSearch(search);
                fetchOrders(1, ordersFilterStatus, search);
              }}
            />
          )}

          {/* REVIEWS */}
          {currentSection === 'reviews' && (
            <ReviewsPage
              books={books}
              onAddReview={(bookId, review) => addReview(bookId, review)}
              onUpdateBook={(bookId, updated) => updateBook(bookId, updated)}
              showToast={showToast}
            />
          )}

          {/* TESTIMONIALS */}
          {currentSection === 'testimonials' && (
            <TestimonialsPage
              testimonials={testimonials}
              onAddTestimonial={(t) => addTestimonial(t)}
              onUpdateTestimonial={(id, updated) => updateTestimonial(id, updated)}
              onDeleteTestimonial={(id) => deleteTestimonial(id)}
              onResetDefaults={resetTestimonialsToDefault}
              showToast={showToast}
            />
          )}

          {/* CATEGORIES */}
          {currentSection === 'categories' && (
            <CategoriesPage
              examPaths={examPaths}
              onUpdateExamPath={(cat, updated) => updateExamPath(cat, updated)}
              onResetDefaults={resetExamPathsToDefault}
              showToast={showToast}
            />
          )}

          {/* OFFERS & COUPONS */}
          {currentSection === 'offers' && (
            <OffersPage showToast={showToast} />
          )}

          {/* MEDIA & ASSETS */}
          {currentSection === 'media' && (
            <MediaPage
              books={books}
              testimonials={testimonials}
              examPaths={examPaths}
              showToast={showToast}
            />
          )}

          {/* SETTINGS */}
          {currentSection === 'settings' && (
            <SettingsPage
              isCloudSyncing={isCloudSyncing}
              lastCloudSync={lastCloudSync}
              onRefreshCloud={refreshProductsFromCloud}
              onSyncToCloud={async () => { await syncBooksToCloud(); }}
              onResetCatalog={resetBooksToDefault}
              showToast={showToast}
            />
          )}
        </main>
      </div>
    </div>
  );
};
