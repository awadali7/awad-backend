import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyOrAdminGuard } from '../admin/api-key-or-admin.guard';
import { AssistantService } from './assistant.service';
import { InterpretDto } from './dto/interpret.dto';

@ApiTags('assistant')
@ApiSecurity('api-key')
@ApiBearerAuth('bearer')
@UseGuards(ApiKeyOrAdminGuard)
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  /** Lets the console hide the chat entirely when no key is configured. */
  @Get('status')
  status() {
    return { configured: this.assistantService.isConfigured };
  }

  /**
   * Turns a note into a *proposed* record. Writes nothing — the console shows
   * the proposal and the operator confirms it through the normal endpoints.
   */
  @Post('interpret')
  @HttpCode(200)
  interpret(@Body() dto: InterpretDto) {
    return this.assistantService.interpret(dto);
  }
}
