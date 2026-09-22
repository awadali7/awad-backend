import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { IncomeController } from './income.controller';
import { IncomeService } from './income.service';

@Module({
  imports: [AdminModule],
  controllers: [IncomeController],
  providers: [IncomeService],
})
export class IncomeModule {}
