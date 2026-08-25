import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp, type Notification } from "../context/AppContext";
import { isNotificationSoundEnabled, setNotificationSoundEnabled, unlockNotificationSound } from "../lib/notificationSound";

const TYPE_LABELS: Record<Notification["type"], string> = {
  order: "Order",
  review: "Review",
  booking: "Booking",
  shop: "Shop",
  promotion: "Promotion",
  system: "System",
};

const TYPE_COLORS: Record<Notification["type"], string> = {
  order: "bg-blue-50 border-blue-200 text-blue-700",
  review: "bg-blue-50 border-blue-200 text-blue-700",
  booking: "bg-purple-50 border-purple-200 text-purple-700",
  shop: "bg-green-50 border-green-200 text-green-700",
  promotion: "bg-amber-50 border-amber-200 text-amber-700",
  system: "bg-stone-100 border-stone-200 text-stone-600",
};

export default function NotificationsPage() {
  const { user, openAuthModal, notifications, unreadCount, markAllRead, markRead } = useApp();
  const [soundEnabled, setSoundEnabled] = useState(() => isNotificationSoundEnabled());

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">🔔</div>
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "Lora, serif" }}>Sign in to see notifications</h2>
        <button
          onClick={() => openAuthModal("login")}
          className="px-6 py-2 bg-[#1C3270] text-white rounded-lg font-medium text-sm hover:bg-[#0F1F4A] transition-colors"
        >
          Log in
        </button>
      </div>
    );
  }

  const grouped = {
    unread: notifications.filter((n) => n.unread),
    today: notifications.filter((n) => !n.unread && n.time.includes("h ago")),
    older: notifications.filter((n) => !n.unread && !n.time.includes("h ago")),
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900" style={{ fontFamily: "Lora, serif" }}>
            Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="text-stone-500 text-sm mt-0.5">
              {unreadCount} unread
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-sm text-[#1C3270] hover:text-[#0F1F4A] font-medium transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-100 p-16 text-center">
          <div className="text-5xl mb-4">🔕</div>
          <h3 className="font-bold text-stone-900 mb-1 text-lg" style={{ fontFamily: "Lora, serif" }}>
            All caught up
          </h3>
          <p className="text-stone-500 text-sm">
            Order updates, review replies, and booking confirmations will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Unread */}
          {grouped.unread.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wider">New</h2>
                <div className="flex-1 h-px bg-stone-100" />
              </div>
              <div className="space-y-2">
                {grouped.unread.map((n) => (
                  <NotifCard key={n.id} n={n} onRead={markRead} />
                ))}
              </div>
            </section>
          )}

          {/* Today / recent */}
          {grouped.today.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wider">Earlier today</h2>
                <div className="flex-1 h-px bg-stone-100" />
              </div>
              <div className="space-y-2">
                {grouped.today.map((n) => (
                  <NotifCard key={n.id} n={n} onRead={markRead} />
                ))}
              </div>
            </section>
          )}

          {/* Older */}
          {grouped.older.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wider">Older</h2>
                <div className="flex-1 h-px bg-stone-100" />
              </div>
              <div className="space-y-2">
                {grouped.older.map((n) => (
                  <NotifCard key={n.id} n={n} onRead={markRead} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <div className="mt-8 bg-white rounded-xl border border-stone-100 p-4 flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-sm text-stone-900">Notification sound</p>
          <p className="text-xs text-stone-500 mt-0.5">Play a chime when a new notification arrives.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button type="button" onClick={async () => { if (soundEnabled) { await unlockNotificationSound(); } }} className="px-3 py-2 rounded-lg text-xs font-semibold border border-stone-200 text-stone-600 hover:bg-stone-50">Test sound</button>
          <button
            type="button"
            onClick={async () => {
              const next = !soundEnabled;
              setNotificationSoundEnabled(next);
              setSoundEnabled(next);
              if (next) { await unlockNotificationSound(); }
            }}
            className={`px-3 py-2 rounded-lg text-xs font-semibold ${soundEnabled ? "bg-[#1C3270] text-white" : "bg-stone-100 text-stone-600"}`}
          >
            {soundEnabled ? "Sound on" : "Sound off"}
          </button>
        </div>
      </div>

      {/* Notification preferences link */}
      <div className="mt-8 text-center">
        <Link
          to="/account"
          className="text-sm text-stone-400 hover:text-[#1C3270] transition-colors"
        >
          Manage notification preferences →
        </Link>
      </div>
    </div>
  );
}

function NotifCard({ n, onRead }: { n: Notification; onRead: (id: string) => void }) {
  const TYPE_COLORS: Record<Notification["type"], string> = {
    order: "bg-blue-50 text-blue-700 border-blue-200",
    review: "bg-blue-50 text-blue-700 border-blue-200",
    booking: "bg-purple-50 text-purple-700 border-purple-200",
    shop: "bg-green-50 text-green-700 border-green-200",
    promotion: "bg-amber-50 text-amber-700 border-amber-200",
    system: "bg-stone-100 text-stone-500 border-stone-200",
  };

  const TYPE_LABELS: Record<Notification["type"], string> = {
    order: "Order", review: "Review", booking: "Booking", shop: "Shop", promotion: "Promotion", system: "System",
  };

  const inner = (
    <div
      className={`flex items-start gap-4 p-4 rounded-xl border transition-colors cursor-pointer ${
        n.unread
          ? "bg-blue-50/60 border-blue-100 hover:bg-blue-50"
          : "bg-white border-stone-100 hover:bg-stone-50"
      }`}
      onClick={() => onRead(n.id)}
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 border ${TYPE_COLORS[n.type]}`}
      >
        {n.icon}
      </div>
      <div className="flex-1 min-w-0 max-w-full overflow-hidden">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-stone-900">{n.title}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full border ${TYPE_COLORS[n.type]}`}>
              {TYPE_LABELS[n.type]}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-stone-400 whitespace-nowrap">{n.time}</span>
            {n.unread && (
              <div className="w-2 h-2 rounded-full bg-[#44B444] flex-shrink-0" />
            )}
          </div>
        </div>
        <p className="text-sm text-stone-600 mt-0.5 leading-relaxed break-words overflow-wrap-anywhere">{n.body}</p>
        {n.linkTo && (
          <span className="text-xs text-[#1C3270] font-medium mt-1 inline-block hover:text-[#0F1F4A]">
            View details →
          </span>
        )}
      </div>
    </div>
  );

  if (n.linkTo) {
    return <Link to={n.linkTo} onClick={() => onRead(n.id)}>{inner}</Link>;
  }
  return inner;
}
