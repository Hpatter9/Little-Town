// Writes build/icon.ico: the tray's campfire at 16, 32, 48 and 256 px, for the app and its installer.
// (An .ico may hold PNGs as they are, so no converter is needed.)
import { mkdirSync, writeFileSync } from 'node:fs';
import { trayIconPng } from '../src/main/trayIcon.ts';

const images = [1, 2, 3, 16].map((scale) => ({ size: 16 * scale, png: trayIconPng(scale) }));
const header = Buffer.alloc(6 + 16 * images.length);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(images.length, 4);
let offset = header.length;
images.forEach(({ size, png }, i) => {
  const e = 6 + 16 * i;
  header[e] = size % 256; // 256 is written as 0
  header[e + 1] = size % 256;
  header.writeUInt16LE(1, e + 4); // colour planes
  header.writeUInt16LE(32, e + 6); // bits per pixel
  header.writeUInt32LE(png.length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += png.length;
});
mkdirSync('build', { recursive: true });
writeFileSync('build/icon.ico', Buffer.concat([header, ...images.map((i) => i.png)]));
console.log('wrote build/icon.ico');
