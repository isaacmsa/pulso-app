// AsyncStorage guarda la caché de TanStack Query; en las pruebas es uno en memoria.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// El mock de AppState de React Native devuelve undefined al suscribirse; el focusManager de TanStack Query
// (src/shared/query/client.ts) necesita la suscripción para poder cancelarla.
const { AppState } = require('react-native');
AppState.addEventListener = () => ({ remove: () => undefined });

// La pantalla de arranque es nativa; en las pruebas solo se registra si se pide mantenerla o soltarla.
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve(true)),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

// Sentry trae módulos ESM que Jest no carga; en las pruebas es un mock (la app lo arranca desde app/_layout.tsx).
jest.mock('@sentry/react-native', () => ({ init: jest.fn() }));
