import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { BillsController } from './bills.controller';
import { BillsService } from './bills.service';

@Module({
  imports: [AdminModule],
  controllers: [BillsController],
  providers: [BillsService],
})
export class BillsModule {}
