import type { Readable } from 'node:stream';
export const STORAGE = Symbol('STORAGE');
export type StorageBucket = 'originais' | 'tiles';
export interface UploadInput {
  bucket: StorageBucket;
  key: string;
  body: Buffer | Readable;
  contentType?: string;
}
export interface StorageItem {
  key: string;
  size: number;
  lastModified: Date | null;
}
export interface StorageList {
  items: StorageItem[];
  continuationToken: string | null;
}
export interface Storage {
  upload(input: UploadInput): Promise<void>;
  download(bucket: StorageBucket, key: string): Promise<Readable>;
  delete(bucket: StorageBucket, key: string): Promise<void>;
  list(
    bucket: StorageBucket,
    prefix: string,
    options?: { limit?: number; continuationToken?: string },
  ): Promise<StorageList>;
  getSignedUrl(
    bucket: StorageBucket,
    key: string,
    expiresIn?: number,
  ): Promise<string>;
}
