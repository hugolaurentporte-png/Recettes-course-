/**
 * Import idempotent des recettes générées, en BROUILLON (jamais publiées automatiquement).
 *
 *   npm run import:recipes                       # fichier par défaut
 *   npm run import:recipes -- autre-fichier.json
 *
 * Écrit :
 * - src/lib/data/drafts/recettes-import.json : brouillons au format de l'appli (published: false) ;
 * - data/import/rapport-import.json : acceptées, rejetées (doublons, invalides), variantes, alertes.
 * Relancer la commande donne les mêmes fichiers ; les statuts « valide » / « refuse » déjà posés sont gardés.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { BASE_RECIPES as RECIPES } from "../src/lib/data/recipes";
import { FAMILY_CORRECTIONS, importRecipes, publishedFromDrafts, type DraftRecipe, type SourceFile } from "../src/lib/import/recipeImport";

const sourcePath = process.argv[2] ?? "data/import/recettes_1000_import.json";
const draftsPath = "src/lib/data/drafts/recettes-import.json";
const publishedPath = "src/lib/data/recettes-importees.json";
const reportPath = "data/import/rapport-import.json";

const source = JSON.parse(readFileSync(sourcePath, "utf8")) as SourceFile;
const previous: DraftRecipe[] = existsSync(draftsPath) ? JSON.parse(readFileSync(draftsPath, "utf8")) : [];

const { drafts, rejected } = importRecipes(source, RECIPES, previous);

writeFileSync(draftsPath, JSON.stringify(drafts, null, 1) + "\n");
// Recettes validées, chargées par l'appli (JSON compact : il part dans l'appli).
writeFileSync(publishedPath, JSON.stringify(publishedFromDrafts(drafts)) + "\n");

const count = (pred: (d: DraftRecipe) => boolean) => drafts.filter(pred).length;
const report = {
  source: sourcePath,
  entrees: source.recettes.length,
  recettesExistantesIntactes: RECIPES.length,
  acceptees: drafts.length,
  rejetees: rejected.length,
  doublonsDeRecettesExistantes: rejected.filter((r) => r.reason === "doublon").length,
  variantesTresProches: count((d) => !!d.review.variantOf),
  prochesDUneRecetteExistante: count((d) => !!d.review.closeTo),
  avecAlerte: count((d) => d.review.warnings.length > 0),
  statuts: {
    brouillon: count((d) => d.review.status === "brouillon"),
    valide: count((d) => d.review.status === "valide"),
    refuse: count((d) => d.review.status === "refuse"),
  },
  correctionsCommunes: FAMILY_CORRECTIONS,
  rejets: rejected,
};
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");

console.log(`${report.entrees} entrées : ${report.acceptees} brouillons, ${report.rejetees} rejetées (${report.doublonsDeRecettesExistantes} doublons).`);
console.log(`${report.statuts.valide} validées et publiées, ${report.statuts.refuse} refusées à la relecture.`);
console.log(`${report.variantesTresProches} variantes très proches, ${report.prochesDUneRecetteExistante} proches d'une recette existante.`);
