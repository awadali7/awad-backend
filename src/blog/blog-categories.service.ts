import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { slugify } from './blog.util';
import { UpsertBlogCategoryDto } from './dto/upsert-blog-category.dto';

@Injectable()
export class BlogCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Categories that have at least one published post. An empty category has
   * no page worth indexing, so it never reaches the public sidebar.
   */
  async findPublic() {
    const rows = await this.prisma.blogCategory.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        _count: { select: { posts: { where: { status: 'published' } } } },
      },
    });
    return rows
      .filter((row) => row._count.posts > 0)
      .map(({ _count, ...category }) => ({
        ...category,
        postCount: _count.posts,
      }));
  }

  /** Every category with how many posts, drafts included, are filed in it. */
  async findAllForAdmin() {
    const rows = await this.prisma.blogCategory.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { posts: true } } },
    });
    return rows.map(({ _count, ...category }) => ({
      ...category,
      postCount: _count.posts,
    }));
  }

  async findOne(id: string) {
    const category = await this.prisma.blogCategory.findUnique({
      where: { id },
    });
    if (!category) throw new NotFoundException(`Category ${id} not found`);
    return category;
  }

  async create(dto: UpsertBlogCategoryDto) {
    const name = dto.name.trim();
    const slug = dto.slug || slugify(name, 60);
    if (!slug) {
      throw new BadRequestException(
        'Give the category a name with at least one letter or number',
      );
    }

    try {
      return await this.prisma.blogCategory.create({
        data: { name, slug, description: dto.description?.trim() || null },
      });
    } catch (err) {
      throw this.asFriendlyError(err, name, slug);
    }
  }

  /**
   * Renaming keeps the slug unless a new one is sent: the slug is the
   * category page's address, so it only moves when that is the intent.
   */
  async update(id: string, dto: UpsertBlogCategoryDto) {
    const existing = await this.findOne(id);
    const name = dto.name.trim();
    const slug = dto.slug || existing.slug;

    try {
      return await this.prisma.blogCategory.update({
        where: { id },
        data: { name, slug, description: dto.description?.trim() || null },
      });
    } catch (err) {
      throw this.asFriendlyError(err, name, slug);
    }
  }

  /** Posts filed here are kept and become uncategorised (ON DELETE SET NULL). */
  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.blogCategory.delete({ where: { id } });
  }

  private asFriendlyError(err: unknown, name: string, slug: string) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return new ConflictException(
        `A category called "${name}" or with the slug "${slug}" already exists`,
      );
    }
    return err;
  }
}
