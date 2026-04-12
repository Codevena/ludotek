export function PlatformTag({ label, color }: { label: string; color?: string }) {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{
        backgroundColor: `${color || "#f59e0b"}20`,
        color: color || "#f59e0b",
      }}
    >
      {label}
    </span>
  );
}
