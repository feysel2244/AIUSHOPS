type Variant =
  | "open" | "closed" | "promoted" | "promotion_pending"
  | "pending" | "confirmed" | "ready" | "delivered" | "cancelled" | "rejected"
  | "service" | "tag" | "rank" | "paused"
  | "payment_reported" | "cash_on_pickup";

const styles: Record<Variant, string> = {
  open:              "bg-green-50 text-green-700 border border-green-200",
  closed:            "bg-red-50 text-red-700 border border-red-200",
  paused:            "bg-blue-50 text-blue-700 border border-blue-200",
  promoted:          "bg-blue-50 text-blue-700 border border-blue-300 font-semibold",
  promotion_pending: "bg-amber-50 text-amber-700 border border-amber-300",
  pending:           "bg-blue-50 text-blue-700 border border-blue-200",
  confirmed:         "bg-blue-50 text-blue-700 border border-blue-200",
  ready:             "bg-purple-50 text-purple-700 border border-purple-200",
  delivered:         "bg-green-50 text-green-700 border border-green-200",
  cancelled:         "bg-gray-100 text-gray-500 border border-gray-200",
  rejected:          "bg-red-50 text-red-600 border border-red-200",
  service:           "bg-purple-50 text-purple-700 border border-purple-200",
  tag:               "bg-stone-100 text-stone-600 border border-stone-200",
  rank:              "text-white font-bold",
  payment_reported:  "bg-amber-50 text-amber-700 border border-amber-300",
  cash_on_pickup:    "bg-slate-100 text-slate-600 border border-slate-200",
};

const rankColors: Record<number, string> = {
  1: "bg-amber-400",
  2: "bg-stone-400",
  3: "bg-amber-700",
};

const labels: Record<string, string> = {
  open:              "Open",
  closed:            "Closed",
  paused:            "Paused",
  promoted:          "✦ Promoted",
  promotion_pending: "⏳ Promo Pending",
  pending:           "Pending",
  confirmed:         "Confirmed",
  ready:             "Ready for Pickup",
  delivered:         "Delivered",
  cancelled:         "Cancelled",
  rejected:          "Rejected",
  service:           "Service",
  payment_reported:  "💳 Payment Reported",
  cash_on_pickup:    "💵 Pay on Pickup",
};

type Props = {
  variant: Variant;
  label?: string;
  rank?: number;
  className?: string;
};

export default function Badge({ variant, label, rank, className = "" }: Props) {
  if (variant === "rank" && rank !== undefined) {
    return (
      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${rankColors[rank] || "bg-stone-300"} ${styles.rank} ${className}`}>
        #{rank}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${styles[variant]} ${className}`}>
      {label ?? labels[variant] ?? variant}
    </span>
  );
}
