import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input:
    process.env.OPENAPI_SOURCE ??
    'https://pulso-api-staging.isaac-mendozasa.workers.dev/openapi.json',
  output: { path: 'src/shared/api/generated' },
  plugins: [
    // Sin extensión: con `.ts` el código generado importaría '../client.ts' y tsc lo rechaza.
    { name: '@hey-api/client-fetch', runtimeConfigPath: './src/shared/api/client' },
    'zod',
    { name: '@hey-api/sdk', validator: true },
  ],
});
