/**
 * Import idempotent des recettes Thermomix proposées, en BROUILLON (jamais publiées automatiquement).
 *
 *   npm run import:thermomix
 *
 * Règle de fichier (consigne de Hugo) : si les 80 premières recettes (tmx-0001 à tmx-0080) sont déjà
 * importées, on prend « recettes_thermomix_220_supplementaires.json » ; sinon le catalogue complet de 300.
 * Jamais les deux.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { BASE_RECIPES, IMPORTED_RECIPES } from "../src/lib/data/recipes";
import { importThermomix, type ThermomixDraft } from "../src/lib/import/thermomixImport";

const draftsPath = "src/lib/data/drafts/thermomix-import.json";
const reportPath = "data/import/rapport-thermomix.json";
const previous: ThermomixDraft[] = existsSync(draftsPath) ? JSON.parse(readFileSync(draftsPath, "utf8")) : [];

const has80 = Array.from({ length: 80 }, (_, i) => `imp-tmx-${String(i + 1).padStart(4, "0")}`).every((id) => previous.some((d) => d.id === id));
const sourcePath = has80 ? "data/import/recettes_thermomix_220_supplementaires.json" : "data/import/recettes_thermomix_300_complet.json";
const source = JSON.parse(readFileSync(sourcePath, "utf8"));

// En mode « supplément », les 80 déjà importées restent telles quelles.
const kept = has80 ? previous.filter((d) => !source.recettes.some((r: { id: string }) => `imp-${r.id}` === d.id)) : [];
const { drafts: fresh, rejected } = importThermomix(source, [...BASE_RECIPES, ...IMPORTED_RECIPES, ...kept], previous);
const drafts = [...kept, ...fresh].sort((a, b) => a.id.localeCompare(b.id));
// Décision de Hugo (2026-11-17, « Je valide toutes les PR ») : les brouillons Thermomix sont validés.
// Un statut « refuse » posé plus tard est conservé au ré-import.
for (const d of drafts) if (d.review.status === "brouillon") d.review.status = "valide";
writeFileSync(draftsPath, JSON.stringify(drafts, null, 1) + "\n");
writeFileSync(
  "src/lib/data/thermomix-publiees.json",
  JSON.stringify(drafts.filter((d) => d.review.status === "valide").map(({ review: _r, ...r }) => ({ ...r, published: true }))) + "\n",
);

const count = (f: (d: ThermomixDraft) => boolean) => drafts.filter(f).length;
const byFamily: Record<string, number> = {};
for (const d of drafts) byFamily[d.review.family] = (byFamily[d.review.family] ?? 0) + 1;
const report = {
  source: sourcePath,
  entrees: source.recettes.length,
  acceptees: fresh.length,
  rejetees: rejected.length,
  parFamille: byFamily,
  prochesDUneRecetteThermomixExistante: count((d) => !!d.review.closeTo),
  avecAlerte: count((d) => d.review.warnings.length > 0),
  chargeMaxDuBol: Math.max(...drafts.map((d) => d.review.bowlLoad)),
  statuts: { brouillon: count((d) => d.review.status === "brouillon"), valide: count((d) => d.review.status === "valide"), refuse: count((d) => d.review.status === "refuse") },
  rejets: rejected,
};
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(`${sourcePath} : ${report.entrees} entrées, ${report.acceptees} brouillons, ${report.rejetees} rejetées.`);
