import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { assertRequiredEnv } from './config/validate-env';
import { uploadsRoot } from './blog/uploads/blog-uploads.util';

/**
 * Swagger describes every route including the admin auth endpoints, so it is
 * off in production unless explicitly switched back on.
 */
function isSwaggerEnabled(): boolean {
  if (process.env.ENABLE_SWAGGER === 'true') return true;
  if (process.env.ENABLE_SWAGGER === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

async function bootstrap() {
  // Before anything binds a port: a misconfigured deploy should fail loudly
  // here rather than serve 500s once traffic arrives.
  assertRequiredEnv();

  // rawBody is required so the Razorpay webhook handler can verify the HMAC
  // signature against the exact bytes Razorpay sent (req.rawBody).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  app.use(helmet());
  // Nothing is gained by advertising the framework to a scanner.
  app.disable('x-powered-by');

  // Blog images uploaded from the admin console. Names are random and never
  // reused, so browsers may cache them for a year. The CORP header lets the
  // portfolio, a different site, show them; helmet's default would block it.
  app.useStaticAssets(uploadsRoot(), {
    prefix: '/uploads/',
    index: false,
    dotfiles: 'deny',
    maxAge: '365d',
    immutable: true,
    setHeaders: (res: { setHeader: (name: string, value: string) => void }) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  });

  app.enableCors({
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(','),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Let Nest run OnModuleDestroy (Prisma disconnect) on SIGTERM, so a rolling
  // deploy closes its pool instead of dropping connections.
  app.enableShutdownHooks();

  if (isSwaggerEnabled()) {
    const config = new DocumentBuilder()
      .setTitle('Due — EMI backend API')
      .setDescription('API backing the emi household bill tracker')
      .setVersion('1.0')
      .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'bearer',
      )
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  // Behind a reverse proxy on a shared box, set HOST=127.0.0.1 so the port is
  // not reachable from the internet directly — otherwise nginx's TLS and rate
  // limiting can be bypassed by hitting the port. Containers keep 0.0.0.0.
  await app.listen(process.env.PORT ?? 3001, process.env.HOST ?? '0.0.0.0');
}
void bootstrap();
