import { batteryGuide } from '../battery-guide';

const titles = (maker: string) => batteryGuide(maker).map((step) => step.title);

it("batteryGuide('Xiaomi') incluye Inicio automático", () => {
  expect(titles('Xiaomi')).toContain('Inicio automático');
  expect(titles('Xiaomi')).toContain('Batería sin restricciones');
});

it('Redmi y Poco usan la guía de Xiaomi, sin importar mayúsculas', () => {
  expect(batteryGuide('REDMI')).toEqual(batteryGuide('Xiaomi'));
  expect(batteryGuide('poco')).toEqual(batteryGuide('Xiaomi'));
});

it('en Xiaomi el Inicio automático abre su pantalla y la batería la suya', () => {
  const steps = batteryGuide('Xiaomi');
  expect(steps.find((s) => s.title === 'Inicio automático')?.open).toBe('autostart');
  expect(steps.find((s) => s.title === 'Batería sin restricciones')?.open).toBe('battery');
});

it('Samsung habla de apps en suspensión profunda', () => {
  const text = batteryGuide('samsung')
    .map((s) => `${s.title} ${s.body}`)
    .join(' ');
  expect(text).toContain('suspensión profunda');
});

it('Tecno, Infinix y un fabricante desconocido usan la guía genérica', () => {
  expect(batteryGuide('TECNO')).toEqual(batteryGuide('Fairphone'));
  expect(batteryGuide('Infinix')).toEqual(batteryGuide('Fairphone'));
  expect(titles('Fairphone')).toContain('Batería sin restricciones');
  expect(batteryGuide('')).toEqual(batteryGuide('Fairphone'));
});

it('nunca pide la exclusión de optimización de batería del sistema', () => {
  for (const maker of ['Xiaomi', 'Samsung', 'Tecno', 'Otro']) {
    for (const step of batteryGuide(maker)) {
      expect(`${step.title} ${step.body}`).not.toMatch(/optimiz/i);
    }
  }
});
