import sharp from 'sharp';
import type {
  Storage,
  UploadInput,
} from '../shared/application/storage/storage.interface.js';
import {
  prepararMapaDev,
  PLANTA_DEV_ID,
  ORIGINAL_DEV,
  TILE_DEV,
  seedId,
} from './development-map.js';
describe('Arquivos do mapa de desenvolvimento', () => {
  it('gera original e tile reais com chaves estáveis', async () => {
    const upload = vi
      .fn<(input: UploadInput) => Promise<void>>()
      .mockResolvedValue(undefined);
    await prepararMapaDev({ upload } as unknown as Storage);
    expect(upload.mock.calls.map(([i]) => [i.bucket, i.key])).toEqual([
      ['originais', ORIGINAL_DEV],
      ['tiles', TILE_DEV],
    ]);
    for (const [input] of upload.mock.calls) {
      expect(await sharp(input.body as Buffer).metadata()).toMatchObject({
        width: 256,
        height: 256,
        format: input.bucket === 'tiles' ? 'webp' : 'png',
      });
    }
    expect(PLANTA_DEV_ID).toBe(seedId(900));
  });
});
