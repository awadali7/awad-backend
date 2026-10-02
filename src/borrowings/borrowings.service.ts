import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertBorrowingDto } from './dto/upsert-borrowing.dto';

@Injectable()
export class BorrowingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Outstanding borrowings first and soonest-due at the top, since that is the
   * one that needs attention; settled ones sink to the bottom.
   */
  async findAll(adminUserId: string) {
    const borrowings = await this.prisma.borrowing.findMany({
      where: { adminUserId },
      orderBy: [{ repaidOn: 'asc' }, { dueDate: 'asc' }],
    });

    const outstanding = borrowings.filter((row) => row.repaidOn === null);
    const sum = (rows: typeof borrowings) =>
      rows.reduce((total, row) => total + row.amount, 0);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    return {
      borrowings,
      outstandingTotal: sum(outstanding),
      repaidTotal: sum(borrowings.filter((row) => row.repaidOn !== null)),
      outstandingCount: outstanding.length,
      overdueCount: outstanding.filter((row) => row.dueDate < startOfToday)
        .length,
    };
  }

  /** Scoped by owner — see the note on BillsService.findOne. */
  async findOne(id: string, adminUserId: string) {
    const borrowing = await this.prisma.borrowing.findFirst({
      where: { id, adminUserId },
    });
    if (!borrowing) throw new NotFoundException(`Borrowing ${id} not found`);
    return borrowing;
  }

  // async so a validation failure surfaces as a rejected promise rather than a
  // synchronous throw — callers shouldn't have to handle both.
  async create(dto: UpsertBorrowingDto, adminUserId: string) {
    return this.prisma.borrowing.create({
      data: { ...this.toData(dto), adminUserId },
    });
  }

  async update(id: string, dto: UpsertBorrowingDto, adminUserId: string) {
    await this.findOne(id, adminUserId);
    return this.prisma.borrowing.update({
      where: { id },
      data: this.toData(dto),
    });
  }

  /** Settle it. Defaults to today when no date is given. */
  async markRepaid(id: string, adminUserId: string, repaidOn?: string) {
    await this.findOne(id, adminUserId);
    return this.prisma.borrowing.update({
      where: { id },
      data: { repaidOn: repaidOn ? new Date(repaidOn) : new Date() },
    });
  }

  /** Undo a settlement — for a mis-tap. */
  async markOutstanding(id: string, adminUserId: string) {
    await this.findOne(id, adminUserId);
    return this.prisma.borrowing.update({
      where: { id },
      data: { repaidOn: null },
    });
  }

  async remove(id: string, adminUserId: string) {
    await this.findOne(id, adminUserId);
    await this.prisma.borrowing.delete({ where: { id } });
  }

  private toData(dto: UpsertBorrowingDto) {
    const startDate = new Date(dto.startDate);
    const dueDate = new Date(dto.dueDate);

    // A due date before the money was taken is always a typo, and it would
    // otherwise show as permanently overdue with no way to notice why.
    if (dueDate < startDate) {
      throw new BadRequestException('Due date cannot be before the start date');
    }

    return {
      lender: dto.lender.trim(),
      amount: dto.amount,
      startDate,
      dueDate,
      repaidOn: dto.repaidOn ? new Date(dto.repaidOn) : null,
      notes: dto.notes?.trim() || null,
    };
  }
}
