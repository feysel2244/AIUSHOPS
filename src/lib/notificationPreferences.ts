import { supabase } from "./supabase";

export type NotificationPreferences = {
  orderUpdates: boolean;
  bookings: boolean;
  reviews: boolean;
  promotions: boolean;
  shopUpdates: boolean;
  browserNotifications: boolean;
  sound: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  orderUpdates: true,
  bookings: true,
  reviews: true,
  promotions: false,
  shopUpdates: true,
  browserNotifications: true,
  sound: true,
};

export function preferenceAllows(p: NotificationPreferences, type: string) {
  if (type === "booking") return p.bookings;
  if (type === "review") return p.reviews;
  if (type === "promotion") return p.promotions;
  if (type === "shop") return p.shopUpdates;
  if (type === "order") return p.orderUpdates;
  return true;
}

export async function loadNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("order_updates,bookings,reviews,promotions,shop_updates,browser_notifications,sound")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    orderUpdates: data?.order_updates ?? DEFAULT_NOTIFICATION_PREFERENCES.orderUpdates,
    bookings: data?.bookings ?? DEFAULT_NOTIFICATION_PREFERENCES.bookings,
    reviews: data?.reviews ?? DEFAULT_NOTIFICATION_PREFERENCES.reviews,
    promotions: data?.promotions ?? DEFAULT_NOTIFICATION_PREFERENCES.promotions,
    shopUpdates: data?.shop_updates ?? DEFAULT_NOTIFICATION_PREFERENCES.shopUpdates,
    browserNotifications: data?.browser_notifications ?? DEFAULT_NOTIFICATION_PREFERENCES.browserNotifications,
    sound: data?.sound ?? DEFAULT_NOTIFICATION_PREFERENCES.sound,
  };
}

export async function saveNotificationPreferences(userId: string, preferences: NotificationPreferences) {
  const { error } = await supabase.from("notification_preferences").upsert({
    user_id: userId,
    order_updates: preferences.orderUpdates,
    bookings: preferences.bookings,
    reviews: preferences.reviews,
    promotions: preferences.promotions,
    shop_updates: preferences.shopUpdates,
    browser_notifications: preferences.browserNotifications,
    sound: preferences.sound,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}
