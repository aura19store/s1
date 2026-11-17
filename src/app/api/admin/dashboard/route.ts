import { NextResponse } from "next/server";
import { queryAll, queryOne } from "@/db";
import { requireAdminApi } from "@/lib/auth";

export async function GET() {
  const auth = await requireAdminApi("dashboard");
  if ("error" in auth) return auth.error;

  const [
    productStats,
    categoryCount,
    orderStats,
    ordersByStatus,
    dailyRevenue,
    recentOrders,
    lowStockProducts,
  ] = await Promise.all([
    queryOne<{
      total_products: number;
      men_products: number;
      women_products: number;
      hidden_products: number;
      out_of_stock: number;
      low_stock: number;
    }>(`
      SELECT
        COUNT(*) as total_products,
        SUM(CASE WHEN g.slug = 'men' THEN 1 ELSE 0 END) as men_products,
        SUM(CASE WHEN g.slug = 'women' THEN 1 ELSE 0 END) as women_products,
        SUM(CASE WHEN p.status = 'hidden' THEN 1 ELSE 0 END) as hidden_products,
        SUM(CASE WHEN p.stock_quantity <= 0 THEN 1 ELSE 0 END) as out_of_stock,
        SUM(CASE WHEN p.stock_quantity > 0 AND p.stock_quantity <= p.low_stock_threshold THEN 1 ELSE 0 END) as low_stock
      FROM products p
      JOIN genders g ON g.id = p.gender_id
    `),
    queryOne<{ c: number }>(`SELECT COUNT(*) as c FROM categories`),
    queryOne<{
      total_orders: number;
      new_orders: number;
      pending_orders: number;
      completed_orders: number;
      total_revenue_iqd: number;
    }>(`
      SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN status IN ('pending','confirmed') THEN 1 ELSE 0 END) as new_orders,
        SUM(CASE WHEN status IN ('pending','processing','shipped') THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as completed_orders,
        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total_iqd ELSE 0 END), 0) as total_revenue_iqd
      FROM orders
    `),
    queryAll<{ status: string; count: number; total_iqd: number }>(`
      SELECT status, COUNT(*) as count, COALESCE(SUM(total_iqd), 0) as total_iqd
      FROM orders
      GROUP BY status
    `),
    queryAll<{ day: string; revenue_iqd: number; orders_count: number }>(`
      SELECT substr(created_at, 1, 10) as day,
             COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total_iqd ELSE 0 END), 0) as revenue_iqd,
             COUNT(*) as orders_count
      FROM orders
      GROUP BY substr(created_at, 1, 10)
      ORDER BY day ASC
      LIMIT 14
    `),
    queryAll(`
      SELECT id, order_number, customer_name, governorate, total_iqd, status, created_at
      FROM orders
      ORDER BY datetime(created_at) DESC, id DESC
      LIMIT 6
    `),
    queryAll(`
      SELECT p.id, p.name, p.sku, p.stock_quantity, p.low_stock_threshold, g.name as gender_name
      FROM products p
      JOIN genders g ON g.id = p.gender_id
      WHERE p.stock_quantity <= p.low_stock_threshold
      ORDER BY p.stock_quantity ASC
      LIMIT 8
    `),
  ]);

  return NextResponse.json({
    kpis: {
      totalProducts: Number(productStats?.total_products || 0),
      menProducts: Number(productStats?.men_products || 0),
      womenProducts: Number(productStats?.women_products || 0),
      totalCategories: Number(categoryCount?.c || 0),
      hiddenProducts: Number(productStats?.hidden_products || 0),
      outOfStockProducts: Number(productStats?.out_of_stock || 0),
      lowStockProducts: Number(productStats?.low_stock || 0),
      totalOrders: Number(orderStats?.total_orders || 0),
      newOrders: Number(orderStats?.new_orders || 0),
      pendingOrders: Number(orderStats?.pending_orders || 0),
      completedOrders: Number(orderStats?.completed_orders || 0),
      totalRevenueIqd: Number(orderStats?.total_revenue_iqd || 0),
    },
    ordersByStatus,
    dailyRevenue,
    recentOrders,
    lowStockProducts,
  });
}
