import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { formatRelativeTime } from "../lib/marketData";
import { ensureBuyerProfile } from "../lib/profiles";
import { playNotificationSound, showBrowserNotification, unlockNotificationSound } from "../lib/notificationSound";

export type User = {
  id: string;
  name: string;
  email: string;
  department: string;
  year: string;
  whatsapp: string;
  avatar?: string;
  hasShop: boolean;
  shopSlug?: string;
  isAdmin?: boolean;
};

export type CartItem = {
  id: string;
  productId: string;
  shopId: string;
  shopName: string;
  shopSlug: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  note?: string;
  pickupLocation: string;
};

export type Notification = {
  id: string;
  icon: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  type: "order" | "review" | "booking" | "shop" | "system" | "promotion";
  linkTo?: string;
};

export type RecentItem = {
  id: string;
  slug: string;
  type: "product" | "service" | "shop";
  name: string;
  image: string;
  price?: number;
  shopName?: string;
  viewedAt: number;
};

// SEED_NOTIFICATIONS removed — guests should see an empty notification list.
// Real notifications load from Supabase after login via loadUserData().

// Only AIU university email addresses are allowed to sign up / log in.

export const UNIVERSITY_EMAIL_DOMAIN = "gmail.com";

export function isUniversityEmail(email: string) {
  return /^[a-zA-Z0-9]+@gmail.com$/i.test(email.trim());
}


type AppContextType = {
  user: User | null;
  setUser: (u: User | null) => void;
  authLoading: boolean;
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, "id">) => void;
  removeFromCart: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
  cartCount: number;
  wishlist: string[];
  toggleWishlist: (itemId: string, itemType?: "product" | "service") => void;
  favouriteShops: string[];
  toggleFavouriteShop: (shopId: string) => void;
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;
  announcementDismissed: boolean;
  announcementText: string;
  dismissAnnouncement: () => void;
  authModal: "login" | "signup" | "forgot" | "reset" | null;
  openAuthModal: (mode: "login" | "signup" | "forgot") => void;
  closeAuthModal: () => void;
  passwordRecovery: boolean;
  cancelPasswordRecovery: () => void;
  completePasswordRecovery: () => Promise<void>;
  recentlyViewed: RecentItem[];
  trackView: (item: RecentItem) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
};

const noop = () => {};
const defaultCtx: AppContextType = {
  user: null, setUser: noop, authLoading: true,
  cart: [], addToCart: noop, removeFromCart: noop, updateQty: noop, clearCart: noop, cartCount: 0,
  wishlist: [], toggleWishlist: noop,
  favouriteShops: [], toggleFavouriteShop: noop,
  notifications: [], unreadCount: 0, markAllRead: noop, markRead: noop,
  announcementDismissed: false, announcementText: "", dismissAnnouncement: noop,
  authModal: null, openAuthModal: noop, closeAuthModal: noop,
  passwordRecovery: false, cancelPasswordRecovery: noop, completePasswordRecovery: async () => {},
  recentlyViewed: [], trackView: noop,
  darkMode: false, toggleDarkMode: noop,
};

const AppContext = createContext<AppContextType>(defaultCtx);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [favouriteShops, setFavouriteShops] = useState<string[]>([]);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const [announcementText, setAnnouncementText] = useState("");
  const [authModal, setAuthModal] = useState<"login" | "signup" | "forgot" | "reset" | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentItem[]>([]);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try { return localStorage.getItem("darkMode") === "true"; } catch { return false; }
  });
  const [authLoading, setAuthLoading] = useState(true);
  const passwordRecoveryRef = useRef(false);
  // A reset-password link includes type=recovery in the URL — flag it
  // synchronously so the very first getSession() below doesn't race ahead
  // and log the person in before onAuthStateChange fires PASSWORD_RECOVERY.
  if (!passwordRecoveryRef.current && typeof window !== "undefined") {
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    if (hash.includes("type=recovery") || search.includes("type=recovery") || window.location.pathname === "/reset-password") {
      passwordRecoveryRef.current = true;
    }
  }

  const loadUserData = useCallback(async (userId: string, authUser?: { email?: string; user_metadata?: Record<string, unknown> }) => {
    let { data: profile } = await supabase
      .from("profiles")
      .select("id,name,email,department,year,whatsapp,avatar_url,has_shop,is_admin,is_suspended,shops(slug,status)")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      const metadata = authUser?.user_metadata ?? {};
      const repaired = await ensureBuyerProfile({
        id: userId,
        name: String(metadata.name || authUser?.email || "AIU Student"),
        email: String(metadata.email || authUser?.email || ""),
        department: String(metadata.department || ""),
        year: String(metadata.year || ""),
        whatsapp: String(metadata.whatsapp || ""),
      });

      if (repaired.ok) {
        const { data: repairedProfile } = await supabase
          .from("profiles")
          .select("id,name,email,department,year,whatsapp,avatar_url,has_shop,is_admin,is_suspended,shops(slug,status)")
          .eq("id", userId)
          .maybeSingle();
        profile = repairedProfile;
      }
    }

    if (profile) {
      // Block suspended accounts immediately on login
      if (profile.is_suspended) {
        await supabase.auth.signOut();
        alert("Your account has been suspended. Please contact support.");
        return;
      }

      const approvedShop = Array.isArray(profile.shops)
        ? profile.shops.find((shop: { slug?: string; status?: string }) => shop.status === "approved")
        : null;

      setUser({
        id: profile.id,
        name: profile.name || profile.email || "AIU Student",
        email: profile.email || "",
        department: profile.department || "",
        year: profile.year || "",
        whatsapp: profile.whatsapp || "",
        avatar: profile.avatar_url || undefined,
        hasShop: Boolean(profile.has_shop),
        shopSlug: approvedShop?.slug,
        isAdmin: Boolean(profile.is_admin),
      });
    } else {
      const metadata = authUser?.user_metadata ?? {};
      setUser({
        id: userId,
        name: String(metadata.name || authUser?.email || "AIU Student"),
        email: String(metadata.email || authUser?.email || ""),
        department: String(metadata.department || ""),
        year: String(metadata.year || ""),
        whatsapp: String(metadata.whatsapp || ""),
        hasShop: Boolean(metadata.has_shop),
        isAdmin: Boolean(metadata.is_admin),
      });
    }

    const [{ data: wishRows }, { data: followRows }, { data: notificationRows }] = await Promise.all([
      supabase.from("wishlist_items").select("product_id,service_id").eq("user_id", userId),
      supabase.from("followed_shops").select("shop_id").eq("user_id", userId),
      supabase
        .from("notifications")
        .select("id,icon,title,body,type,link_to,is_unread,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);

    setWishlist((wishRows ?? []).map((row) => row.product_id || row.service_id).filter(Boolean) as string[]);
    setFavouriteShops((followRows ?? []).map((row) => row.shop_id).filter(Boolean) as string[]);
    setNotifications((notificationRows ?? []).map((row) => ({
      id: row.id,
      icon: row.icon || "🔔",
      title: row.title,
      body: row.body,
      time: formatRelativeTime(row.created_at),
      unread: Boolean(row.is_unread),
      type: row.type,
      linkTo: row.link_to || undefined,
    })));
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      if (data.session?.user && !passwordRecoveryRef.current) {
        await loadUserData(data.session.user.id, data.session.user);
      } else if (data.session?.user && passwordRecoveryRef.current) {
        setPasswordRecovery(true);
        setAuthModal("reset");
      }
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      // A "forgot password" link lands here as a PASSWORD_RECOVERY event.
      // Supabase already creates a session at this point, but the person has
      // NOT chosen a new password yet — treat them as still logged out and
      // force the "set new password" screen instead of silently logging in.
      if (event === "PASSWORD_RECOVERY") {
        passwordRecoveryRef.current = true;
        setPasswordRecovery(true);
        setAuthModal("reset");
        setAuthLoading(false);
        return;
      }

      if (session?.user && !passwordRecoveryRef.current) {
        await loadUserData(session.user.id, session.user);
      } else if (!session?.user) {
        setUser(null);
        setWishlist([]);
        setFavouriteShops([]);
        setNotifications([]);
        setCart([]);
      }
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadUserData]);

  // Keep notifications live while the user is logged in. The initial list is
  // loaded by loadUserData(); this subscription handles new notifications
  // created while the app is already open.
  // Unlock browser audio after the user interacts with the site. Browsers
  // block autoplay audio until there has been a user gesture.
  useEffect(() => {
    const unlock = () => { void unlockNotificationSound(); };
    window.addEventListener("pointerdown", unlock, { once: true, capture: true });
    window.addEventListener("touchstart", unlock, { once: true, capture: true });
    window.addEventListener("keydown", unlock, { once: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("touchstart", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            icon?: string | null;
            title: string;
            body: string;
            type: Notification["type"];
            link_to?: string | null;
            is_unread?: boolean | null;
            created_at: string;
          };

          const incoming: Notification = {
            id: row.id,
            icon: row.icon || "🔔",
            title: row.title,
            body: row.body,
            time: formatRelativeTime(row.created_at),
            unread: row.is_unread !== false,
            type: row.type,
            linkTo: row.link_to || undefined,
          };

          setNotifications((prev) => {
            if (prev.some((n) => n.id === incoming.id)) return prev;
            playNotificationSound();
            showBrowserNotification(incoming.title, incoming.body);
            return [incoming, ...prev];
          });
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error("Notification realtime channel failed to connect.");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    let timeoutId = window.setTimeout(() => supabase.auth.signOut(), 30 * 60 * 1000);
    function resetTimer() {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => supabase.auth.signOut(), 30 * 60 * 1000);
    }
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, resetTimer));
    return () => {
      window.clearTimeout(timeoutId);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [user]);

  useEffect(() => {
    if (!user || localStorage.getItem("aiu_session_only") !== "true") return;
    const signOutOnClose = () => {
      void supabase.auth.signOut();
    };
    window.addEventListener("beforeunload", signOutOnClose);
    return () => window.removeEventListener("beforeunload", signOutOnClose);
  }, [user]);

  function toggleDarkMode() {
    setDarkMode((prev) => {
      const next = !prev;
      try { localStorage.setItem("darkMode", String(next)); } catch {}
      return next;
    });
  }

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const unreadCount = notifications.filter((n) => n.unread).length;

  function addToCart(item: Omit<CartItem, "id">) {
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === item.productId);
      if (existing) {
        return prev.map((c) =>
          c.productId === item.productId ? { ...c, quantity: c.quantity + item.quantity } : c
        );
      }
      return [...prev, { ...item, id: Math.random().toString(36).slice(2) }];
    });
  }

  function removeFromCart(id: string) {
    setCart((prev) => prev.filter((c) => c.id !== id));
  }

  function updateQty(id: string, qty: number) {
    if (qty <= 0) { removeFromCart(id); return; }
    setCart((prev) => prev.map((c) => (c.id === id ? { ...c, quantity: qty } : c)));
  }

  function clearCart() { setCart([]); }

  async function toggleWishlist(productId: string, itemType: "product" | "service" = "product") {
    if (!user) return;
    const isService = itemType === "service";
    const removing = wishlist.includes(productId);
    setWishlist((prev) =>
      removing ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
    if (removing) {
      const query = supabase.from("wishlist_items").delete().eq("user_id", user.id);
      await (isService ? query.eq("service_id", productId) : query.eq("product_id", productId));
    } else {
      await supabase.from("wishlist_items").insert({
        user_id: user.id,
        product_id: isService ? null : productId,
        service_id: isService ? productId : null,
      });
    }
  }

  async function toggleFavouriteShop(shopId: string) {
    if (!user) return;
    const removing = favouriteShops.includes(shopId);
    setFavouriteShops((prev) =>
      removing ? prev.filter((id) => id !== shopId) : [...prev, shopId]
    );
    if (removing) {
      await supabase.from("followed_shops").delete().eq("user_id", user.id).eq("shop_id", shopId);
    } else {
      await supabase.from("followed_shops").insert({ user_id: user.id, shop_id: shopId });
    }
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    if (user) await supabase.from("notifications").update({ is_unread: false }).eq("user_id", user.id);
  }

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, unread: false } : n));
    if (user) await supabase.from("notifications").update({ is_unread: false }).eq("id", id).eq("user_id", user.id);
  }

  const trackView = useCallback((item: RecentItem) => {
    setRecentlyViewed((prev) => {
      const filtered = prev.filter((r) => !(r.id === item.id && r.type === item.type));
      return [{ ...item, viewedAt: Date.now() }, ...filtered].slice(0, 12);
    });
  }, []);

  function openAuthModal(mode: "login" | "signup" | "forgot") { setAuthModal(mode); }
  function closeAuthModal() {
    // While a password reset is pending, the modal can't be dismissed by
    // clicking away — it must be completed or explicitly cancelled below.
    if (passwordRecoveryRef.current) return;
    setAuthModal(null);
  }

  // Called if someone backs out of the "set new password" screen without
  // finishing it — drop the temporary recovery session instead of leaving
  // them signed in with the old password still active.
  async function cancelPasswordRecovery() {
    passwordRecoveryRef.current = false;
    setPasswordRecovery(false);
    await supabase.auth.signOut();
    setAuthModal(null);
  }

  // Called after the person successfully sets a new password.
  // End the temporary recovery session and require a normal login with the
  // newly chosen password, so the reset flow cannot silently leave the user
  // signed in after the reset link is consumed.
  async function completePasswordRecovery() {
    passwordRecoveryRef.current = false;
    setPasswordRecovery(false);
    await supabase.auth.signOut();
    setAuthModal("login");
  }

  useEffect(() => {
    let active = true;
    async function loadAnnouncement() {
      const { data } = await supabase.from("platform_settings").select("announcement_text").eq("id", true).maybeSingle();
      if (active) setAnnouncementText(data?.announcement_text?.trim() || "");
    }
    void loadAnnouncement();
    return () => { active = false; };
  }, []);

  return (
    <AppContext.Provider
      value={{
        user, setUser: (next) => {
          if (next === null) void supabase.auth.signOut();
          setUser(next);
        },
        authLoading,
        cart, addToCart, removeFromCart, updateQty, clearCart, cartCount,
        wishlist, toggleWishlist,
        favouriteShops, toggleFavouriteShop,
        notifications, unreadCount, markAllRead, markRead,
        announcementDismissed, announcementText, dismissAnnouncement: () => setAnnouncementDismissed(true),
        authModal, openAuthModal, closeAuthModal,
        passwordRecovery, cancelPasswordRecovery, completePasswordRecovery,
        recentlyViewed, trackView,
        darkMode, toggleDarkMode,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
