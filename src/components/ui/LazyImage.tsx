import { useEffect, useRef, useState } from "react";

type Props = React.ImgHTMLAttributes<HTMLImageElement>;

/**
 * Drop-in replacement for <img> that:
 * - Shows a shimmer skeleton (.skeleton CSS class) while the image loads
 * - Fades the image in smoothly (300 ms) once it is ready
 * - Instantly shows already-cached images (no flicker on repeat visits)
 */
export default function LazyImage({ className, style, ...props }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  // If the browser already has the image cached, mark it as loaded immediately
  // so we do not show a skeleton flash on repeat visits.
  useEffect(() => {
    if (imgRef.current?.complete) {
      setLoaded(true);
    }
  }, []);

  return (
    <span className="relative block w-full h-full">
      {/* Shimmer skeleton shown until the image loads */}
      {!loaded && (
        <span
          className="skeleton absolute inset-0 rounded-none"
          aria-hidden="true"
        />
      )}

      <img
        ref={imgRef}
        {...props}
        onLoad={() => setLoaded(true)}
        style={{ ...style, transition: "opacity 0.3s ease" }}
        className={`${className ?? ""} ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </span>
  );
}
