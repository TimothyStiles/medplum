import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'medplum-cli',
      fileName: (format) => `medplum-cli.${format}.js`,
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
  },
});
