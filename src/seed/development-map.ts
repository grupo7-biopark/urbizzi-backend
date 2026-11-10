import sharp from 'sharp';
import type { Storage } from '../shared/application/storage/storage.interface.js';

/** Identificadores estáveis reservados aos exemplos do seed. */
export function seedId(numero: number): string {
  return `bee00500-0000-4000-8000-${String(numero).padStart(12, '0')}`;
}
export const PLANTA_DEV_ID = seedId(900);
export const ORIGINAL_DEV = `plantas/${PLANTA_DEV_ID}/original.png`;
export const TILE_DEV = `plantas/${PLANTA_DEV_ID}/0/0/0.webp`;
export async function prepararMapaDev(storage: Storage): Promise<void> {
  const celulas = Array.from(
    { length: 12 },
    (_, i) =>
      `<rect x="${8 + (i % 4) * 62}" y="${8 + Math.floor(i / 4) * 82}" width="54" height="74" fill="${i === 0 ? '#1d4ed8' : i === 1 ? '#be185d' : i === 2 ? '#515151' : '#16a34a'}" stroke="white" stroke-width="2"/>`,
  ).join('');
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e7e8e8"/>${celulas}</svg>`,
  );
  await storage.upload({
    bucket: 'originais',
    key: ORIGINAL_DEV,
    body: await sharp(svg).png().toBuffer(),
    contentType: 'image/png',
  });
  await storage.upload({
    bucket: 'tiles',
    key: TILE_DEV,
    body: await sharp(svg).webp().toBuffer(),
    contentType: 'image/webp',
  });
}
