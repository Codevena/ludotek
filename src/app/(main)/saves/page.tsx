import { SavedVersions } from "@/components/saved-versions";
import { Breadcrumbs } from "@/components/breadcrumbs";

export default function SavesPage() {
  return <div className="max-w-5xl mx-auto space-y-6">
    <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Save-Versionen" }]} />
    <h1 className="font-heading text-2xl font-bold">Save-Versionen</h1>
    <p className="text-sm text-vault-muted">Gesicherte Spielstände und Savestates bleiben nach dem Entfernen eines Spiels oder Geräts erhalten. Für eine Wiederherstellung wählst du ein vorhandenes Zielgerät und prüfst den Dateiplan.</p>
    <SavedVersions />
  </div>;
}
