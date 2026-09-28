import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname || '.', '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      // Target modern browsers with better compression support
      target: 'es2020',
      // Minify with esbuild (faster than terser, very effective)
      minify: 'esbuild',
      // Enable CSS code splitting
      cssCodeSplit: true,
      // Increase chunk warning limit slightly (our chunks are justified)
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          // Manual chunk splitting for better caching and parallel loading
          manualChunks(id) {
            // Vendor: React core (tiny, critical path)
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
              return 'react-vendor';
            }
            // Vendor: React Router
            if (id.includes('node_modules/react-router')) {
              return 'router-vendor';
            }
            // Vendor: Lucide icons (large, tree-shake as separate chunk)
            if (id.includes('node_modules/lucide-react')) {
              return 'icons-vendor';
            }
            // Admin section (already lazy-loaded, keep isolated)
            if (id.includes('/src/admin/')) {
              return 'admin-bundle';
            }
            // Checkout and payment flows (rarely needed on first visit)
            if (
              id.includes('/src/views/CheckoutView') ||
              id.includes('/src/views/OrderSuccess') ||
              id.includes('/src/components/CashfreeCheckout') ||
              id.includes('/src/components/CheckoutPage')
            ) {
              return 'checkout-bundle';
            }
            // Account / Materials pages
            if (
              id.includes('/src/views/MyMaterials') ||
              id.includes('/src/views/CustomerAccount') ||
              id.includes('/src/views/OrdersHistory') ||
              id.includes('/src/views/CustomerLogin')
            ) {
              return 'account-bundle';
            }
            // Shared view components (catalog, product detail)
            if (id.includes('/src/views/') || id.includes('/src/components/')) {
              return 'app-views';
            }
          },
          // Predictable, cacheable file names
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
  };
});
