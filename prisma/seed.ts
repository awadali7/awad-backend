import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Permanent income sources (cycle null = counts towards every month).
const DEFAULT_INCOME_SOURCES = [
  { label: 'My salary', amount: 30_000 },
  { label: 'Spouse salary', amount: 10_000 },
];

// Mirrors emi/lib/seed.ts — the household's starting bills, seeded once.
const SEED_BILLS = [
  {
    id: 'tvs-fridge',
    name: 'TVS Credit – Refrigerator',
    category: 'Refrigerator EMI',
    type: 'emi' as const,
    amount: 1_821,
    dueDay: 1,
    installmentsPaid: 1,
    installmentsTotal: 12,
  },
  {
    id: 'lnt-scooter',
    name: 'L&T Planet – Scooter',
    category: 'Scooter EMI',
    type: 'emi' as const,
    amount: 5_379,
    dueDay: 2,
    installmentsPaid: 1,
    installmentsTotal: 36,
  },
  {
    id: 'gpay-bike-chitty',
    name: 'GPay – Bike chitty',
    category: 'Bike chitty',
    type: 'chitty' as const,
    amount: 5_000,
    dueDay: 7,
    installmentsPaid: 16,
    installmentsTotal: 20,
  },
  {
    id: 'pocketly-2',
    name: 'Pocketly #2',
    category: 'Pocketly',
    type: 'chitty' as const,
    amount: 1_768,
    dueDay: 7,
    installmentsLeft: 1,
  },
  {
    id: 'ksfe-bike-chitty',
    name: 'KSFE Power – Bike chitty',
    category: 'Bike chitty',
    type: 'chitty' as const,
    amount: 10_000,
    dueDay: 22,
    installmentsPaid: 43,
    installmentsTotal: 60,
  },
  {
    id: 'washing-machine',
    name: 'Washing machine',
    category: 'Appliance EMI',
    type: 'emi' as const,
    amount: 1_100,
    dueDay: 25,
    installmentsPaid: 1,
    installmentsTotal: 12,
  },
  {
    id: 'pocketly-1',
    name: 'Pocketly #1',
    category: 'Pocketly',
    type: 'chitty' as const,
    amount: 1_768,
    dueDay: 25,
    installmentsLeft: 2,
  },
  {
    id: 'rent',
    name: 'Rent',
    category: 'Housing',
    type: 'recurring' as const,
    amount: 10_000,
    dueDay: null,
  },
  {
    id: 'axis-credit-card',
    name: 'Axis Credit Card',
    category: 'Credit card',
    type: 'credit_card' as const,
    amount: 20_500,
    dueDay: null,
    endOfMonth: true,
  },
];

/**
 * Creates the /admin operator account from ADMIN_USERNAME / ADMIN_PASSWORD.
 * Only ever creates: re-running the seed must not reset a password that has
 * since been changed through the console.
 */
async function seedAdminUser(
  rawUsername: string | undefined,
  password: string | undefined,
  name: string,
) {
  const username = (rawUsername ?? '').toLowerCase().trim();

  if (!username || !password) {
    console.log(`Skipping admin seed for ${name} — username/password not set.`);
    return null;
  }

  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (existing) {
    console.log(`Skipping admin seed — "${username}" already exists.`);
    return existing;
  }

  const created = await prisma.adminUser.create({
    data: {
      username,
      passwordHash: await bcrypt.hash(password, 10),
      name,
    },
  });
  console.log(`Created admin user "${username}".`);
  return created;
}

async function main() {
  const primary = await seedAdminUser(
    process.env.ADMIN_USERNAME,
    process.env.ADMIN_PASSWORD,
    'Awad Ali',
  );

  // Second operator. Her money is scoped to her own account — the seed data
  // below belongs to the primary admin only, so she starts with a clean slate.
  await seedAdminUser(
    process.env.SECOND_ADMIN_USERNAME,
    process.env.SECOND_ADMIN_PASSWORD,
    'Maisa',
  );

  if (!primary) {
    console.log('No primary admin — skipping bill and income seed.');
    return;
  }

  const billCount = await prisma.bill.count({
    where: { adminUserId: primary.id },
  });
  if (billCount === 0) {
    await prisma.bill.createMany({
      data: SEED_BILLS.map((bill) => ({ ...bill, adminUserId: primary.id })),
    });
    console.log(`Seeded ${SEED_BILLS.length} bills for ${primary.username}.`);
  } else {
    console.log(`Skipping bill seed — ${billCount} bill(s) already exist.`);
  }

  const incomeCount = await prisma.incomeSource.count({
    where: { adminUserId: primary.id },
  });
  if (incomeCount === 0) {
    await prisma.incomeSource.createMany({
      data: DEFAULT_INCOME_SOURCES.map((source) => ({
        ...source,
        cycle: null,
        adminUserId: primary.id,
      })),
    });
    console.log(`Seeded ${DEFAULT_INCOME_SOURCES.length} income sources.`);
  } else {
    console.log(
      `Skipping income seed — ${incomeCount} source(s) already exist.`,
    );
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
