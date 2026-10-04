import { MapCanvas } from "@/map/canvas";
import { countCategories } from "@/map/categories";
import { CategoryRail } from "@/map/rail";
import { MapShell } from "@/map/shell";
import { loadPreview } from "@/preview/data";

// Renders the map interface from checked-in parser output, so the interface can
// be built without a database or network. Goes away once analyses are stored.
export default function Preview() {
  const result = loadPreview();
  return (
    <MapShell
      rail={<CategoryRail categories={countCategories(result.files)} />}
      canvas={<MapCanvas files={result.files} edges={result.edges} />}
      detail={null}
    />
  );
}
