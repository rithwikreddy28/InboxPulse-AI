import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Guard against WebSocket / HMR failure warnings and benign unhandled promise rejections
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = String(reason?.message || reason || '');
    if (
      msg.includes('WebSocket') ||
      msg.includes('ws://') ||
      msg.includes('wss://') ||
      msg.includes('popup-closed-by-user') ||
      msg.includes('cancelled-popup-request') ||
      msg.includes('AbortError') ||
      msg.includes('Failed to fetch')
    ) {
      event.preventDefault();
      return;
    }
    // Prevent unhandled rejection runtime crashes
    event.preventDefault();
    console.warn('[Handled Rejection]', msg);
  });

  window.addEventListener('error', (event) => {
    const msg = String(event.message || '');
    if (
      msg.includes('WebSocket') ||
      msg.includes('ws://') ||
      msg.includes('wss://')
    ) {
      event.preventDefault();
      return;
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);
