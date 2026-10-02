import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../admin/admin-jwt.guard';
import { CurrentAdmin } from '../admin/current-admin.decorator';
import type { AuthenticatedAdmin } from '../admin/admin-jwt.strategy';
import { BillsService } from './bills.service';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { UpsertBillDto } from './dto/upsert-bill.dto';

@ApiTags('bills')
@ApiBearerAuth('bearer')
@UseGuards(AdminJwtGuard)
@Controller('bills')
export class BillsController {
  constructor(private readonly billsService: BillsService) {}

  @Get()
  findAll(@CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.billsService.findAll(admin.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.billsService.findOne(id, admin.id);
  }

  /** Upsert: creates the bill if `id` doesn't exist yet, otherwise replaces it. */
  @Put(':id')
  upsert(
    @Param('id') id: string,
    @Body() dto: UpsertBillDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.billsService.upsert(id, dto, admin.id);
  }

  /** Settle the given cycle (defaults to this month) and advance progress. */
  @Post(':id/pay')
  @HttpCode(200)
  markPaid(
    @Param('id') id: string,
    @Body() dto: MarkPaidDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.billsService.markPaid(id, admin.id, dto.cycle);
  }

  @Post(':id/unpay')
  @HttpCode(200)
  markUnpaid(
    @Param('id') id: string,
    @Body() dto: MarkPaidDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.billsService.markUnpaid(id, admin.id, dto.cycle);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    await this.billsService.remove(id, admin.id);
  }
}
