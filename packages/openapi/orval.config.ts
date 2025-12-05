import { defineConfig } from 'orval'

export default defineConfig({
  api: {
    input: './openapi.yaml',
    output: {
      target: './dist/index.ts',
      schemas: './dist/schemas',
      mode: 'split',
      client: 'zod',
      mock: false,
      prettier: true,
    },
  },
})
