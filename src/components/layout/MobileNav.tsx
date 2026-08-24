import { Link, useLocation } from "react-router-dom";
import { useApp } from "../../context/AppContext";

export default function MobileNav() {
  const { cartCount, user, unreadCount } = useApp();
  const location = useLocation();
  const p = location.pathname;

  const links: {
    to: string;
    icon: React.ReactNode;
    label: string;
    badge?: number;
    exact?: boolean;
  }[] = [
    {
      to: "/",
      exact: true,
      label: "Home",
      icon: (
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      ),
    },
    {
      to: "/browse",
      label: "Search",
      icon: (
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z" />
        </svg>
      ),
    },
    {
      to: "/cart",
      label: "Cart",
      badge: cartCount,
      icon: (
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
        </svg>
      ),
    },
    {
      to: "/orders",
      label: "Orders",
      icon: (
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      ),
    },
    {
      to: user ? "/account" : "#",
      label: "Profile",
      badge: user ? unreadCount : 0,
      icon: (
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#0D1E36] border-t border-stone-200 dark:border-[#1C3058] md:hidden z-40">
      <div className="flex items-center justify-around h-16 px-1">
        {links.map((l) => {
          const active = l.exact ? p === l.to : (p.startsWith(l.to) && l.to !== "/");
          return (
            <Link
              key={l.to}
              to={l.to}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-2 flex-1 transition-colors rounded-xl mx-0.5 ${
                active ? "text-[#1C3270] dark:text-[#5B8FD4]" : "text-stone-400 dark:text-[#4E6A88] hover:text-stone-600"
              }`}
            >
              {/* Active indicator */}
              {active && (
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                  style={{ background: "#1C3270" }}
                />
              )}

              <span className={`transition-transform ${active ? "scale-110" : ""}`}>
                {l.icon}
              </span>
              <span className="text-[10px] font-medium leading-none">{l.label}</span>

              {/* Badge */}
              {(l.badge ?? 0) > 0 && (
                <span className="absolute top-1.5 right-2 min-w-[16px] h-4 bg-[#1C3270] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                  {(l.badge ?? 0) > 9 ? "9+" : l.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
