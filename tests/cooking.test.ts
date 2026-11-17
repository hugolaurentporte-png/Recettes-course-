import { describe, expect, it } from "vitest";
import { findTimers, formatClock, formatDuration, scaleStep } from "@/lib/domain/cooking";
import { formatAmount, formatRecipeAmount, scaleQuantity } from "@/lib/domain/units";
import { RECIPES } from "@/lib/data/recipes";

const text = (step: string, from: number, to: number) => scaleStep(step, from, to).map((p) => p.text).join("");

describe("minuteurs du mode cuisine", () => {
  it("repère les durées utiles d'une étape", () => {
    expect(findTimers("Faites cuire 22 min à 100 °C vitesse 1.")).toEqual([{ label: "22 min", seconds: 1320 }]);
    expect(findTimers("Cuire 8 à 10 minutes dans l'eau bouillante.")).toEqual([{ label: "8 à 10 minutes", seconds: 480 }]);
    expect(findTimers("Enfournez 1 h 30 à 160 °C.")).toEqual([{ label: "1 h 30", seconds: 5400 }]);
    expect(findTimers("Cuire 25 min/100 °C/vitesse 1.")[0]?.seconds).toBe(1500);
    expect(findTimers("Laisser reposer 1 heure.")[0]?.seconds).toBe(3600);
    expect(findTimers("Mixer 45 secondes.")[0]?.seconds).toBe(45);
  });

  it("ignore les durées trop courtes et ce qui n'est pas une durée", () => {
    expect(findTimers("Mixez 5 s vitesse 5, puis 10 sec/vitesse 10.")).toEqual([]);
    expect(findTimers("Préchauffez le four à 180 °C. Le Thermomix TM6 suffit.")).toEqual([]);
    expect(findTimers("Ajoutez 2 minutes plus tard 3 mangues")).toEqual([{ label: "2 minutes", seconds: 120 }]);
  });

  it("affiche le temps restant et la durée", () => {
    expect(formatClock(600)).toBe("10:00");
    expect(formatClock(65.2)).toBe("1:06");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatDuration(5400)).toBe("1 h 30");
    expect(formatDuration(1320)).toBe("22 min");
  });

  it("trouve un minuteur dans la plupart des recettes", () => {
    const withTimer = RECIPES.filter((r) => r.instructions.some((s) => findTimers(s).length > 0)).length;
    expect(withTimer / RECIPES.length).toBeGreaterThan(0.8);
  });
});

describe("quantités dans le texte des étapes", () => {
  it("recalcule l'eau et les liquides, pas les températures ni les vitesses", () => {
    const step = "Versez 850 ml d'eau et le cube de bouillon. Faites cuire 16 min à 100 °C vitesse 1.";
    expect(text(step, 4, 2)).toBe("Versez 425 ml d'eau et le cube de bouillon. Faites cuire 16 min à 100 °C vitesse 1.");
    expect(text(step, 4, 6)).toBe("Versez 1,3 l d'eau et le cube de bouillon. Faites cuire 16 min à 100 °C vitesse 1.");
    expect(text("Ajouter 1,5 l d'eau et 20 cl de crème.", 4, 2)).toBe("Ajouter 750 ml d'eau et 100 ml de crème.");
    expect(text("Mixez 5 s vitesse 5. Ajoutez 30 g de beurre.", 4, 8)).toBe("Mixez 5 s vitesse 5. Ajoutez 60 g de beurre.");
  });

  it("marque les quantités recalculées et ne touche à rien sans changement", () => {
    const parts = scaleStep("Versez 600 ml d'eau.", 4, 2);
    expect(parts.find((p) => p.scaled)).toEqual({ text: "300 ml", scaled: { original: "600 ml" } });
    expect(scaleStep("Versez 600 ml d'eau.", 4, 4)).toEqual([{ text: "Versez 600 ml d'eau." }]);
    expect(text("Le TM6 et l'huile, 2 l'un", 4, 2)).toBe("Le TM6 et l'huile, 2 l'un");
  });
});

describe("portions lisibles", () => {
  it("parle en fractions pour les pièces et les cuillères", () => {
    expect(formatAmount({ value: scaleQuantity(1, "piece", 4, 2), unit: "piece" })).toBe("½ pièce");
    expect(formatAmount({ value: 1.5, unit: "piece" })).toBe("1 ½ pièces");
    expect(formatRecipeAmount({ value: 1.5, unit: "piece" })).toBe("1 ½");
    expect(formatRecipeAmount({ value: 200, unit: "g" })).toBe("200 g");
    expect(formatAmount({ value: scaleQuantity(1, "cs", 4, 3), unit: "cs" })).toBe("¾ c. à soupe");
    expect(formatAmount({ value: scaleQuantity(2, "cs", 4, 3), unit: "cs" })).toBe("1 ½ c. à soupe");
    expect(formatAmount({ value: scaleQuantity(1, "cc", 4, 1), unit: "cc" })).toBe("¼ c. à café");
  });

  it("arrondit les grosses quantités de façon pratique", () => {
    expect(formatAmount({ value: scaleQuantity(800, "g", 4, 5), unit: "g" })).toBe("1 kg");
    expect(formatAmount({ value: scaleQuantity(900, "g", 4, 5), unit: "g" })).toBe("1,15 kg");
    expect(scaleQuantity(1, "pincee", 4, 2)).toBe(1);
  });
});
