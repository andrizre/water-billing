import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'esnext',
    cssMinify: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) {
              return 'icons-vendor';
            }
            if (id.includes('@supabase')) {
              return 'supabase-vendor';
            }
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/react-router') ||
              id.includes('/scheduler/') ||
              id.includes('\\react\\') ||
              id.includes('\\react-dom\\') ||
              id.includes('\\react-router') ||
              id.includes('\\scheduler\\')
            ) {
              return 'react-core';
            }
            return 'vendor';
          }
        }
      }
    }
  }
});
