import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  detectImage,
  uploadsRoot,
  type UploadedImageFile,
} from './blog-uploads.util';

export type BlogImageUpload = {
  /** The address to put in a post: cover field or markdown image. */
  url: string;
  /** Location inside the uploads folder, e.g. blog/2026/10/<id>.webp. */
  path: string;
  size: number;
  type: string;
};

@Injectable()
export class BlogUploadsService {
  private readonly root = uploadsRoot();

  /**
   * Saves an image under blog/<year>/<month>/ with a random name. The name
   * never comes from the upload, so it can't overwrite or escape the folder.
   */
  async saveImage(
    file: UploadedImageFile | undefined,
    publicBaseUrl: string,
  ): Promise<BlogImageUpload> {
    if (!file || file.size === 0) {
      throw new BadRequestException('Attach an image in the "file" field');
    }
    const image = detectImage(file.buffer);
    if (!image) {
      throw new BadRequestException(
        'Only JPEG, PNG, GIF, WebP and AVIF images can be uploaded',
      );
    }

    const now = new Date();
    const folder = [
      'blog',
      String(now.getUTCFullYear()),
      String(now.getUTCMonth() + 1).padStart(2, '0'),
    ];
    const name = `${randomUUID()}.${image.extension}`;

    await mkdir(join(this.root, ...folder), { recursive: true });
    // 'wx' fails rather than overwrite, should a name ever repeat.
    await writeFile(join(this.root, ...folder, name), file.buffer, {
      flag: 'wx',
    });

    const path = [...folder, name].join('/');
    return {
      url: `${publicBaseUrl}/${path}`,
      path,
      size: file.size,
      type: image.mimeType,
    };
  }
}
