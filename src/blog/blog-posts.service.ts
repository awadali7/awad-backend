import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { normalizeTags, readingMinutes } from './blog.util';
import { BlogPostsQueryDto } from './dto/blog-posts-query.dto';
import { UpsertBlogPostDto } from './dto/upsert-blog-post.dto';

export const DEFAULT_PAGE_SIZE = 12;
export const RELATED_POST_COUNT = 3;
export const FEED_SIZE = 20;

/** Every public read goes through this filter, so a draft can never leak. */
const PUBLISHED = { status: 'published' } satisfies Prisma.BlogPostWhereInput;

const NEWEST_FIRST: Prisma.BlogPostOrderByWithRelationInput[] = [
  { publishedAt: 'desc' },
  { id: 'asc' },
];

/** What a card needs: never the body, never authorship or draft state. */
const SUMMARY_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  coverImageUrl: true,
  coverImageAlt: true,
  tags: true,
  readingMinutes: true,
  publishedAt: true,
  contentUpdatedAt: true,
  category: { select: { name: true, slug: true } },
} satisfies Prisma.BlogPostSelect;

const DETAIL_SELECT = {
  ...SUMMARY_SELECT,
  content: true,
  seoTitle: true,
  seoDescription: true,
  canonicalUrl: true,
  categoryId: true,
} satisfies Prisma.BlogPostSelect;

const ADMIN_ROW_SELECT = {
  id: true,
  slug: true,
  title: true,
  status: true,
  tags: true,
  readingMinutes: true,
  publishedAt: true,
  contentUpdatedAt: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, slug: true } },
  author: { select: { name: true, username: true } },
} satisfies Prisma.BlogPostSelect;

const ADMIN_INCLUDE = {
  category: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.BlogPostInclude;

@Injectable()
export class BlogPostsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Public ---------------------------------------------------------------

  /** One page of published posts, newest first, optionally filtered. */
  async findPublished(query: BlogPostsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    const where: Prisma.BlogPostWhereInput = { ...PUBLISHED };
    if (query.category) where.category = { slug: query.category };
    if (query.tag?.trim()) where.tags = { has: query.tag.trim().toLowerCase() };

    const search = query.q?.trim();
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
        { tags: { has: search.toLowerCase() } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.blogPost.count({ where }),
      this.prisma.blogPost.findMany({
        where,
        select: SUMMARY_SELECT,
        orderBy: NEWEST_FIRST,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /** A published post with its body and the posts to suggest after it. */
  async findPublishedBySlug(slug: string) {
    const post = await this.prisma.blogPost.findFirst({
      where: { ...PUBLISHED, slug },
      select: DETAIL_SELECT,
    });
    if (!post) throw new NotFoundException(`Post ${slug} not found`);

    const { categoryId, ...publicPost } = post;
    const related = await this.findRelated(post.id, categoryId);
    return { ...publicPost, related };
  }

  /** The newest published posts with their bodies, for the RSS feed. */
  feed() {
    return this.prisma.blogPost.findMany({
      where: PUBLISHED,
      select: { ...SUMMARY_SELECT, content: true },
      orderBy: NEWEST_FIRST,
      take: FEED_SIZE,
    });
  }

  /** Every published post, with the dates the blog sitemap needs. */
  async sitemap() {
    const posts = await this.prisma.blogPost.findMany({
      where: PUBLISHED,
      select: {
        slug: true,
        title: true,
        coverImageUrl: true,
        coverImageAlt: true,
        publishedAt: true,
        contentUpdatedAt: true,
        category: { select: { slug: true } },
      },
      orderBy: NEWEST_FIRST,
    });

    const categoryDates = new Map<string, Date>();
    const entries = posts.map((post) => {
      const lastModified = post.contentUpdatedAt ?? post.publishedAt;
      if (post.category && lastModified) {
        const latest = categoryDates.get(post.category.slug);
        if (!latest || lastModified > latest) {
          categoryDates.set(post.category.slug, lastModified);
        }
      }
      return {
        slug: post.slug,
        title: post.title,
        coverImageUrl: post.coverImageUrl,
        coverImageAlt: post.coverImageAlt,
        lastModified,
      };
    });

    return {
      posts: entries,
      categories: [...categoryDates].map(([slug, lastModified]) => ({
        slug,
        lastModified,
      })),
    };
  }

  /** Same category first, topped up with the newest posts from elsewhere. */
  private async findRelated(postId: string, categoryId: string | null) {
    const sameCategory = categoryId
      ? await this.prisma.blogPost.findMany({
          where: { ...PUBLISHED, categoryId, id: { not: postId } },
          select: SUMMARY_SELECT,
          orderBy: NEWEST_FIRST,
          take: RELATED_POST_COUNT,
        })
      : [];
    if (sameCategory.length >= RELATED_POST_COUNT) return sameCategory;

    const newest = await this.prisma.blogPost.findMany({
      where: {
        ...PUBLISHED,
        id: { notIn: [postId, ...sameCategory.map((related) => related.id)] },
      },
      select: SUMMARY_SELECT,
      orderBy: NEWEST_FIRST,
      take: RELATED_POST_COUNT - sameCategory.length,
    });
    return [...sameCategory, ...newest];
  }

  // ---- Admin ----------------------------------------------------------------

  /** Every post including drafts, most recently edited first. No bodies. */
  findAllForAdmin() {
    return this.prisma.blogPost.findMany({
      select: ADMIN_ROW_SELECT,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOneForAdmin(id: string) {
    const post = await this.prisma.blogPost.findUnique({
      where: { id },
      include: ADMIN_INCLUDE,
    });
    if (!post) throw new NotFoundException(`Post ${id} not found`);
    return post;
  }

  /** New posts always start as drafts. */
  async create(dto: UpsertBlogPostDto, authorId: string) {
    const data = await this.toData(dto);
    try {
      return await this.prisma.blogPost.create({
        data: { ...data, authorId, status: 'draft' },
        include: ADMIN_INCLUDE,
      });
    } catch (err) {
      throw this.asFriendlyError(err, data.slug);
    }
  }

  async update(id: string, dto: UpsertBlogPostDto) {
    const existing = await this.findOneForAdmin(id);
    const data = await this.toData(dto);

    if (existing.publishedAt && data.slug !== existing.slug) {
      throw new BadRequestException(
        `The slug can't change after a post has been published, because links to /blog/${existing.slug} would break`,
      );
    }

    // Only a real change to the words moves the "Updated" date, and only once
    // readers could have seen the earlier version.
    const wordsChanged =
      data.title !== existing.title ||
      data.excerpt !== existing.excerpt ||
      data.content !== existing.content;
    const contentUpdatedAt =
      existing.publishedAt && wordsChanged
        ? { contentUpdatedAt: new Date() }
        : {};

    try {
      return await this.prisma.blogPost.update({
        where: { id },
        data: { ...data, ...contentUpdatedAt },
        include: ADMIN_INCLUDE,
      });
    } catch (err) {
      throw this.asFriendlyError(err, data.slug);
    }
  }

  /** The first publish sets the date; later ones keep it. */
  async publish(id: string) {
    const existing = await this.findOneForAdmin(id);
    return this.prisma.blogPost.update({
      where: { id },
      data: {
        status: 'published',
        publishedAt: existing.publishedAt ?? new Date(),
      },
      include: ADMIN_INCLUDE,
    });
  }

  /** Back to draft. The publish date is kept for when it goes live again. */
  async unpublish(id: string) {
    await this.findOneForAdmin(id);
    return this.prisma.blogPost.update({
      where: { id },
      data: { status: 'draft' },
      include: ADMIN_INCLUDE,
    });
  }

  async remove(id: string) {
    await this.findOneForAdmin(id);
    await this.prisma.blogPost.delete({ where: { id } });
  }

  private async toData(dto: UpsertBlogPostDto) {
    const categoryId = dto.categoryId || null;
    if (categoryId) {
      const category = await this.prisma.blogCategory.findUnique({
        where: { id: categoryId },
        select: { id: true },
      });
      if (!category) {
        throw new BadRequestException(`Category ${categoryId} does not exist`);
      }
    }

    return {
      title: dto.title.trim(),
      slug: dto.slug,
      excerpt: dto.excerpt.trim(),
      content: dto.content,
      coverImageUrl: dto.coverImageUrl?.trim() || null,
      coverImageAlt: dto.coverImageAlt?.trim() || null,
      categoryId,
      tags: normalizeTags(dto.tags ?? []),
      seoTitle: dto.seoTitle?.trim() || null,
      seoDescription: dto.seoDescription?.trim() || null,
      canonicalUrl: dto.canonicalUrl?.trim() || null,
      readingMinutes: readingMinutes(dto.content),
    };
  }

  private asFriendlyError(err: unknown, slug: string) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return new ConflictException(
        `Another post already uses the slug "${slug}"`,
      );
    }
    return err;
  }
}
