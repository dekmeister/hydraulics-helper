/** 0–3 stars, drawn as text with a spoken equivalent. */
export function Stars({ stars }: { stars: number }) {
  const n = Math.max(0, Math.min(3, Math.round(stars)));
  return (
    <span className="stars" role="img" aria-label={`${String(n)} of 3 stars`}>
      {'★'.repeat(n)}
      {'☆'.repeat(3 - n)}
    </span>
  );
}
