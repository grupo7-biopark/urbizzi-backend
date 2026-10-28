import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.validation.js';
import { STORAGE } from '../../application/storage/storage.interface.js';
import { S3_CLIENT, S3_PUBLIC_CLIENT, createS3Client } from './s3-client.js';
import { StorageService } from './storage.service.js';
@Module({
  providers: [
    {
      provide: S3_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => createS3Client(config),
    },
    {
      provide: S3_PUBLIC_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        createS3Client(config, true),
    },
    StorageService,
    { provide: STORAGE, useExisting: StorageService },
  ],
  exports: [StorageService, STORAGE],
})
export class StorageModule {}
