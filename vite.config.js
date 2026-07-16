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
        { find: /^react-native$/, replacement: 'react-native-web' },
        { find: /^expo-location$/, replacement: fileURLToPath(new URL('./mobile/src/shared/expo-location.web.ts', import.meta.url)) },
        { find: /^expo-mail-composer$/, replacement: fileURLToPath(new URL('./mobile/src/shared/expo-mail-composer.web.ts', import.meta.url)) },
        { find: './background', replacement: fileURLToPath(new URL('./mobile/src/shared/background.web.ts', import.meta.url)) },
      ],
    },
    define: {
      __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
      'process.env.EXPO_PUBLIC_API_URL': JSON.stringify(process.env.EXPO_PUBLIC_API_URL || ''),
    },
    plugins: [react()],
  };
});
