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
import { BlogCategoriesService } from './blog-categories.service';
import { UpsertBlogCategoryDto } from './dto/upsert-blog-category.dto';

@ApiTags('blog-admin')
@ApiBearerAuth('bearer')
@UseGuards(AdminJwtGuard)
@Controller('admin/blog/categories')
export class BlogAdminCategoriesController {
  constructor(private readonly categoriesService: BlogCategoriesService) {}

  @Get()
  findAll() {
    return this.categoriesService.findAllForAdmin();
  }

  @Post()
  create(@Body() dto: UpsertBlogCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpsertBlogCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.categoriesService.remove(id);
  }
}
