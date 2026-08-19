import { supabase } from "./supabase";

export type SalesSummary = {
  orderCount: number;
  totalSales: number;
};

export type CommissionOverviewRow = {
  shopId: string;
  shopName: string;
  ownerId: string;
  today: SalesSummary;
  period: SalesSummary;
  commissionPerOrder: number;
  amountOwed: number;
};

export function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export function startOfTomorrow() {
  const date = startOfToday();
  date.setDate(date.getDate() + 1);
  return date;
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function startOfNextMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

export function formatPeriodMonth(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export function calculateCommissionOwed(orderCount: number, commissionPerOrder: number) {
  return Number((orderCount * commissionPerOrder).toFixed(2));
}

export async function getShopSalesSummary(shopId: string, startDate: Date, endDate: Date): Promise<SalesSummary> {
  const { data, count, error } = await supabase
    .from("orders")
    .select("total", { count: "exact" })
    .eq("shop_id", shopId)
    .eq("payment_status", "paid")
    .eq("status", "completed")
    .gte("created_at", startDate.toISOString())
    .lt("created_at", endDate.toISOString());

  if (error) throw new Error(error.message);

  const totalSales = (data ?? []).reduce((sum, order) => sum + Number(order.total || 0), 0);
  return { orderCount: count ?? 0, totalSales };
}

async function getSalesSummariesByShop(shopIds: string[], startDate: Date, endDate: Date) {
  const summaries: Record<string, SalesSummary> = Object.fromEntries(
    shopIds.map((shopId) => [shopId, { orderCount: 0, totalSales: 0 }])
  );
  if (shopIds.length === 0) return summaries;

  const { data, error } = await supabase
    .from("orders")
    .select("shop_id,total")
    .in("shop_id", shopIds)
    .eq("payment_status", "paid")
    .eq("status", "completed")
    .gte("created_at", startDate.toISOString())
    .lt("created_at", endDate.toISOString());

  if (error) throw new Error(error.message);

  for (const order of data ?? []) {
    const shopId = String(order.shop_id);
    const current = summaries[shopId] ?? { orderCount: 0, totalSales: 0 };
    current.orderCount += 1;
    current.totalSales += Number(order.total || 0);
    summaries[shopId] = current;
  }

  return summaries;
}

export async function getCommissionOverview(startDate: Date, endDate: Date): Promise<CommissionOverviewRow[]> {
  const { data: shops, error } = await supabase
    .from("shops")
    .select("id,name,owner_id,commission_per_order")
    .eq("status", "approved");

  if (error) throw new Error(error.message);

  const shopRows = shops ?? [];
  const shopIds = shopRows.map((shop) => shop.id);
  const [today, period] = await Promise.all([
    getSalesSummariesByShop(shopIds, startOfToday(), startOfTomorrow()),
    getSalesSummariesByShop(shopIds, startDate, endDate),
  ]);

  return shopRows
    .map((shop) => {
      const commissionPerOrder = Number(shop.commission_per_order || 0);
      const periodSummary = period[shop.id] ?? { orderCount: 0, totalSales: 0 };
      return {
        shopId: shop.id,
        shopName: shop.name ?? "Shop",
        ownerId: shop.owner_id ?? "",
        today: today[shop.id] ?? { orderCount: 0, totalSales: 0 },
        period: periodSummary,
        commissionPerOrder,
        amountOwed: calculateCommissionOwed(periodSummary.orderCount, commissionPerOrder),
      };
    })
    .sort((a, b) => b.amountOwed - a.amountOwed);
}
