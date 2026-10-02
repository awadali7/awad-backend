import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertBillDto } from './dto/upsert-bill.dto';

/** "YYYY-MM" for the month a payment settles. */
export function currentCycle(now: Date = new Date()): string {
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

@Injectable()
export class BillsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(adminUserId: string) {
    return this.prisma.bill.findMany({
      where: { adminUserId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Scoped by owner on purpose: findUnique({ id }) would happily return another
   * operator's bill to anyone who guessed its id, and every mutation below
   * routes through here. "Not yours" and "not found" are the same answer, so
   * ids can't be probed either.
   */
  async findOne(id: string, adminUserId: string) {
    const bill = await this.prisma.bill.findFirst({
      where: { id, adminUserId },
    });
    if (!bill) throw new NotFoundException(`Bill ${id} not found`);
    return bill;
  }

  async upsert(id: string, dto: UpsertBillDto, adminUserId: string) {
    const data = {
      name: dto.name,
      category: dto.category,
      type: dto.type,
      amount: dto.amount,
      dueDay: dto.dueDay ?? null,
      endOfMonth: dto.endOfMonth ?? false,
      installmentsPaid: dto.installmentsPaid ?? null,
      installmentsTotal: dto.installmentsTotal ?? null,
      installmentsLeft: dto.installmentsLeft ?? null,
      startCycle: dto.startCycle ?? null,
      lastPaidCycle: dto.lastPaidCycle ?? null,
      lastNotifiedCycle: dto.lastNotifiedCycle ?? null,
      archived: dto.archived ?? false,
    };
    // Scoped guard before the upsert: a bare upsert on a known id would let one
    // operator overwrite another's bill through the "update" branch.
    const existing = await this.prisma.bill.findUnique({ where: { id } });
    if (existing && existing.adminUserId !== adminUserId) {
      throw new NotFoundException(`Bill ${id} not found`);
    }

    return this.prisma.bill.upsert({
      where: { id },
      create: { id, ...data, adminUserId },
      update: data,
    });
  }

  /**
   * Mark this month's instalment settled. Idempotent — paying twice in the
   * same cycle must not advance the counter twice, which is the whole reason
   * `lastPaidCycle` is stored rather than derived.
   *
   * Progress is tracked one of three ways, and only the one in use moves:
   *   installmentsTotal set -> "paid/total" counts up
   *   installmentsLeft set  -> "N left" counts down
   *   neither               -> open-ended (rent, credit card); only the cycle moves
   */
  async markPaid(id: string, adminUserId: string, cycle = currentCycle()) {
    const bill = await this.findOne(id, adminUserId);
    if (bill.lastPaidCycle === cycle) return bill;

    // A bill that starts later isn't owed yet — paying it early would advance
    // the instalment count against a cycle that was never billed.
    if (bill.startCycle && cycle < bill.startCycle) {
      throw new BadRequestException(
        `${bill.name} does not start until ${bill.startCycle}`,
      );
    }

    const data: {
      lastPaidCycle: string;
      installmentsPaid?: number;
      installmentsLeft?: number;
    } = { lastPaidCycle: cycle };

    if (bill.installmentsTotal !== null) {
      data.installmentsPaid = Math.min(
        (bill.installmentsPaid ?? 0) + 1,
        bill.installmentsTotal,
      );
    }
    if (bill.installmentsLeft !== null) {
      data.installmentsLeft = Math.max(bill.installmentsLeft - 1, 0);
    }

    return this.prisma.bill.update({ where: { id }, data });
  }

  /** Undo markPaid for the cycle it recorded — for a mis-tap. */
  async markUnpaid(id: string, adminUserId: string, cycle = currentCycle()) {
    const bill = await this.findOne(id, adminUserId);
    if (bill.lastPaidCycle !== cycle) return bill;

    const data: {
      lastPaidCycle: null;
      installmentsPaid?: number;
      installmentsLeft?: number;
    } = { lastPaidCycle: null };

    if (bill.installmentsTotal !== null) {
      data.installmentsPaid = Math.max((bill.installmentsPaid ?? 0) - 1, 0);
    }
    if (bill.installmentsLeft !== null) {
      data.installmentsLeft = bill.installmentsTotal
        ? Math.min(bill.installmentsLeft + 1, bill.installmentsTotal)
        : bill.installmentsLeft + 1;
    }

    return this.prisma.bill.update({ where: { id }, data });
  }

  async remove(id: string, adminUserId: string) {
    await this.findOne(id, adminUserId);
    await this.prisma.bill.delete({ where: { id } });
  }
}
