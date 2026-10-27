// Genera los PNG del ícono y de la tienda desde los SVG de assets/brand/ con Chrome sin ventana.
// Uso: pnpm brand:render   (CHROME=/ruta/al/binario para otro Chrome)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { decodePng, encodePng, withChannels } from './png.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// channels: 4 conserva la transparencia (o agrega alfa opaco), 3 la quita.
const OUTPUTS = [
  { svg: 'icon.svg', out: 'assets/icon.png', size: [1024, 1024], channels: 3 },
  {
    svg: 'android-icon-foreground.svg',
    out: 'assets/android-icon-foreground.png',
    size: [1024, 1024],
    channels: 4,
  },
  {
    svg: 'android-icon-background.svg',
    out: 'assets/android-icon-background.png',
    size: [1024, 1024],
    channels: 3,
  },
  {
    svg: 'android-icon-monochrome.svg',
    out: 'assets/android-icon-monochrome.png',
    size: [1024, 1024],
    channels: 4,
  },
  { svg: 'splash-icon.svg', out: 'assets/splash-icon.png', size: [1024, 1024], channels: 4 },
  { svg: 'favicon.svg', out: 'assets/favicon.png', size: [48, 48], channels: 4 },
  // Play pide el ícono en PNG de 32 bits: RGBA, pero opaco.
  { svg: 'store-icon-512.svg', out: 'assets/store/icon-512.png', size: [512, 512], channels: 4 },
  // El gráfico destacado va en PNG de 24 bits, sin alfa.
  {
    svg: 'feature-graphic.svg',
    out: 'assets/store/feature-graphic.png',
    size: [1024, 500],
    channels: 3,
  },
];

const scratch = mkdtempSync(join(tmpdir(), 'pulso-brand-'));
try {
  for (const { svg, out, size, channels } of OUTPUTS) {
    const shot = join(scratch, 'shot.png');
    execFileSync(
      chrome,
      [
        '--headless',
        '--disable-gpu',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        '--force-color-profile=srgb',
        '--default-background-color=00000000',
        `--window-size=${size[0]},${size[1]}`,
        `--screenshot=${shot}`,
        pathToFileURL(join(root, 'assets/brand', svg)).href,
      ],
      { stdio: 'ignore' },
    );
    // Chrome guarda RGB cuando todo es opaco y RGBA cuando hay transparencia: se fija aquí.
    const image = decodePng(readFileSync(shot));
    if (image.width !== size[0] || image.height !== size[1]) {
      throw new Error(`${svg}: salió de ${image.width}×${image.height}`);
    }
    writeFileSync(join(root, out), encodePng(withChannels(image, channels)));
    console.log(`${out}  ${size[0]}×${size[1]}`);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
