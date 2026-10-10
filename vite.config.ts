import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

// Suppress Vite HMR client script & socket injection in preview iframe
const suppressHmrPlugin = (): Plugin => ({
  name: 'suppress-hmr-client',
  transformIndexHtml: {
    order: 'pre',
    handler(html: string) {
      const suppressorScript = `
    <script>
      (function() {
        try {
          var OrigWebSocket = window.WebSocket;
          window.WebSocket = function(url, protocols) {
            var urlStr = String(url || '');
            if (urlStr.includes('vite') || urlStr.includes('3000') || urlStr.includes('ais-dev') || urlStr.includes('ais-pre') || urlStr.includes('run.app')) {
              return {
                readyState: 3,
                CLOSED: 3,
                CLOSING: 2,
                CONNECTING: 0,
                OPEN: 1,
                send: function() {},
                close: function() {},
                addEventListener: function() {},
                removeEventListener: function() {},
                dispatchEvent: function() { return false; },
                onopen: null,
                onclose: null,
                onerror: null,
                onmessage: null
              };
            }
            return new OrigWebSocket(url, protocols);
          };
          if (OrigWebSocket && OrigWebSocket.prototype) {
            window.WebSocket.prototype = OrigWebSocket.prototype;
          }
        } catch(e) {}
      })();
    </script>`;
      return html.replace('<head>', '<head>' + suppressorScript);
    },
  },
});

export default defineConfig(() => {
  return {
    plugins: [suppressHmrPlugin(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      hmr: false,
      host: true,
      port: 3000,
      watch: null,
    },
  };
});
