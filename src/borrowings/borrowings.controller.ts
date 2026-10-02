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
import { BorrowingsService } from './borrowings.service';
import { MarkRepaidDto } from './dto/mark-repaid.dto';
import { UpsertBorrowingDto } from './dto/upsert-borrowing.dto';

@ApiTags('borrowings')
@ApiBearerAuth('bearer')
@UseGuards(AdminJwtGuard)
@Controller('borrowings')
export class BorrowingsController {
  constructor(private readonly borrowingsService: BorrowingsService) {}

  @Get()
  findAll(@CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.borrowingsService.findAll(admin.id);
  }

  @Post()
  create(
    @Body() dto: UpsertBorrowingDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.borrowingsService.create(dto, admin.id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpsertBorrowingDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.borrowingsService.update(id, dto, admin.id);
  }

  @Post(':id/repay')
  @HttpCode(200)
  markRepaid(
    @Param('id') id: string,
    @Body() dto: MarkRepaidDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.borrowingsService.markRepaid(id, admin.id, dto.repaidOn);
  }

  @Post(':id/unrepay')
  @HttpCode(200)
  markOutstanding(
    @Param('id') id: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    return this.borrowingsService.markOutstanding(id, admin.id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id') id: string,
    @CurrentAdmin() admin: AuthenticatedAdmin,
  ) {
    await this.borrowingsService.remove(id, admin.id);
  }
}
