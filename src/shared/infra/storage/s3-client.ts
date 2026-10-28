import { S3Client } from '@aws-sdk/client-s3';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.validation.js';
export const S3_CLIENT = Symbol('S3_CLIENT');
export const S3_PUBLIC_CLIENT = Symbol('S3_PUBLIC_CLIENT');
export function createS3Client(
  config: ConfigService<Env, true>,
  publicEndpoint = false,
): S3Client {
  return new S3Client({
    endpoint: publicEndpoint
      ? (config.get('S3_PUBLIC_ENDPOINT', { infer: true }) ??
        config.get('S3_ENDPOINT', { infer: true }))
      : config.get('S3_ENDPOINT', { infer: true }),
    region: config.get('S3_REGION', { infer: true }),
    forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
    credentials: {
      accessKeyId: config.get('S3_ACCESS_KEY_ID', { infer: true }),
      secretAccessKey: config.get('S3_SECRET_ACCESS_KEY', { infer: true }),
    },
    // Evita checksums opcionais/aws-chunked não suportados por alguns provedores S3.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}
