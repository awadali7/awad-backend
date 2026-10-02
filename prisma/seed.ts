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
async function seedAdminUser() {
  const username = (process.env.ADMIN_USERNAME ?? '').toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.log('Skipping admin seed — ADMIN_USERNAME/ADMIN_PASSWORD not set.');
    return;
  }

  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (existing) {
    console.log(`Skipping admin seed — "${username}" already exists.`);
    return;
  }

  await prisma.adminUser.create({
    data: {
      username,
      passwordHash: await bcrypt.hash(password, 10),
      name: 'Awad Ali',
    },
  });
  console.log(`Created admin user "${username}".`);
}

async function main() {
  await seedAdminUser();

  const billCount = await prisma.bill.count();
  if (billCount === 0) {
    await prisma.bill.createMany({ data: SEED_BILLS });
    console.log(`Seeded ${SEED_BILLS.length} bills.`);
  } else {
    console.log(`Skipping bill seed — ${billCount} bill(s) already exist.`);
  }

  const incomeCount = await prisma.incomeSource.count();
  if (incomeCount === 0) {
    await prisma.incomeSource.createMany({
      data: DEFAULT_INCOME_SOURCES.map((source) => ({ ...source, cycle: null })),
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
