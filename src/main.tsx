import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { MotionConfig } from 'motion/react';
import App from './App';
import { StoreProvider } from './store';
import './styles/index.css';

/** The update is applied only when the user taps "Reload" — unsaved edits are never discarded. */
let applyUpdate: (() => Promise<void>) | null = null;
applyUpdate = registerSW({
  onNeedRefresh() { window.dispatchEvent(new CustomEvent('habits:update-ready')); },
  onOfflineReady() { window.dispatchEvent(new CustomEvent('habits:offline-ready')); }
}) as unknown as () => Promise<void>;
(window as unknown as { __applyUpdate: () => Promise<void> }).__applyUpdate = () => applyUpdate!();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <StoreProvider><App /></StoreProvider>
    </MotionConfig>
  </React.StrictMode>
);
