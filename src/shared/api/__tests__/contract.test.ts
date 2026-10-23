import { nativeEventSchema } from '../../../modules/power-detection/native-schema';
import { zDeviceEvent, zDiagnostics, zHomeStatus } from '../generated/zod.gen';
import exported from './fixtures/redmi-a5-2026-11-02.json';

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
