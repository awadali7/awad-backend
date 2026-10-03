/**
 * Four sample blog posts in three categories, for local development.
 *
 *   npm run prisma:seed:blog-demo               add them, or refresh them
 *   npm run prisma:seed:blog-demo -- --remove   delete them again
 *
 * Post bodies live in prisma/blog-demo/<slug>.md so they are easy to edit.
 * Refuses to run against a database that is not on this machine, so sample
 * posts can never reach the live blog by accident.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { normalizeTags, readingMinutes } from '../src/blog/blog.util';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const CATEGORIES = [
  {
    slug: 'nextjs',
    name: 'Next.js',
    description: 'Notes on building fast, search-friendly sites with Next.js.',
  },
  {
    slug: 'react',
    name: 'React',
    description:
      'Patterns and habits for React code that stays easy to change.',
  },
  {
    slug: 'nodejs',
    name: 'Node.js',
    description: 'Backend notes on Node.js, NestJS and Prisma.',
  },
];

/** Free Unsplash photos, sized for a 1200 px wide cover. */
const unsplash = (photo: string) =>
  `https://images.unsplash.com/${photo}?w=1600&q=80&auto=format&fit=crop`;

const POSTS = [
  {
    slug: 'nextjs-app-router-caching',
    coverImageUrl: unsplash('photo-1555066931-4365d14bab8c'),
    coverImageAlt: 'Laptop screen showing code in a dark editor',
    title: 'How caching works in the Next.js App Router',
    excerpt:
      'The App Router caches at four layers, and Next.js 15 changed which ones are on by default. Here is what each layer does and how to control it.',
    category: 'nextjs',
    tags: ['nextjs', 'caching', 'performance'],
    publishedAt: '2026-09-08T04:30:00.000Z',
    // Edited later, so the article shows an "Updated" date.
    contentUpdatedAt: '2026-09-28T05:00:00.000Z',
  },
  {
    slug: 'react-patterns-every-project',
    coverImageUrl: unsplash('photo-1633356122544-f134324a6cee'),
    coverImageAlt: 'Code editor next to a browser showing the React logo',
    title: 'Five React patterns I use on almost every project',
    excerpt:
      'Small habits that keep React code easy to change: deriving values, resetting with keys, custom hooks, composition and keeping state close.',
    category: 'react',
    tags: ['react', 'patterns'],
    publishedAt: '2026-09-16T04:30:00.000Z',
  },
  {
    slug: 'nestjs-prisma-typed-api',
    coverImageUrl: unsplash('photo-1558494949-ef010cbdcc31'),
    coverImageAlt: 'Server racks with bundles of network cables',
    title: 'A typed REST API with NestJS and Prisma',
    excerpt:
      'Validation at the edge, one Prisma client for the whole app, and database errors turned into HTTP errors your frontend can show.',
    category: 'nodejs',
    tags: ['nestjs', 'prisma', 'typescript'],
    publishedAt: '2026-09-24T04:30:00.000Z',
  },
  {
    slug: 'nextjs-core-web-vitals-checklist',
    coverImageUrl: unsplash('photo-1460925895917-afdab827c52f'),
    coverImageAlt:
      'Laptop on a desk showing an analytics dashboard with charts',
    title: 'A Core Web Vitals checklist for Next.js sites',
    excerpt:
      'LCP, INP and CLS explained in plain terms, with the Next.js settings that move each one in the right direction.',
    category: 'nextjs',
    tags: ['nextjs', 'seo', 'performance'],
    publishedAt: '2026-10-01T04:30:00.000Z',
    // Shows how an SEO title replaces the page title in search results only.
    seoTitle: 'Core Web Vitals for Next.js: a practical checklist',
  },
];

function assertLocalDatabase(url: string | undefined): string {
  if (!url) throw new Error('DATABASE_URL is not set');
  const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
  if (!LOCAL_HOSTS.has(host) || process.env.NODE_ENV === 'production') {
    throw new Error(
      `Refusing to touch the database on "${host}": sample posts are for a local database only.`,
    );
  }
  return url;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: assertLocalDatabase(process.env.DATABASE_URL),
  }),
});

async function seed() {
  const categoryIds = new Map<string, string>();
  for (const category of CATEGORIES) {
    // Match by slug or name, so a category made earlier in the admin is reused.
    const existing = await prisma.blogCategory.findFirst({
      where: { OR: [{ slug: category.slug }, { name: category.name }] },
    });
    const saved = existing
      ? await prisma.blogCategory.update({
          where: { id: existing.id },
          data: { description: existing.description ?? category.description },
        })
      : await prisma.blogCategory.create({ data: category });
    categoryIds.set(category.slug, saved.id);
  }

  const author =
    (await prisma.adminUser.findUnique({
      where: { username: (process.env.ADMIN_USERNAME ?? '').toLowerCase() },
    })) ??
    (await prisma.adminUser.findFirst({ orderBy: { createdAt: 'asc' } }));

  for (const post of POSTS) {
    const content = readFileSync(
      join(__dirname, 'blog-demo', `${post.slug}.md`),
      'utf8',
    );
    const data = {
      title: post.title,
      excerpt: post.excerpt,
      content,
      tags: normalizeTags(post.tags),
      readingMinutes: readingMinutes(content),
      status: 'published' as const,
      publishedAt: new Date(post.publishedAt),
      contentUpdatedAt: post.contentUpdatedAt
        ? new Date(post.contentUpdatedAt)
        : null,
      seoTitle: post.seoTitle ?? null,
      coverImageUrl: post.coverImageUrl,
      coverImageAlt: post.coverImageAlt,
      categoryId: categoryIds.get(post.category) ?? null,
      authorId: author?.id ?? null,
    };
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      update: data,
      create: { slug: post.slug, ...data },
    });
    console.log(`Saved "${post.title}"`);
  }
}

async function remove() {
  const { count } = await prisma.blogPost.deleteMany({
    where: { slug: { in: POSTS.map((post) => post.slug) } },
  });
  console.log(`Deleted ${count} sample post(s).`);

  // Only remove a sample category once nothing else is filed in it.
  for (const category of CATEGORIES) {
    const removed = await prisma.blogCategory.deleteMany({
      where: { slug: category.slug, posts: { none: {} } },
    });
    if (removed.count) console.log(`Deleted category "${category.name}".`);
  }
}

(process.argv.includes('--remove') ? remove() : seed())
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
