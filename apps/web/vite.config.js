import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '::',
    port: 3000,
    proxy: {
      '/angel-one': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/hcgi': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/hcgi/, ''),
      },
    },
  },
});
