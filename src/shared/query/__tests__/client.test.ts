import { ApiError } from '../../api/client';
import { persistOptions, shouldRetry } from '../client';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.2.3' } },
}));

// Una versión nueva de la app puede cambiar la forma de lo guardado: la caché del disco de otra versión se descarta.
it('la caché del disco se ata a la versión de la app', () => {
  expect(persistOptions.buster).toBe('1.2.3');
});

it('solo reintenta fallas que pueden pasar solas', () => {
  expect(shouldRetry(0, new ApiError('network'))).toBe(true);
  expect(shouldRetry(0, new ApiError('invalid_response'))).toBe(false);
  expect(shouldRetry(2, new ApiError('timeout'))).toBe(false);
});
