NestJS and Prisma fit together well because both lean on TypeScript. This is the setup I use for small and medium APIs: validation at the edge, one database client for the whole app, and errors your frontend can actually show.

## Validate at the edge

Turn on a global validation pipe once, and every DTO is checked before your code runs. Unknown fields are rejected instead of quietly ignored.

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
```

A DTO then documents and enforces the request shape in one place:

```ts
export class CreateNoteDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  body?: string;
}
```

## One Prisma client for the whole app

Wrap the client in an injectable service so every module shares a single connection pool, and close it cleanly on shutdown.

```ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

## Turn database errors into HTTP errors

A unique constraint violation should reach the client as a 409 with a readable message, not a 500.

```ts
try {
  return await this.prisma.note.create({ data: dto });
} catch (error) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new ConflictException('A note with that title already exists');
  }
  throw error;
}
```

## Test the service, not the framework

Services hold the rules, so that is where tests pay off. Swap the Prisma service for a plain object with Jest mocks and assert on what the service asks the database to do.

The result is an API where the types, the validation and the error messages all tell the same story.
