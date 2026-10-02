import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../admin/admin-jwt.guard';
import { CurrentAdmin } from '../admin/current-admin.decorator';
import type { AuthenticatedAdmin } from '../admin/admin-jwt.strategy';
import { ExpenseQueryDto } from './dto/expense-query.dto';
import { UpsertExpenseDto } from './dto/upsert-expense.dto';
import { ExpensesService } from './expenses.service';

@ApiTags('expenses')
@ApiBearerAuth('bearer')
@UseGuards(AdminJwtGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  find(
    @Query() query: ExpenseQueryDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.expensesService.findForCycle(admin.id, query.cycle);
  }

  @Post()
  create(
    @Body() dto: UpsertExpenseDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.expensesService.create(dto, admin.id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpsertExpenseDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.expensesService.update(id, dto, admin.id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    await this.expensesService.remove(id, admin.id);
  }
}
