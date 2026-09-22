import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtGuard } from './admin-jwt.guard';
import { CurrentAdmin } from './current-admin.decorator';
import { AdminLoginDto } from './dto/admin-login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import type { AuthenticatedAdmin } from './admin-jwt.strategy';

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  // Rate limited: this is the one unauthenticated door into the admin console.
  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  login(@Body() dto: AdminLoginDto) {
    return this.adminAuthService.login(dto);
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @UseGuards(AdminJwtGuard)
  me(@CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.adminAuthService.me(admin.id);
  }

  @Post('change-password')
  @HttpCode(200)
  @ApiBearerAuth('bearer')
  @UseGuards(AdminJwtGuard)
  changePassword(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.adminAuthService.changePassword(admin.id, dto);
  }
}
