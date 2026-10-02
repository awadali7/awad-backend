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

  findAll() {
    return this.prisma.bill.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async findOne(id: string) {
    const bill = await this.prisma.bill.findUnique({ where: { id } });
    if (!bill) throw new NotFoundException(`Bill ${id} not found`);
    return bill;
  }

  upsert(id: string, dto: UpsertBillDto) {
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
    return this.prisma.bill.upsert({
      where: { id },
      create: { id, ...data },
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
  async markPaid(id: string, cycle = currentCycle()) {
    const bill = await this.findOne(id);
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
  async markUnpaid(id: string, cycle = currentCycle()) {
    const bill = await this.findOne(id);
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

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.bill.delete({ where: { id } });
  }
}
