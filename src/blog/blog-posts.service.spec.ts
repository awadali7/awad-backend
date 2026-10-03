import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BlogPostsService } from './blog-posts.service';
import type { UpsertBlogPostDto } from './dto/upsert-blog-post.dto';

const FOUR_HUNDRED_FIFTY_WORDS = 'word '.repeat(450);

const dto = (
  overrides: Partial<UpsertBlogPostDto> = {},
): UpsertBlogPostDto => ({
  title: '  Caching in Next.js  ',
  slug: 'caching-in-nextjs',
  excerpt: 'What changed and why it matters.',
  content: FOUR_HUNDRED_FIFTY_WORDS,
  coverImageUrl: '',
  coverImageAlt: null,
  categoryId: null,
  tags: ['Next JS', 'react', 'React'],
  seoTitle: '   ',
  seoDescription: null,
  canonicalUrl: null,
  ...overrides,
});

const stored = (overrides: Record<string, unknown> = {}) => ({
  id: 'post-1',
  slug: 'caching-in-nextjs',
  title: 'Caching in Next.js',
  excerpt: 'What changed and why it matters.',
  content: FOUR_HUNDRED_FIFTY_WORDS,
  status: 'draft',
  publishedAt: null,
  contentUpdatedAt: null,
  ...overrides,
});

type FindManyArgs = {
  where: Record<string, unknown>;
  select?: Record<string, unknown>;
  orderBy: unknown[];
  skip?: number;
  take?: number;
};

describe('BlogPostsService', () => {
  let service: BlogPostsService;
  const prisma = {
    blogPost: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    blogCategory: { findUnique: jest.fn() },
  };

  const findManyCall = (index: number) =>
    (prisma.blogPost.findMany.mock.calls[index] as [FindManyArgs])[0];

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.blogPost.create.mockImplementation(
      (args: { data: Record<string, unknown> }) => Promise.resolve(args.data),
    );
    prisma.blogPost.update.mockImplementation(
      (args: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({ ...args.where, ...args.data }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        BlogPostsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(BlogPostsService);
  });

  describe('public reads', () => {
    it('only lists published posts, newest first', async () => {
      prisma.blogPost.count.mockResolvedValue(0);
      prisma.blogPost.findMany.mockResolvedValue([]);

      await service.findPublished({});

      const args = findManyCall(0);
      expect(args.where.status).toBe('published');
      expect(args.orderBy[0]).toEqual({ publishedAt: 'desc' });
      expect(prisma.blogPost.count).toHaveBeenCalledWith({ where: args.where });
    });

    it('pages twelve at a time and reports the page count', async () => {
      prisma.blogPost.count.mockResolvedValue(25);
      prisma.blogPost.findMany.mockResolvedValue([]);

      const result = await service.findPublished({ page: 3 });

      expect(findManyCall(0)).toMatchObject({ skip: 24, take: 12 });
      expect(result).toMatchObject({
        page: 3,
        pageSize: 12,
        total: 25,
        totalPages: 3,
      });
    });

    it('filters by category slug, lowercase tag and search text', async () => {
      prisma.blogPost.count.mockResolvedValue(0);
      prisma.blogPost.findMany.mockResolvedValue([]);

      await service.findPublished({
        category: 'react',
        tag: ' NextJS ',
        q: ' Hooks ',
      });

      const { where } = findManyCall(0);
      expect(where.status).toBe('published');
      expect(where.category).toEqual({ slug: 'react' });
      expect(where.tags).toEqual({ has: 'nextjs' });
      expect(where.OR).toEqual([
        { title: { contains: 'Hooks', mode: 'insensitive' } },
        { excerpt: { contains: 'Hooks', mode: 'insensitive' } },
        { tags: { has: 'hooks' } },
      ]);
    });

    it('returns 404 for a slug that is not published', async () => {
      prisma.blogPost.findFirst.mockResolvedValue(null);

      await expect(service.findPublishedBySlug('a-draft')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.blogPost.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'published', slug: 'a-draft' },
        }),
      );
    });

    it('suggests same-category posts first, then the newest elsewhere', async () => {
      prisma.blogPost.findFirst.mockResolvedValue({
        id: 'post-1',
        slug: 'caching-in-nextjs',
        categoryId: 'cat-1',
      });
      prisma.blogPost.findMany
        .mockResolvedValueOnce([{ id: 'post-2' }])
        .mockResolvedValueOnce([{ id: 'post-3' }, { id: 'post-4' }]);

      const result = await service.findPublishedBySlug('caching-in-nextjs');

      expect(result.related.map((post) => post.id)).toEqual([
        'post-2',
        'post-3',
        'post-4',
      ]);
      expect(findManyCall(0).where).toMatchObject({
        status: 'published',
        categoryId: 'cat-1',
        id: { not: 'post-1' },
      });
      expect(findManyCall(1)).toMatchObject({
        where: { status: 'published', id: { notIn: ['post-1', 'post-2'] } },
        take: 2,
      });
      expect(result).not.toHaveProperty('categoryId');
    });

    it('feeds the twenty newest published posts with their bodies', async () => {
      prisma.blogPost.findMany.mockResolvedValue([]);

      await service.feed();

      expect(findManyCall(0)).toMatchObject({
        where: { status: 'published' },
        orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
        take: 20,
      });
      expect(findManyCall(0).select).toMatchObject({
        content: true,
        slug: true,
      });
    });

    it('dates a category in the sitemap by its newest post', async () => {
      prisma.blogPost.findMany.mockResolvedValue([
        {
          slug: 'b',
          title: 'B',
          publishedAt: new Date('2026-09-01'),
          contentUpdatedAt: new Date('2026-09-20'),
          category: { slug: 'react' },
        },
        {
          slug: 'a',
          title: 'A',
          publishedAt: new Date('2026-08-01'),
          contentUpdatedAt: null,
          category: { slug: 'react' },
        },
      ]);

      const result = await service.sitemap();

      expect(result.posts.map((post) => post.lastModified)).toEqual([
        new Date('2026-09-20'),
        new Date('2026-08-01'),
      ]);
      expect(result.categories).toEqual([
        { slug: 'react', lastModified: new Date('2026-09-20') },
      ]);
    });
  });

  describe('create', () => {
    it('starts as a draft by its author, with cleaned-up fields', async () => {
      const created = await service.create(dto(), 'admin-1');

      expect(created).toMatchObject({
        title: 'Caching in Next.js',
        status: 'draft',
        authorId: 'admin-1',
        coverImageUrl: null,
        seoTitle: null,
        tags: ['next-js', 'react'],
        readingMinutes: 3,
      });
    });

    it('rejects a category that does not exist', async () => {
      prisma.blogCategory.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          dto({ categoryId: '6f1c2b8e-1d2a-4c7e-9a51-2b0d7f3e9c10' }),
          'admin-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.blogPost.create).not.toHaveBeenCalled();
    });

    it('turns a duplicate slug into a conflict', async () => {
      prisma.blogPost.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.create(dto(), 'admin-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    it('refuses to change the slug once the post has been published', async () => {
      prisma.blogPost.findUnique.mockResolvedValue(
        stored({ status: 'published', publishedAt: new Date('2026-09-01') }),
      );

      await expect(
        service.update('post-1', dto({ slug: 'a-new-slug' })),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.blogPost.update).not.toHaveBeenCalled();
    });

    it('lets a never-published draft change its slug', async () => {
      prisma.blogPost.findUnique.mockResolvedValue(stored());

      await expect(
        service.update('post-1', dto({ slug: 'a-new-slug' })),
      ).resolves.toMatchObject({ slug: 'a-new-slug' });
    });

    it('moves the updated date when the words of a published post change', async () => {
      prisma.blogPost.findUnique.mockResolvedValue(
        stored({ status: 'published', publishedAt: new Date('2026-09-01') }),
      );

      const updated = await service.update(
        'post-1',
        dto({ content: 'Rewritten body' }),
      );

      expect(updated.contentUpdatedAt).toBeInstanceOf(Date);
    });

    it('leaves the updated date alone when only tags or SEO fields change', async () => {
      prisma.blogPost.findUnique.mockResolvedValue(
        stored({ status: 'published', publishedAt: new Date('2026-09-01') }),
      );

      const updated = await service.update(
        'post-1',
        dto({ tags: ['other'], seoTitle: 'Next.js caching explained' }),
      );

      expect(updated).not.toHaveProperty('contentUpdatedAt');
    });

    it('never sets an updated date before the first publish', async () => {
      prisma.blogPost.findUnique.mockResolvedValue(stored());

      const updated = await service.update(
        'post-1',
        dto({ content: 'Rewritten body' }),
      );

      expect(updated).not.toHaveProperty('contentUpdatedAt');
    });

    it('returns 404 for a post that does not exist', async () => {
      prisma.blogPost.findUnique.mockResolvedValue(null);

      await expect(service.update('missing', dto())).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('publishing', () => {
    it('sets the publish date on the first publish', async () => {
      prisma.blogPost.findUnique.mockResolvedValue(stored());

      const published = await service.publish('post-1');

      expect(published.status).toBe('published');
      expect(published.publishedAt).toBeInstanceOf(Date);
    });

    it('keeps the original publish date when publishing again', async () => {
      const firstPublished = new Date('2026-09-01T10:00:00Z');
      prisma.blogPost.findUnique.mockResolvedValue(
        stored({ status: 'draft', publishedAt: firstPublished }),
      );

      const published = await service.publish('post-1');

      expect(published.publishedAt).toBe(firstPublished);
    });

    it('unpublishing only changes the status', async () => {
      prisma.blogPost.findUnique.mockResolvedValue(
        stored({ status: 'published', publishedAt: new Date('2026-09-01') }),
      );

      await service.unpublish('post-1');

      expect(prisma.blogPost.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'draft' } }),
      );
    });
  });
});
