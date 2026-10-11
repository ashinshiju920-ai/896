import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Book, BookFormat, CartItem, Order, ShippingInfo, ExamCategory, ViewType, Review, Testimonial, ExamPath, Customer, CatalogBannerConfig, HomeSpotlightConfig } from '../types';
import { BOOKS } from '../data/books';

import { TESTIMONIALS } from '../data/testimonials';
import { DEFAULT_EXAM_PATHS } from '../data/examPaths';
import { DEFAULT_CATALOG_BANNER } from '../data/catalogBanner';
import { DEFAULT_HOME_SPOTLIGHT } from '../data/homeSpotlight';
import {
  saveCatalogToCloud,
  fetchCatalogFromCloud,
  checkCatalogVersion,
  subscribeToRealtimeBroadcast,
  broadcastLocalUpdate,
} from '../utils/cloudSync';
import {
  getBookAddons,
  calculateAddonsPricing,
  getCartLineKey,
  calculateDisplayPrice,
  getSelectableAddons,
  validateAndReconcileCart,
} from '../utils/pricing';
import { trackAddToCart, pushAddToCartEvent } from '../utils/analytics';
import { STUDENT_PORTAL_URL } from '../utils/cashfree';

interface Toast {
  id: string;
  message: string;
  type?: 'success' | 'info' | 'warning';
}

interface ShopContextType {
  // Navigation
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  selectedCategory: ExamCategory;
  setSelectedCategory: (cat: ExamCategory) => void;
  selectedBookId: string;
  setSelectedBookId: (id: string) => void;
  checkoutStep: 1 | 2 | 3;
  setCheckoutStep: (step: 1 | 2 | 3) => void;

  // Products & Books Catalog
  books: Book[];
  addBook: (book: Book) => Promise<boolean>;
  updateBook: (id: string, updated: Partial<Book>) => Promise<boolean>;
  deleteBook: (id: string) => Promise<boolean>;
  resetBooksToDefault: () => Promise<boolean>;
  reorderBooks: (orderedBooks: Book[]) => Promise<boolean>;
  moveBookOrder: (bookId: string, direction: 'up' | 'down') => Promise<boolean>;
  setBookOrderPosition: (bookId: string, targetPosition: number) => Promise<boolean>;
  setPaperbackGlobally: (enable: boolean) => Promise<boolean>;

  // Real-time Cloud Synchronization
  isCloudSyncing: boolean;
  isCatalogReady: boolean;
  lastCloudSync: Date | null;
  refreshProductsFromCloud: (force?: boolean) => Promise<Book[] | null>;
  syncBooksToCloud: (booksToSync?: Book[]) => Promise<{ success: boolean; error?: string }>;

  // Exam Paths (Image 1 - Hero & Homepage Category Cards)
  examPaths: ExamPath[];
  updateExamPath: (category: ExamCategory, updated: Partial<ExamPath>) => Promise<boolean>;
  deleteExamPath: (category: ExamCategory) => Promise<boolean>;
  resetExamPathsToDefault: () => Promise<boolean>;

  // Catalog Hero Banner (Customizable Background Images & Text Colors)
  catalogBanner: CatalogBannerConfig;
  updateCatalogBanner: (updated: Partial<CatalogBannerConfig>) => Promise<boolean>;
  resetCatalogBannerToDefault: () => Promise<boolean>;
  homeSpotlight: HomeSpotlightConfig;
  updateHomeSpotlight: (updated: Partial<HomeSpotlightConfig>) => Promise<boolean>;
  resetHomeSpotlightToDefault: () => Promise<boolean>;


  // Testimonials & Reviews (Image 2 - Learner Avatars & Quotes)
  testimonials: Testimonial[];
  addTestimonial: (testimonial: Omit<Testimonial, 'id'>) => Promise<boolean>;
  updateTestimonial: (id: string, updated: Partial<Testimonial>) => Promise<boolean>;
  deleteTestimonial: (id: string) => Promise<boolean>;
  resetTestimonialsToDefault: () => Promise<boolean>;
  addReview: (bookId: string, review: Omit<Review, 'id' | 'date'>) => Promise<boolean>;

  // Cart
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  pruneInvalidAddon: (badAddonId: string) => void;
  addToCart: (book: Book, format?: BookFormat, quantity?: number, selectedAddonIds?: string[]) => void;
  buyNow: (book: Book, format?: BookFormat, quantity?: number, selectedAddonIds?: string[]) => void;
  updateCartQty: (bookId: string, format: BookFormat, delta: number, selectedAddonIds?: string[]) => void;
  removeFromCart: (bookId: string, format: BookFormat, selectedAddonIds?: string[]) => void;
  clearCart: () => void;
  reconcileCartWithCatalog: (customCatalog?: Book[]) => { changed: boolean; removedCount: number; error?: string };
  cartCount: number;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;

  // Coupon
  couponCode: string;
  appliedCoupon: string | null;
  couponDiscount: number;
  applyCoupon: (code: string, estimatedDiscount?: number) => boolean;
  removeCoupon: () => void;

  // Wishlist
  wishlist: string[];
  toggleWishlist: (bookId: string) => void;
  isInWishlist: (bookId: string) => boolean;

  // Shipping & Orders
  shippingInfo: ShippingInfo;
  setShippingInfo: React.Dispatch<React.SetStateAction<ShippingInfo>>;
  currentOrder: Order | null;
  setCurrentOrder: React.Dispatch<React.SetStateAction<Order | null>>;
  orders: Order[];
  placeOrder: (paymentMethod: 'upi' | 'card' | 'netbanking' | 'wallets') => Promise<Order>;

  // Search & Modals
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // PDF Preview & Reader
  isPdfModalOpen: boolean;
  activePdfBook: Book | null;
  openPdfViewer: (book: Book) => void;
  closePdfViewer: () => void;
  downloadBookPdf: (book: Book, orderId?: string) => Promise<void>;

  // Support / Contact Modal
  isContactModalOpen: boolean;
  setIsContactModalOpen: (open: boolean) => void;

  // Toasts
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'info' | 'warning') => void;

  // Customer Authentication & Account (Phase 7)
  currentCustomer: Customer | null;
  isCustomerLoading: boolean;
  checkCustomerSession: () => Promise<Customer | null>;
  logoutCustomer: () => Promise<void>;
  setCurrentCustomer: React.Dispatch<React.SetStateAction<Customer | null>>;

  // Helpers
  navigateToProduct: (bookId: string) => void;
  navigateToCatalog: (category?: ExamCategory) => void;
  openCart: () => void;
}

const defaultShipping: ShippingInfo = {
  fullName: '',
  email: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  pinCode: '',
  deliveryOption: 'digital',
  saveAddress: false,
};

const ShopContext = createContext<ShopContextType | undefined>(undefined);

const mergeWithBuiltInBooks = (sourceBooks: Book[]): Book[] => {
  const sourceIds = new Set(sourceBooks.map((book) => book.id));
  return [
    ...sourceBooks,
    ...BOOKS.filter((book) => !sourceIds.has(book.id)),
  ];
};

export const ShopProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Derive currentView reactively from the URL pathname
  const currentView: ViewType = useMemo(() => {
    const p = location.pathname;
    if (p === '/' || p === '') return 'home';
    if (p === '/books' || p === '/catalog') return 'catalog';
    if (p.startsWith('/books/') || p.startsWith('/product')) return 'product';
    if (p === '/cart') return 'cart';
    if (p === '/checkout') return 'checkout';
    if (p === '/order-success') return 'order-success';
    if (p === '/my-materials') return 'my-materials';
    if (p === '/orders') return 'orders';
    if (p === '/about') return 'about';
    if (p === '/blog' || p.startsWith('/blog/')) return 'blog';
    if (p === '/login') return 'login';
    if (p === '/account') return 'account';
    if (p.startsWith('/admin')) return 'admin';
    return 'home';
  }, [location.pathname]);

  const [selectedCategory, setSelectedCategory] = useState<ExamCategory>('All');
  const [selectedBookId, setSelectedBookId] = useState<string>('ielts-full-prep');
  const [checkoutStep, setCheckoutStep] = useState<1 | 2 | 3>(1);

  // Sync selectedBookId from URL if user lands on /books/:slug
  useEffect(() => {
    if (location.pathname.startsWith('/books/')) {
      const slug = decodeURIComponent(location.pathname.replace('/books/', '').split('/')[0]);
      if (slug) {
        setSelectedBookId(slug);
      }
    }
  }, [location.pathname]);

  // Persistent Books State
  const [books, setBooks] = useState<Book[]>(() => {
    try {
      const saved = localStorage.getItem('xylem_books_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return mergeWithBuiltInBooks(parsed);
      }
    } catch (e) {
      console.error('Failed to load books from storage:', e);
    }
    return BOOKS;
  });

  useEffect(() => {
    try {
      localStorage.setItem('xylem_books_data', JSON.stringify(books));
    } catch (e) {
      console.error('Failed to save books to storage:', e);
    }
  }, [books]);

  // Persistent Exam Paths State (Image 1 - IELTS, OET, PTE, German)
  const [examPaths, setExamPaths] = useState<ExamPath[]>(() => {
    try {
      const saved = localStorage.getItem('xylem_exam_paths_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load exam paths from storage:', e);
    }
    return DEFAULT_EXAM_PATHS;
  });

  // Persistent Testimonials State (Cached from server or TESTIMONIALS seed)
  const [testimonials, setTestimonials] = useState<Testimonial[]>(() => {
    try {
      const saved = localStorage.getItem('xylem_testimonials_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load testimonials from storage:', e);
    }
    return TESTIMONIALS;
  });

  // Persistent Catalog Hero Banner State (Fully customizable images & colors)
  const [catalogBanner, setCatalogBanner] = useState<CatalogBannerConfig>(() => {
    try {
      const saved = localStorage.getItem('xylem_catalog_banner_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return { ...DEFAULT_CATALOG_BANNER, ...parsed };
        }
      }
    } catch (e) {
      console.error('Failed to load catalog banner from storage:', e);
    }
    return DEFAULT_CATALOG_BANNER;
  });

  const [homeSpotlight, setHomeSpotlight] = useState<HomeSpotlightConfig>(() => {
    try {
      const saved = localStorage.getItem('xylem_home_spotlight_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return { ...DEFAULT_HOME_SPOTLIGHT, ...parsed };
        }
      }
    } catch (e) {
      console.error('Failed to load home spotlight from storage:', e);
    }
    return DEFAULT_HOME_SPOTLIGHT;
  });

  // Real-time Cloud Synchronization State
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  // A persisted catalog is only a cache. Checkout waits for the first no-cache
  // server catalog fetch before it renders purchasable cart content.
  const [isCatalogReady, setIsCatalogReady] = useState<boolean>(false);
  const [lastCloudSync, setLastCloudSync] = useState<Date | null>(null);
  const localCatalogVersionRef = useRef<number>(0);
  const isFetchingRemoteRef = useRef<boolean>(false);

  useEffect(() => {
    try {
      let savedVersion = Number(localStorage.getItem('xylem_books_version'));
      if (savedVersion) {
        // Guard against any millisecond timestamps stored by legacy code
        if (savedVersion > 20000000000) savedVersion = Math.floor(savedVersion / 1000);
        localCatalogVersionRef.current = savedVersion;
      }
    } catch {}
  }, []);

  const triggerCloudSync = async (
    booksToSync: Book[],
    pathsToSync?: ExamPath[],
    testisToSync?: Testimonial[],
    bannerToSync?: CatalogBannerConfig,
    spotlightToSync?: HomeSpotlightConfig
  ): Promise<{
    success: boolean;
    version?: number;
    books?: Book[];
    examPaths?: ExamPath[];
    testimonials?: Testimonial[];
    catalogBanner?: CatalogBannerConfig;
    homeSpotlight?: HomeSpotlightConfig;
    error?: string;
  }> => {
    setIsCloudSyncing(true);
    try {
      const paths = pathsToSync !== undefined ? pathsToSync : examPaths;
      const testis = testisToSync !== undefined ? testisToSync : testimonials;
      const banner = bannerToSync !== undefined ? bannerToSync : catalogBanner;
      const spotlight = spotlightToSync !== undefined ? spotlightToSync : homeSpotlight;
      const res = await saveCatalogToCloud(booksToSync, paths, testis, banner, spotlight);
      if (res.success) {
        if (res.version) localCatalogVersionRef.current = res.version;
        setLastCloudSync(new Date());
        return {
          success: true,
          version: res.version,
          books: res.books,
          examPaths: res.examPaths,
          testimonials: res.testimonials,
          catalogBanner: res.catalogBanner,
          homeSpotlight: res.homeSpotlight,
        };
      } else {
        return { success: false, error: res.error };
      }
    } catch (e: any) {
      console.error('Real-time sync to cloud failed:', e);
      return { success: false, error: e?.message || 'Sync failed' };
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const syncBooksToCloud = async (customBooks?: Book[]) => {
    return triggerCloudSync(customBooks || books);
  };


  const refreshProductsFromCloud = async (force = false): Promise<Book[] | null> => {
    if (isFetchingRemoteRef.current && !force) return null;
    isFetchingRemoteRef.current = true;
    try {
      // 1. Fast version check first (skips large payload if nothing changed)
      if (!force) {
        const latestVersion = await checkCatalogVersion();
        if (latestVersion !== null && latestVersion <= localCatalogVersionRef.current) {
          isFetchingRemoteRef.current = false;
          return books;
        }
      }

      // 2. Fetch full updated catalog
      const remote = await fetchCatalogFromCloud();
      if (remote && Array.isArray(remote.books) && remote.books.length > 0) {
        const remoteVersion = Number(remote.version) || Math.floor(Date.now() / 1000);
        const mergedBooks = mergeWithBuiltInBooks(remote.books);
        if (force || remoteVersion > localCatalogVersionRef.current) {
          localCatalogVersionRef.current = remoteVersion;
          setBooks(mergedBooks);
          if (Array.isArray(remote.examPaths)) {
            setExamPaths(remote.examPaths);
            try {
              localStorage.setItem('xylem_exam_paths_data', JSON.stringify(remote.examPaths));
            } catch {}
          }
          if (Array.isArray(remote.testimonials)) {
            setTestimonials(remote.testimonials);
            try {
              localStorage.setItem('xylem_testimonials_data', JSON.stringify(remote.testimonials));
            } catch {}
          }
          if (remote.catalogBanner && typeof remote.catalogBanner === 'object') {
            const merged = { ...DEFAULT_CATALOG_BANNER, ...remote.catalogBanner };
            setCatalogBanner(merged);
            try {
              localStorage.setItem('xylem_catalog_banner_data', JSON.stringify(merged));
            } catch {}
          }
          if (remote.homeSpotlight && typeof remote.homeSpotlight === 'object') {
            const merged = { ...DEFAULT_HOME_SPOTLIGHT, ...remote.homeSpotlight };
            setHomeSpotlight(merged);
            try {
              localStorage.setItem('xylem_home_spotlight_data', JSON.stringify(merged));
            } catch {}
          }
          setLastCloudSync(new Date());
          try {
            localStorage.setItem('xylem_books_data', JSON.stringify(mergedBooks));
            localStorage.setItem('xylem_books_version', String(remoteVersion));
          } catch {}
        }
        return mergedBooks;
      }
      return null;
    } catch (err) {
      console.warn('Real-time background sync fetch error:', err);
      return null;
    } finally {
      isFetchingRemoteRef.current = false;
    }
  };

  // Real-time synchronization listeners:
  // - Immediate force fetch on mount
  // - 1.5-second ultra-responsive version check poller
  // - Instant cross-tab BroadcastChannel & Storage events (0ms latency)
  // - Immediate check on tab focus & visibility change
  // - User interaction wakeup (click / touch)
  useEffect(() => {
    let active = true;
    refreshProductsFromCloud(true).finally(() => {
      if (active) setIsCatalogReady(true);
    });

    const unsubscribe = subscribeToRealtimeBroadcast((newBooks, version, newPaths, newTestis, newBanner, newSpotlight) => {
      const mergedBooks = mergeWithBuiltInBooks(newBooks);
      localCatalogVersionRef.current = version;
      setBooks(mergedBooks);
      if (newPaths && Array.isArray(newPaths)) {
        setExamPaths(newPaths);
      }
      if (newTestis && Array.isArray(newTestis)) {
        setTestimonials(newTestis);
      }
      if (newBanner && typeof newBanner === 'object') {
        setCatalogBanner({ ...DEFAULT_CATALOG_BANNER, ...newBanner });
      }
      if (newSpotlight && typeof newSpotlight === 'object') {
        setHomeSpotlight({ ...DEFAULT_HOME_SPOTLIGHT, ...newSpotlight });
      }
      setLastCloudSync(new Date());
    });


    // Fast 1.5s real-time check interval
    const interval = setInterval(() => {
      refreshProductsFromCloud(false);
    }, 1500);

    const onWakeup = () => {
      refreshProductsFromCloud(false);
    };

    window.addEventListener('focus', onWakeup);
    document.addEventListener('visibilitychange', onWakeup);

    // Throttled check on user click or touch
    let lastInteractionTime = 0;
    const onUserInteraction = () => {
      const now = Date.now();
      if (now - lastInteractionTime > 3000) {
        lastInteractionTime = now;
        refreshProductsFromCloud(false);
      }
    };
    window.addEventListener('pointerdown', onUserInteraction, { passive: true });

    return () => {
      active = false;
      unsubscribe();
      clearInterval(interval);
      window.removeEventListener('focus', onWakeup);
      document.removeEventListener('visibilitychange', onWakeup);
      window.removeEventListener('pointerdown', onUserInteraction);
    };
  }, []);

  // Cart state: brand new visitors start with an empty cart []
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('xylem_cart_items');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hydratedCart = parsed.map((item: any) => ({
            ...item,
            selectedAddonIds: Array.isArray(item.selectedAddonIds) ? item.selectedAddonIds : [],
            selectedAddons: Array.isArray(item.selectedAddons) ? item.selectedAddons : [],
          }));
          // Cart storage is an intent only. Never hydrate its saved product, add-on,
          // or price snapshots into the live UI without resolving them against the
          // catalog currently available to this session.
          return validateAndReconcileCart(hydratedCart, books).reconciledCart;
        }
      }
    } catch (e) {
      console.error('Failed to load cart from storage:', e);
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('xylem_cart_items', JSON.stringify(cart));
    } catch (e) {
      console.error('Failed to save cart to storage:', e);
    }
  }, [cart]);

  const [wishlist, setWishlist] = useState<string[]>([]);
  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>(() => {
    try {
      const saved = localStorage.getItem('xylem_saved_shipping');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          // Guard against legacy dummy customer data
          if (parsed.fullName === 'Ashin Shiju' || parsed.email === 'ashin.shiju@example.com') {
            return defaultShipping;
          }
          return { ...defaultShipping, ...parsed };
        }
      }
    } catch (e) {
      console.error('Failed to load shipping info from storage:', e);
    }
    return defaultShipping;
  });

  useEffect(() => {
    try {
      if (shippingInfo.saveAddress && (shippingInfo.fullName || shippingInfo.email || shippingInfo.phone)) {
        localStorage.setItem('xylem_saved_shipping', JSON.stringify(shippingInfo));
      }
    } catch (e) {
      console.error('Failed to save shipping info to storage:', e);
    }
  }, [shippingInfo]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState<number>(0);

  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('xylem_orders_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to load orders from storage:', e);
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('xylem_orders_history', JSON.stringify(orders));
    } catch (e) {
      console.error('Failed to save orders to storage:', e);
    }
  }, [orders]);

  const [currentOrder, setCurrentOrderState] = useState<Order | null>(() => {
    try {
      const saved = sessionStorage.getItem('xylem_current_order');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load current order from session:', e);
    }
    return null;
  });

  const setCurrentOrder: React.Dispatch<React.SetStateAction<Order | null>> = useCallback((action) => {
    setCurrentOrderState((prev) => {
      const next = typeof action === 'function' ? (action as (prevState: Order | null) => Order | null)(prev) : action;
      try {
        if (next) {
          sessionStorage.setItem('xylem_current_order', JSON.stringify(next));
          setOrders((currentOrders) => {
            if (currentOrders.some((o) => o.id === next.id)) return currentOrders;
            return [next, ...currentOrders];
          });
        } else {
          sessionStorage.removeItem('xylem_current_order');
        }
      } catch (e) {
        console.error('Failed to sync current order to session:', e);
      }
      return next;
    });
  }, []);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [activePdfBook, setActivePdfBook] = useState<Book | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const activeToastMessagesRef = useRef<Set<string>>(new Set());

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'warning' = 'success') => {
    if (!message || !message.trim()) return;
    const cleanMsg = message.trim();
    if (activeToastMessagesRef.current.has(cleanMsg)) {
      return; // Deduplicate: do not show identical toast while already visible
    }
    activeToastMessagesRef.current.add(cleanMsg);
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => {
      if (prev.some((t) => t.message === cleanMsg)) return prev;
      return [...prev, { id, message: cleanMsg, type }];
    });
    setTimeout(() => {
      activeToastMessagesRef.current.delete(cleanMsg);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  // Customer Authentication State (Phase 7)
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
  const [isCustomerLoading, setIsCustomerLoading] = useState<boolean>(true);

  // Centralized session check (optimizes Free plan by avoiding duplicate requests)
  const checkCustomerSession = useCallback(async (): Promise<Customer | null> => {
    try {
      const res = await fetch('/api/customer/session');
      if (res.ok) {
        const data = await res.json();
        if (data && data.authenticated && data.customer) {
          setCurrentCustomer(data.customer);
          return data.customer;
        }
      }
      setCurrentCustomer(null);
      return null;
    } catch {
      setCurrentCustomer(null);
      return null;
    } finally {
      setIsCustomerLoading(false);
    }
  }, []);

  const logoutCustomer = useCallback(async () => {
    try {
      await fetch('/api/customer/logout', { method: 'POST' });
    } catch {}
    setCurrentCustomer(null);
    showToast('Signed out of your account.', 'info');
    navigate('/');
  }, [navigate]);

  // Initial check on mount only - NO polling loops
  useEffect(() => {
    checkCustomerSession();
  }, [checkCustomerSession]);

  // Scroll to top on view changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentView, selectedBookId, selectedCategory]);

  // Reconcile cart with catalog on demand or after changes
  const reconcileCartWithCatalog = useCallback((catalogToCheck?: Book[]) => {
    const targetCatalog = (catalogToCheck && catalogToCheck.length > 0) ? catalogToCheck : books;
    if (!targetCatalog || targetCatalog.length === 0) return { changed: false, removedCount: 0 };

    const result = validateAndReconcileCart(cart, targetCatalog);
    if (result.hasChanges) {
      setCart(result.reconciledCart);
      if (result.errorMessage) showToast(result.errorMessage, 'warning');
    }

    return {
      changed: result.hasChanges,
      removedCount: result.removedItems.length,
      error: result.errorMessage,
    };
  }, [books, cart, showToast]);

  // Prune a specific invalid/unknown add-on ID from the cart immediately
  const pruneInvalidAddon = useCallback((badAddonId: string) => {
    if (!badAddonId) return;
    setCart((prevCart) => {
      const nextCart = prevCart.map((item) => {
        const currentAddonIds = Array.isArray(item.selectedAddonIds) ? item.selectedAddonIds : [];
        if (currentAddonIds.includes(badAddonId)) {
          const prunedIds = currentAddonIds.filter((id) => id !== badAddonId);
          const targetBook = item.book || books.find((b) => b.id === (item.bookId || item.book?.id));
          const displayCalc = calculateDisplayPrice(
            targetBook,
            item.format || 'digital',
            prunedIds
          );
          return {
            ...item,
            price: displayCalc.totalPrice,
            originalPrice: displayCalc.totalOriginalPrice,
            selectedAddonIds: prunedIds,
            selectedAddons: displayCalc.selectedAddons,
          };
        }
        return item;
      });
      try {
        localStorage.setItem('xylem_cart_items', JSON.stringify(nextCart));
      } catch {}
      return nextCart;
    });
  }, [books]);

  // Automatically reconcile cart whenever the catalog updates
  useEffect(() => {
    if (books && books.length > 0 && cart.length > 0) {
      reconcileCartWithCatalog(books);
    }
  }, [books, cart, reconcileCartWithCatalog]);

  const addToCart = (
    book: Book,
    format: BookFormat = 'digital',
    quantity = 1,
    selectedAddonIds: string[] = []
  ) => {
    const targetBook = books.find((b) => b.id === book.id) || book;
    const safeSelectedIds = Array.from(
      new Set(Array.isArray(selectedAddonIds) ? selectedAddonIds.filter(Boolean).map(String) : [])
    );
    trackAddToCart(targetBook.id, safeSelectedIds);
    const displayCalc = calculateDisplayPrice(targetBook, format, safeSelectedIds);
    pushAddToCartEvent(targetBook, format, quantity, displayCalc.selectedAddons);
    const effectiveFormat: BookFormat =
      format === 'physical' || displayCalc.selectedAddons.some((a) => a.deliveryOption === 'physical')
        ? 'physical'
        : 'digital';

    const cartItem: CartItem = {
      bookId: targetBook.id,
      book: targetBook,
      format: effectiveFormat,
      quantity,
      price: displayCalc.totalPrice,
      originalPrice: displayCalc.totalOriginalPrice,
      selectedAddonIds: safeSelectedIds,
      selectedAddons: displayCalc.selectedAddons,
    };

    const targetKey = getCartLineKey(targetBook.id, effectiveFormat, safeSelectedIds);

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => {
        return getCartLineKey(item.bookId, item.format, item.selectedAddonIds) === targetKey;
      });

      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        return updated;
      }
      return [...prev, cartItem];
    });

    const addOnsNote = displayCalc.selectedAddons.length > 0
      ? ` with ${displayCalc.selectedAddons.length} optional material${displayCalc.selectedAddons.length > 1 ? 's' : ''}`
      : '';
    showToast(`Added "${targetBook.title}"${addOnsNote} to cart!`, 'success');
  };

  const buyNow = (
    book: Book,
    format: BookFormat = 'digital',
    quantity = 1,
    selectedAddonIds: string[] = []
  ) => {
    const targetBook = books.find((b) => b.id === book.id) || book;
    const safeSelectedIds = Array.from(
      new Set(Array.isArray(selectedAddonIds) ? selectedAddonIds.filter(Boolean).map(String) : [])
    );
    const displayCalc = calculateDisplayPrice(targetBook, format, safeSelectedIds);
    pushAddToCartEvent(targetBook, format, quantity, displayCalc.selectedAddons);
    const effectiveFormat: BookFormat =
      format === 'physical' || displayCalc.selectedAddons.some((a) => a.deliveryOption === 'physical')
        ? 'physical'
        : 'digital';

    setCart([
      {
        bookId: targetBook.id,
        book: targetBook,
        format: effectiveFormat,
        quantity,
        price: displayCalc.totalPrice,
        originalPrice: displayCalc.totalOriginalPrice,
        selectedAddonIds: safeSelectedIds,
        selectedAddons: displayCalc.selectedAddons,
      },
    ]);
    setCheckoutStep(1);
    setCurrentView('checkout');
  };

  const updateCartQty = (
    bookId: string,
    format: BookFormat,
    delta: number,
    selectedAddonIds?: string[]
  ) => {
    const targetKey = selectedAddonIds !== undefined
      ? getCartLineKey(bookId, format, selectedAddonIds)
      : null;

    setCart((prev) =>
      prev
        .map((item) => {
          const match = targetKey
            ? getCartLineKey(item.bookId, item.format, item.selectedAddonIds) === targetKey
            : item.bookId === bookId && item.format === format;
          if (match) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (
    bookId: string,
    format: BookFormat,
    selectedAddonIds?: string[]
  ) => {
    const targetKey = selectedAddonIds !== undefined
      ? getCartLineKey(bookId, format, selectedAddonIds)
      : null;

    setCart((prev) =>
      prev.filter((item) => {
        if (targetKey) {
          return getCartLineKey(item.bookId, item.format, item.selectedAddonIds) !== targetKey;
        }
        return !(item.bookId === bookId && item.format === format);
      })
    );
    showToast('Item removed from cart', 'info');
  };

  const clearCart = () => {
    setCart([]);
  };

  const toggleWishlist = (bookId: string) => {
    setWishlist((prev) => {
      const exists = prev.includes(bookId);
      if (exists) {
        showToast('Removed from your wishlist', 'info');
        return prev.filter((id) => id !== bookId);
      } else {
        showToast('Saved to your wishlist!', 'success');
        return [...prev, bookId];
      }
    });
  };

  const isInWishlist = (bookId: string) => wishlist.includes(bookId);

  // Calculations
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Check if any physical book or add-on in cart
  const hasPhysicalItem = cart.some(
    (item) =>
      item.format === 'physical' ||
      (Array.isArray(item.selectedAddons) && item.selectedAddons.some((a) => a.deliveryOption === 'physical'))
  );
  const deliveryFee = hasPhysicalItem ? 99 : 0;

  // Keep shippingInfo.deliveryOption synchronized with cart contents
  useEffect(() => {
    const targetOption = hasPhysicalItem ? 'physical' : 'digital';
    setShippingInfo((prev) => (prev.deliveryOption !== targetOption ? { ...prev, deliveryOption: targetOption } : prev));
  }, [hasPhysicalItem]);

  // Keep coupon discount synchronized with current subtotal & cart state
  useEffect(() => {
    if (cart.length === 0) {
      if (appliedCoupon !== null) setAppliedCoupon(null);
      if (couponDiscount !== 0) setCouponDiscount(0);
      return;
    }

    if (appliedCoupon) {
      if (appliedCoupon === 'XYLEM20') {
        setCouponDiscount(Math.round(subtotal * 0.2));
      } else if (appliedCoupon === 'FIRST50') {
        setCouponDiscount(Math.min(50, subtotal));
      } else if (appliedCoupon === 'SPECIALOFFER' || appliedCoupon === 'OFFER67') {
        setCouponDiscount(Math.round(subtotal * 0.15));
      } else {
        setCouponDiscount((prev) => Math.min(subtotal, Math.max(0, prev)));
      }
    } else if (couponDiscount !== 0) {
      setCouponDiscount(0);
    }
  }, [cart.length, subtotal, appliedCoupon]);

  const effectiveCouponDiscount = Math.min(subtotal, Math.max(0, couponDiscount));
  const total = Math.max(0, subtotal + deliveryFee - effectiveCouponDiscount);

  // Coupon handling
  const applyCoupon = (code: string, estimatedDiscount?: number): boolean => {
    const clean = code.trim().toUpperCase();
    if (!clean) return false;

    if (estimatedDiscount !== undefined) {
      setAppliedCoupon(clean);
      setCouponDiscount(Math.max(0, Math.min(subtotal, Math.round(estimatedDiscount))));
      return true;
    }

    if (clean === 'XYLEM20') {
      const discountVal = Math.round(subtotal * 0.2);
      setAppliedCoupon('XYLEM20');
      setCouponDiscount(discountVal);
      showToast('Coupon XYLEM20 applied! 20% discount added.');
      return true;
    } else if (clean === 'FIRST50') {
      const discountVal = Math.min(50, subtotal);
      setAppliedCoupon('FIRST50');
      setCouponDiscount(discountVal);
      showToast('Coupon FIRST50 applied! ₹50 off.');
      return true;
    } else if (clean === 'SPECIALOFFER' || clean === 'OFFER67') {
      const discountVal = Math.round(subtotal * 0.15);
      setAppliedCoupon(clean);
      setCouponDiscount(discountVal);
      showToast(`Coupon ${clean} applied!`);
      return true;
    } else {
      setAppliedCoupon(clean);
      setCouponDiscount(0);
      return true;
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    showToast('Coupon removed');
  };

  const placeOrder = async (paymentMethod: 'upi' | 'card' | 'netbanking' | 'wallets'): Promise<Order> => {
    // Generate order
    const orderNumber = `XL${new Date().getFullYear()}${Math.floor(100000 + Math.random() * 900000)}`;
    const newOrder: Order = {
      id: orderNumber,
      date: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      items: [...cart],
      shipping: { ...shippingInfo },
      subtotal,
      discount: couponDiscount,
      deliveryFee,
      total,
      paymentMethod,
      status: 'confirmed',
      paymentId: `PAY_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
    };

    setOrders((prev) => [newOrder, ...prev]);
    setCurrentOrder(newOrder);
    clearCart();
    setAppliedCoupon(null);
    setCouponDiscount(0);
    navigate('/order-success');
    return newOrder;
  };

  const setCurrentView = useCallback((view: ViewType) => {
    switch (view) {
      case 'home':
        navigate('/');
        break;
      case 'catalog':
        navigate('/books');
        break;
      case 'product':
        navigate(selectedBookId ? `/books/${encodeURIComponent(selectedBookId)}` : '/books');
        break;
      case 'cart':
        navigate('/cart');
        break;
      case 'checkout':
        navigate('/checkout');
        break;
      case 'order-success':
        navigate('/order-success');
        break;
      case 'my-materials':
        navigate('/my-materials');
        break;
      case 'orders':
        navigate('/orders');
        break;
      case 'about':
        navigate('/about');
        break;
      case 'login':
        navigate('/login');
        break;
      case 'account':
        navigate('/account');
        break;
      case 'admin':
        navigate('/admin');
        break;
      default:
        navigate('/');
    }
  }, [navigate, selectedBookId]);

  const navigateToProduct = useCallback((bookId: string) => {
    setSelectedBookId(bookId);
    navigate(`/books/${encodeURIComponent(bookId)}`);
  }, [navigate]);

  const navigateToCatalog = useCallback((category: ExamCategory = 'All') => {
    setSelectedCategory(category);
    if (category && category !== 'All') {
      navigate(`/books?category=${encodeURIComponent(category)}`);
    } else {
      navigate('/books');
    }
  }, [navigate]);

  const openCart = useCallback(() => {
    navigate('/cart');
  }, [navigate]);

  const openPdfViewer = (book: Book) => {
    setActivePdfBook(book);
    setIsPdfModalOpen(true);
  };

  const closePdfViewer = () => {
    setIsPdfModalOpen(false);
  };

  const addBook = async (newBook: Book): Promise<boolean> => {
    const updated = [newBook, ...books];
    const res = await triggerCloudSync(updated);
    if (res.success) {
      const confirmedBooks = Array.isArray(res.books) ? res.books : updated;
      setBooks(confirmedBooks);
      try {
        localStorage.setItem('xylem_books_data', JSON.stringify(confirmedBooks));
      } catch {}
      showToast(`Book "${newBook.title}" published & synced live to server!`, 'success');
      return true;
    } else {
      showToast(`Unable to save book: ${res.error || 'Server error'}. Please try again.`, 'warning');
      return false;
    }
  };

  const updateBook = async (id: string, updated: Partial<Book>): Promise<boolean> => {
    const next = books.map((b) => (b.id === id ? { ...b, ...updated } : b));
    const res = await triggerCloudSync(next);
    if (res.success) {
      const confirmedBooks = Array.isArray(res.books) ? res.books : next;
      setBooks(confirmedBooks);
      try {
        localStorage.setItem('xylem_books_data', JSON.stringify(confirmedBooks));
      } catch {}
      showToast('Product updated & synced live to server!', 'success');
      return true;
    } else {
      showToast(`Unable to update product: ${res.error || 'Server error'}. Please try again.`, 'warning');
      return false;
    }
  };

  const deleteBook = async (id: string): Promise<boolean> => {
    const next = books.filter((b) => b.id !== id);
    const res = await triggerCloudSync(next);
    if (res.success) {
      const confirmedBooks = Array.isArray(res.books) ? res.books : next;
      setBooks(confirmedBooks);
      try {
        localStorage.setItem('xylem_books_data', JSON.stringify(confirmedBooks));
      } catch {}
      showToast('Book removed & synced live to server', 'info');
      return true;
    } else {
      showToast(`Unable to delete book: ${res.error || 'Server error'}. Please try again.`, 'warning');
      return false;
    }
  };

  const resetBooksToDefault = async (): Promise<boolean> => {
    const res = await triggerCloudSync(BOOKS, DEFAULT_EXAM_PATHS, TESTIMONIALS);
    if (res.success) {
      const confirmedBooks = Array.isArray(res.books) ? res.books : BOOKS;
      const confirmedTestimonials = Array.isArray(res.testimonials) ? res.testimonials : TESTIMONIALS;
      const confirmedExamPaths = Array.isArray(res.examPaths) ? res.examPaths : DEFAULT_EXAM_PATHS;
      setBooks(confirmedBooks);
      setTestimonials(confirmedTestimonials);
      setExamPaths(confirmedExamPaths);
      try {
        localStorage.setItem('xylem_books_data', JSON.stringify(confirmedBooks));
        localStorage.setItem('xylem_testimonials_data', JSON.stringify(confirmedTestimonials));
        localStorage.setItem('xylem_exam_paths_data', JSON.stringify(confirmedExamPaths));
      } catch {}
      showToast('Catalog restored to default books & synced to server', 'info');
      return true;
    } else {
      showToast(`Unable to reset catalog: ${res.error || 'Server error'}. Please try again.`, 'warning');
      return false;
    }
  };

  const reorderBooks = async (orderedBooks: Book[]): Promise<boolean> => {
    const withOrder = orderedBooks.map((b, i) => ({ ...b, order: i + 1 }));
    const res = await triggerCloudSync(withOrder);
    if (res.success) {
      const confirmedBooks = Array.isArray(res.books) ? res.books : withOrder;
      setBooks(confirmedBooks);
      try {
        localStorage.setItem('xylem_books_data', JSON.stringify(confirmedBooks));
      } catch {}
      showToast('Product arrangement updated & synced live to server!', 'success');
      return true;
    } else {
      showToast(`Unable to reorder products: ${res.error || 'Server error'}. Please try again.`, 'warning');
      return false;
    }
  };

  const moveBookOrder = async (bookId: string, direction: 'up' | 'down'): Promise<boolean> => {
    const idx = books.findIndex((b) => b.id === bookId);
    if (idx === -1) return false;
    if (direction === 'up' && idx === 0) return false;
    if (direction === 'down' && idx === books.length - 1) return false;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const next = [...books];
    const [moved] = next.splice(idx, 1);
    next.splice(targetIdx, 0, moved);

    const withOrder = next.map((b, i) => ({ ...b, order: i + 1 }));
    const res = await triggerCloudSync(withOrder);
    if (res.success) {
      const confirmedBooks = Array.isArray(res.books) ? res.books : withOrder;
      setBooks(confirmedBooks);
      try {
        localStorage.setItem('xylem_books_data', JSON.stringify(confirmedBooks));
      } catch {}
      showToast('Homepage product position updated & synced to server!', 'success');
      return true;
    } else {
      showToast(`Unable to move product: ${res.error || 'Server error'}. Please try again.`, 'warning');
      return false;
    }
  };

  const setBookOrderPosition = async (bookId: string, targetPosition: number): Promise<boolean> => {
    const idx = books.findIndex((b) => b.id === bookId);
    if (idx === -1) return false;
    const clamped = Math.max(1, Math.min(books.length, targetPosition)) - 1;
    if (clamped === idx) return false;

    const next = [...books];
    const [moved] = next.splice(idx, 1);
    next.splice(clamped, 0, moved);

    const withOrder = next.map((b, i) => ({ ...b, order: i + 1 }));
    const res = await triggerCloudSync(withOrder);
    if (res.success) {
      const confirmedBooks = Array.isArray(res.books) ? res.books : withOrder;
      setBooks(confirmedBooks);
      try {
        localStorage.setItem('xylem_books_data', JSON.stringify(confirmedBooks));
      } catch {}
      showToast(`Product moved to position #${targetPosition} & synced live to server!`, 'success');
      return true;
    } else {
      showToast(`Unable to set position: ${res.error || 'Server error'}. Please try again.`, 'warning');
      return false;
    }
  };

  const setPaperbackGlobally = async (enable: boolean): Promise<boolean> => {
    const updatedBooks = books.map((b) => ({
      ...b,
      disablePaperback: !enable,
    }));
    const res = await triggerCloudSync(updatedBooks);
    if (res.success) {
      const confirmedBooks = Array.isArray(res.books) ? res.books : updatedBooks;
      setBooks(confirmedBooks);
      try {
        localStorage.setItem('xylem_books_data', JSON.stringify(confirmedBooks));
      } catch {}
      const confirmedVer = res.version || Math.floor(Date.now() / 1000);
      broadcastLocalUpdate(confirmedBooks, confirmedVer, examPaths, testimonials, catalogBanner);
      showToast(
        enable
          ? 'Paperback edition re-enabled across all courses!'
          : 'Paperback edition turned OFF for all courses (Digital PDF-only)!',
        'success'
      );
      return true;
    } else {
      showToast(`Failed to update paperback availability: ${res.error || 'Server error'}`, 'warning');
      return false;
    }
  };

  // Exam Paths management (Image 1)

  const updateExamPath = async (category: ExamCategory, updated: Partial<ExamPath>): Promise<boolean> => {
    const exists = examPaths.some((p) => p.category === category);
    const nextPaths = exists
      ? examPaths.map((p) => (p.category === category ? { ...p, ...updated } : p))
      : [
          ...examPaths,
          {
            category,
            title: updated.title || category,
            description: updated.description || '',
            bgImage: updated.bgImage || '/images/exams/ielts.jpg',
            scriptWords: updated.scriptWords || ['Study', 'Prepare', 'Succeed'],
            redirectTarget: updated.redirectTarget || 'catalog',
            arrowColor: updated.arrowColor || '#00a375',
            badgeColor: updated.badgeColor || '#071d36',
            ...updated,
          } as ExamPath,
        ];

    const res = await triggerCloudSync(books, nextPaths, testimonials);
    if (res.success) {
      const confirmedPaths = Array.isArray(res.examPaths) ? res.examPaths : nextPaths;
      setExamPaths(confirmedPaths);
      try {
        localStorage.setItem('xylem_exam_paths_data', JSON.stringify(confirmedPaths));
      } catch {}
      showToast(`Updated ${category} category card! Synced to server.`, 'success');
      return true;
    } else {
      showToast(`Unable to save ${category} category card: ${res.error || 'Server error'}. Please try again.`, 'warning');
      return false;
    }
  };

  const deleteExamPath = async (category: ExamCategory): Promise<boolean> => {
    const nextPaths = examPaths.filter((p) => p.category !== category);
    const res = await triggerCloudSync(books, nextPaths, testimonials);
    if (res.success) {
      const confirmedPaths = Array.isArray(res.examPaths) ? res.examPaths : nextPaths;
      setExamPaths(confirmedPaths);
      try {
        localStorage.setItem('xylem_exam_paths_data', JSON.stringify(confirmedPaths));
      } catch {}
      showToast(`Removed ${category} category card! Synced to server.`, 'info');
      return true;
    } else {
      showToast(`Unable to remove ${category} category card: ${res.error || 'Server error'}.`, 'warning');
      return false;
    }
  };

  const resetExamPathsToDefault = async (): Promise<boolean> => {
    const res = await triggerCloudSync(books, DEFAULT_EXAM_PATHS, testimonials);
    if (res.success) {
      const confirmedPaths = Array.isArray(res.examPaths) ? res.examPaths : DEFAULT_EXAM_PATHS;
      setExamPaths(confirmedPaths);
      try {
        localStorage.setItem('xylem_exam_paths_data', JSON.stringify(confirmedPaths));
      } catch {}
      showToast('Reset homepage exam path cards to default.', 'info');
      return true;
    } else {
      showToast(`Unable to reset exam paths: ${res.error || 'Server error'}. Please try again.`, 'warning');
      return false;
    }
  };

  // Catalog Hero Banner management
  const updateCatalogBanner = async (updated: Partial<CatalogBannerConfig>): Promise<boolean> => {
    const nextBanner: CatalogBannerConfig = {
      ...catalogBanner,
      ...updated,
    };
    setCatalogBanner(nextBanner);
    try {
      localStorage.setItem('xylem_catalog_banner_data', JSON.stringify(nextBanner));
    } catch {}

    const syncRes = await triggerCloudSync(books, examPaths, testimonials, nextBanner);
    if (syncRes.success) {
      const confirmedBanner = syncRes.catalogBanner || nextBanner;
      setCatalogBanner(confirmedBanner);
      try {
        localStorage.setItem('xylem_catalog_banner_data', JSON.stringify(confirmedBanner));
      } catch {}
      const confirmedVer = syncRes.version || Math.floor(Date.now() / 1000);
      broadcastLocalUpdate(books, confirmedVer, examPaths, testimonials, confirmedBanner);
      showToast('Catalog banner updated! Synced in real time.', 'success');
      return true;
    } else {
      showToast(`Unable to sync banner: ${syncRes.error || 'Server error'}. Changes kept locally.`, 'warning');
      return false;
    }
  };

  const resetCatalogBannerToDefault = async (): Promise<boolean> => {
    setCatalogBanner(DEFAULT_CATALOG_BANNER);
    try {
      localStorage.setItem('xylem_catalog_banner_data', JSON.stringify(DEFAULT_CATALOG_BANNER));
    } catch {}
    const syncRes = await triggerCloudSync(books, examPaths, testimonials, DEFAULT_CATALOG_BANNER);
    if (syncRes.success) {
      const confirmedBanner = syncRes.catalogBanner || DEFAULT_CATALOG_BANNER;
      setCatalogBanner(confirmedBanner);
      try {
        localStorage.setItem('xylem_catalog_banner_data', JSON.stringify(confirmedBanner));
      } catch {}
      const confirmedVer = syncRes.version || Math.floor(Date.now() / 1000);
      broadcastLocalUpdate(books, confirmedVer, examPaths, testimonials, confirmedBanner);
      showToast('Reset catalog banner to defaults.', 'info');
      return true;
    } else {
      showToast(`Unable to reset banner: ${syncRes.error || 'Server error'}.`, 'warning');
      return false;
    }
  };

  const updateHomeSpotlight = async (updated: Partial<HomeSpotlightConfig>): Promise<boolean> => {
    const nextSpotlight: HomeSpotlightConfig = {
      ...homeSpotlight,
      ...updated,
    };
    setHomeSpotlight(nextSpotlight);
    try {
      localStorage.setItem('xylem_home_spotlight_data', JSON.stringify(nextSpotlight));
    } catch {}

    const syncRes = await triggerCloudSync(books, examPaths, testimonials, catalogBanner, nextSpotlight);
    if (syncRes.success) {
      const confirmedSpotlight = syncRes.homeSpotlight || nextSpotlight;
      setHomeSpotlight(confirmedSpotlight);
      try {
        localStorage.setItem('xylem_home_spotlight_data', JSON.stringify(confirmedSpotlight));
      } catch {}
      const confirmedVer = syncRes.version || Math.floor(Date.now() / 1000);
      broadcastLocalUpdate(books, confirmedVer, examPaths, testimonials, catalogBanner, confirmedSpotlight);
      showToast('Homepage spotlight updated! Synced in real time.', 'success');
      return true;
    }

    showToast(`Unable to sync spotlight: ${syncRes.error || 'Server error'}. Changes kept locally.`, 'warning');
    return false;
  };

  const resetHomeSpotlightToDefault = async (): Promise<boolean> => {
    setHomeSpotlight(DEFAULT_HOME_SPOTLIGHT);
    try {
      localStorage.setItem('xylem_home_spotlight_data', JSON.stringify(DEFAULT_HOME_SPOTLIGHT));
    } catch {}

    const syncRes = await triggerCloudSync(books, examPaths, testimonials, catalogBanner, DEFAULT_HOME_SPOTLIGHT);
    if (syncRes.success) {
      const confirmedSpotlight = syncRes.homeSpotlight || DEFAULT_HOME_SPOTLIGHT;
      setHomeSpotlight(confirmedSpotlight);
      try {
        localStorage.setItem('xylem_home_spotlight_data', JSON.stringify(confirmedSpotlight));
      } catch {}
      const confirmedVer = syncRes.version || Math.floor(Date.now() / 1000);
      broadcastLocalUpdate(books, confirmedVer, examPaths, testimonials, catalogBanner, confirmedSpotlight);
      showToast('Reset homepage spotlight to defaults.', 'info');
      return true;
    }

    showToast(`Unable to reset spotlight: ${syncRes.error || 'Server error'}.`, 'warning');
    return false;
  };


  // Testimonials management (Image 2)
  const addTestimonial = async (item: Omit<Testimonial, 'id'>): Promise<boolean> => {
    const newTestimonial: Testimonial = {
      ...item,
      id: `test-${Date.now()}`,
    };
    const nextTestis = [newTestimonial, ...testimonials];
    const res = await triggerCloudSync(books, examPaths, nextTestis);
    if (res.success) {
      const confirmedTestimonials = Array.isArray(res.testimonials) ? res.testimonials : nextTestis;
      setTestimonials(confirmedTestimonials);
      try {
        localStorage.setItem('xylem_testimonials_data', JSON.stringify(confirmedTestimonials));
      } catch {}
      showToast('Student testimonial published & synced to server!', 'success');
      return true;
    } else {
      showToast(`Unable to save testimonial: ${res.error || 'Server error'}. Please try again.`, 'warning');
      return false;
    }
  };

  const updateTestimonial = async (id: string, updated: Partial<Testimonial>): Promise<boolean> => {
    const nextTestis = testimonials.map((t) => (t.id === id ? { ...t, ...updated } : t));
    const res = await triggerCloudSync(books, examPaths, nextTestis);
    if (res.success) {
      const confirmedTestimonials = Array.isArray(res.testimonials) ? res.testimonials : nextTestis;
      setTestimonials(confirmedTestimonials);
      try {
        localStorage.setItem('xylem_testimonials_data', JSON.stringify(confirmedTestimonials));
      } catch {}
      showToast('Student testimonial updated & synced to server!', 'success');
      return true;
    } else {
      showToast(`Unable to update testimonial: ${res.error || 'Server error'}. Please try again.`, 'warning');
      return false;
    }
  };

  const deleteTestimonial = async (id: string): Promise<boolean> => {
    const nextTestis = testimonials.filter((t) => t.id !== id);
    const res = await triggerCloudSync(books, examPaths, nextTestis);
    if (res.success) {
      const confirmedTestimonials = Array.isArray(res.testimonials) ? res.testimonials : nextTestis;
      setTestimonials(confirmedTestimonials);
      try {
        localStorage.setItem('xylem_testimonials_data', JSON.stringify(confirmedTestimonials));
      } catch {}
      showToast('Testimonial removed & synced to server', 'info');
      return true;
    } else {
      showToast(`Unable to delete testimonial: ${res.error || 'Server error'}. Please try again.`, 'warning');
      return false;
    }
  };

  const resetTestimonialsToDefault = async (): Promise<boolean> => {
    const res = await triggerCloudSync(books, examPaths, TESTIMONIALS);
    if (res.success) {
      const confirmedTestimonials = Array.isArray(res.testimonials) ? res.testimonials : TESTIMONIALS;
      setTestimonials(confirmedTestimonials);
      try {
        localStorage.setItem('xylem_testimonials_data', JSON.stringify(confirmedTestimonials));
      } catch {}
      showToast('Reset student testimonials to default.', 'info');
      return true;
    } else {
      showToast(`Unable to reset testimonials: ${res.error || 'Server error'}. Please try again.`, 'warning');
      return false;
    }
  };

  const addReview = async (bookId: string, reviewData: Omit<Review, 'id' | 'date'>): Promise<boolean> => {
    const targetBook = books.find((b) => b.id === bookId);
    if (!targetBook) {
      showToast('Unable to add review: product not found.', 'warning');
      return false;
    }

    const newReview: Review = {
      ...reviewData,
      id: `rev-${Date.now()}`,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    };

    const currentReviews = targetBook.reviews || [];
    const updatedReviews = [newReview, ...currentReviews];
    const totalRatingSum = updatedReviews.reduce((sum, r) => sum + r.rating, 0);
    const newAvgRating = Number((totalRatingSum / updatedReviews.length).toFixed(1));

    const saved = await updateBook(bookId, {
      reviews: updatedReviews,
      reviewCount: updatedReviews.length,
      rating: newAvgRating,
    });
    if (saved) {
      showToast('Review submitted, verified, and synced!', 'success');
    }
    return saved;
  };

  const downloadBookPdf = async (_book: Book, _orderId?: string) => {
    showToast('Please access your purchased study materials in the Aylem student portal.', 'info');
    window.location.assign(STUDENT_PORTAL_URL);
  };

  return (
    <ShopContext.Provider
      value={{
        currentView,
        setCurrentView,
        selectedCategory,
        setSelectedCategory,
        selectedBookId,
        setSelectedBookId,
        checkoutStep,
        setCheckoutStep,

        // Catalog & Admin
        books,
        addBook,
        updateBook,
        deleteBook,
        resetBooksToDefault,
        reorderBooks,
        moveBookOrder,
        setBookOrderPosition,
        setPaperbackGlobally,

        // Exam Paths (Image 1)

        examPaths,
        updateExamPath,
        deleteExamPath,
        resetExamPathsToDefault,

        // Catalog Hero Banner
        catalogBanner,
        updateCatalogBanner,
        resetCatalogBannerToDefault,
        homeSpotlight,
        updateHomeSpotlight,
        resetHomeSpotlightToDefault,


        // Testimonials (Image 2)
        testimonials,
        addTestimonial,
        updateTestimonial,
        deleteTestimonial,
        resetTestimonialsToDefault,
        addReview,

        cart,
        setCart,
        pruneInvalidAddon,
        addToCart,
        buyNow,
        updateCartQty,
        removeFromCart,
        clearCart,
        reconcileCartWithCatalog,
        cartCount,
        subtotal,
        discount: couponDiscount,
        deliveryFee,
        total,

        couponCode,
        appliedCoupon,
        couponDiscount,
        applyCoupon,
        removeCoupon,

        wishlist,
        toggleWishlist,
        isInWishlist,

        shippingInfo,
        setShippingInfo,
        currentOrder,
        setCurrentOrder,
        orders,
        placeOrder,

        isSearchOpen,
        setIsSearchOpen,
        searchQuery,
        setSearchQuery,

        isPdfModalOpen,
        activePdfBook,
        openPdfViewer,
        closePdfViewer,
        downloadBookPdf,

        isContactModalOpen,
        setIsContactModalOpen,

        toasts,
        showToast,

        navigateToProduct,
        navigateToCatalog,
        openCart,

        isCloudSyncing,
        isCatalogReady,
        lastCloudSync,
        refreshProductsFromCloud,
        syncBooksToCloud,

        // Customer Authentication & Account (Phase 7)
        currentCustomer,
        isCustomerLoading,
        checkCustomerSession,
        logoutCustomer,
        setCurrentCustomer,
      }}
    >
      {children}
    </ShopContext.Provider>
  );
};

export const useShop = () => {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
};
