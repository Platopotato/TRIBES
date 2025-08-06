import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react'
  },
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Mobile performance optimizations
    rollupOptions: {
      output: {
        // Add timestamp to filenames for cache busting
        entryFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
        chunkFileNames: `assets/[name]-[hash]-${Date.now()}.js`,
        assetFileNames: `assets/[name]-[hash]-${Date.now()}.[ext]`,
        manualChunks: {
          // Separate vendor chunks for better caching
          vendor: ['react', 'react-dom'],
          socketio: ['socket.io-client'],
          shared: ['@radix-tribes/shared']
        }
      }
    },
    // Optimize for mobile networks
    chunkSizeWarningLimit: 1000,
    minify: 'esbuild' // Use esbuild instead of terser for faster builds
  },
  // PWA and mobile optimizations
  define: {
    // Enable PWA features
    __PWA_ENABLED__: true,
    // Mobile-specific feature flags
    __MOBILE_OPTIMIZED__: true
  }
})
