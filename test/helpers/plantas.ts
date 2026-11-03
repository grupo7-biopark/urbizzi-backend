import type { INestApplication } from '@nestjs/common';
import sharp from 'sharp';
import request from 'supertest';
import { PrismaService } from '../../src/shared/infra/database/prisma.service.js';
import { StorageService } from '../../src/shared/infra/storage/storage.service.js';

/** PNG de uma cor só, para montar plantas pequenas de teste. */
export function png(
  width: number,
  height: number,
  background = '#4a8',
): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background } })
    .png()
    .toBuffer();
}

/** Envia uma planta pelo endpoint e devolve o corpo da resposta (201). */
export async function enviarPlanta(
  app: INestApplication,
  token: string,
  arquivos: [string, Buffer][],
  nome = 'Masterplan',
): Promise<{ id: string; versao: number }> {
  const req = request(app.getHttpServer())
    .post('/v1/plantas')
    .auth(token, { type: 'bearer' })
    .field('nome', nome);
  for (const [arquivo, conteudo] of arquivos) {
    req.attach('arquivos', conteudo, arquivo);
  }
  const res = await req.expect(201);
  return res.body;
}

/**
 * Remove do armazenamento os originais e tiles das plantas do banco de
 * teste. Chame antes de `limparBanco`; só apaga os prefixos dessas plantas.
 */
export async function limparArquivosPlantas(
  app: INestApplication,
): Promise<void> {
  const prisma = app.get(PrismaService);
  const storage = app.get(StorageService);
  const plantas = await prisma.planta.findMany();
  for (const planta of plantas) {
    await Promise.all(
      planta.originais.map((chave) => storage.delete('originais', chave)),
    );
    let continuationToken: string | undefined;
    do {
      const pagina = await storage.list('tiles', `plantas/${planta.id}/`, {
        limit: 1000,
        continuationToken,
      });
      await Promise.all(
        pagina.items.map((item) => storage.delete('tiles', item.key)),
      );
      continuationToken = pagina.continuationToken ?? undefined;
    } while (continuationToken);
  }
}
