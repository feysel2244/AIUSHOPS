import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PaymentRequest = {
  type: "order" | "promotion";
  referenceId: string;
  amount: number;
  description: string;
  buyerEmail: string;
  buyerName: string;
  durationDays?: number;
  listingType?: "product" | "service";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = mustEnv("SUPABASE_URL");
  const supabaseAnonKey = mustEnv("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
  const billplzApiKey = mustEnv("BILLPLZ_API_KEY");
  const billplzCollectionId = mustEnv("BILLPLZ_COLLECTION_ID");
  const billplzBaseUrl = mustEnv("BILLPLZ_BASE_URL").replace(/\/$/, "");
  const siteUrl = (Deno.env.get("SITE_URL") || req.headers.get("origin") || "").replace(/\/$/, "");

  const authHeader = req.headers.get("Authorization") ?? "";
  const authedClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authError } = await authedClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

  const body = await req.json() as PaymentRequest;
  const validationError = validatePaymentRequest(body);
  if (validationError) return json({ error: validationError }, 400);

  const admin = createClient(supabaseUrl, supabaseServiceRoleKey);
  const metadata = authData.user.user_metadata ?? {};
  await admin.from("profiles").upsert({
    id: authData.user.id,
    name: metadata.name || body.buyerName,
    email: metadata.email || body.buyerEmail || authData.user.email,
    department: metadata.department || "",
    year: metadata.year || "",
    whatsapp: metadata.whatsapp || "",
    has_shop: Boolean(metadata.has_shop),
    is_admin: Boolean(metadata.is_admin),
  });

  const amountInCents = Math.round(Number(body.amount) * 100);
  const callbackUrl = `${supabaseUrl}/functions/v1/payment-webhook`;
  const redirectUrl = `${siteUrl}/payment-complete?ref=${encodeURIComponent(body.referenceId)}`;

  const { data: payment, error: paymentError } = await admin
    .from("payments")
    .insert({
      type: body.type,
      reference_id: body.referenceId,
      user_id: authData.user.id,
      amount: body.amount,
      status: "pending",
      duration_days: body.durationDays ?? null,
      listing_type: body.listingType ?? null,
    })
    .select("id")
    .single();

  if (paymentError || !payment) return json({ error: paymentError?.message || "Could not create payment" }, 400);

  const billBody = new URLSearchParams({
    collection_id: billplzCollectionId,
    email: body.buyerEmail,
    name: body.buyerName,
    amount: String(amountInCents),
    description: body.description,
    callback_url: callbackUrl,
    redirect_url: redirectUrl,
  });

  const billResponse = await fetch(`${billplzBaseUrl}/bills`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${billplzApiKey}:`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: billBody,
  });

  const bill = await billResponse.json().catch(() => null);
  if (!billResponse.ok || !bill?.id || !bill?.url) {
    await admin.from("payments").update({ status: "failed" }).eq("id", payment.id);
    return json({ error: bill?.error?.message || bill?.message || "Billplz could not create the bill" }, 400);
  }

  const { error: updateError } = await admin
    .from("payments")
    .update({ billplz_bill_id: bill.id })
    .eq("id", payment.id);

  if (updateError) return json({ error: updateError.message }, 400);

  return json({ paymentUrl: bill.url });
});

function validatePaymentRequest(body: PaymentRequest) {
  if (!["order", "promotion"].includes(body.type)) return "Invalid payment type";
  if (!body.referenceId) return "Missing referenceId";
  if (!Number.isFinite(Number(body.amount)) || Number(body.amount) <= 0) return "Invalid amount";
  if (!body.description) return "Missing description";
  if (!body.buyerEmail || !body.buyerName) return "Missing buyer details";
  if (body.type === "promotion" && (!body.durationDays || !body.listingType)) return "Missing promotion details";
  return "";
}

function mustEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
