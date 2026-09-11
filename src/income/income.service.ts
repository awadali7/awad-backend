import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateIncomeDto } from './dto/update-income.dto';

const HOUSEHOLD_ID = 'household';
const DEFAULT_INCOME = { userSalary: 30_000, spouseSalary: 10_000 };

@Injectable()
export class IncomeService {
  constructor(private readonly prisma: PrismaService) {}

  async find() {
    const income = await this.prisma.incomeSettings.findUnique({
      where: { id: HOUSEHOLD_ID },
    });
    return income ?? { id: HOUSEHOLD_ID, ...DEFAULT_INCOME };
  }

  update(dto: UpdateIncomeDto) {
    return this.prisma.incomeSettings.upsert({
      where: { id: HOUSEHOLD_ID },
      create: { id: HOUSEHOLD_ID, ...dto },
      update: dto,
    });
  }
}
