export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) return null;

  const rounded = Math.round(score);
  const color =
    rounded >= 75
      ? "bg-green-500/20 text-green-400"
      : rounded >= 50
        ? "bg-yellow-500/20 text-yellow-400"
        : "bg-red-500/20 text-red-400";

  return (
    <span className={`${color} text-xs font-bold px-2 py-0.5 rounded-full`}>
      {rounded}
    </span>
  );
}
