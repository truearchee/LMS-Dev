import fs from 'fs';
import path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// StorageService Interface
// All adapters implement this. Routes call only the interface — zero coupling
// to the underlying storage mechanism (local disk, S3, R2, GCS, etc.)
// ─────────────────────────────────────────────────────────────────────────────

export interface StorageService {
  /** Upload a file buffer. Returns the public URL of the stored file. */
  upload(file: Buffer, filename: string, mimeType: string): Promise<string>;

  /** Delete a file by its public URL. */
  delete(url: string): Promise<void>;

  /**
   * Generate a time-limited signed URL for private assets.
   * Optional — only implemented by cloud adapters.
   */
  getSignedUrl?(url: string, expiresInSeconds: number): Promise<string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// LocalStorageService
// Wraps the current uploads/ directory logic.
// Returns: http://localhost:3001/uploads/<filename>
// ─────────────────────────────────────────────────────────────────────────────

export class LocalStorageService implements StorageService {
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor(uploadDir?: string, baseUrl?: string) {
    this.uploadDir = uploadDir ?? path.join(process.cwd(), 'uploads');
    this.baseUrl   = baseUrl ?? 'http://localhost:3001/uploads';
    // Ensure directory exists at instantiation time
    fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  async upload(file: Buffer, filename: string, _mimeType: string): Promise<string> {
    const safeFilename = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const targetPath   = path.join(this.uploadDir, safeFilename);
    await fs.promises.writeFile(targetPath, file);
    return `${this.baseUrl}/${safeFilename}`;
  }

  async delete(url: string): Promise<void> {
    const filename = url.split('/').pop();
    if (!filename) return;
    const targetPath = path.join(this.uploadDir, filename);
    await fs.promises.rm(targetPath, { force: true });
  }

  // Local storage has no concept of signed URLs — not implemented
}

// ─────────────────────────────────────────────────────────────────────────────
// Future adapters — uncomment and implement when cloud storage is configured
// ─────────────────────────────────────────────────────────────────────────────
// export class S3StorageService implements StorageService { ... }
// export class R2StorageService implements StorageService { ... }
