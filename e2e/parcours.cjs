// Test du parcours utilisateur sur un téléphone émulé (Playwright).
// Usage : npm run build && (servir le dossier out/ sur le port 4173) && node e2e/parcours.cjs
const { chromium, devices } = require("playwright");
const { mkdirSync } = require("node:fs");

const BASE = process.env.BASE_URL ?? "http://localhost:4173";
const SHOTS = process.env.SHOTS ?? "e2e/screens";
mkdirSync(SHOTS, { recursive: true });

const results = [];
/** Attend qu'un élément apparaisse (les données locales se chargent en quelques millisecondes). */
const visible = (loc, timeout = 5000) => loc.first().waitFor({ timeout }).then(() => true, () => false);
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

(async () => {
const browser = await chromium.launch();
const context = await browser.newContext({ ...devices["iPhone 13"], locale: "fr-FR" });
const page = await context.newPage();
page.on("pageerror", (e) => check("aucune erreur JavaScript", false, e.message));

// 1. Ouvrir l'appli et ajouter un article en moins de 5 secondes, sans passer par les recettes.
const t0 = Date.now();
await page.goto(`${BASE}/`);
await page.getByRole("link", { name: /Courses/ }).last().click();
const firstLaunch = Date.now();
await page.getByLabel("Ajouter un article").fill("2 kg pommes de terre");
await page.keyboard.press("Enter");
await page.getByText("Pommes de terre").first().waitFor();
const elapsed = Date.now() - t0;
check("ouvrir → ajouter un article en moins de 5 s", elapsed < 5000, `${elapsed} ms (temps machine, hors frappe)`);

for (const t of ["Papier toilette", "lait 1l", "Lessive", "6 oeufs", "lait 50cl"]) {
  await page.getByLabel("Ajouter un article").fill(t);
  await page.keyboard.press("Enter");
}
await page.waitForTimeout(300);
const laitRows = await page.getByRole("button", { name: /^Lait/ }).count();
check("doublon « lait » fusionné", laitRows === 1);
check("quantités fusionnées (1 l + 50 cl = 1,5 l)", await page.getByText("Lait · 1,5 l").count() === 1);
check("rayon Hygiène créé pour le papier toilette", await page.getByRole("heading", { name: /Hygiène/ }).count() === 1);
check("rayon Maison créé pour la lessive", await page.getByRole("heading", { name: /Maison/ }).count() === 1);
await page.screenshot({ path: `${SHOTS}/1-courses.png` });

// 2. Cocher, puis vérifier la persistance après rechargement.
await page.getByRole("checkbox", { name: /Cocher Papier toilette/ }).click();
await page.reload();
check("article coché conservé après rechargement", await visible(page.getByText("Dans le panier (1)"), 10000));
check("liste conservée après fermeture / rechargement", await page.getByText("Lessive").count() === 1);
check("article coché regroupé en bas", await page.getByRole("checkbox", { name: /Décocher Papier toilette/ }).count() === 1);
await page.screenshot({ path: `${SHOTS}/2-coche.png` });

// 3. Modifier la catégorie d'un article.
await page.getByRole("button", { name: /^Lessive/ }).click();
await page.getByRole("button", { name: /Autres/ }).click();
await page.getByRole("button", { name: "Enregistrer" }).click();
check("catégorie modifiable", await page.getByRole("heading", { name: /Autres/ }).count() === 1);

// 4. Terminer mes courses.
await page.getByRole("button", { name: "Terminer mes courses" }).click();
await page.waitForTimeout(200);
check("récapitulatif avant de ranger", await page.getByRole("button", { name: /^Ranger \d+ article/ }).count() === 1);
await page.getByRole("button", { name: /^Ranger \d+ article/ }).click();
await page.waitForTimeout(200);
check("« Terminer » archive les cochés", await page.getByRole("checkbox", { name: /Papier toilette/ }).count() === 0);
check("« Terminer » garde les non achetés", await page.getByText("Lessive").count() === 1);

// 5. Frigo : 10 ingrédients en moins d'une minute.
const t1 = Date.now();
await page.goto(`${BASE}/frigo/`);
const tenIngredients = ["pomme de terre", "carotte", "lait", "ail", "oeuf", "champignon", "beurre", "lardon", "oignon", "pates"];
for (const name of tenIngredients) {
  await page.getByLabel("Ajouter un ingrédient").fill(name);
  await page.keyboard.press("Enter");
}
const t10 = Date.now() - t1;
check("10 ingrédients ajoutés en moins d'une minute", t10 < 60000, `${t10} ms (temps machine)`);
// Quantité + priorité
await page.getByRole("button", { name: /^Pommes de terre/ }).click();
await page.getByLabel("Quantité").fill("500");
await page.getByLabel("Unité").selectOption("g");
await page.getByRole("button", { name: "Enregistrer" }).click();
await page.getByRole("button", { name: /Marquer Champignons à utiliser rapidement/ }).click();
check("section « À utiliser rapidement »", await page.getByText("⚡ À utiliser rapidement").count() === 1);
await page.screenshot({ path: `${SHOTS}/3-frigo.png`, fullPage: true });

// 6. Accueil : sections et recommandations.
await page.goto(`${BASE}/`);
const onboarding = page.getByRole("button", { name: "Passer" });
if (await onboarding.count()) await onboarding.click();
await page.getByText("⚡ À cuisiner rapidement").waitFor();
check("accueil : section « À cuisiner rapidement »", true);
await page.screenshot({ path: `${SHOTS}/4-accueil.png` });

// 7. Recettes : filtre et ajout des manquants (exemple du cahier des charges).
await page.goto(`${BASE}/recettes/gratin-pdt-carottes/`);
await page.getByRole("button", { name: /Ajouter ce qu'il manque/ }).click();
await page.screenshot({ path: `${SHOTS}/5-recette.png` });
await page.goto(`${BASE}/courses/`);
check("recette → 300 g de pommes de terre ajoutés", await visible(page.getByRole("button", { name: /^Pommes de terre · 2,3 kg/ })),
  "2 kg ajoutés à la main + 300 g manquants pour la recette");
check("recette → crème ajoutée", await visible(page.getByRole("button", { name: /^Crème fraîche · 200 ml/ })));
check("ajout manuel conservé (lessive toujours là)", await visible(page.getByRole("checkbox", { name: "Cocher Lessive" })));
await page.screenshot({ path: `${SHOTS}/6-courses-recette.png`, fullPage: true });

await page.goto(`${BASE}/recettes/?t=15`);
const cards = await page.locator("article h3").count();
check("filtre < 15 min affiche des recettes", cards > 0, `${cards} recettes`);
await page.goto(`${BASE}/recettes/?t=15&m=cocotte`);
await page.getByText("Aucune recette ne correspond").waitFor();
check("aucun résultat : message clair", true);
await page.goto(`${BASE}/recettes/`);
await page.screenshot({ path: `${SHOTS}/7-recettes.png` });

// 8. Hors connexion : après une première visite, l'appli doit s'ouvrir sans réseau.
await page.goto(`${BASE}/courses/`);
await page.evaluate(async () => { await navigator.serviceWorker.ready; });
await page.waitForTimeout(1500);
await context.setOffline(true);
await page.reload();
await page.getByLabel("Ajouter un article").fill("Pain");
await page.keyboard.press("Enter");
const painOk = await page.getByRole("checkbox", { name: "Cocher Pain" }).waitFor({ timeout: 3000 }).then(() => true, () => false);
const lessiveOk = await visible(page.getByRole("checkbox", { name: "Cocher Lessive" }));
check("hors connexion : liste accessible et modifiable", painOk && lessiveOk, `pain=${painOk} lessive=${lessiveOk}`);
await page.goto(`${BASE}/recettes/ratatouille/`).catch(() => {});
check("hors connexion : fiche recette accessible", await page.getByText("Ratatouille").count() > 0);
await context.setOffline(false);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} vérifications réussies`);
process.exit(failed.length ? 1 : 0);
})();
