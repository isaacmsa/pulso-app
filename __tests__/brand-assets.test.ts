/// <reference types="node" />
// Los tipos de Node vienen con Jest (@types/node es dependencia de @jest/console).
import { Buffer } from 'node:buffer';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import config from '../app.json';

// Los PNG salen de assets/brand/ con `node scripts/brand/render.mjs`. Estos tests fijan lo que
// piden Android y Play, para que una regeneración no rompa la ficha sin que nadie lo note.

const root = join(__dirname, '..');

type Png = { width: number; height: number; colorType: number; pixels: Buffer; channels: number };

/** Lee un PNG de 8 bits sin entrelazar (RGB o RGBA). Basta para los que genera Chrome. */
function readPng(path: string): Png {
  const file = readFileSync(join(root, path));
  expect(file.subarray(1, 4).toString('latin1')).toBe('PNG');
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = -1;
  const idat: Buffer[] = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('latin1', offset + 4, offset + 8);
    const data = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect(data[8]).toBe(8);
      colorType = data[9] ?? -1;
      expect([2, 6]).toContain(colorType);
      expect(data[12]).toBe(0);
    } else if (type === 'IDAT') {
      idat.push(data);
    }
    offset += 12 + length;
  }
  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x;
      const a = x >= channels ? (pixels[i - channels] ?? 0) : 0;
      const b = y > 0 ? (pixels[i - stride] ?? 0) : 0;
      const c = x >= channels && y > 0 ? (pixels[i - stride - channels] ?? 0) : 0;
      const p = a + b - c;
      const paeth =
        Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c)
          ? a
          : Math.abs(p - b) <= Math.abs(p - c)
            ? b
            : c;
      const predictor = [0, a, b, (a + b) >> 1, paeth][filter ?? 0] ?? 0;
      pixels[i] = ((raw[y * (stride + 1) + 1 + x] ?? 0) + predictor) & 0xff;
    }
  }
  return { width, height, colorType, pixels, channels };
}

function alphaAt(png: Png, x: number, y: number): number {
  return png.channels === 4 ? (png.pixels[(y * png.width + x) * 4 + 3] ?? -1) : 255;
}

function isOpaque(png: Png): boolean {
  if (png.channels === 3) return true;
  for (let i = 3; i < png.pixels.length; i += 4) if (png.pixels[i] !== 255) return false;
  return true;
}

const { icon, android } = config.expo;
const referenced = [
  icon,
  android.adaptiveIcon.foregroundImage,
  android.adaptiveIcon.backgroundImage,
  android.adaptiveIcon.monochromeImage,
];

it.each(referenced)('%s existe y mide 1024 × 1024', (path) => {
  expect(existsSync(join(root, path))).toBe(true);
  const png = readPng(path);
  expect([png.width, png.height]).toEqual([1024, 1024]);
});

it('la capa delantera y la monocromática del ícono adaptativo tienen fondo transparente', () => {
  for (const path of [android.adaptiveIcon.foregroundImage, android.adaptiveIcon.monochromeImage]) {
    const png = readPng(path);
    expect(png.colorType).toBe(6);
    expect(alphaAt(png, 0, 0)).toBe(0);
    expect(alphaAt(png, 1023, 1023)).toBe(0);
  }
});

it('la capa delantera deja libre lo que queda fuera del círculo seguro de 66 dp', () => {
  // 108 dp de lienzo: el círculo seguro mide 66 dp, o sea un radio de 313 px en 1024.
  const png = readPng(android.adaptiveIcon.foregroundImage);
  const radius = (66 / 108 / 2) * 1024;
  for (let y = 0; y < 1024; y += 4) {
    for (let x = 0; x < 1024; x += 4) {
      if (Math.hypot(x + 0.5 - 512, y + 0.5 - 512) > radius) expect(alphaAt(png, x, y)).toBe(0);
    }
  }
});

it('la capa trasera es el color de fondo de la app, liso', () => {
  const png = readPng(android.adaptiveIcon.backgroundImage);
  expect(isOpaque(png)).toBe(true);
  for (let p = 0; p < png.width * png.height; p++) {
    const rgb = [...png.pixels.subarray(p * png.channels, p * png.channels + 3)];
    if (rgb.join() !== '11,15,20') throw new Error(`píxel ${p}: ${rgb.join()} en vez de #0B0F14`);
  }
});

it('el ícono de Play mide 512 × 512 y es PNG de 32 bits sin transparencia', () => {
  const png = readPng('assets/store/icon-512.png');
  expect([png.width, png.height]).toEqual([512, 512]);
  expect(png.colorType).toBe(6);
  expect(isOpaque(png)).toBe(true);
});

it('el gráfico destacado mide 1024 × 500 y no tiene canal alfa', () => {
  const png = readPng('assets/store/feature-graphic.png');
  expect([png.width, png.height]).toEqual([1024, 500]);
  expect(png.colorType).toBe(2);
});

it.each([
  ['assets/splash-icon.png', 1024],
  ['assets/favicon.png', 48],
])('%s mide %i px de lado', (path, size) => {
  const png = readPng(path);
  expect([png.width, png.height]).toEqual([size, size]);
});
