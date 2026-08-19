import { supabase } from "./supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ShopPaymentInfo = {
  name: string;
  payment_qr_url: string | null;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
};

export type PlatformPaymentInfo = {
  payment_qr_url: string | null;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
};

// ─── Fetchers ─────────────────────────────────────────────────────────────────

/** Fetch one shop's payment details (QR URL + bank fallback). */
export async function fetchShopPaymentInfo(shopId: string): Promise<ShopPaymentInfo | null> {
  const { data } = await supabase
    .from("shops")
    .select("name,payment_qr_url,bank_name,account_name,account_number")
    .eq("id", shopId)
    .maybeSingle();
  if (!data) return null;
  return {
    name: data.name ?? "",
    payment_qr_url: data.payment_qr_url ?? null,
    bank_name: data.bank_name ?? null,
    account_name: data.account_name ?? null,
    account_number: data.account_number ?? null,
  };
}

/** Fetch the platform's own payment details (used for promotion fees). */
export async function fetchPlatformPaymentInfo(): Promise<PlatformPaymentInfo> {
  const { data } = await supabase
    .from("platform_settings")
    .select("payment_qr_url,bank_name,account_name,account_number")
    .eq("id", true)
    .maybeSingle();
  return {
    payment_qr_url: data?.payment_qr_url ?? null,
    bank_name: data?.bank_name ?? null,
    account_name: data?.account_name ?? null,
    account_number: data?.account_number ?? null,
  };
}

/** Fetch payment info for multiple shops in a single query. */
export async function fetchMultiShopPaymentInfo(
  shopIds: string[]
): Promise<Record<string, ShopPaymentInfo>> {
  if (shopIds.length === 0) return {};
  const { data } = await supabase
    .from("shops")
    .select("id,name,payment_qr_url,bank_name,account_name,account_number")
    .in("id", shopIds);
  const map: Record<string, ShopPaymentInfo> = {};
  for (const row of data ?? []) {
    map[row.id] = {
      name: row.name ?? "",
      payment_qr_url: row.payment_qr_url ?? null,
      bank_name: row.bank_name ?? null,
      account_name: row.account_name ?? null,
      account_number: row.account_number ?? null,
    };
  }
  return map;
}

// ─── Confirmation ─────────────────────────────────────────────────────────────

/**
 * Buyer taps "I've Paid" — marks the order as buyer-confirmed and advances
 * status from 'pending' → 'confirmed' so the seller sees it as active.
 * This is an honor-system update, NOT verified payment.
 */
export async function confirmPaymentByBuyer(orderId: string, paymentProofUrl?: string | null): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      payment_confirmed_by: "buyer",
      payment_confirmed_at: new Date().toISOString(),
      status: "confirmed",
      ...(paymentProofUrl ? { payment_proof_url: paymentProofUrl } : {}),
    })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
}

/**
 * Seller verifies they actually received payment in their own TnG / bank app.
 */
export async function sellerVerifyPayment(orderId: string): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ payment_verified_by_seller: true })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
}

/**
 * Called when a seller marks a 'pay on pickup' order as delivered and
 * confirms they collected cash / QR payment in person.
 */
export async function confirmPaymentBySeller(orderId: string): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      payment_confirmed_by: "seller",
      payment_confirmed_at: new Date().toISOString(),
      payment_verified_by_seller: true,
      status: "completed",
    })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
}

// ─── Notifications ────────────────────────────────────────────────────────────

/** Insert a notification for the shop owner (seller) about a new paid order. */
export async function notifySellerNewOrder(
  shopId: string,
  buyerName: string,
  amount: number
): Promise<void> {
  // Look up the shop's owner_id first
  const { data: shopRow } = await supabase
    .from("shops")
    .select("owner_id")
    .eq("id", shopId)
    .maybeSingle();
  if (!shopRow?.owner_id) return;

  const { error } = await supabase.from("notifications").insert({
    user_id: shopRow.owner_id,
    icon: "🛍️",
    title: "New paid order",
    body: `${buyerName} just paid RM${amount.toFixed(2)} for an order. Please verify you received it before preparing.`,
    type: "order",
    link_to: "/orders",
    is_unread: true,
  });
  if (error) console.error("Could not create seller order notification:", error.message);
}


/** Notify the buyer immediately after they confirm payment. */
export async function notifyBuyerOrderConfirmed(
  buyerId: string,
  shopName: string,
  amount: number
): Promise<void> {
  const { error } = await supabase.from("notifications").insert({
    user_id: buyerId,
    icon: "✅",
    title: "Order placed successfully",
    body: `Your payment of RM${amount.toFixed(2)} to ${shopName} was recorded. The seller has been notified.`,
    type: "order",
    link_to: "/orders",
    is_unread: true,
  });
  if (error) console.error("Could not create buyer order notification:", error.message);
}

/** Insert a notification for all admin users about a new promotion receipt. */
export async function notifyAdminsPromoReceipt(
  shopName: string,
  listingName: string,
  amount: number
): Promise<void> {
  const { data: admins } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_admin", true);
  if (!admins?.length) return;
  const { error } = await supabase.from("notifications").insert(
    admins.map((a: { id: string }) => ({
      user_id: a.id,
      icon: "📣",
      title: "Promotion receipt submitted",
      body: `${shopName} submitted a payment receipt for promoting "${listingName}" — RM${amount.toFixed(2)}. Review in Admin Panel → Promotions.`,
      type: "promotion",
      is_unread: true,
    }))
  );
  if (error) console.error("Could not create promotion receipt notifications:", error.message);
}

/** Insert a notification for the seller about their promotion status. */
export async function notifySellerPromoStatus(
  ownerId: string,
  listingName: string,
  approved: boolean,
  reason?: string
): Promise<void> {
  const { error } = await supabase.from("notifications").insert({
    user_id: ownerId,
    icon: approved ? "🎉" : "📣",
    title: approved ? "Promotion approved! 🎉" : "Promotion not approved",
    body: approved
      ? `Your promotion for "${listingName}" has been approved and is now live!`
      : `Your promotion for "${listingName}" was not approved. ${reason ? `Reason: ${reason}` : ""}`,
    type: "promotion",
    is_unread: true,
  });
  if (error) console.error("Could not create promotion status notification:", error.message);
}

/** Insert a notification for all admin users about a new commission receipt. */
export async function notifyAdminsCommissionReceipt(
  shopName: string,
  amount: number
): Promise<void> {
  const { data: admins } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_admin", true);
  if (!admins?.length) return;
  const { error } = await supabase.from("notifications").insert(
    admins.map((a: { id: string }) => ({
      user_id: a.id,
      icon: "💰",
      title: "Commission receipt submitted",
      body: `${shopName} submitted a monthly commission receipt for RM${amount.toFixed(2)}. Review it in Admin Panel -> Payouts.`,
      type: "promotion",
      is_unread: true,
    }))
  );
  if (error) console.error("Could not create commission receipt notifications:", error.message);
}

/** Insert a notification for the seller about their commission settlement status. */
export async function notifySellerCommissionStatus(
  ownerId: string,
  periodLabel: string,
  approved: boolean,
  reason?: string
): Promise<void> {
  const { error } = await supabase.from("notifications").insert({
    user_id: ownerId,
    icon: approved ? "✅" : "💰",
    title: approved ? "Commission payment approved" : "Commission payment not approved",
    body: approved
      ? `Your commission payment for ${periodLabel} has been approved.`
      : `Your commission payment for ${periodLabel} was not approved. ${reason ? `Reason: ${reason}` : ""}`,
    type: "promotion",
    is_unread: true,
  });
  if (error) console.error("Could not create commission status notification:", error.message);
}


/** Notify all administrators that a new seller application is waiting for review. */
export async function notifyAdminsSellerApplication(shopName: string, applicantName: string): Promise<void> {
  const { error } = await supabase.rpc("notify_admins_new_seller_application", { p_shop_name: shopName, p_applicant_name: applicantName });
  if (error) console.error("Could not create seller application notifications:", error.message);
}
