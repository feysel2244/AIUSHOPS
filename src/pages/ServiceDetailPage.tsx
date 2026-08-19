import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { toService, toShop, type ServiceRow, type ShopRow } from "../lib/marketData";
import { ensureBuyerProfile } from "../lib/profiles";
import StarRating from "../components/ui/StarRating";
import Badge from "../components/ui/Badge";
import { useApp } from "../context/AppContext";

type Review = {
  id: string;
  author: string;
  avatar: string;
  rating: number;
  date: string;
  text: string;
};

const avatarFallback = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&auto=format";

function orderCode() {
  return `AIU-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function toReview(row: any): Review {
  return {
    id: row.id,
    author: row.profiles?.name || "AIU Student",
    avatar: row.profiles?.avatar_url || avatarFallback,
    rating: Number(row.rating || 0),
    date: row.created_at ? new Date(row.created_at).toLocaleDateString("en-MY") : "",
    text: row.text || "",
  };
}

export default function ServiceDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, openAuthModal, trackView } = useApp();
  const [service, setService] = useState<any>(null);
  const [shop, setShop] = useState<any>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [meetOnline, setMeetOnline] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;

    async function loadService() {
      setLoading(true);
      const { data } = await supabase
        .from("services")
        .select("*,shops!inner(*,profiles(name,department,year,whatsapp))").is("shops.deleted_at", null)
        .eq("slug", slug)
        .maybeSingle();

      if (!active) return;
      if (!data) {
        setService(null);
        setLoading(false);
        return;
      }

      const nextService = toService(data as ServiceRow);
      setService(nextService);
      setShop(data.shops ? toShop(data.shops as ShopRow) : null);
      setMeetOnline(nextService.pickupLocation === "Online");

      const { data: serviceReviews } = await supabase
        .from("reviews")
        .select("id,rating,text,created_at,profiles(name,avatar_url)")
        .eq("service_id", data.id)
        .order("created_at", { ascending: false });

      let scopedReviews = serviceReviews ?? [];
      if (scopedReviews.length === 0) {
        const { data: fallbackReviews } = await supabase
          .from("reviews")
          .select("id,rating,text,created_at,profiles(name,avatar_url)")
          .eq("shop_id", data.shop_id)
          .is("product_id", null)
          .is("service_id", null)
          .order("created_at", { ascending: false });
        scopedReviews = fallbackReviews ?? [];
      }

      if (!active) return;
      setReviews(scopedReviews.map(toReview));
      setLoading(false);
    }

    void loadService();
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (service) {
      trackView({
        id: service.id,
        slug: service.slug,
        type: "service",
        name: service.name,
        image: service.image,
        price: service.price,
        shopName: service.shopName,
        viewedAt: Date.now(),
      });
      // Fire-and-forget view tracking
      void supabase.from("listing_views").insert({
        listing_type: "service",
        listing_id: service.id,
        shop_id: service.shopId,
        viewer_id: user?.id ?? null,
      });
    }
  }, [service?.id, trackView]);

  if (loading) {
    return <div className="max-w-7xl mx-auto px-4 py-20 text-center text-stone-500">Loading service...</div>;
  }

  if (!service) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">Calendar</div>
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "Lora, serif" }}>Service not found</h2>
        <p className="text-stone-500 mb-4">This listing may have been removed.</p>
        <Link to="/browse" className="px-6 py-2 bg-[#1C3270] text-white rounded-lg text-sm font-medium">Browse Services</Link>
      </div>
    );
  }

  const sv = service;

  function availLabel() {
    if (sv.availability === "available") return { text: "Available now", cls: "text-green-600" };
    if (sv.availability === "slots_open") return { text: "Slots open this week", cls: "text-blue-600" };
    if (sv.availability === "fully_booked") return { text: "Fully booked", cls: "text-red-500" };
    return { text: sv.availability, cls: "text-stone-500" };
  }

  const { text: availText, cls: availCls } = availLabel();
  const canBook = sv.availability !== "fully_booked";

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { openAuthModal("login"); return; }
    const errs: Record<string, string> = {};
    if (!date) errs.date = "Please select a preferred date";
    if (!time) errs.time = "Please select a preferred time";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const profileReady = await ensureBuyerProfile(user);
    if (!profileReady.ok) {
      setErrors({ submit: `Could not prepare your buyer profile: ${profileReady.message}` });
      return;
    }

    const subtotal = sv.price;
    const platformFee = Number((subtotal * 0.02).toFixed(2));
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        order_code: orderCode(),
        buyer_id: user.id,
        shop_id: sv.shopId,
        type: "service",
        status: "pending",
        subtotal,
        platform_fee: platformFee,
        total: subtotal + platformFee,
        payment_method: "Pay after confirmation",
        payment_status: "unpaid",
        note: `${notes}${meetOnline ? "\nMeet online" : ""}`.trim(),
        booking_date: date,
        booking_time: time,
      })
      .select("id")
      .single();

    if (error || !order) {
      setErrors({ submit: error?.message || "Could not create booking request" });
      return;
    }

    const { error: itemError } = await supabase.from("order_items").insert({
      order_id: order.id,
      service_id: sv.id,
      name: sv.name,
      price: sv.price,
      quantity: 1,
    });

    if (itemError) {
      setErrors({ submit: itemError.message });
      return;
    }

    setSubmitted(true);
  }

  function handleMessage() {
    if (!user) { openAuthModal("login"); return; }
    if (shop?.seller?.whatsapp) window.open(`https://wa.me/${shop.seller.whatsapp}`, "_blank");
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 pb-28 md:pb-8">
      <nav className="text-xs text-stone-400 mb-6 flex items-center gap-1.5">
        <Link to="/" className="hover:text-[#1C3270]">Home</Link> /
        <Link to="/browse" className="hover:text-[#1C3270]">Browse</Link> /
        <Link to={`/shop/${sv.shopSlug}`} className="hover:text-[#1C3270]">{sv.shopName}</Link> /
        <span className="text-stone-600">{sv.name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <div>
          <div className="aspect-[4/3] bg-stone-100 rounded-2xl overflow-hidden relative">
            <img src={sv.image} alt={sv.name} className="w-full h-full object-cover" />
            <div className="absolute top-3 left-3"><Badge variant="service" label="Service" /></div>
            {sv.promoted && <div className="absolute top-3 right-3"><Badge variant="promoted" /></div>}
          </div>
        </div>

        <div>
          <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">{sv.category}</span>
          <h1 className="text-2xl font-bold text-stone-900 mt-2 mb-1 leading-tight" style={{ fontFamily: "Lora, serif" }}>{sv.name}</h1>
          <div className="flex items-center gap-3 mb-3">
            <StarRating rating={sv.rating} reviewCount={sv.reviewCount} />
            <span className={`text-sm font-medium ${availCls}`}>{availText}</span>
          </div>

          <Link to={`/shop/${sv.shopSlug}`} className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100 hover:border-stone-200 transition-colors mb-4">
            <img src={sv.shopLogo} alt={sv.shopName} className="w-9 h-9 rounded-lg object-cover bg-stone-200" />
            <div>
              <div className="font-semibold text-sm text-stone-900">{sv.shopName}</div>
              <div className="text-xs text-stone-500 flex items-center gap-1">{sv.pickupLocation}</div>
            </div>
            <span className="ml-auto text-xs text-[#1C3270]">View shop</span>
          </Link>

          <div className="mb-4">
            <div className="text-sm text-stone-400">{sv.priceType}</div>
            <span className="text-3xl font-bold text-[#1C3270]">RM {sv.price.toFixed(2)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
            <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
              <div className="text-xs text-stone-400 mb-0.5">Turnaround</div>
              <div className="font-medium text-stone-700">{sv.turnaround}</div>
            </div>
            <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
              <div className="text-xs text-stone-400 mb-0.5">Location</div>
              <div className="font-medium text-stone-700">{sv.pickupLocation}</div>
            </div>
          </div>

          {submitted ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
              <div className="text-3xl mb-2">Done</div>
              <h3 className="font-bold text-green-800 mb-1" style={{ fontFamily: "Lora, serif" }}>Booking Request Sent!</h3>
              <p className="text-sm text-green-700">The seller will review your request and confirm within 24 hours. Payment is only required after confirmation.</p>
              <Link to="/orders" className="inline-block mt-3 text-sm text-[#1C3270] font-medium hover:underline">View my orders</Link>
            </div>
          ) : (
            <form onSubmit={handleBook} className="space-y-3">
              <div className="font-semibold text-stone-900 text-sm border-b border-stone-100 pb-2 mb-3" style={{ fontFamily: "Lora, serif" }}>Request a Booking</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Preferred Date *</label>
                  <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setErrors((er) => { const n = { ...er }; delete n.date; return n; }); }} min={new Date().toISOString().split("T")[0]} className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#1C3270] ${errors.date ? "border-red-300 bg-red-50" : "border-stone-200 bg-stone-50"}`} />
                  {errors.date && <p className="text-xs text-red-500 mt-0.5">{errors.date}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Preferred Time *</label>
                  <input type="time" value={time} onChange={(e) => { setTime(e.target.value); setErrors((er) => { const n = { ...er }; delete n.time; return n; }); }} className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-[#1C3270] ${errors.time ? "border-red-300 bg-red-50" : "border-stone-200 bg-stone-50"}`} />
                  {errors.time && <p className="text-xs text-red-500 mt-0.5">{errors.time}</p>}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Meet-up location</label>
                <div className="flex gap-2 mb-2">
                  <button type="button" onClick={() => setMeetOnline(false)} className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${!meetOnline ? "bg-[#1C3270] text-white border-[#1C3270]" : "border-stone-200 text-stone-600 hover:border-stone-300"}`}>In person</button>
                  <button type="button" onClick={() => setMeetOnline(true)} className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${meetOnline ? "bg-[#1C3270] text-white border-[#1C3270]" : "border-stone-200 text-stone-600 hover:border-stone-300"}`}>Online</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Notes / Requirements</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50 resize-none" />
              </div>
              {errors.submit && <p className="text-xs text-red-500">{errors.submit}</p>}
              <button type="submit" disabled={!canBook} className="w-full py-3 bg-[#44B444] text-white rounded-xl font-semibold hover:bg-[#2E8A2E] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {canBook ? "Request Booking" : "Fully Booked"}
              </button>
              <p className="text-xs text-stone-400 text-center">Payment is only required after the seller accepts your request.</p>
            </form>
          )}

          <button onClick={handleMessage} className="w-full mt-3 py-2.5 border-2 border-[#25D366] text-[#25D366] rounded-xl font-semibold hover:bg-[#25D366] hover:text-white transition-colors flex items-center justify-center gap-2 text-sm">
            Message Seller on WhatsApp
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-100 p-6 mb-8">
        <h2 className="text-xl font-bold text-stone-900 mb-3" style={{ fontFamily: "Lora, serif" }}>About this service</h2>
        <p className="text-stone-600 leading-relaxed mb-4">{sv.description}</p>
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 text-sm mb-1">What's included</h4>
          <p className="text-sm text-blue-800">{sv.what_included}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-100 p-6 mb-8">
        <h2 className="text-xl font-bold text-stone-900 mb-4" style={{ fontFamily: "Lora, serif" }}>Reviews</h2>
        <div className="space-y-4">
          {reviews.length === 0 ? <p className="text-sm text-stone-500">No reviews yet.</p> : reviews.map((r) => (
            <div key={r.id} className="flex gap-3 p-4 bg-stone-50 rounded-xl">
              <img src={r.avatar} alt={r.author} className="w-9 h-9 rounded-full object-cover" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{r.author}</span>
                  <StarRating rating={r.rating} size="sm" />
                  <span className="text-xs text-stone-400">{r.date}</span>
                </div>
                <p className="text-sm text-stone-600 mt-1">{r.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
