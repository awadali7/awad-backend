import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { IncomeService } from './income.service';
import { UpdateIncomeDto } from './dto/update-income.dto';

@ApiTags('income')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@Controller('income')
export class IncomeController {
  constructor(private readonly incomeService: IncomeService) {}

  @Get()
  find() {
    return this.incomeService.find();
  }

  @Put()
  update(@Body() dto: UpdateIncomeDto) {
    return this.incomeService.update(dto);
  }
}
