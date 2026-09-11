import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertBillDto } from './dto/upsert-bill.dto';

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

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.bill.delete({ where: { id } });
  }
}
