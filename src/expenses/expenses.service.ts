import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertExpenseDto } from './dto/upsert-expense.dto';

/** "YYYY-MM" for the month being reported on. */
export function currentCycle(now: Date = new Date()): string {
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  /** One month's expenses, with a total and a per-category breakdown. */
  async findForCycle(adminUserId: string, cycle = currentCycle()) {
    const expenses = await this.prisma.expense.findMany({
      where: { adminUserId, cycle },
      orderBy: { createdAt: 'desc' },
    });

    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    const byCategory = Object.entries(
      expenses.reduce<Record<string, number>>((acc, expense) => {
        const key = expense.category?.trim() || 'Uncategorised';
        acc[key] = (acc[key] ?? 0) + expense.amount;
        return acc;
      }, {}),
    )
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    return { cycle, expenses, total, byCategory };
  }

  /** Scoped by owner — see the note on BillsService.findOne. */
  async findOne(id: string, adminUserId: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, adminUserId },
    });
    if (!expense) throw new NotFoundException(`Expense ${id} not found`);
    return expense;
  }

  create(dto: UpsertExpenseDto, adminUserId: string) {
    return this.prisma.expense.create({
      data: { ...this.toData(dto), adminUserId },
    });
  }

  async update(id: string, dto: UpsertExpenseDto, adminUserId: string) {
    await this.findOne(id, adminUserId);
    return this.prisma.expense.update({
      where: { id },
      data: this.toData(dto),
    });
  }

  async remove(id: string, adminUserId: string) {
    await this.findOne(id, adminUserId);
    await this.prisma.expense.delete({ where: { id } });
  }

  private toData(dto: UpsertExpenseDto) {
    return {
      label: dto.label.trim(),
      amount: dto.amount,
      cycle: dto.cycle,
      category: dto.category?.trim() || null,
      notes: dto.notes?.trim() || null,
    };
  }
}
