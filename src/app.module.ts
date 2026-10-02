import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { BillsModule } from './bills/bills.module';
import { IncomeModule } from './income/income.module';
import { ExpensesModule } from './expenses/expenses.module';
import { BorrowingsModule } from './borrowings/borrowings.module';
import { AssistantModule } from './assistant/assistant.module';
import { CategoriesModule } from './categories/categories.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { PaymentsModule } from './payments/payments.module';
import { BullseyeModule } from './bullseye/bullseye.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    BillsModule,
    IncomeModule,
    ExpensesModule,
    BorrowingsModule,
    AssistantModule,
    CategoriesModule,
    AuthModule,
    AdminModule,
    PaymentsModule,
    BullseyeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
