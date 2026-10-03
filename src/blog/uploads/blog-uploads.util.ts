import { join, resolve } from 'node:path';

/** 5 MB. The admin console shrinks large photos before they get here. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type DetectedImage = { extension: string; mimeType: string };

/** The parts of a Multer upload this module reads. */
export interface UploadedImageFile {
  buffer: Buffer;
  size: number;
}

const hasBytes = (buffer: Buffer, bytes: number[], offset = 0) =>
  bytes.every((byte, index) => buffer[offset + index] === byte);

const text = (buffer: Buffer, start: number, end: number) =>
  buffer.subarray(start, end).toString('latin1');

/**
 * Recognises an image by its first bytes, never by the file name or the type
 * the browser claims. SVG is deliberately not accepted: it can carry scripts.
 */
export function detectImage(buffer: Buffer): DetectedImage | null {
  if (buffer.length < 12) return null;
  if (hasBytes(buffer, [0xff, 0xd8, 0xff])) {
    return { extension: 'jpg', mimeType: 'image/jpeg' };
  }
  if (hasBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { extension: 'png', mimeType: 'image/png' };
  }
  const signature = text(buffer, 0, 6);
  if (signature === 'GIF87a' || signature === 'GIF89a') {
    return { extension: 'gif', mimeType: 'image/gif' };
  }
  if (text(buffer, 0, 4) === 'RIFF' && text(buffer, 8, 12) === 'WEBP') {
    return { extension: 'webp', mimeType: 'image/webp' };
  }
  if (
    text(buffer, 4, 8) === 'ftyp' &&
    ['avif', 'avis'].includes(text(buffer, 8, 12))
  ) {
    return { extension: 'avif', mimeType: 'image/avif' };
  }
  return null;
}

/**
 * Where uploads live on disk. Set UPLOADS_DIR to a folder outside the code
 * (for example /var/www/awad-uploads) so a deploy never deletes them.
 */
export function uploadsRoot(): string {
  return resolve(process.env.UPLOADS_DIR || join(process.cwd(), 'uploads'));
}

type RequestLike = {
  protocol: string;
  get(name: string): string | undefined;
};

/**
 * The public address of the uploads folder. UPLOADS_PUBLIC_URL wins when set;
 * otherwise it is this API's own /uploads address, using the scheme nginx
 * reports in X-Forwarded-Proto so links come out as https behind the proxy.
 */
export function publicUploadsUrl(request: RequestLike): string {
  const configured = process.env.UPLOADS_PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');

  const forwarded = request.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol =
    forwarded === 'https' || forwarded === 'http'
      ? forwarded
      : request.protocol;
  return `${protocol}://${request.get('host')}/uploads`;
}
