import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { SLUG_PATTERN } from '../blog.util';

export class UpsertBlogCategoryDto {
  @ApiProperty({ example: 'React' })
  @IsString()
  @Matches(/\S/, { message: 'name must not be blank' })
  @MaxLength(60)
  name!: string;

  @ApiPropertyOptional({
    example: 'react',
    description:
      'Defaults to the name on create. Left as-is on update unless sent.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Matches(SLUG_PATTERN, {
    message:
      'slug must be lowercase letters and numbers joined by single hyphens',
  })
  slug?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Intro text and meta description for the category page.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string | null;
}
