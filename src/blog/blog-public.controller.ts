import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BlogCategoriesService } from './blog-categories.service';
import { BlogPostsService } from './blog-posts.service';
import { BlogPostsQueryDto } from './dto/blog-posts-query.dto';

/**
 * Read-only endpoints behind awadali.com/blog. No auth: everything here is
 * already public, and drafts are filtered out in the service, not here.
 */
@ApiTags('blog')
@Controller('blog')
export class BlogPublicController {
  constructor(
    private readonly postsService: BlogPostsService,
    private readonly categoriesService: BlogCategoriesService,
  ) {}

  @Get('posts')
  findPosts(@Query() query: BlogPostsQueryDto) {
    return this.postsService.findPublished(query);
  }

  @Get('posts/:slug')
  findPost(@Param('slug') slug: string) {
    return this.postsService.findPublishedBySlug(slug);
  }

  @Get('categories')
  findCategories() {
    return this.categoriesService.findPublic();
  }

  @Get('feed')
  feed() {
    return this.postsService.feed();
  }

  @Get('sitemap')
  sitemap() {
    return this.postsService.sitemap();
  }
}
