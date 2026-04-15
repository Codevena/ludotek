"use client";

interface ConsoleMilestone {
  title: string;
  year: number;
  description: string;
}

interface ConsoleCardProps {
  name: string;
  alternateNames: string[];
  manufacturer: string;
  releaseYear: number;
  color: string;
  romCount: number;
  history: string[];
  facts: {
    unitsSold: string;
    cpu: string;
    gameLibrary: string;
    launchPrice: string;
  };
  milestones: ConsoleMilestone[];
  platformId: string;
  lang?: "en" | "de";
}

export function ConsoleCard({
  name,
  alternateNames,
  manufacturer,
  releaseYear,
  color,
  romCount,
  history,
  facts,
  milestones,
  platformId,
  lang = "en",
}: ConsoleCardProps) {
  return (
    <div className="relative pl-12 md:pl-16 pb-12 last:pb-0">
      {/* Timeline node (glowing circle) */}
      <div
        className="absolute left-0 top-1.5 w-4 h-4 rounded-full"
        style={{
          backgroundColor: color,
          boxShadow: `0 0 12px ${color}66, 0 0 24px ${color}33`,
        }}
      />

      {/* Year + Manufacturer label */}
      <div
        className="text-xs font-bold uppercase tracking-widest mb-2"
        style={{ color }}
      >
        {releaseYear} — {manufacturer}
      </div>

      {/* Card */}
      <div
        className="rounded-xl p-5 md:p-6 border"
        style={{
          background: `linear-gradient(135deg, ${color}08, ${color}03)`,
          borderColor: `${color}18`,
        }}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div className="flex items-center gap-3">
            <img
              src={`/platforms/${platformId}.png`}
              alt={name}
              className="w-8 h-8 object-contain flex-shrink-0"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                if (!img.dataset.triedSvg) {
                  img.dataset.triedSvg = "1";
                  img.src = `/platforms/${platformId}.svg`;
                } else {
                  img.style.display = "none";
                }
              }}
            />
            <div>
              <h3 className="font-heading text-lg font-bold text-vault-text">
                {name}
              </h3>
              {alternateNames.length > 0 && (
                <p className="text-sm text-vault-muted">
                  {alternateNames.join(" / ")}
                </p>
              )}
            </div>
          </div>
          <span
            className="text-xs px-3 py-1 rounded-full whitespace-nowrap self-start"
            style={{
              backgroundColor: `${color}22`,
              color,
            }}
          >
            {romCount} {romCount === 1 ? "ROM" : "ROMs"} {lang === "de" ? "in deiner Sammlung" : "in your collection"}
          </span>
        </div>

        {/* History paragraphs */}
        <div className="mt-4 space-y-3">
          {history.map((paragraph, i) => (
            <p key={i} className="text-sm text-vault-text/90 leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>

        {/* Facts grid */}
        <div className="mt-5 pt-4 border-t border-white/5">
          <div className="text-[10px] uppercase tracking-widest text-vault-muted mb-3">
            {lang === "de" ? "Fakten" : "Facts"}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { label: lang === "de" ? "Verkauft" : "Sold", value: facts.unitsSold },
              { label: "CPU", value: facts.cpu },
              { label: lang === "de" ? "Spielebibliothek" : "Game Library", value: facts.gameLibrary },
              { label: lang === "de" ? "Launchpreis" : "Launch Price", value: facts.launchPrice },
            ].map((fact) => (
              <div key={fact.label} className="flex items-start gap-2 text-sm">
                <span className="text-vault-amber mt-0.5">&#9632;</span>
                <span className="text-vault-muted">
                  <span className="text-vault-text/70">{fact.label}:</span>{" "}
                  {fact.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Milestones */}
        {milestones.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <div className="text-[10px] uppercase tracking-widest text-vault-muted mb-3">
              {lang === "de" ? "Meilensteine" : "Milestones"}
            </div>
            <div className="space-y-1.5">
              {milestones.map((m) => (
                <div key={m.title} className="text-sm text-vault-muted leading-relaxed">
                  <span className="text-vault-text/80 font-medium">
                    {m.title}
                  </span>{" "}
                  <span className="text-vault-muted/60">({m.year})</span>
                  {" — "}
                  {m.description}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
