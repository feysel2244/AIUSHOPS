import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-[#0F1F4A] text-stone-300 mt-16 pb-20 md:pb-0">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#1C3270" }}>
                <span className="text-white font-bold text-sm" style={{ fontFamily: "Lora, serif" }}>A</span>
              </div>
              <span className="font-bold text-white text-lg" style={{ fontFamily: "Lora, serif" }}>AIU Market</span>
            </div>
            <p className="text-sm text-stone-400 max-w-xs leading-relaxed">
              The official campus marketplace for Albukhary International University students  buy, sell, and discover from your peers.
            </p>
            <div className="flex items-center gap-3 mt-4">
              {[
                ["Instagram", "https://www.instagram.com/AIUedu"],
                ["WhatsApp", "https://wa.me/601124141208"],
                ["Telegram", "#"],
              ].map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  target={href !== "#" ? "_blank" : undefined}
                  rel={href !== "#" ? "noopener noreferrer" : undefined}
                  className="text-xs text-stone-400 hover:text-[#44B444] transition-colors"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm mb-3" style={{ fontFamily: "Lora, serif" }}>Marketplace</h4>
            <ul className="space-y-2">
              {[["Browse", "/browse"], ["How It Works", "/how-it-works"], ["Resources", "/resources"], ["Become a Seller", "/become-seller"]].map(([l, h]) => (
                <li key={l}><Link to={h} className="text-sm text-stone-400 hover:text-[#44B444] transition-colors">{l}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm mb-3" style={{ fontFamily: "Lora, serif" }}>Support</h4>
            <ul className="space-y-2">
              {[["About", "/about"], ["Contact", "/contact"], ["Terms of Use", "/terms"], ["Privacy Policy", "/privacy"]].map(([l, h]) => (
                <li key={l}><Link to={h} className="text-sm text-stone-400 hover:text-[#44B444] transition-colors">{l}</Link></li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-stone-700 mt-8 pt-6 flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="text-xs text-stone-500">© 2026 AIU Market. All rights reserved. For students, by students.</p>
          <p className="text-xs text-stone-600">Albukhary International University, Alor Setar, Kedah, Malaysia</p>
        </div>
      </div>
    </footer>
  );
}
