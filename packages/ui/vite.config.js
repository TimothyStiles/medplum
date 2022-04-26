import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'medplum-ui',
      fileName: (format) => `medplum-ui.${format}.js`,
    },
    rollupOptions: {
      external: ['@medplum/core', '@medplum/mock', 'react', 'react-dom', 'react-router-dom'],
      output: {
        globals: {
          '@medplum/core': 'medplum.core',
          '@medplum/mock': 'medplum.mock',
          react: 'React',
          'react-dom': 'ReactDOM',
          'react-router-dom': 'ReactRouterDOM',
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test.setup.ts',
  },
});
