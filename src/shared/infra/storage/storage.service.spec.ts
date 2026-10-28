import { Readable } from 'node:stream';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { validate, type Env } from '../../../config/env.validation.js';
import { StorageService } from './storage.service.js';
import { createS3Client } from './s3-client.js';
const mocks = vi.hoisted(() => ({ done: vi.fn() }));
vi.mock('@aws-sdk/lib-storage', () => ({
  Upload: class {
    done() {
      return mocks.done();
    }
  },
}));

describe('StorageService', () => {
  const config = new ConfigService<Env, true>(
    validate({
      DATABASE_URL: 'postgresql://local/teste',
      S3_ACCESS_KEY_ID: 'chave-teste',
      S3_SECRET_ACCESS_KEY: 'segredo-ficticio',
      S3_PUBLIC_ENDPOINT: 'https://arquivos.exemplo.com',
    }),
  );
  const send = vi.fn();
  const destroy = vi.fn();
  const client = { send, destroy } as unknown as S3Client;
  let publicClient: S3Client;
  let service: StorageService;
  beforeEach(() => {
    vi.resetAllMocks();
    publicClient = createS3Client(config, true);
    service = new StorageService(client, publicClient, config);
  });
  afterEach(() => {
    service.onModuleDestroy();
  });
  it('gera URL assinada com host público, chave escapada e validade', async () => {
    const url = new URL(
      await service.getSignedUrl('originais', 'p/área #1%.png', 60),
    );
    expect(url.origin).toBe('https://arquivos.exemplo.com');
    expect(decodeURIComponent(url.pathname)).toBe(
      '/plantas-originais/p/área #1%.png',
    );
    expect(url.searchParams.get('X-Amz-Expires')).toBe('60');
    expect(url.searchParams.has('X-Amz-Signature')).toBe(true);
    expect(url.searchParams.get('X-Amz-Credential')).toContain(
      '/garage/s3/aws4_request',
    );
  });
  it('permite outro endpoint, região e endereçamento virtual por configuração', async () => {
    const cfg = new ConfigService<Env, true>(
      validate({
        DATABASE_URL: 'postgresql://local/teste',
        S3_ACCESS_KEY_ID: 'teste',
        S3_SECRET_ACCESS_KEY: 'teste',
        S3_ENDPOINT: 'https://s3.exemplo.com',
        S3_REGION: 'us-east-1',
        S3_FORCE_PATH_STYLE: 'false',
      }),
    );
    const s3 = createS3Client(cfg, true);
    try {
      const url = new URL(
        await new StorageService(client, s3, cfg).getSignedUrl(
          'tiles',
          'id/0.png',
        ),
      );
      expect(url.hostname).toBe('plantas-tiles.s3.exemplo.com');
      expect(url.pathname).toBe('/id/0.png');
      expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
    } finally {
      s3.destroy();
    }
  });
  it('retorna download como stream', async () => {
    const body = Readable.from(['teste']);
    send.mockResolvedValue({ Body: body });
    expect(await service.download('originais', 'id.pdf')).toBe(body);
    expect(send.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand);
    expect(send.mock.calls[0][0].input.Bucket).toBe('plantas-originais');
  });
  it('exclui somente o objeto informado', async () => {
    send.mockResolvedValue({});
    await service.delete('tiles', 'id/0.png');
    expect(send.mock.calls[0][0]).toBeInstanceOf(DeleteObjectCommand);
    expect(send.mock.calls[0][0].input).toEqual({
      Bucket: 'plantas-tiles',
      Key: 'id/0.png',
    });
  });
  it('lista com prefixo e paginação por cursor', async () => {
    send.mockResolvedValue({
      Contents: [{ Key: 'p/a', Size: 10, LastModified: new Date(0) }],
      NextContinuationToken: 'proximo',
    });
    expect(
      await service.list('tiles', 'p/', {
        limit: 1,
        continuationToken: 'anterior',
      }),
    ).toEqual({
      items: [{ key: 'p/a', size: 10, lastModified: new Date(0) }],
      continuationToken: 'proximo',
    });
    expect(send.mock.calls[0][0]).toBeInstanceOf(ListObjectsV2Command);
    expect(send.mock.calls[0][0].input).toMatchObject({
      MaxKeys: 1,
      Prefix: 'p/',
      ContinuationToken: 'anterior',
    });
    send.mockResolvedValue({});
    expect(await service.list('originais', '')).toEqual({
      items: [],
      continuationToken: null,
    });
  });
  it('converte arquivo inexistente e oculta detalhes do provedor', async () => {
    send.mockRejectedValue(
      Object.assign(new Error('segredo'), { name: 'NoSuchKey' }),
    );
    await expect(
      service.download('originais', 'ausente'),
    ).rejects.toMatchObject({ code: 'ARQUIVO_NAO_ENCONTRADO' });
    send.mockRejectedValue(new Error('segredo'));
    await expect(service.download('originais', 'a')).rejects.toThrow(
      'Não foi possível obter',
    );
    await expect(service.list('tiles', '')).rejects.toThrow(
      'Não foi possível listar',
    );
    await expect(service.delete('tiles', 'a')).rejects.toThrow(
      'Não foi possível excluir',
    );
  });
  it('envia arquivo e propaga falha de upload sem detalhes sensíveis', async () => {
    mocks.done.mockResolvedValue({});
    await service.upload({
      bucket: 'originais',
      key: 'a.pdf',
      body: Buffer.from('teste'),
    });
    expect(mocks.done).toHaveBeenCalledOnce();
    mocks.done.mockRejectedValue(new Error('segredo'));
    await expect(
      service.upload({
        bucket: 'tiles',
        key: '0.png',
        body: Readable.from(['teste']),
        contentType: 'image/png',
      }),
    ).rejects.toThrow('Não foi possível enviar');
  });
  it.each([0, -1, 1001, 1.5])('valida limite de listagem %s', async (limit) => {
    await expect(service.list('tiles', '', { limit })).rejects.toMatchObject({
      code: 'LIMITE_ARQUIVOS_INVALIDO',
    });
    expect(send).not.toHaveBeenCalled();
  });
  it.each([0, -1, 604801, 1.5])(
    'valida prazo de assinatura %s',
    async (ttl) => {
      await expect(
        service.getSignedUrl('tiles', '0.png', ttl),
      ).rejects.toMatchObject({ code: 'VALIDADE_URL_INVALIDA' });
    },
  );
  it('recusa bucket fora da lista permitida', async () => {
    await expect(service.delete('outro' as 'tiles', 'a')).rejects.toMatchObject(
      { code: 'BUCKET_INVALIDO' },
    );
  });
});
