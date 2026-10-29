import { Readable } from 'node:stream';
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env } from '../../../config/env.validation.js';
import type {
  Storage,
  StorageBucket,
  StorageList,
  UploadInput,
} from '../../application/storage/storage.interface.js';
import { assertStorageKey } from '../../application/storage/storage-key.js';
import {
  BusinessRuleError,
  NotFoundError,
} from '../../domain/errors/domain.error.js';
import { S3_CLIENT, S3_PUBLIC_CLIENT } from './s3-client.js';

@Injectable()
export class StorageService implements Storage, OnModuleDestroy {
  constructor(
    @Inject(S3_CLIENT) private readonly client: S3Client,
    @Inject(S3_PUBLIC_CLIENT) private readonly publicClient: S3Client,
    private readonly config: ConfigService<Env, true>,
  ) {}
  async upload(input: UploadInput): Promise<void> {
    assertStorageKey(input.key);
    const bucket = this.bucketName(input.bucket);
    try {
      await new Upload({
        client: this.client,
        params: {
          Bucket: bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType ?? 'application/octet-stream',
        },
        partSize: 8 * 1024 * 1024,
        queueSize: 2,
        leavePartsOnError: false,
      }).done();
    } catch {
      throw new Error('Não foi possível enviar o arquivo ao armazenamento');
    }
  }
  async download(bucket: StorageBucket, key: string): Promise<Readable> {
    assertStorageKey(key);
    const name = this.bucketName(bucket);
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: name, Key: key }),
      );
      if (!(result.Body instanceof Readable))
        throw new Error('Stream indisponível');
      return result.Body;
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === 'NoSuchKey' || error.name === 'NotFound')
      )
        throw new NotFoundError(
          'ARQUIVO_NAO_ENCONTRADO',
          'Arquivo não encontrado',
        );
      throw new Error('Não foi possível obter o arquivo do armazenamento');
    }
  }
  async delete(bucket: StorageBucket, key: string): Promise<void> {
    assertStorageKey(key);
    const name = this.bucketName(bucket);
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: name, Key: key }),
      );
    } catch {
      throw new Error('Não foi possível excluir o arquivo do armazenamento');
    }
  }
  async list(
    bucket: StorageBucket,
    prefix: string,
    options: { limit?: number; continuationToken?: string } = {},
  ): Promise<StorageList> {
    assertStorageKey(prefix, true);
    const limit = options.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000)
      throw new BusinessRuleError(
        'LIMITE_ARQUIVOS_INVALIDO',
        'O limite deve estar entre 1 e 1000',
      );
    const name = this.bucketName(bucket);
    try {
      const result = await this.client.send(
        new ListObjectsV2Command({
          Bucket: name,
          Prefix: prefix,
          MaxKeys: limit,
          ContinuationToken: options.continuationToken,
        }),
      );
      return {
        items: (result.Contents ?? []).map((item) => ({
          key: item.Key ?? '',
          size: item.Size ?? 0,
          lastModified: item.LastModified ?? null,
        })),
        continuationToken: result.NextContinuationToken ?? null,
      };
    } catch {
      throw new Error('Não foi possível listar os arquivos do armazenamento');
    }
  }
  async getSignedUrl(
    bucket: StorageBucket,
    key: string,
    expiresIn?: number,
  ): Promise<string> {
    assertStorageKey(key);
    const ttl =
      expiresIn ?? this.config.get('S3_URL_EXPIRES_IN', { infer: true });
    if (!Number.isInteger(ttl) || ttl < 1 || ttl > 604800)
      throw new BusinessRuleError(
        'VALIDADE_URL_INVALIDA',
        'A validade da URL deve estar entre 1 e 604800 segundos',
      );
    const name = this.bucketName(bucket);
    try {
      return await getSignedUrl(
        this.publicClient,
        new GetObjectCommand({ Bucket: name, Key: key }),
        { expiresIn: ttl },
      );
    } catch {
      throw new Error('Não foi possível assinar a URL do arquivo');
    }
  }
  onModuleDestroy(): void {
    this.client.destroy();
    this.publicClient.destroy();
  }
  private bucketName(bucket: StorageBucket): string {
    if (bucket === 'originais')
      return this.config.get('S3_BUCKET_ORIGINAIS', { infer: true });
    if (bucket === 'tiles')
      return this.config.get('S3_BUCKET_TILES', { infer: true });
    throw new BusinessRuleError(
      'BUCKET_INVALIDO',
      'Bucket de armazenamento inválido',
    );
  }
}
