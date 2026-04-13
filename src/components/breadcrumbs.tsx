import Link from "next/link";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex items-center gap-1.5 mb-6 flex-wrap" aria-label="Breadcrumb">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-[10px] text-zinc-700">&#9656;</span>}
            {isLast ? (
              <span className="text-xs px-2.5 py-1 rounded-full bg-vault-amber/10 text-vault-amber font-medium">
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href || "/"}
                className="text-xs px-2.5 py-1 rounded-full bg-vault-surface text-vault-muted hover:text-vault-text transition-colors"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
