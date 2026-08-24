import { useApp } from "../../context/AppContext";

export default function AnnouncementBanner() {
  const { announcementDismissed, announcementText, dismissAnnouncement } = useApp();
  if (announcementDismissed || !announcementText.trim()) return null;

  return (
    <div className="bg-[#1C3270] dark:bg-[#0A1525] border-b border-[#2A4A9A] dark:border-[#1C3058] text-white text-sm py-2 px-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 mx-auto">
        <span>📢</span>
        <span>{announcementText}</span>
      </div>
      <button
        onClick={dismissAnnouncement}
        aria-label="Dismiss announcement"
        className="text-white/80 hover:text-white transition-colors flex-shrink-0 text-lg leading-none"
      >
        ✕
      </button>
    </div>
  );
}
