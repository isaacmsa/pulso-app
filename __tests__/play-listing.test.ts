/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Los textos de la ficha viven en docs/play-store.md, en bloques ```text listos para pegar.
// Play cuenta caracteres Unicode, saltos de línea incluidos, y corta al pegar si se pasan.

const doc = readFileSync(join(__dirname, '..', 'docs', 'play-store.md'), 'utf8');
const section = doc.slice(doc.indexOf('## Ficha y formularios'));

function blockAfter(marker: string): string {
  const start = section.indexOf(marker);
  if (start < 0) throw new Error(`No está "${marker}" en docs/play-store.md`);
  const open = section.indexOf('```text\n', start) + '```text\n'.length;
  return section.slice(open, section.indexOf('\n```', open));
}

const length = (text: string) => [...text].length;

it('el nombre y su respaldo caben en 30 caracteres', () => {
  expect(length(blockAfter('### Nombre'))).toBeLessThanOrEqual(30);
  expect(length(blockAfter('respaldo es este'))).toBeLessThanOrEqual(30);
});

it('la descripción corta cabe en 80 caracteres', () => {
  expect(length(blockAfter('### Descripción corta'))).toBeLessThanOrEqual(80);
});

it('la descripción larga cabe en 4000 caracteres y empieza por la detección automática', () => {
  const long = blockAfter('### Descripción larga');
  expect(length(long)).toBeLessThanOrEqual(4000);
  expect(long.startsWith('Pulso detecta solo')).toBe(true);
});

it('la descripción larga con el bloque de la actualización 1 sigue cabiendo', () => {
  const extra = blockAfter('**Para la actualización 1');
  expect(length(blockAfter('### Descripción larga')) + length(extra) + 2).toBeLessThanOrEqual(4000);
});

it('las notas de la versión caben en 500 caracteres sin contar las etiquetas', () => {
  const notes = blockAfter('### Notas de la versión')
    .replace(/^<es-419>\n/, '')
    .replace(/\n<\/es-419>$/, '');
  expect(length(notes)).toBeGreaterThan(0);
  expect(length(notes)).toBeLessThanOrEqual(500);
});

describe('formulario de seguridad de datos', () => {
  const form = section.slice(
    section.indexOf('### Seguridad de datos'),
    section.indexOf('### Clasificación'),
  );
  const row = (type: string) =>
    form.split('\n').find((line) => line.startsWith(`| ${type} |`)) ?? '';

  it('marca lo que todavía no trae la versión de la prueba', () => {
    expect(row('IDs del dispositivo u otros IDs')).toMatch(
      /token push \(entra en la actualización 1\)/,
    );
    expect(row('Información y rendimiento de la app → Registros de fallos')).toMatch(
      /\(entra en la fase 4\)/,
    );
    expect(form).toMatch(/al pedir el acceso a producción/i);
  });

  it('el contenido generado por el usuario es solo el alias de la casa', () => {
    const cells = row('Actividad en la app → Otro contenido generado por el usuario').split(' | ');
    expect(cells[1]).toBe('Alias de la casa');
  });
});
