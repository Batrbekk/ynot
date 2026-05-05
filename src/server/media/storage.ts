/**
 * Backend-agnostic media storage interface for product/CMS images.
 * Phase 7a ships only `LocalFsStorage`; S3/R2 backends are placeholders
 * for follow-on phases (see spec §8).
 */
export interface MediaStorage {
  put(key: string, content: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ buffer: Buffer; contentType: string }>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
