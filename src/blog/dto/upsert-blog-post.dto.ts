import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsNotIn,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { MAX_TAGS, RESERVED_POST_SLUGS, SLUG_PATTERN } from '../blog.util';

/**
 * About 9,000 words. Keeps a whole post comfortably inside the API's JSON
 * body limit, so a long article fails here with a clear message rather than
 * as an opaque 413 from the body parser.
 */
export const MAX_CONTENT_LENGTH = 60_000;

const NOT_BLANK = /\S/;
const HTTPS_URL = { protocols: ['https'], require_protocol: true };

/**
 * Cover links are https only in production. Local development also accepts
 * http with no domain ending, so an image uploaded to http://localhost:3001
 * can be used as a cover. PM2 sets NODE_ENV before this file is loaded.
 */
const COVER_URL =
  process.env.NODE_ENV === 'production'
    ? HTTPS_URL
    : {
        protocols: ['https', 'http'],
        require_protocol: true,
        require_tld: false,
      };

export class UpsertBlogPostDto {
  @ApiProperty({ example: 'What changed in Next.js caching' })
  @IsString()
  @Matches(NOT_BLANK, { message: 'title must not be blank' })
  @MaxLength(150)
  title!: string;

  @ApiProperty({
    example: 'nextjs-caching-changes',
    description:
      'Lowercase words joined by hyphens. Cannot change once the post has been published.',
  })
  @IsString()
  @MaxLength(80)
  @Matches(SLUG_PATTERN, {
    message:
      'slug must be lowercase letters and numbers joined by single hyphens',
  })
  @IsNotIn(RESERVED_POST_SLUGS, {
    message: 'that slug is reserved by the blog',
  })
  slug!: string;

  @ApiProperty({ description: 'Card text and default meta description.' })
  @IsString()
  @Matches(NOT_BLANK, { message: 'excerpt must not be blank' })
  @MaxLength(300)
  excerpt!: string;

  @ApiProperty({ description: 'Markdown body.' })
  @IsString()
  @Matches(NOT_BLANK, { message: 'content must not be blank' })
  @MaxLength(MAX_CONTENT_LENGTH)
  content!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl(COVER_URL, { message: 'coverImageUrl must be a full https link' })
  @MaxLength(500)
  coverImageUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  coverImageAlt?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional({ type: [String], example: ['nextjs', 'react'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TAGS)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags?: string[];

  @ApiPropertyOptional({
    nullable: true,
    description: 'Replaces the title tag only.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(70)
  seoTitle?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Replaces the excerpt as the meta description.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  seoDescription?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Only for posts that first appeared on another site.',
  })
  @IsOptional()
  @IsUrl(HTTPS_URL, { message: 'canonicalUrl must be a full https link' })
  @MaxLength(500)
  canonicalUrl?: string | null;
}
