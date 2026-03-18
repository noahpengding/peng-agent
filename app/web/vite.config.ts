import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        'react': path.resolve(__dirname, './node_modules/react'),
        'react-dom': path.resolve(__dirname, './node_modules/react-dom')
      }
    },
    server: {
      port: 3000,
      host: true,
      proxy: {
        '/proxy': {
          target: env.VITE_BACKEND_URL,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/proxy/, ''),
          secure: false,
        },
      },
    },
  };
});
