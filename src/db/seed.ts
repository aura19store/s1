import {
  closeDbPool,
  getDatabaseDriver,
  queryOne,
  runTransaction,
} from "./index";
import { seedDatabase } from "./seed-data";

async function main() {
  const driver = getDatabaseDriver();
  console.log(`Seeding AURA database (driver: ${driver})...`);

  await runTransaction(async (tx) => {
    await seedDatabase(tx);
  });

  const [users, genders, categories, products, attributes, orders] =
    await Promise.all([
      queryOne<{ c: number }>("SELECT COUNT(*) as c FROM users"),
      queryOne<{ c: number }>("SELECT COUNT(*) as c FROM genders"),
      queryOne<{ c: number }>("SELECT COUNT(*) as c FROM categories"),
      queryOne<{ c: number }>("SELECT COUNT(*) as c FROM products"),
      queryOne<{ c: number }>("SELECT COUNT(*) as c FROM attributes"),
      queryOne<{ c: number }>("SELECT COUNT(*) as c FROM orders"),
    ]);

  console.log("AURA database ready:", {
    driver,
    users: Number(users?.c ?? 0),
    genders: Number(genders?.c ?? 0),
    categories: Number(categories?.c ?? 0),
    products: Number(products?.c ?? 0),
    attributes: Number(attributes?.c ?? 0),
    orders: Number(orders?.c ?? 0),
  });
}

main()
  .catch((err) => {
    console.error("Seed error:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDbPool();
  });
