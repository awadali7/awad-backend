import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { BorrowingsController } from './borrowings.controller';
import { BorrowingsService } from './borrowings.service';

@Module({
  imports: [AdminModule],
  controllers: [BorrowingsController],
  providers: [BorrowingsService],
})
export class BorrowingsModule {}
