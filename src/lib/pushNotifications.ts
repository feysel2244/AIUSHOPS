import { supabase } from "./supabase";

const SW_PATH = "/push-sw.js";

function base64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export async function registerPushServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register(SW_PATH, { scope: "/" });
}

export async function getPushPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported" as NotificationPermission | "unsupported";
  return Notification.permission;
}

export async function requestPushPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported" as NotificationPermission | "unsupported";
  return Notification.requestPermission();
}

export async function enableWebPush(userId: string) {
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!publicKey) throw new Error("Browser push is not configured yet. Add VITE_VAPID_PUBLIC_KEY to the Vercel environment variables.");
  const permission = await requestPushPermission();
  if (permission !== "granted") throw new Error(permission === "denied" ? "Browser notifications are blocked. Allow notifications for this site in your browser settings." : "Notification permission was not granted.");
  const registration = await registerPushServiceWorker();
  if (!registration) throw new Error("This browser does not support push notifications.");
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64ToUint8Array(publicKey),
  });
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("The browser returned an incomplete push subscription.");
  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    user_agent: navigator.userAgent,
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });
  if (error) throw new Error(error.message);
  return subscription;
}

export async function disableWebPush(userId: string) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint);
  }
}

export async function syncWebPushSubscription(userId: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!publicKey) return;
  try { await enableWebPush(userId); } catch (error) { console.warn("Could not sync browser push subscription:", error); }
}
