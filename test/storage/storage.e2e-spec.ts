import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { S3_CLIENT } from '../../src/shared/infra/storage/s3-client.js';
import { createHash, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import { StorageModule } from '../../src/shared/infra/storage/storage.module.js';
import { StorageService } from '../../src/shared/infra/storage/storage.service.js';
import type { StorageBucket } from '../../src/shared/application/storage/storage.interface.js';
import { validate } from '../../src/config/env.validation.js';

describe('Storage com Garage (integração)', () => {
  let app: INestApplication;
  let storage: StorageService;
  const prefix = `integracao/${randomUUID()}`;
  const objetos: { bucket: StorageBucket; key: string }[] = [];
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate }),
        StorageModule,
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    storage = app.get(StorageService);
  });
  afterAll(async () => {
    if (storage)
      for (const objeto of objetos)
        await storage.delete(objeto.bucket, objeto.key);
    await app?.close();
  });
  async function upload(
    bucket: StorageBucket,
    key: string,
    body: Buffer | Readable,
  ) {
    objetos.push({ bucket, key });
    await storage.upload({
      bucket,
      key,
      body,
      contentType: 'application/octet-stream',
    });
  }
  it('upload multipart e download em stream de 32 MiB preservam conteúdo', async () => {
    const calls = vi.spyOn(app.get<S3Client>(S3_CLIENT), 'send');
    const key = `${prefix}/grande.bin`;
    const chunk = Buffer.alloc(1024 * 1024, 29);
    const expected = createHash('sha256');
    for (let i = 0; i < 32; i++) expected.update(chunk);
    await upload(
      'originais',
      key,
      Readable.from(
        (function* () {
          for (let i = 0; i < 32; i++) yield chunk;
        })(),
      ),
    );
    expect(
      calls.mock.calls.some(
        ([cmd]) => cmd instanceof CreateMultipartUploadCommand,
      ),
    ).toBe(true);
    expect(
      calls.mock.calls.filter(([cmd]) => cmd instanceof UploadPartCommand),
    ).toHaveLength(4);
    expect(
      calls.mock.calls.some(
        ([cmd]) => cmd instanceof CompleteMultipartUploadCommand,
      ),
    ).toBe(true);
    calls.mockRestore();
    const hash = createHash('sha256');
    let bytes = 0;
    for await (const part of await storage.download('originais', key)) {
      const data = part as Buffer;
      bytes += data.length;
      hash.update(data);
    }
    expect(bytes).toBe(32 * 1024 * 1024);
    expect(hash.digest('hex')).toBe(expected.digest('hex'));
    const url = await storage.getSignedUrl('originais', key, 60);
    const response = await fetch(url);
    expect(response.status).toBe(200);
    expect(
      createHash('sha256')
        .update(Buffer.from(await response.arrayBuffer()))
        .digest('hex'),
    ).toBe(
      createHash('sha256')
        .update(Buffer.alloc(32 * 1024 * 1024, 29))
        .digest('hex'),
    );
  }, 60000);
  it('lista apenas o prefixo solicitado com cursor e exclui objetos', async () => {
    for (const name of ['a', 'b', 'c'])
      await upload('tiles', `${prefix}/pagina/${name}.png`, Buffer.from(name));
    await upload('tiles', `${prefix}/fora.png`, Buffer.from('fora'));
    const first = await storage.list('tiles', `${prefix}/pagina/`, {
      limit: 2,
    });
    expect(first.items).toHaveLength(2);
    expect(first.continuationToken).toBeTruthy();
    const next = await storage.list('tiles', `${prefix}/pagina/`, {
      limit: 2,
      continuationToken: first.continuationToken!,
    });
    expect([...first.items, ...next.items].map((i) => i.key).sort()).toEqual(
      ['a', 'b', 'c'].map((n) => `${prefix}/pagina/${n}.png`),
    );
    const key = `${prefix}/pagina/a.png`;
    await storage.delete('tiles', key);
    await storage.delete('tiles', key);
    await expect(storage.download('tiles', key)).rejects.toMatchObject({
      code: 'ARQUIVO_NAO_ENCONTRADO',
    });
  });
  it('assina chaves especiais corretamente e mantém buckets privados', async () => {
    const key = `${prefix}/área #1%.png`;
    await upload('tiles', key, Buffer.from('imagem'));
    const url = new URL(await storage.getSignedUrl('tiles', key, 60));
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('imagem');
    url.search = '';
    expect((await fetch(url)).status).toBe(403);
  });
});
