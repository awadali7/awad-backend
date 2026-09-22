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
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyOrAdminGuard } from '../admin/api-key-or-admin.guard';
import { BillsService } from './bills.service';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { UpsertBillDto } from './dto/upsert-bill.dto';

@ApiTags('bills')
@ApiSecurity('api-key')
@ApiBearerAuth('bearer')
@UseGuards(ApiKeyOrAdminGuard)
@Controller('bills')
export class BillsController {
  constructor(private readonly billsService: BillsService) {}

  @Get()
  findAll() {
    return this.billsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.billsService.findOne(id);
  }

  /** Upsert: creates the bill if `id` doesn't exist yet, otherwise replaces it. */
  @Put(':id')
  upsert(@Param('id') id: string, @Body() dto: UpsertBillDto) {
    return this.billsService.upsert(id, dto);
  }

  /** Settle the given cycle (defaults to this month) and advance progress. */
  @Post(':id/pay')
  @HttpCode(200)
  markPaid(@Param('id') id: string, @Body() dto: MarkPaidDto) {
    return this.billsService.markPaid(id, dto.cycle);
  }

  @Post(':id/unpay')
  @HttpCode(200)
  markUnpaid(@Param('id') id: string, @Body() dto: MarkPaidDto) {
    return this.billsService.markUnpaid(id, dto.cycle);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.billsService.remove(id);
  }
}
