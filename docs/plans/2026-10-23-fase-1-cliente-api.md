# Fase 1 · Cliente de la API: plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar `superpowers:executing-plans` (recomendado) o `superpowers:subagent-driven-development` para ejecutar este plan tarea por tarea. Los pasos usan checkboxes (`- [ ]`). La tarea 3 necesita el Xiaomi y se hace en la sesión principal con Isaac.

**Objetivo:** que la app tenga un cliente de `pulso-api` generado desde su `openapi.json`, con la URL base, el token, el timeout y los errores resueltos en un solo lugar, y que el Xiaomi llegue a staging con él.

**Arquitectura:** `@hey-api/openapi-ts` genera en `src/shared/api/generated/` los tipos, los esquemas Zod y un SDK de fetch que valida cada petición y cada respuesta. El código generado no se edita: la configuración propia entra por `runtimeConfigPath`, que apunta a `src/shared/api/client.ts`. Esta fase no sube eventos ni registra el teléfono (eso es la fase 2a): solo deja el cliente listo y probado contra staging.

**Stack:** `@hey-api/openapi-ts` 0.99.0 (plugins `@hey-api/client-fetch`, `zod` y `@hey-api/sdk` con `validator: true`), Zod 4, TypeScript 6 estricto, jest-expo.

**Spec:** `docs/architecture.md` ("Contrato con la API" y "Entornos"), `docs/decisions.md` (D-014, D-016, D-017), `docs/roadmap.md` (fase 1), `pulso-api/docs/api.md` y el contrato de staging, `https://pulso-api-staging.isaac-mendozasa.workers.dev/openapi.json`. Ese contrato es igual, salvo por el formato, al `openapi.json` de `pulso-api` en `769cae4`.

## Decisiones que este plan toma (se aprueban junto con el plan)

| Id | Decisión | Por qué | Costo |
| --- | --- | --- | --- |
| D-023 | Las respuestas se validan con el Zod generado. Un campo nuevo se acepta (`z.object` lo descarta). Un valor nuevo en un enum de respuesta, en cambio, hace fallar la llamada. Por eso, en `/v1`, el backend no agrega valores a un enum de respuesta: un estado nuevo va en un campo nuevo o en `/v2` | D-017 pide validación en tiempo de ejecución en los dos lados, y una app vieja de Play no se actualiza. Si el backend amplía un enum, esa app falla en esa ruta para siempre | El backend tiene menos libertad en `/v1`. La regla se agrega también en `pulso-api/AGENTS.md` (regla 6) |
| D-024 | Timeout de 15 s por petición y sin reintentos en el cliente JS. Los reintentos de la subida son de WorkManager (Kotlin, fase 2a) y los de las pantallas, de TanStack Query | En las redes venezolanas una petición puede quedarse colgada. Si reintentara en dos capas, una falla saldría duplicada | `docs/architecture.md` decía "timeouts y reintentos": se corrige |
| D-025 | La URL base sale de `EXPO_PUBLIC_API_URL`. Si no está definida, se usa staging (`https://pulso-api-staging.isaac-mendozasa.workers.dev`). Cada perfil de EAS la define cuando se cree `eas.json` | Todavía no hay `eas.json`, y en esta fase la app solo habla con staging | Un build sin la variable apunta a staging, no a producción. En la fase 2 el perfil `production` tiene que definirla |

Además, dos ajustes menores:
- **Instalación de `@hey-api/openapi-ts`:** se instala con `pnpm add -D -E` y no con `npx expo install`, porque es una herramienta de build y no un módulo de Expo. Se fija en 0.99.0 exacto porque el código generado depende de la versión.
- **`native-schema.ts`:** sigue hasta la fase 2a, como dice el roadmap ("el esquema nativo se reemplaza por el generado"), y no en la fase 1, como decía `docs/architecture.md`. Ese documento se corrige en la tarea 1. En esta fase, un test de contrato comprueba que los dos esquemas aceptan los mismos eventos reales.

## Restricciones globales

- `src/shared/api/generated/` solo cambia con `pnpm api:generate`, nunca a mano, y se versiona (D-017). Biome ya lo ignora.
- Un cambio de contrato empieza en `pulso-api`: aditivo y desplegado en staging. Después se regenera aquí (D-014).
- `pnpm api:generate` lee `OPENAPI_SOURCE`. Si no está definida, usa `https://pulso-api-staging.isaac-mendozasa.workers.dev/openapi.json`. Para usar el archivo local: `OPENAPI_SOURCE=../../backend/pulso-api/openapi.json`.
- Ninguna variable `EXPO_PUBLIC_*` contiene secretos.
- El token nunca aparece en logs, en mensajes de error ni en Sentry. En esta fase todavía no hay token real: el proveedor devuelve `null` hasta la fase 2a.
- Timeout: `REQUEST_TIMEOUT_MS = 15_000`.
- Horas en epoch ms. Textos de la interfaz en español venezolano; código en inglés; documentación en español.
- Conventional Commits, sin atribución a Claude ni Anthropic. Al cerrar una tarea, se marca su línea en `docs/roadmap.md` en el mismo commit.

## Foco de revisión

1. **El backend agrega un valor a un enum de respuesta**, por ejemplo `state: 'nuevo'`: la llamada falla con `ApiError('invalid_response')` y no deja la pantalla en blanco ni rompe la app. Lo cubren el test "un estado desconocido se rechaza" (tarea 1) y "una respuesta fuera de contrato da invalid_response" (tarea 2).
2. **La respuesta trae campos nuevos**: se acepta. Lo cubre "una respuesta con campos nuevos se acepta" (tarea 1).
3. **La red se cuelga sin responder**: a los 15 s la llamada termina con `ApiError('timeout')`. Lo cubre "corta la petición a los 15 s" (tarea 2).
4. **El proveedor del token falla** (la bóveda de la fase 2a lanza un error): la petición no sale y la llamada falla con `ApiError`, sin cerrar la app. Lo cubre "si el proveedor del token falla, no manda la petición" (tarea 2).
5. **El token se filtra en un error**: el `message` de `ApiError` nunca incluye el token. Lo cubre "el mensaje de ApiError no incluye el token" (tarea 2).

---

## Estructura de archivos

```text
openapi-ts.config.ts                        # input (OPENAPI_SOURCE), output y plugins
src/shared/api/
  client.ts                                 # createClientConfig, URL, token, timeout, ApiError, unwrap
  generated/                                # pnpm api:generate (no se edita)
  __tests__/contract.test.ts
  __tests__/client.test.ts
  __tests__/fixtures/redmi-a5-2026-11-02.json   # copia del fixture público de pulso-api
app/debug.tsx                               # línea "API: …" (tarea 3)
src/modules/power-detection/__tests__/debug-screen.test.tsx
```

---

### Tarea 1: generar el cliente y fijar el contrato

**Archivos:**
- Crear: `openapi-ts.config.ts`, `src/shared/api/client.ts` (versión mínima), `src/shared/api/__tests__/contract.test.ts`, `src/shared/api/__tests__/fixtures/redmi-a5-2026-11-02.json`
- Generar: `src/shared/api/generated/**`
- Modificar: `package.json`, `docs/architecture.md`, `docs/roadmap.md`

**Interfaces:**
- Produce:
  - `src/shared/api/generated/index.ts`, que exporta entre otros `getHealth`, `registerDevice`, `updateDevice`, `deleteDevice`, `createHome`, `updateHome`, `getHomeStatus` e `ingestEvents`.
  - `src/shared/api/generated/zod.gen.ts`, con `zDeviceEvent`, `zDiagnostics`, `zHomeStatus`, `zError` y `zEventBatch`.
  - `client.ts`, que exporta `STAGING_API_URL: string`, `resolveApiUrl(value: string | undefined): string` y `createClientConfig: CreateClientConfig`.

- [ ] **Paso 1: escribir el test de contrato que falla**

Primero, copiar el fixture: `cp ../../backend/pulso-api/test/fixtures/exports/redmi-a5-2026-11-02.json src/shared/api/__tests__/fixtures/`. Ya es público y está desplazado en el tiempo.

```ts
// src/shared/api/__tests__/contract.test.ts
import exported from './fixtures/redmi-a5-2026-11-02.json';
import { zDeviceEvent, zDiagnostics, zHomeStatus } from '../generated/zod.gen';
import { nativeEventSchema } from '../../../modules/power-detection/native-schema';

const status = { state: 'con_luz', since: 1793628000000, alias: 'Casa', openOutageStart: null };

it('los eventos del exporte real cumplen el esquema generado', () => {
  for (const e of exported.events) expect(zDeviceEvent.safeParse(e).success).toBe(true);
});
it('el esquema nativo y el generado aceptan los mismos eventos', () => {
  for (const e of exported.events)
    expect(nativeEventSchema.safeParse(e).success).toBe(zDeviceEvent.safeParse(e).success);
});
it('el diagnóstico del exporte cumple el esquema generado', () => {
  expect(zDiagnostics.safeParse(exported.diagnostics).success).toBe(true);
});
it('una respuesta con campos nuevos se acepta', () => {
  expect(zHomeStatus.parse({ ...status, nuevo: 1 })).toEqual(status);
});
it('un estado desconocido se rechaza', () => {
  expect(zHomeStatus.safeParse({ ...status, state: 'nuevo' }).success).toBe(false);
});
```

- [ ] **Paso 2: correrlo y verlo fallar**

Run: `pnpm test src/shared/api`
Expected: FAIL con "Cannot find module '../generated/zod.gen'".

- [ ] **Paso 3: instalar el generador y configurarlo**

1. Instalar: `pnpm add -D -E @hey-api/openapi-ts@0.99.0`. Si `pnpm install` se detiene por `allowBuilds`, resolverlo con `pnpm approve-builds` y anotar la decisión.
2. Agregar en `package.json` el script `"api:generate": "openapi-ts"`.
3. `openapi-ts.config.ts`:
   - `input`: `process.env.OPENAPI_SOURCE ?? 'https://pulso-api-staging.isaac-mendozasa.workers.dev/openapi.json'`.
   - `output.path`: `'src/shared/api/generated'`.
   - `plugins`: `[{ name: '@hey-api/client-fetch', runtimeConfigPath: './src/shared/api/client' }, 'zod', { name: '@hey-api/sdk', validator: true }]`.
   - El `runtimeConfigPath` va sin extensión: con `.ts`, el generado importa `'../client.ts'` y TypeScript lo rechaza sin `allowImportingTsExtensions`.
4. `client.ts` mínimo:
   - `STAGING_API_URL`.
   - `resolveApiUrl(value)`: devuelve `value` sin la `/` final, o `STAGING_API_URL` si viene vacío o `undefined`.
   - `createClientConfig = (config) => ({ ...config, baseUrl: resolveApiUrl(process.env.EXPO_PUBLIC_API_URL) })`. Expo solo reemplaza la variable si se escribe literal, como `process.env.EXPO_PUBLIC_API_URL`.
   - El tipo `CreateClientConfig` se importa con `import type` desde `./generated/client.gen`, para que no haya un ciclo en tiempo de ejecución.

- [ ] **Paso 4: generar**

Run: `pnpm api:generate`
Expected: `✓ ./src/shared/api/generated · 5 files`. Aparecen `sdk.gen.ts`, `zod.gen.ts`, `types.gen.ts`, `client.gen.ts`, `index.ts`, `client/` y `core/`. `client.gen.ts` importa `createClientConfig` desde `'../client'`.

- [ ] **Paso 5: comprobar que el contrato local es el mismo que el de staging**

Run: `OPENAPI_SOURCE=../../backend/pulso-api/openapi.json pnpm api:generate && git status --short src/shared/api/generated`
Expected: sin salida. El código generado desde el archivo local es idéntico al de staging.

- [ ] **Paso 6: tests, tipos y lint**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: todo en verde, incluidos los 5 tests de contrato.

- [ ] **Paso 7: documentación y commit**

1. `docs/architecture.md`:
   - En la estructura, `api/client.ts` pasa a decir "URL base, token, timeout y errores (D-024)".
   - El párrafo de `native-schema.ts` dice que se reemplaza en la fase 2a.
2. `docs/decisions.md`: D-023, D-024 y D-025 ya están registradas, porque se aprobaron con el plan maestro.
3. `docs/roadmap.md`: marcar la línea `[app] pnpm api:generate …`.

```bash
git add openapi-ts.config.ts package.json pnpm-lock.yaml src/shared/api docs
git commit -m "feat(api): cliente generado desde el openapi de staging"
```

---

### Tarea 2: URL, token, timeout y errores en `client.ts`

**Archivos:**
- Modificar: `src/shared/api/client.ts`
- Test: `src/shared/api/__tests__/client.test.ts`

**Interfaces:**
- Consume: `createClientConfig`, `resolveApiUrl` y `STAGING_API_URL` de la tarea 1, más `getHealth`, `getHomeStatus` y `zError` del código generado.
- Produce, en `client.ts`:
  - `REQUEST_TIMEOUT_MS = 15_000`.
  - `setTokenProvider(provider: () => Promise<string | null>): void`. El proveedor por defecto devuelve `null`.
  - `class ApiError extends Error { readonly code: ApiErrorCode; readonly status: number | null }`.
  - `type ApiErrorCode = 'validation_failed' | 'invalid_token' | 'not_found' | 'home_exists' | 'rate_limited' | 'internal_error' | 'timeout' | 'network' | 'invalid_response' | 'unknown'`.
  - `unwrap<T>(call: Promise<{ data?: T; error?: unknown; response?: Response }>): Promise<T>`.
  - `createClientConfig`, que ahora también define `auth` (usa el proveedor) y `fetch` (con timeout).

- [ ] **Paso 1: escribir los tests que fallan**

Los tests espían `globalThis.fetch` con `jest.spyOn`, y el `fetch` con timeout lo llama en cada petición, no al cargar el módulo. Cada test lee el `Request` que recibe el espía.

| Test | Montaje | Se espera |
| --- | --- | --- |
| `resolveApiUrl usa la variable y quita la barra final` | — | `resolveApiUrl('http://localhost:8787/')` da `'http://localhost:8787'`, y `resolveApiUrl(undefined)` da `STAGING_API_URL` |
| `manda Authorization: Bearer en rutas con token` | proveedor → `'abc.def'`; `unwrap(getHomeStatus())` con 200 y un `HomeStatus` válido | header `authorization` igual a `'Bearer abc.def'` |
| `sin token no manda Authorization` | proveedor → `null` | `request.headers.get('authorization')` es `null` |
| `getHealth no manda el token` | proveedor → `'abc.def'`; `unwrap(getHealth())` | sin `authorization`, y `data` igual a `{ ok: true }` |
| `corta la petición a los 15 s` | `jest.useFakeTimers()`; un `fetch` que nunca responde y solo rechaza cuando se aborta su señal; avanzar `REQUEST_TIMEOUT_MS` | rechaza con `ApiError` de código `'timeout'` y `status` `null` |
| `un 401 se convierte en invalid_token` | 401 con `{ error: { code: 'invalid_token', message: 'x' } }` | `ApiError` de código `'invalid_token'` y `status` 401 |
| `un código de error desconocido da unknown con su status` | 418 con `{ error: { code: 'nuevo', message: 'x' } }` | `ApiError` de código `'unknown'` y `status` 418 |
| `una respuesta fuera de contrato da invalid_response` | 200 con `{ state: 'nuevo', since: 1, alias: 'x', openOutageStart: null }` | `ApiError` de código `'invalid_response'` |
| `sin red da network` | `fetch` rechaza `new TypeError('Network request failed')` | `ApiError` de código `'network'` |
| `si el proveedor del token falla, no manda la petición` | proveedor rechaza `new Error('vault')` | `ApiError` y `fetch` no se llama |
| `el mensaje de ApiError no incluye el token` | proveedor → `'abc.def'`, respuesta 401 | `error.message` no contiene `'abc.def'` |

- [ ] **Paso 2: correrlos y verlos fallar**

Run: `pnpm test src/shared/api/__tests__/client.test.ts`
Expected: FAIL, porque `setTokenProvider`, `unwrap` y `ApiError` no existen todavía.

- [ ] **Paso 3: implementar en `client.ts`**

- **`fetch` con timeout:** crea un `AbortController` y llama `globalThis.fetch(request, { signal })`. Si la señal del `Request` original se aborta, aborta también el suyo. Al vencer el plazo rechaza con un error de `name` `'TimeoutError'`, para distinguirlo de un aborto del que llama, y limpia el temporizador en `finally`.
- **`auth`:** `() => tokenProvider()`. El SDK ya omite el header si el valor es `null`.
- **`unwrap`:** el cliente generado no lanza. Devuelve `{ error, response }` tanto por fallas de red como por las del validador o por un HTTP que no es 2xx. `unwrap` lo clasifica en este orden:
  1. `response` existe y no es `ok`: código desde `zError.safeParse(error)`; si no cumple el esquema, `'unknown'`. `status` es `response.status`.
  2. `error instanceof z.ZodError`: `'invalid_response'`.
  3. `error.name === 'TimeoutError'`: `'timeout'`.
  4. `error instanceof TypeError`: `'network'`.
  5. Cualquier otro caso: `'unknown'`.

  El `message` de `ApiError` se arma solo con el código y el estado, nunca con headers ni con el cuerpo de la petición.

- [ ] **Paso 4: correrlos y verlos pasar**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: todo en verde.

- [ ] **Paso 5: commit**

```bash
git add src/shared/api
git commit -m "feat(api): token, timeout de 15 s y errores tipados en el cliente"
```

---

### Tarea 3: la pantalla de registro llega a staging (Xiaomi, con Isaac)

**Archivos:**
- Modificar: `app/debug.tsx`, `src/modules/power-detection/__tests__/debug-screen.test.tsx`

**Interfaces:**
- Consume: `unwrap` y `ApiError` (tarea 2), y `getHealth` del código generado.

- [ ] **Paso 1: escribir los tests que fallan**

Mockear `src/shared/api/generated/sdk.gen` (`getHealth`) en el test de la pantalla.
- `muestra "API: en línea" cuando /health responde`: `getHealth` resuelve `{ data: { ok: true }, response: new Response(null, { status: 200 }) }`, y aparece el texto `API: en línea`.
- `muestra "API: sin respuesta (network)" cuando falla`: `getHealth` resuelve `{ error: new TypeError('Network request failed') }`, y aparece `API: sin respuesta (network)`.

- [ ] **Paso 2: correrlos y verlos fallar**

Run: `pnpm test src/modules/power-detection/__tests__/debug-screen.test.tsx`
Expected: FAIL, porque el texto no existe.

- [ ] **Paso 3: implementar**

En `refresh()` de `app/debug.tsx`:
- Llamar a `unwrap(getHealth())` aparte de lo demás: si la API falla, la lista de eventos se sigue mostrando.
- Guardar `'en línea'`, o `sin respuesta (${error.code})` si es un `ApiError`.
- Mostrarlo debajo del diagnóstico, con el mismo estilo de `diagnostics`.

- [ ] **Paso 4: tests**

Run: `pnpm lint && pnpm typecheck && pnpm test`
Expected: todo en verde.

- [ ] **Paso 5: verificar en el Xiaomi [Isaac]**

Con depuración inalámbrica y Metro corriendo (`pnpm start`; el cambio es solo de JS, no hace falta recompilar el build de desarrollo):
1. Abrir `pulso://debug` (`adb shell am start -a android.intent.action.VIEW -d "pulso://debug"`). Se tiene que ver **"API: en línea"**.
2. Apagar el Wi-Fi y los datos y deslizar para refrescar. Se tiene que ver **"API: sin respuesta (network)"**.
3. Encenderlos y refrescar otra vez. Vuelve **"API: en línea"**.

- [ ] **Paso 6: commit**

```bash
git add app/debug.tsx src/modules/power-detection/__tests__/debug-screen.test.tsx
git commit -m "feat(debug): estado de la API de staging en la pantalla de registro"
```

---

## Pasos de Isaac

| Momento | Paso |
| --- | --- |
| Antes de empezar | Aprobar este plan y las decisiones D-023, D-024 y D-025 |
| Después de aprobar | Pedirle a la sesión de `pulso-api` que agregue la regla de D-023 a su `AGENTS.md` (regla 6): en `/v1` no se agregan valores a los enums de respuesta |
| Tarea 3, paso 5 | El Xiaomi con depuración inalámbrica: abrir la pantalla de registro, apagar y encender la red y contar lo que se ve |

## Cierre de la fase

La fase 1 queda lista cuando las tres tareas están commiteadas y su línea marcada en `docs/roadmap.md`, y el Xiaomi muestra **"API: en línea"** contra staging. El criterio del backend ("reenviar el mismo lote devuelve `duplicated` igual al número de eventos") ya se cumplió en staging el 22 de octubre.
