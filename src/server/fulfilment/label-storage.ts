/**
 * Storage abstraction for carrier-generated label PDFs.
 *
 * Implementations: {@link LocalFsStorage} (Phase 5 default).
 * S3 / R2 backends are stubs in {@link createLabelStorage} until Phase 6.
 */
export interface LabelStorage {
  /**
   * Persist a label PDF for the given shipment id.
   *
   * @param id Shipment identifier (used as the file basename).
   * @param content Raw PDF bytes.
   * @returns The storage key (opaque to callers; pass back to {@link get}/{@link delete}).
   */
  put(id: string, content: Buffer): Promise<string>;

  /**
   * Read back PDF bytes for a previously stored key. Throws if missing.
   */
  get(key: string): Promise<Buffer>;

  /**
   * Remove the stored PDF. Idempotent — missing keys do not throw.
   */
  delete(key: string): Promise<void>;
}
