import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyOrAdminGuard } from '../admin/api-key-or-admin.guard';
import { CategoriesService } from './categories.service';
import { CategoryQueryDto } from './dto/category-query.dto';
import { UpsertCategoryDto } from './dto/upsert-category.dto';

@ApiTags('categories')
@ApiSecurity('api-key')
@ApiBearerAuth('bearer')
@UseGuards(ApiKeyOrAdminGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll(@Query() query: CategoryQueryDto) {
    return this.categoriesService.findAll(query.kind);
  }

  @Post()
  create(@Body() dto: UpsertCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpsertCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.categoriesService.remove(id);
  }
}
