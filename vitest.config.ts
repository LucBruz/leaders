import { defineConfig } from 'vitest/config'

// Le moteur est du TypeScript pur : il se teste sans Nuxt ni jsdom.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['engine/**/*.spec.ts', 'app/**/*.spec.ts'],
  },
})
