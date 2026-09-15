import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Customer-facing analogue of ApiKeyGuard — validates a bearer JWT instead of a shared secret. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
