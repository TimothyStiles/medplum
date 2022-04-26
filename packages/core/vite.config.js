import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'medplum-core',
      fileName: (format) => `medplum-core.${format}.js`,
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
