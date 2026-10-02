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
  async findForCycle(adminUserId: string, cycle = currentCycle()) {
    const sources = await this.prisma.incomeSource.findMany({
      where: { adminUserId, OR: [{ cycle: null }, { cycle }] },
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
  findAll(adminUserId: string) {
    return this.prisma.incomeSource.findMany({
      where: { adminUserId },
      orderBy: [{ cycle: 'asc' }, { createdAt: 'asc' }],
    });
  }

  create(dto: UpsertIncomeSourceDto, adminUserId: string) {
    return this.prisma.incomeSource.create({
      data: {
        label: dto.label.trim(),
        amount: dto.amount,
        cycle: dto.cycle ?? null,
        adminUserId,
      },
    });
  }

  async update(id: string, dto: UpsertIncomeSourceDto, adminUserId: string) {
    await this.findOne(id, adminUserId);
    return this.prisma.incomeSource.update({
      where: { id },
      data: {
        label: dto.label.trim(),
        amount: dto.amount,
        cycle: dto.cycle ?? null,
      },
    });
  }

  /** Scoped by owner — see the note on BillsService.findOne. */
  async findOne(id: string, adminUserId: string) {
    const source = await this.prisma.incomeSource.findFirst({
      where: { id, adminUserId },
    });
    if (!source) throw new NotFoundException(`Income source ${id} not found`);
    return source;
  }

  async remove(id: string, adminUserId: string) {
    await this.findOne(id, adminUserId);
    await this.prisma.incomeSource.delete({ where: { id } });
  }
}
