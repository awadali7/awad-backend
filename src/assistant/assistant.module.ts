import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { AzureOpenAiService } from './azure-openai.service';

@Module({
  imports: [AdminModule],
  controllers: [AssistantController],
  providers: [AssistantService, AzureOpenAiService],
})
export class AssistantModule {}
