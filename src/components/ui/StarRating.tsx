type Props = {
  rating: number;
  reviewCount?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onChange?: (r: number) => void;
};

export default function StarRating({ rating, reviewCount, size = "md", interactive, onChange }: Props) {
  const sizes = { sm: "text-xs gap-0.5", md: "text-sm gap-1", lg: "text-base gap-1" };

  return (
    <div className={`flex items-center ${sizes[size]}`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => interactive && onChange?.(i)}
          className={`${interactive ? "cursor-pointer hover:scale-110 transition-transform" : "cursor-default"} leading-none`}
          aria-label={interactive ? `Rate ${i} stars` : undefined}
        >
          <span style={{ color: i <= Math.round(rating) ? "#F5A623" : "#CBD5E1", fontSize: "inherit" }}>
            ★
          </span>
        </button>
      ))}
      {reviewCount !== undefined && (
        <span style={{ color: "#6B6462", fontSize: size === "sm" ? "0.7rem" : "0.75rem" }}>
          ({reviewCount})
        </span>
      )}
    </div>
  );
}
