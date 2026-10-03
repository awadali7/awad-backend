import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BlogCategoriesService } from './blog-categories.service';

describe('BlogCategoriesService', () => {
  let service: BlogCategoriesService;
  const prisma = {
    blogCategory: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.blogCategory.create.mockImplementation(
      (args: { data: Record<string, unknown> }) => Promise.resolve(args.data),
    );
    prisma.blogCategory.update.mockImplementation(
      (args: { data: Record<string, unknown> }) => Promise.resolve(args.data),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        BlogCategoriesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(BlogCategoriesService);
  });

  it('derives the slug from the name when none is sent', async () => {
    await expect(
      service.create({ name: ' Next.js & React ' }),
    ).resolves.toEqual({
      name: 'Next.js & React',
      slug: 'next-js-react',
      description: null,
    });
  });

  it('rejects a name that leaves nothing to build a slug from', async () => {
    await expect(service.create({ name: '???' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('keeps the slug on rename unless a new one is sent', async () => {
    prisma.blogCategory.findUnique.mockResolvedValue({
      id: 'cat-1',
      name: 'React',
      slug: 'react',
    });

    await expect(
      service.update('cat-1', { name: 'React.js' }),
    ).resolves.toMatchObject({ name: 'React.js', slug: 'react' });
  });

  it('turns a duplicate name or slug into a conflict', async () => {
    prisma.blogCategory.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(service.create({ name: 'React' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('hides categories without published posts from the public list', async () => {
    prisma.blogCategory.findMany.mockResolvedValue([
      {
        id: 'cat-1',
        name: 'React',
        slug: 'react',
        description: null,
        _count: { posts: 2 },
      },
      {
        id: 'cat-2',
        name: 'Empty',
        slug: 'empty',
        description: null,
        _count: { posts: 0 },
      },
    ]);

    await expect(service.findPublic()).resolves.toEqual([
      {
        id: 'cat-1',
        name: 'React',
        slug: 'react',
        description: null,
        postCount: 2,
      },
    ]);
  });
});
