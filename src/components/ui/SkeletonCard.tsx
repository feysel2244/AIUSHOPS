export default function SkeletonCard({ type = "product" }: { type?: "product" | "shop" }) {
  return (
    <div className="bg-white dark:bg-[#112038] rounded-xl overflow-hidden border border-stone-100 dark:border-[#1C3058] shadow-sm">
      <div className="skeleton aspect-[4/3] w-full" />
      <div className="p-4 space-y-2">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3 w-1/2" />
        {type === "product" && <div className="skeleton h-5 w-1/3 mt-1" />}
        <div className="skeleton h-8 w-full mt-2 rounded-lg" />
      </div>
    </div>
  );
}
