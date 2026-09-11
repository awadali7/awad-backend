# awad-backend

NestJS API backing the [`emi`](../emi) household bill tracker. It is the
server-side source of truth for bills and income settings — the frontend no
longer stores this data in IndexedDB.

## Stack

- NestJS 11 + TypeScript
- PostgreSQL via Prisma 7 (`@prisma/adapter-pg` driver adapter)
- Auth: a single shared secret (`API_KEY`), sent by the frontend as the
  `x-api-key` header on every request — no accounts, matching the household
  app's "no login" philosophy.

## Data model

Mirrors `emi/lib/types.ts`:

- **Bill** — `id`, `name`, `category`, `type` (`emi` | `chitty` | `recurring` |
  `credit_card`), `amount`, `dueDay`, `endOfMonth`, `installmentsPaid` /
  `installmentsTotal` / `installmentsLeft`, `lastPaidCycle`,
  `lastNotifiedCycle`, `archived`, `createdAt`, `updatedAt`.
- **IncomeSettings** — a single row (`id: "household"`) holding `userSalary`
  and `spouseSalary`.

Due-date math, bill status, and the mark-as-paid transform (`emi/lib/schedule.ts`)
stay client-side — this API only stores and serves the raw fields. That keeps
the one piece of business logic in one place instead of duplicating it on the
server.

## API docs (Swagger)

Interactive OpenAPI docs are served at `/docs` (JSON spec at `/docs-json`)
whenever the server is running, e.g. http://localhost:3001/docs.

Every protected route is annotated with the `api-key` security scheme, so the
UI shows a lock icon on `bills`/`income` routes. Click **Authorize** (top
right) and paste your `API_KEY` value once — Swagger UI then sends it as the
`x-api-key` header on every "Try it out" request for the rest of the session.

Config lives in `src/main.ts` (`DocumentBuilder` + `SwaggerModule.setup`);
per-route docs come from `@ApiTags`/`@ApiSecurity` on the controllers and
`@ApiProperty`/`@ApiPropertyOptional` on the DTOs in `src/*/dto/`.

## API

All routes below except `GET /` require the `x-api-key` header.

| Method | Path         | Description                                              |
| ------ | ------------ | --------------------------------------------------------- |
| GET    | `/`          | Health check (no auth)                                    |
| GET    | `/bills`     | List all bills (including archived)                       |
| GET    | `/bills/:id` | Get one bill                                               |
| PUT    | `/bills/:id` | Upsert a bill — creates it if `id` is new, else replaces it |
| DELETE | `/bills/:id` | Delete a bill                                              |
| GET    | `/income`    | Get household income settings                             |
| PUT    | `/income`    | Replace household income settings                         |

`PUT /bills/:id` takes the full bill body (everything except `id`,
`createdAt`, `updatedAt`, which the server manages):

```json
{
  "name": "Washing machine",
  "category": "Appliance EMI",
  "type": "emi",
  "amount": 1100,
  "dueDay": 25,
  "installmentsPaid": 2,
  "installmentsTotal": 12
}
```

## Local setup

1. **Database** — either:
   - Use an existing local Postgres: `createdb emi_dev`, or
   - `docker compose up -d` to run one via `docker-compose.yml`.
2. Copy `.env.example` to `.env` and adjust `DATABASE_URL` / `API_KEY` to match.
3. Install dependencies: `npm install`
4. Apply the schema: `npm run prisma:migrate`
5. Seed the household's starting bills (only runs if the `bills` table is
   empty, mirroring `emi/lib/seed.ts`): `npm run prisma:seed`
6. Start the API: `npm run start:dev` (listens on `PORT`, default `3001`)

## Scripts

```bash
npm run start:dev       # watch mode
npm run build            # compile to dist/
npm run start:prod       # run compiled build
npm run lint              # eslint --fix
npm run test              # unit tests
npm run test:e2e          # e2e tests

npm run prisma:generate   # regenerate the Prisma client after a schema change
npm run prisma:migrate    # create + apply a migration (dev)
npm run prisma:deploy     # apply pending migrations (prod/CI)
npm run prisma:seed       # run prisma/seed.ts
npm run prisma:studio     # browse the DB in Prisma Studio
```

## Deployment

Set `DATABASE_URL`, `API_KEY`, `CORS_ORIGIN` (the deployed frontend's origin),
and `PORT` in the environment, then:

```bash
npm ci
npm run build
npm run prisma:deploy
npm run start:prod
```
