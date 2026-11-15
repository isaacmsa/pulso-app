/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/android/'],
  // El primer test que dibuja una pantalla carga React Native entero. En el CI, sin caché, eso ronda
  // los 5 s que Jest da por defecto y el test falla sin que haya nada roto.
  testTimeout: 15_000,
};
