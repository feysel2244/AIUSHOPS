import { useState, useRef, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { supabase } from "../lib/supabase";
import { uploadImage, validateImageFile } from "../lib/uploadImage";

export default function AccountPage() {
  const { user, setUser, openAuthModal } = useApp();

  const [form, setForm] = useState({
    name: user?.name ?? "",
    department: user?.department ?? "",
    year: user?.year ?? "",
    whatsapp: user?.whatsapp ?? "",
  });
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [notifs, setNotifs] = useState({ orderUpdates: true, reviews: true, promotions: false, newsletter: false });
  const [saved, setSaved] = useState("");
  const [saveError, setSaveError] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name,
        department: user.department,
        year: user.year,
        whatsapp: user.whatsapp,
      });
    }
  }, [user?.id]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">👤</div>
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "Lora, serif" }}>Not signed in</h2>
        <button onClick={() => openAuthModal("login")} className="px-6 py-2 bg-[#1C3270] text-white rounded-lg font-medium text-sm">Log in</button>
      </div>
    );
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) { setAvatarError(err); return; }
    setAvatarError("");
    setAvatarUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user!.id}/avatar-${Date.now()}.${ext}`;
      const url = await uploadImage("avatars", path, file);
      const { error: saveError } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user!.id);
      if (saveError) throw new Error(`Avatar uploaded, but could not be saved to your profile: ${saveError.message}`);
      setUser({ ...user!, avatar: url });
    } catch (uploadErr) {
      setAvatarError(uploadErr instanceof Error ? uploadErr.message : "Upload failed. Please try again.");
    } finally {
      setAvatarUploading(false);
      e.target.value = "";
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaveError("");
    const { error } = await supabase
      .from("profiles")
      .update({ name: form.name, department: form.department, year: form.year, whatsapp: form.whatsapp })
      .eq("id", user!.id);
    if (error) {
      setSaveError(error.message);
      return;
    }
    setUser({ ...user!, ...form });
    setSaved("profile");
    setTimeout(() => setSaved(""), 2500);
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) return;
    if (pwForm.next.length < 6) {
      setSaveError("Password must be at least 6 characters.");
      return;
    }
    setSaveError("");
    const { error } = await supabase.auth.updateUser({ password: pwForm.next });
    if (error) {
      setSaveError(error.message);
      return;
    }
    setSaved("password");
    setPwForm({ current: "", next: "", confirm: "" });
    setTimeout(() => setSaved(""), 2500);
  }

  const YEARS = ["Foundation", "Year 1", "Year 2", "Year 3", "Year 4", "Postgraduate"];
  const DEPTS = ["Business Administration", "Engineering", "ICT", "Sciences", "Arts & Design", "English Language", "Foundation"];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-stone-900 dark:text-[#E2EAF6] mb-6" style={{ fontFamily: "Lora, serif" }}>Account Settings</h1>

      {/* Profile card */}
      <div className="bg-white dark:bg-[#112038] rounded-2xl border border-stone-100 dark:border-[#1C3058] p-6 mb-6">
        <h2 className="font-bold text-stone-900 dark:text-[#E2EAF6] mb-4" style={{ fontFamily: "Lora, serif" }}>Profile</h2>

        {/* Avatar */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-full bg-[#1C3270] text-white flex items-center justify-center text-2xl font-bold shadow-md overflow-hidden">
              {user.avatar
                ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                : user.name.charAt(0).toUpperCase()
              }
              {avatarUploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute bottom-0 right-0 w-6 h-6 bg-white border border-stone-200 rounded-full flex items-center justify-center text-xs shadow-sm hover:bg-stone-50 disabled:opacity-50"
            >
              ✏️
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div>
            <div className="font-semibold text-stone-900 dark:text-[#E2EAF6]">{user.name}</div>
            <div className="text-sm text-stone-500 dark:text-[#6888A8]">{user.email}</div>
            <div className="text-xs text-stone-400 dark:text-[#4E6A88] mt-0.5">AIU Student</div>
            {avatarError && <p className="text-xs text-red-500 mt-1">{avatarError}</p>}
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-[#A8C0D8] mb-1">Full Name</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2.5 border border-stone-200 dark:border-[#1C3058] rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50 dark:bg-[#0E1A2E] dark:text-[#A8C0D8]" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-[#A8C0D8] mb-1">Department</label>
              <select value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} className="w-full px-3 py-2.5 border border-stone-200 dark:border-[#1C3058] rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50 dark:bg-[#0E1A2E] dark:text-[#A8C0D8]">
                {DEPTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-[#A8C0D8] mb-1">Year of Study</label>
              <select value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} className="w-full px-3 py-2.5 border border-stone-200 dark:border-[#1C3058] rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50 dark:bg-[#0E1A2E] dark:text-[#A8C0D8]">
                {YEARS.map((y) => <option key={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-[#A8C0D8] mb-1">WhatsApp Number</label>
            <input value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} placeholder="60123456789" className="w-full px-3 py-2.5 border border-stone-200 dark:border-[#1C3058] rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50 dark:bg-[#0E1A2E] dark:text-[#A8C0D8]" />
            <p className="text-xs text-stone-400 mt-1">Used to generate contact links for buyers and sellers.</p>
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" className="px-6 py-2.5 bg-[#1C3270] text-white rounded-lg text-sm font-semibold hover:bg-[#0F1F4A] transition-colors">
              Save Changes
            </button>
            {saved === "profile" && <span className="text-sm text-green-600 font-medium">✓ Profile saved</span>}
            {saveError && saved !== "profile" && <span className="text-sm text-red-500">{saveError}</span>}
          </div>
        </form>
      </div>

      {/* Change password */}
      <div className="bg-white dark:bg-[#112038] rounded-2xl border border-stone-100 dark:border-[#1C3058] p-6 mb-6">
        <h2 className="font-bold text-stone-900 dark:text-[#E2EAF6] mb-4" style={{ fontFamily: "Lora, serif" }}>Change Password</h2>
        <form onSubmit={handleSavePassword} className="space-y-4">
          {(["current", "next", "confirm"] as const).map((f) => (
            <div key={f}>
              <label className="block text-sm font-medium text-stone-700 dark:text-[#A8C0D8] mb-1">
                {f === "current" ? "Current password" : f === "next" ? "New password" : "Confirm new password"}
              </label>
              <input
                type="password"
                value={pwForm[f]}
                onChange={(e) => setPwForm((p) => ({ ...p, [f]: e.target.value }))}
                placeholder="••••••••"
                className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none bg-stone-50 dark:bg-[#0E1A2E] dark:text-[#A8C0D8] ${f === "confirm" && pwForm.confirm && pwForm.next !== pwForm.confirm ? "border-red-300 focus:border-red-400" : "border-stone-200 dark:border-[#1C3058] focus:border-[#1C3270]"}`}
              />
              {f === "confirm" && pwForm.confirm && pwForm.next !== pwForm.confirm && (
                <p className="text-xs text-red-500 mt-0.5">Passwords do not match</p>
              )}
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button type="submit" className="px-6 py-2.5 bg-stone-800 text-white rounded-lg text-sm font-semibold hover:bg-stone-900 transition-colors">
              Update Password
            </button>
            {saved === "password" && <span className="text-sm text-green-600 font-medium">✓ Password updated</span>}
          </div>
        </form>
      </div>

      {/* Notification preferences */}
      <div className="bg-white dark:bg-[#112038] rounded-2xl border border-stone-100 dark:border-[#1C3058] p-6 mb-6">
        <h2 className="font-bold text-stone-900 dark:text-[#E2EAF6] mb-4" style={{ fontFamily: "Lora, serif" }}>Notification Preferences</h2>
        <div className="space-y-4">
          {(Object.entries(notifs) as [keyof typeof notifs, boolean][]).map(([key, val]) => {
            const labels: Record<string, [string, string]> = {
              orderUpdates: ["Order Updates", "Confirmations, status changes, and delivery notifications"],
              reviews: ["Review Replies", "When a seller replies to your review"],
              promotions: ["Promotions & Deals", "Special offers from shops you follow"],
              newsletter: ["AIU Market Newsletter", "Monthly roundup of new shops and features"],
            };
            const [label, desc] = labels[key];
            return (
              <label key={key} className="flex items-start gap-3 cursor-pointer group">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={(e) => setNotifs((n) => ({ ...n, [key]: e.target.checked }))}
                    className="sr-only"
                  />
                  <div
                    className={`w-10 h-6 rounded-full transition-colors ${val ? "bg-[#1C3270]" : "bg-stone-200"}`}
                    onClick={() => setNotifs((n) => ({ ...n, [key]: !n[key] }))}
                  >
                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${val ? "translate-x-4" : ""}`} />
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-stone-900 dark:text-[#E2EAF6]">{label}</div>
                  <div className="text-xs text-stone-400 dark:text-[#6888A8]">{desc}</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Referral */}
      <div className="bg-blue-50 dark:bg-[#0E1A2E] border border-blue-200 dark:border-[#1C3058] rounded-2xl p-6 mb-6">
        <h2 className="font-bold text-stone-900 dark:text-[#E2EAF6] mb-2" style={{ fontFamily: "Lora, serif" }}>Invite Friends — Earn Rewards</h2>
        <p className="text-sm text-stone-600 dark:text-[#A8C0D8] mb-3">Share your referral link with fellow AIU students.</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 px-3 py-2 bg-white dark:bg-[#112038] border border-blue-200 dark:border-[#1C3058] rounded-lg text-sm font-mono text-stone-700 dark:text-[#A8C0D8] select-all">
            aiumarket.my/ref/{user.id.slice(0, 6)}
          </div>
          <button
            onClick={() => navigator.clipboard?.writeText(`aiumarket.my/ref/${user.id.slice(0, 6)}`)}
            className="px-4 py-2 bg-[#44B444] text-white rounded-lg text-sm font-medium hover:bg-[#2E8A2E] transition-colors flex-shrink-0"
          >
            Copy
          </button>
        </div>
        <p className="text-xs text-stone-400 mt-2">Friends who sign up using your link count towards your referral score.</p>
      </div>
    </div>
  );
}
