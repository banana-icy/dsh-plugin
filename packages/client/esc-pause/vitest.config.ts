import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    environmentOptions: {
      // A real origin gives jsdom a working document for the gesture specs.
      jsdom: { url: 'http://localhost/' },
    },
  },
})