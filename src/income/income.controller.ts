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
import { IncomeQueryDto } from './dto/income-query.dto';
import { UpsertIncomeSourceDto } from './dto/upsert-income-source.dto';
import { IncomeService } from './income.service';

@ApiTags('income')
@ApiBearerAuth('bearer')
@UseGuards(AdminJwtGuard)
@Controller('income')
export class IncomeController {
  constructor(private readonly incomeService: IncomeService) {}

  /** Permanent sources plus the one-offs for `cycle`, with totals. */
  @Get()
  find(
    @Query() query: IncomeQueryDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.incomeService.findForCycle(admin.id, query.cycle);
  }

  @Get('all')
  findAll(@CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.incomeService.findAll(admin.id);
  }

  @Post()
  create(
    @Body() dto: UpsertIncomeSourceDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.incomeService.create(dto, admin.id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpsertIncomeSourceDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.incomeService.update(id, dto, admin.id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    await this.incomeService.remove(id, admin.id);
  }
}
