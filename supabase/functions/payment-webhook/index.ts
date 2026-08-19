import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.3";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const form = await req.formData();
  const params = new Map<string, string>();
  for (const [key, value] of form.entries()) params.set(key, String(value ?? ""));

  const receivedSignature = params.get("x_signature") ?? "";
  const expectedSignature = await billplzSignature(params, mustEnv("BILLPLZ_X_SIGNATURE_KEY"));
  if (!constantTimeEqual(receivedSignature, expectedSignature)) {
    return new Response("Invalid signature", { status: 400 });
  }

  const billId = params.get("id") ?? "";
  const paid = params.get("paid") === "true";
  const supabase = createClient(mustEnv("SUPABASE_URL"), mustEnv("SUPABASE_SERVICE_ROLE_KEY"));

  const { data: payment } = await supabase
    .from("payments")
    .select("id,type,reference_id,user_id,duration_days,listing_type,status")
    .eq("billplz_bill_id", billId)
    .maybeSingle();

  if (!payment) return new Response("ok", { status: 200 });
  if (!paid) {
    await supabase.from("payments").update({ status: "failed" }).eq("id", payment.id).eq("status", "pending");
    return new Response("ok", { status: 200 });
  }

  if (payment.status !== "paid") {
    await supabase
      .from("payments")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", payment.id);

    if (payment.type === "order") {
      await supabase.from("orders").update({ payment_status: "paid" }).eq("id", payment.reference_id);
      await supabase.from("notifications").insert({
        user_id: payment.user_id,
        icon: "Payment",
        title: "Payment confirmed",
        body: "Your order payment has been confirmed.",
        type: "order",
        link_to: "/orders",
        is_unread: true,
      });
    }

    if (payment.type === "promotion" && payment.listing_type) {
      const table = payment.listing_type === "service" ? "services" : "products";
      const promotedUntil = new Date(Date.now() + Number(payment.duration_days || 0) * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from(table).update({ is_promoted: true, promoted_until: promotedUntil }).eq("id", payment.reference_id);
      await supabase.from("notifications").insert({
        user_id: payment.user_id,
        icon: "Promoted",
        title: "Promotion active",
        body: "Your listing promotion is now active.",
        type: "system",
        link_to: "/seller/dashboard",
        is_unread: true,
      });
    }
  }

  return new Response("ok", { status: 200 });
});

async function billplzSignature(params: Map<string, string>, key: string) {
  const source = [...params.entries()]
    .filter(([paramKey]) => paramKey !== "x_signature")
    .map(([paramKey, value]) => `${paramKey}${value}`)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .join("|");

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(source));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function mustEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}
