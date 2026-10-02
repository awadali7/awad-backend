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
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyOrAdminGuard } from '../admin/api-key-or-admin.guard';
import { IncomeQueryDto } from './dto/income-query.dto';
import { UpsertIncomeSourceDto } from './dto/upsert-income-source.dto';
import { IncomeService } from './income.service';

@ApiTags('income')
@ApiSecurity('api-key')
@ApiBearerAuth('bearer')
@UseGuards(ApiKeyOrAdminGuard)
@Controller('income')
export class IncomeController {
  constructor(private readonly incomeService: IncomeService) {}

  /** Permanent sources plus the one-offs for `cycle`, with totals. */
  @Get()
  find(@Query() query: IncomeQueryDto) {
    return this.incomeService.findForCycle(query.cycle);
  }

  @Get('all')
  findAll() {
    return this.incomeService.findAll();
  }

  @Post()
  create(@Body() dto: UpsertIncomeSourceDto) {
    return this.incomeService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpsertIncomeSourceDto) {
    return this.incomeService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.incomeService.remove(id);
  }
}
