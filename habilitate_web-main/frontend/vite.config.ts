import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom/')) return 'vendor-react';
          if (id.includes('node_modules/react/')) return 'vendor-react';
          if (id.includes('node_modules/react-router')) return 'vendor-react';
          if (id.includes('node_modules/@supabase/')) return 'vendor-supabase';
          if (id.includes('node_modules/@tanstack/')) return 'vendor-query';
          if (id.includes('node_modules/recharts/') || id.includes('node_modules/d3-')) return 'vendor-charts';
          if (id.includes('node_modules/date-fns/')) return 'vendor-datefns';
        },
      },
    },
  },
})
