import type { Equipment } from "./domain/types";

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  four: "Four",
  poele: "Poêle",
  casserole: "Casserole",
  cocotte: "Cocotte",
  airfryer: "Air fryer",
  thermomix: "Thermomix",
  "sans-cuisson": "Sans cuisson",
};

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}
