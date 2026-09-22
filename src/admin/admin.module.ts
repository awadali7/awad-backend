import { Module } from '@nestjs/common';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtGuard } from './admin-jwt.guard';
import { AdminJwtStrategy } from './admin-jwt.strategy';
import { ApiKeyOrAdminGuard } from './api-key-or-admin.guard';

/**
 * Admin console auth. Exports the guards so feature modules (bills, income)
 * can accept an admin session without re-declaring the strategy.
 *
 * ThrottlerModule is @Global() and already registered by AuthModule, so
 * ThrottlerGuard resolves here without a second forRoot().
 */
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.ADMIN_JWT_SECRET,
        signOptions: {
          expiresIn: (process.env.ADMIN_JWT_EXPIRES_IN ??
            '12h') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AdminAuthController],
  providers: [
    AdminAuthService,
    AdminJwtStrategy,
    AdminJwtGuard,
    ApiKeyOrAdminGuard,
  ],
  exports: [AdminJwtGuard, ApiKeyOrAdminGuard],
})
export class AdminModule {}
