/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// El tablero (docs/roadmap.md) y los archivos de fase (docs/phases/) son el estado del proyecto (D-046).
// Estos tests fallan cuando dejan de coincidir: así quedó viejo el roadmap anterior sin que nadie lo notara.

const docs = join(__dirname, '..', 'docs');
const roadmap = readFileSync(join(docs, 'roadmap.md'), 'utf8');

const SECTIONS = [
  '## Siguiente paso',
  '## Lista cuando',
  '## Lo que necesita de Isaac',
  '## Tareas',
  '## Bitácora',
];

/** Las filas de una tabla Markdown que empieza en `header`, sin el encabezado ni la línea de guiones. */
function tableRows(header: string): string[] {
  const start = roadmap.indexOf(header);
  if (start < 0) throw new Error(`No está la tabla "${header}" en docs/roadmap.md`);
  const end = roadmap.indexOf('\n\n', start);
  return roadmap
    .slice(start, end < 0 ? undefined : end)
    .split('\n')
    .slice(2);
}

const firstCell = (row: string) => (row.split('|')[1] ?? '').trim();

// Los estados que se pueden usar son los de la tabla "Estado | Qué significa" del propio tablero.
const states = tableRows('| Estado | Qué significa |').map(firstCell);

type Phase = { number: number; title: string; file: string; state: string };

// Una fila con fase propia: | [7 · API en producción con respaldo](phases/07-api-en-produccion.md) | Lista | … |
const LINK = /^\[(\d+) · ([^\]]+)\]\(phases\/([^)]+)\)$/;
const phases: Phase[] = tableRows('| Fase | Estado |').flatMap((row) => {
  const match = LINK.exec(firstCell(row));
  if (!match) return []; // la fila de las fases cerradas (0 a 4) no tiene archivo
  return [
    {
      number: Number(match[1]),
      title: match[2] ?? '',
      file: match[3] ?? '',
      state: (row.split('|')[2] ?? '').trim(),
    },
  ];
});

const read = (file: string) => readFileSync(join(docs, 'phases', file), 'utf8');

it('la tabla de estados del tablero tiene Hecha y los demás', () => {
  expect(states).toContain('Hecha');
  expect(states.length).toBeGreaterThan(1);
});

it('el tablero tiene una fila por cada archivo de docs/phases', () => {
  const files = readdirSync(join(docs, 'phases')).filter((name) => name.endsWith('.md'));
  expect(phases.length).toBeGreaterThan(0);
  expect(phases.map((phase) => phase.file).sort()).toEqual(files.sort());
});

if (phases.length > 0) {
  describe.each(phases)('fase $number', ({ number, title, file, state }) => {
    it('usa un estado de la tabla de estados', () => {
      expect(states).toContain(state);
    });

    it('el archivo lleva su número y el mismo título que el tablero', () => {
      expect(file.startsWith(`${String(number).padStart(2, '0')}-`)).toBe(true);
      expect(read(file).split('\n')[0]).toBe(`# Fase ${number} · ${title}`);
    });

    it('tiene las secciones que lee una sesión nueva', () => {
      const text = read(file);
      for (const section of SECTIONS) expect(text).toContain(`\n${section}\n`);
    });

    it('las casillas y el estado dicen lo mismo', () => {
      const open = (read(file).match(/^\s*- \[ \]/gm) ?? []).length;
      // Hecha: no queda ninguna casilla. Con cualquier otro estado queda al menos una; si no, ya está hecha.
      if (state === 'Hecha') expect(open).toBe(0);
      else expect(open).toBeGreaterThan(0);
    });
  });
}
