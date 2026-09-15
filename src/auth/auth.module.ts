import { Module } from '@nestjs/common';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    // registerAsync defers reading process.env until Nest actually bootstraps
    // the module, by which point ConfigModule.forRoot() has loaded .env —
    // JwtModule.register() would read it too early, at import/decoration time.
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
        signOptions: {
          expiresIn: (process.env.JWT_EXPIRES_IN ??
            '7d') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
    // Applied only to signup/login (see AuthController) — a public login endpoint
    // with no rate limiting is a brute-force hole.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
