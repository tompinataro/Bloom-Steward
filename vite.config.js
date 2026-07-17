import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(() => {
  return {
    build: {
      outDir: 'build',
    },
    server: {
      proxy: {
        "/api": 'http://localhost:5100',
      }
    },
    resolve: {
      extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
      alias: [
        { find: /^react$/, replacement: fileURLToPath(new URL('./node_modules/react/index.js', import.meta.url)) },
        { find: /^react\/jsx-runtime$/, replacement: fileURLToPath(new URL('./node_modules/react/jsx-runtime.js', import.meta.url)) },
        { find: /^react-dom$/, replacement: fileURLToPath(new URL('./node_modules/react-dom/index.js', import.meta.url)) },
        { find: /^react-dom\/client$/, replacement: fileURLToPath(new URL('./node_modules/react-dom/client.js', import.meta.url)) },
        { find: /^react-native$/, replacement: 'react-native-web' },
        { find: /^react-native-web$/, replacement: fileURLToPath(new URL('./node_modules/react-native-web/dist/index.js', import.meta.url)) },
        { find: /^expo-location$/, replacement: fileURLToPath(new URL('./mobile/src/shared/expo-location.web.ts', import.meta.url)) },
        { find: /^expo-mail-composer$/, replacement: fileURLToPath(new URL('./mobile/src/shared/expo-mail-composer.web.ts', import.meta.url)) },
        { find: './background', replacement: fileURLToPath(new URL('./mobile/src/shared/background.web.ts', import.meta.url)) },
      ],
    },
    define: {
      __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
      global: 'globalThis',
      'process.env.EXPO_PUBLIC_API_URL': JSON.stringify(process.env.EXPO_PUBLIC_API_URL || ''),
    },
    plugins: [react()],
  };
});
