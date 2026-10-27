// Lee y escribe PNG de 8 bits sin entrelazar (RGB o RGBA), lo único que produce Chrome.
// Sirve para fijar el canal alfa de cada salida sin agregar dependencias.
import { crc32, deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS = { 2: 3, 6: 4 };

export function decodePng(file) {
  if (!file.subarray(0, 8).equals(SIGNATURE)) throw new Error('No es un PNG');
  let offset = 8;
  let header;
  const idat = [];
  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString('latin1', offset + 4, offset + 8);
    const data = file.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === 'IDAT') {
      idat.push(data);
    }
    offset += 12 + length;
  }
  const channels = CHANNELS[header?.colorType];
  if (header?.bitDepth !== 8 || header.interlace !== 0 || !channels) {
    throw new Error(`PNG no soportado: ${JSON.stringify(header)}`);
  }
  const { width, height } = header;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x;
      const left = x >= channels ? pixels[i - channels] : 0;
      const up = y > 0 ? pixels[i - stride] : 0;
      const upLeft = x >= channels && y > 0 ? pixels[i - stride - channels] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      pixels[i] = (row[x] + predictor) & 0xff;
    }
  }
  return { width, height, channels, pixels };
}

/**
 * Pasa la imagen a RGB (3 canales) o RGBA (4). Al agregar alfa, cada píxel queda opaco; quitarlo
 * de una imagen con transparencia es un error, no un aplanado silencioso.
 */
export function withChannels(image, channels) {
  if (image.channels === channels) return image;
  const count = image.width * image.height;
  const pixels = Buffer.alloc(count * channels, 0xff);
  for (let p = 0; p < count; p++) {
    if (image.channels === 4 && image.pixels[p * 4 + 3] !== 0xff) {
      throw new Error('La imagen tiene transparencia y la salida no la admite');
    }
    image.pixels.copy(pixels, p * channels, p * image.channels, p * image.channels + 3);
  }
  return { ...image, channels, pixels };
}

export function encodePng({ width, height, channels, pixels }) {
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = channels === 4 ? 6 : 2;
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
