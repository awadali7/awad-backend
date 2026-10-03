import { BadRequestException } from '@nestjs/common';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BlogUploadsService } from './blog-uploads.service';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 1),
]);

describe('BlogUploadsService', () => {
  let dir: string;
  let service: BlogUploadsService;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'blog-uploads-'));
    process.env.UPLOADS_DIR = dir;
    service = new BlogUploadsService();
  });

  afterEach(() => {
    delete process.env.UPLOADS_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  it('saves the image under a dated folder with a random name', async () => {
    const saved = await service.saveImage(
      { buffer: PNG, size: PNG.length },
      'https://api.awadali.com/uploads',
    );

    expect(saved.path).toMatch(/^blog\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/);
    expect(saved.url).toBe(`https://api.awadali.com/uploads/${saved.path}`);
    expect(saved).toMatchObject({ size: PNG.length, type: 'image/png' });
    const onDisk = join(dir, ...saved.path.split('/'));
    expect(existsSync(onDisk)).toBe(true);
    expect(readFileSync(onDisk).equals(PNG)).toBe(true);
  });

  it('gives every upload its own name', async () => {
    const first = await service.saveImage(
      { buffer: PNG, size: PNG.length },
      '',
    );
    const second = await service.saveImage(
      { buffer: PNG, size: PNG.length },
      '',
    );
    expect(first.path).not.toBe(second.path);
  });

  it('refuses a missing or empty file', async () => {
    await expect(service.saveImage(undefined, '')).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.saveImage({ buffer: Buffer.alloc(0), size: 0 }, ''),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuses a file that is not an image, whatever it is called', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script/>',
    );
    await expect(
      service.saveImage({ buffer: svg, size: svg.length }, ''),
    ).rejects.toThrow(
      'Only JPEG, PNG, GIF, WebP and AVIF images can be uploaded',
    );
  });
});
