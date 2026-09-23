import { defineConfig, loadEnv, type ProxyOptions } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// The browser talks to Vite so sid is a first-party cookie, including when
// the upstream still issues SameSite=Lax cookies.
function authProxy(target: string, local = false): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    ws: true,
    cookieDomainRewrite: '',
    cookiePathRewrite: '/',
    ...(local ? { rewrite: (url: string) => url.replace(/^\/local-api/, '') } : {}),
    configure(proxy) {
      proxy.on('proxyRes', (response) => {
        const cookies = response.headers['set-cookie'];
        if (cookies) {
          // Only the local HTTP dev proxy needs this normalization.
          response.headers['set-cookie'] = cookies.map((cookie) => cookie
            .replace(/;\s*Secure\b/gi, '')
            .replace(/;\s*SameSite=[^;]*/gi, '') + '; SameSite=Lax; Path=/');
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, 'VITE_');
  return {
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: env.VITE_API_FALLBACK_URL || 'http://localhost:3000',
        ws: true,
        changeOrigin: true,
      },
      '/local-api/socket.io': {
        target: env.VITE_API_FALLBACK_URL || 'http://localhost:3000',
        ws: true,
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/local-api\/socket\.io/, '/socket.io'),
      },
      '/api': authProxy(env.VITE_API_URL || 'https://18-141-68-40.sslip.io'),
      '/local-api': authProxy(env.VITE_API_FALLBACK_URL || 'http://localhost:3000', true),
    },
  },
  };
});
