import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertIncomeSourceDto } from './dto/upsert-income-source.dto';

/** "YYYY-MM" for the month being reported on. */
export function currentCycle(now: Date = new Date()): string {
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

@Injectable()
export class IncomeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Everything that counts towards one month: the permanent sources plus any
   * one-offs recorded against that cycle. One-offs add on top — they never
   * replace the permanent income.
   */
  async findForCycle(cycle = currentCycle()) {
    const sources = await this.prisma.incomeSource.findMany({
      where: { OR: [{ cycle: null }, { cycle }] },
      orderBy: [{ cycle: 'asc' }, { createdAt: 'asc' }],
    });

    const permanent = sources.filter((source) => source.cycle === null);
    const monthly = sources.filter((source) => source.cycle !== null);
    const sum = (rows: typeof sources) =>
      rows.reduce((total, row) => total + row.amount, 0);

    const permanentTotal = sum(permanent);
    const monthlyTotal = sum(monthly);

    return {
      cycle,
      permanent,
      monthly,
      permanentTotal,
      monthlyTotal,
      total: permanentTotal + monthlyTotal,
    };
  }

  /** Every source regardless of cycle — for an "all one-offs" view. */
  findAll() {
    return this.prisma.incomeSource.findMany({
      orderBy: [{ cycle: 'asc' }, { createdAt: 'asc' }],
    });
  }

  create(dto: UpsertIncomeSourceDto) {
    return this.prisma.incomeSource.create({
      data: {
        label: dto.label.trim(),
        amount: dto.amount,
        cycle: dto.cycle ?? null,
      },
    });
  }

  async update(id: string, dto: UpsertIncomeSourceDto) {
    await this.findOne(id);
    return this.prisma.incomeSource.update({
      where: { id },
      data: {
        label: dto.label.trim(),
        amount: dto.amount,
        cycle: dto.cycle ?? null,
      },
    });
  }

  async findOne(id: string) {
    const source = await this.prisma.incomeSource.findUnique({ where: { id } });
    if (!source) throw new NotFoundException(`Income source ${id} not found`);
    return source;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.incomeSource.delete({ where: { id } });
  }
}
