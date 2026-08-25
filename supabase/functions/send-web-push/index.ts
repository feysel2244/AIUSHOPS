import webpush from "npm:web-push@3.6.7";
const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-push-webhook-secret"};
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
 try{
  const expected=Deno.env.get("PUSH_WEBHOOK_SECRET"); const supplied=req.headers.get("x-push-webhook-secret");
  if(expected && supplied!==expected)return new Response("Unauthorized",{status:401,headers:corsHeaders});
  const payload=await req.json(); const record=payload?.record??payload?.new??payload;
  if(!record?.user_id||!record?.title)return new Response(JSON.stringify({ok:true,skipped:true}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
  const supabaseUrl=Deno.env.get("SUPABASE_URL")!; const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const vapidPublic=Deno.env.get("VAPID_PUBLIC_KEY"); const vapidPrivate=Deno.env.get("VAPID_PRIVATE_KEY");
  if(!vapidPublic || !vapidPrivate) return new Response(JSON.stringify({ok:true,skipped:"vapid_not_configured"}),{headers:{...corsHeaders,"Content-Type":"application/json"}}); const vapidSubject=Deno.env.get("VAPID_SUBJECT")||"mailto:admin@aiumarket.com";
  const headers={apikey:serviceKey,Authorization:`Bearer ${serviceKey}`};
  const prefRes=await fetch(`${supabaseUrl}/rest/v1/notification_preferences?user_id=eq.${record.user_id}&select=browser_notifications,order_updates,bookings,reviews,promotions,shop_updates`,{headers});
  const prefs=(await prefRes.json())?.[0];
  if(prefs?.browser_notifications===false)return new Response(JSON.stringify({ok:true,skipped:"browser_disabled"}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
  const enabled=record.type==="booking"?prefs?.bookings!==false:record.type==="review"?prefs?.reviews!==false:record.type==="promotion"?prefs?.promotions!==false:record.type==="shop"?prefs?.shop_updates!==false:record.type==="order"?prefs?.order_updates!==false:true;
  if(!enabled)return new Response(JSON.stringify({ok:true,skipped:"category_disabled"}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
  const subRes=await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?user_id=eq.${record.user_id}&select=id,endpoint,p256dh,auth`,{headers}); const subscriptions=await subRes.json();
  webpush.setVapidDetails(vapidSubject,vapidPublic,vapidPrivate); const stale:string[]=[];
  for(const sub of subscriptions??[]){try{await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},JSON.stringify({id:record.id,title:record.title,body:record.body,icon:"https://aiumarket.com/favicon.png",badge:"https://aiumarket.com/favicon.png",linkTo:record.link_to||"/notifications"}));}catch(error){const status=(error as {statusCode?:number})?.statusCode;if(status===404||status===410)stale.push(sub.id);console.error("Web push send failed",status,error);}}
  if(stale.length)await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?id=in.(${stale.join(",")})`,{method:"DELETE",headers});
  return new Response(JSON.stringify({ok:true,sent:(subscriptions??[]).length-stale.length}),{headers:{...corsHeaders,"Content-Type":"application/json"}});
 }catch(error){console.error(error);return new Response(JSON.stringify({error:error instanceof Error?error.message:"Push failed"}),{status:500,headers:{...corsHeaders,"Content-Type":"application/json"}});}
});
