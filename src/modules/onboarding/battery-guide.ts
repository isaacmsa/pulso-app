import type { BatterySettingsKind } from '../power-detection/power-monitor';

export type BatteryStep = {
  title: string;
  body: string;
  /** Qué pantalla del teléfono abre el botón "Abrir ajustes". Sin esto, el paso no tiene botón. */
  open?: BatterySettingsKind;
};

const NO_RESTRICTIONS_TITLE = 'Batería sin restricciones';

const XIAOMI: BatteryStep[] = [
  {
    title: 'Inicio automático',
    body: 'Ajustes → Apps → Administrar apps → Pulso → activa «Inicio automático». Si instalas una versión nueva de Pulso, tendrás que activarlo otra vez.',
    open: 'autostart',
  },
  {
    title: NO_RESTRICTIONS_TITLE,
    body: 'En esa misma pantalla de Pulso, toca «Ahorro de batería» y elige «Sin restricciones».',
    open: 'battery',
  },
];

const SAMSUNG: BatteryStep[] = [
  {
    title: 'Apps en suspensión profunda',
    body: 'Ajustes → Batería → Límites de uso en segundo plano → saca a Pulso de «Apps en suspensión profunda» y de «Apps en suspensión».',
  },
  {
    title: NO_RESTRICTIONS_TITLE,
    body: 'Ajustes → Apps → Pulso → Batería → «Sin restricciones».',
    open: 'battery',
  },
];

const GENERIC: BatteryStep[] = [
  {
    title: NO_RESTRICTIONS_TITLE,
    body: 'Ajustes → Apps → Pulso → Batería → «Sin restricciones» o «Permitir en segundo plano».',
    open: 'battery',
  },
  {
    title: 'Inicio automático',
    body: 'Si en los ajustes de Pulso aparece «Inicio automático», actívalo. Si no aparece, sigue al próximo paso.',
    open: 'autostart',
  },
];

const XIAOMI_FAMILY = new Set(['xiaomi', 'redmi', 'poco']);

/** Fabricantes que cierran apps en segundo plano por su cuenta: la guía de batería les importa. */
const RISK_MANUFACTURERS = new Set([...XIAOMI_FAMILY, 'samsung', 'tecno', 'infinix']);

export function isRiskManufacturer(manufacturer: string): boolean {
  return RISK_MANUFACTURERS.has(manufacturer.trim().toLowerCase());
}

/**
 * Los pasos para que el teléfono no cierre Pulso en segundo plano, según el fabricante (`Build.MANUFACTURER`).
 * Los textos salen de `docs/registrador.md`. Tecno, Infinix y cualquier otro usan la guía genérica.
 */
export function batteryGuide(manufacturer: string): BatteryStep[] {
  const maker = manufacturer.trim().toLowerCase();
  if (XIAOMI_FAMILY.has(maker)) return XIAOMI;
  if (maker === 'samsung') return SAMSUNG;
  return GENERIC;
}
