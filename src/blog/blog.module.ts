import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { BlogAdminCategoriesController } from './blog-admin-categories.controller';
import { BlogAdminPostsController } from './blog-admin-posts.controller';
import { BlogCategoriesService } from './blog-categories.service';
import { BlogPostsService } from './blog-posts.service';
import { BlogPublicController } from './blog-public.controller';
import { BlogUploadsController } from './uploads/blog-uploads.controller';
import { BlogUploadsService } from './uploads/blog-uploads.service';

/** Public blog reads (/blog/*) and the admin console's blog tools (/admin/blog/*). */
@Module({
  imports: [AdminModule],
  controllers: [
    BlogPublicController,
    BlogAdminPostsController,
    BlogAdminCategoriesController,
    BlogUploadsController,
  ],
  providers: [BlogPostsService, BlogCategoriesService, BlogUploadsService],
})
export class BlogModule {}
