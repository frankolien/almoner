import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// snarkjs and @stellar/stellar-sdk expect a few Node globals in the browser.
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({ globals: { Buffer: true, process: true }, protocolImports: true }),
  ],
  optimizeDeps: {
    // circomlibjs / snarkjs / ffjavascript ship ESM that benefits from prebundling.
    include: ['snarkjs', 'circomlibjs', 'ffjavascript', '@stellar/stellar-sdk'],
    esbuildOptions: { target: 'es2022' },
  },
  build: { target: 'es2022' },
  server: { port: 5173, fs: { allow: ['..'] } },
});
