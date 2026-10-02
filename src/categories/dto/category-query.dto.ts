import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { CATEGORY_KINDS } from './upsert-category.dto';
import type { CategoryKindDto } from './upsert-category.dto';

export class CategoryQueryDto {
  @ApiPropertyOptional({ enum: CATEGORY_KINDS })
  @IsOptional()
  @IsIn(CATEGORY_KINDS)
  kind?: CategoryKindDto;
}
