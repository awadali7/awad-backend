import {
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminJwtGuard } from '../../admin/admin-jwt.guard';
import { BlogUploadsService } from './blog-uploads.service';
import {
  MAX_UPLOAD_BYTES,
  publicUploadsUrl,
  type UploadedImageFile,
} from './blog-uploads.util';

/**
 * Image uploads for blog posts. The guard runs before the file interceptor,
 * so nothing is read from an unauthenticated request. Files are kept in
 * memory only until their first bytes prove they are an image.
 */
@ApiTags('blog-admin')
@ApiBearerAuth('bearer')
@UseGuards(AdminJwtGuard)
@Controller('admin/blog/uploads')
export class BlogUploadsController {
  constructor(private readonly uploadsService: BlogUploadsService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    }),
  )
  upload(
    @UploadedFile() file: UploadedImageFile | undefined,
    @Req() request: Request,
  ) {
    return this.uploadsService.saveImage(file, publicUploadsUrl(request));
  }
}
