import { getDb } from "./index";

// Calling getDb() runs schema + seeds if empty
const db = getDb();
const counts = {
  users: (db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number }).c,
  genders: (db.prepare("SELECT COUNT(*) as c FROM genders").get() as { c: number }).c,
  categories: (db.prepare("SELECT COUNT(*) as c FROM categories").get() as { c: number }).c,
  products: (db.prepare("SELECT COUNT(*) as c FROM products").get() as { c: number }).c,
  attributes: (db.prepare("SELECT COUNT(*) as c FROM attributes").get() as { c: number }).c,
  orders: (db.prepare("SELECT COUNT(*) as c FROM orders").get() as { c: number }).c,
};
console.log("AURA database ready:", counts);
