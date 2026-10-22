/**
 * Builds the devtools with Void, Zyzz, and TanStack Start, and configures repository checks.
 * @module
 */
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite-plus'
import { voidPlugin } from 'void'
import { zyzz } from 'zyzz/vite'
import { base } from './src/internal/Base.ts'

export default defineConfig({
  // Every page, asset, and endpoint sits under one prefix, so a host app can mount the build.
  base: `${base}/`,
  fmt: {
    ignorePatterns: [
      '.void/**',
      'dist/**',
      'node_modules/**',
      'pnpm-lock.yaml',
      'src/routeTree.gen.ts',
    ],
    printWidth: 80,
    semi: false,
    singleQuote: true,
    sortPackageJson: false,
  },
  lint: {
    categories: { correctness: 'error' },
    ignorePatterns: [
      '.void/**',
      'dist/**',
      'node_modules/**',
      'src/routeTree.gen.ts',
    ],
    // Formatting and linting stay syntax-only; check:types checks types.
    options: { typeAware: false, typeCheck: false },
    rules: { 'no-unused-vars': 'error' },
  },
  // Void comes before the framework plugin, and React follows TanStack Start. Tests run
  // outside the Worker and start the dev server as a separate process.
  plugins: process.env.VITEST
    ? []
    : [
        voidPlugin(),
        zyzz({ exclude: ['internal/**', 'routeTree.gen.ts'] }),
        tanstackStart({
          router: { basepath: base || '/' },
          srcDirectory: 'src/app',
        }),
        react(),
      ],
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 60_000,
  },
})
