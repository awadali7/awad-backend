import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../admin/admin-jwt.guard';
import { CurrentAdmin } from '../admin/current-admin.decorator';
import type { AuthenticatedAdmin } from '../admin/admin-jwt.strategy';
import { BlogPostsService } from './blog-posts.service';
import { UpsertBlogPostDto } from './dto/upsert-blog-post.dto';

/**
 * The blog is shared by every admin account, so unlike the money endpoints
 * nothing here is filtered by owner. The signed-in admin is only recorded as
 * the author of the posts they create.
 */
@ApiTags('blog-admin')
@ApiBearerAuth('bearer')
@UseGuards(AdminJwtGuard)
@Controller('admin/blog/posts')
export class BlogAdminPostsController {
  constructor(private readonly postsService: BlogPostsService) {}

  @Get()
  findAll() {
    return this.postsService.findAllForAdmin();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.postsService.findOneForAdmin(id);
  }

  @Post()
  create(
    @Body() dto: UpsertBlogPostDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.postsService.create(dto, admin.id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpsertBlogPostDto) {
    return this.postsService.update(id, dto);
  }

  @Post(':id/publish')
  @HttpCode(200)
  publish(@Param('id') id: string) {
    return this.postsService.publish(id);
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  unpublish(@Param('id') id: string) {
    return this.postsService.unpublish(id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.postsService.remove(id);
  }
}
