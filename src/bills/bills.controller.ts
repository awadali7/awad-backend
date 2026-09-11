import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { BillsService } from './bills.service';
import { UpsertBillDto } from './dto/upsert-bill.dto';

@ApiTags('bills')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
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

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.billsService.remove(id);
  }
}
