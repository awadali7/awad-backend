import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const HOUSEHOLD_ID = 'household';
const DEFAULT_INCOME = { userSalary: 30_000, spouseSalary: 10_000 };

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

async function main() {
  const billCount = await prisma.bill.count();
  if (billCount === 0) {
    await prisma.bill.createMany({ data: SEED_BILLS });
    console.log(`Seeded ${SEED_BILLS.length} bills.`);
  } else {
    console.log(`Skipping bill seed — ${billCount} bill(s) already exist.`);
  }

  await prisma.incomeSettings.upsert({
    where: { id: HOUSEHOLD_ID },
    update: {},
    create: { id: HOUSEHOLD_ID, ...DEFAULT_INCOME },
  });
  console.log('Ensured household income settings exist.');
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
