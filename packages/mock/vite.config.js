import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'medplum-mock',
      fileName: (format) => `medplum-mock.${format}.js`,
    },
    rollupOptions: {
      external: ['@medplum/core'],
      output: {
        globals: {
          '@medplum/core': 'medplum.core',
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
