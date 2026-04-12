"use client";

import { useRouter, useSearchParams } from "next/navigation";

const SORT_OPTIONS = [
  { value: "title", label: "Name" },
  { value: "igdbScore-desc", label: "Score (high)" },
  { value: "releaseDate-desc", label: "Release (new)" },
  { value: "createdAt-desc", label: "Recently Added" },
];

export function SortSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    const [sort, order] = e.target.value.split("-");
    params.set("sort", sort);
    if (order) params.set("order", order);
    else params.delete("order");
    params.delete("page");
    router.push(`?${params.toString()}`);
  }

  const current = `${searchParams.get("sort") || "title"}${searchParams.get("order") === "desc" ? "-desc" : ""}`;

  return (
    <select
      value={current}
      onChange={handleChange}
      className="bg-vault-surface border border-vault-border rounded-lg px-3 py-2 text-sm text-vault-text focus:outline-none focus:border-vault-amber"
    >
      {SORT_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
