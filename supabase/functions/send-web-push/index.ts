import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-webhook-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Verify webhook secret if configured
    const expected = Deno.env.get("PUSH_WEBHOOK_SECRET");
    const supplied = req.headers.get("x-push-webhook-secret");
    if (expected && supplied !== expected) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    // Parse the payload — supports both webhook format and direct call
    const payload = await req.json();
    const record = payload?.record ?? payload?.new ?? payload;

    if (!record?.user_id || !record?.title) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublic || !vapidPrivate) {
      return new Response(
        JSON.stringify({ ok: true, skipped: "vapid_not_configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@aiumarket.com";
    const headers: Record<string, string> = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    };

    // Check user notification preferences
    const prefRes = await fetch(
      `${supabaseUrl}/rest/v1/notification_preferences?user_id=eq.${record.user_id}&select=browser_notifications,order_updates,bookings,reviews,promotions,shop_updates`,
      { headers }
    );
    const prefs = (await prefRes.json())?.[0];

    // Respect browser notification toggle
    if (prefs?.browser_notifications === false) {
      return new Response(
        JSON.stringify({ ok: true, skipped: "browser_disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Respect per-category preference
    const categoryEnabled =
      record.type === "booking" ? prefs?.bookings !== false :
      record.type === "review" ? prefs?.reviews !== false :
      record.type === "promotion" ? prefs?.promotions !== false :
      record.type === "shop" ? prefs?.shop_updates !== false :
      record.type === "order" ? prefs?.order_updates !== false :
      true;

    if (!categoryEnabled) {
      return new Response(
        JSON.stringify({ ok: true, skipped: "category_disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all push subscriptions for this user
    const subRes = await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?user_id=eq.${record.user_id}&select=id,endpoint,p256dh,auth`,
      { headers }
    );
    const subscriptions = await subRes.json();

    if (!subscriptions?.length) {
      return new Response(
        JSON.stringify({ ok: true, skipped: "no_subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Configure VAPID and send to each subscription
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const stale: string[] = [];
    let sent = 0;

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({
            id: record.id,
            title: record.title,
            body: record.body,
            icon: record.icon || "https://aiumarket.com/favicon.png",
            badge: "https://aiumarket.com/favicon.png",
            linkTo: record.link_to || "/notifications",
          })
        );
        sent++;
      } catch (error) {
        const status = (error as { statusCode?: number })?.statusCode;
        // 404 and 410 mean the subscription is no longer valid
        if (status === 404 || status === 410) {
          stale.push(sub.id);
        }
        console.error("Web push send failed", status, error);
      }
    }

    // Clean up stale subscriptions
    if (stale.length) {
      await fetch(
        `${supabaseUrl}/rest/v1/push_subscriptions?id=in.(${stale.join(",")})`,
        { method: "DELETE", headers }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, sent, total: subscriptions.length, stale: stale.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Push failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
