import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { UpsertCategoryDto } from './dto/upsert-category.dto';
import type { CategoryKindDto } from './dto/upsert-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(kind?: CategoryKindDto) {
    return this.prisma.category.findMany({
      where: kind ? { kind } : undefined,
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException(`Category ${id} not found`);
    return category;
  }

  async create(dto: UpsertCategoryDto) {
    try {
      return await this.prisma.category.create({
        data: { kind: dto.kind, name: dto.name.trim() },
      });
    } catch (err) {
      throw this.asFriendlyError(err, dto);
    }
  }

  /**
   * Renaming also rewrites the records already filed under the old name.
   * Categories are stored as plain strings on Bill/Expense/IncomeSource, so
   * without this a rename would silently orphan every existing record.
   */
  async update(id: string, dto: UpsertCategoryDto) {
    const existing = await this.findOne(id);
    const name = dto.name.trim();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.category.update({
          where: { id },
          data: { kind: dto.kind, name },
        });

        if (existing.name !== name) {
          const where = { category: existing.name };
          if (existing.kind === 'emi') {
            await tx.bill.updateMany({ where, data: { category: name } });
          } else if (existing.kind === 'expense') {
            await tx.expense.updateMany({ where, data: { category: name } });
          } else {
            await tx.incomeSource.updateMany({
              where,
              data: { category: name },
            });
          }
        }

        return updated;
      });
    } catch (err) {
      throw this.asFriendlyError(err, dto);
    }
  }

  /** Deleting a category leaves existing records alone, keeping their label. */
  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.category.delete({ where: { id } });
  }

  private asFriendlyError(err: unknown, dto: UpsertCategoryDto) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return new ConflictException(
        `A ${dto.kind} category called "${dto.name.trim()}" already exists`,
      );
    }
    return err;
  }
}
