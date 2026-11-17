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

// 7 bis. « J'ai cuisiné » (recette Thermomix, 400 g de pommes de terre pour 4) : le frigo se met à jour sans rien peser.
// Ligne du frigo (et non la pastille « Mes indispensables » du même nom).
const pdtLine = () => page.locator("li button", { hasText: /^Pommes de terre/ });
const pdtRow = async () => (await visible(pdtLine(), 3000)) ? pdtLine().first().innerText() : "";
/** Attend que le frigo enregistré (IndexedDB) soit dans l'état voulu avant de recharger la page. */
async function savedPotatoes(expected) {
  for (let t = 0; t < 50; t++) {
    const q = await page.evaluate(() => new Promise((resolve) => {
      const req = indexedDB.open("recettes-courses");
      req.onsuccess = () => {
        const get = req.result.transaction("inventory").objectStore("inventory").getAll();
        get.onsuccess = () => { const p = get.result.find((i) => i.ingredientId === "pomme-de-terre"); resolve(p ? p.quantity : "absent"); req.result.close(); };
        get.onerror = () => resolve("erreur");
      };
      req.onerror = () => resolve("erreur");
    }));
    if (expected(q)) return true;
    await page.waitForTimeout(100);
  }
  return false;
}
await page.goto(`${BASE}/recettes/tm-soupe-poireaux/`);
await page.getByRole("button", { name: "J'ai cuisiné" }).click();
const panel = page.getByRole("dialog", { name: "Tu as fini quelque chose ?" });
check("« J'ai cuisiné » ouvre le panneau", await visible(panel));
check("panneau : seulement les ingrédients présents dans le frigo",
  await panel.getByText("Pommes de terre").count() === 1 && await panel.getByText("Poireaux").count() === 0);
check("« Retirer » absent tant que rien n'est coché", await panel.getByRole("button", { name: /Retirer les produits terminés/ }).count() === 0);
await page.screenshot({ path: `${SHOTS}/8-jai-cuisine.png` });
const nothing = panel.getByRole("button", { name: "Rien de terminé" });
// Double appui : deux clics envoyés avant que l'écran ne se mette à jour.
await nothing.evaluate((b) => { b.click(); b.click(); });
check("confirmation avec « Annuler »", await visible(page.getByRole("button", { name: "Annuler" })));
await page.screenshot({ path: `${SHOTS}/9-confirmation.png` });
await savedPotatoes((q) => q === 100);
await page.goto(`${BASE}/frigo/`);
check("500 g − 400 g, double appui compté une fois → environ 100 g", /100 g/.test(await pdtRow()), await pdtRow());

// Annuler restaure l'état précédent.
await page.goto(`${BASE}/recettes/tm-soupe-poireaux/`);
await page.getByRole("button", { name: "J'ai cuisiné" }).click();
await panel.getByRole("checkbox", { name: /Pommes de terre/ }).check();
await panel.getByRole("button", { name: /Retirer les produits terminés/ }).click();
await savedPotatoes((q) => q === "absent");
await page.getByRole("button", { name: "Annuler" }).click();
check("« Annuler » enregistré dans le téléphone", await savedPotatoes((q) => q === 100));
await page.goto(`${BASE}/frigo/`);
check("« Annuler » remet les pommes de terre", /100 g/.test(await pdtRow()), await pdtRow());

// Produit terminé : il disparaît du frigo.
await page.goto(`${BASE}/recettes/tm-soupe-poireaux/`);
await page.getByRole("button", { name: "J'ai cuisiné" }).click();
await panel.getByRole("checkbox", { name: /Pommes de terre/ }).check();
await panel.getByRole("button", { name: /Retirer les produits terminés/ }).click();
await savedPotatoes((q) => q === "absent");
await page.goto(`${BASE}/frigo/`);
await page.getByRole("button", { name: /^✓ Carottes/ }).or(page.locator("li button", { hasText: /^Carottes/ })).first().waitFor();
check("produit terminé retiré du frigo", await pdtLine().count() === 0);

// 7 ter. « Qu'est-ce qu'on mange ? » : Plat → Gratin → 30 min max → Four, puis retour aux catégories.
await page.goto(`${BASE}/`);
await page.getByRole("link", { name: /Qu.est-ce qu.on mange/ }).click();
await page.getByRole("link", { name: /^Entrée/ }).waitFor();
check("mange : choix Entrée / Plat / Dessert", await page.getByRole("link", { name: /^Dessert/ }).count() === 1);
await page.screenshot({ path: `${SHOTS}/12-mange-moment.png` });
await page.getByRole("link", { name: /^Plat/ }).click();
await page.getByRole("link", { name: /Toutes les idées/ }).waitFor();
check("mange : types de plats + « Toutes les idées »", await page.getByRole("link", { name: /^Gratin/ }).count() === 1);
await page.screenshot({ path: `${SHOTS}/13-mange-types.png` });
await page.getByRole("link", { name: /^Gratin/ }).click();
await page.getByTestId("meal-card").first().waitFor();
const gratins = await page.getByTestId("meal-card").count();
check("mange : plusieurs gratins affichés tout de suite", gratins > 1, `${gratins} recettes`);
check("mange : carte avec temps, matériel et détail", await page.getByTestId("meal-card").first().getByText(/Il manque|Tu as tout|à vérifier/).count() > 0);
await page.screenshot({ path: `${SHOTS}/14-mange-gratins.png`, fullPage: true });
await page.getByRole("button", { name: /30 min max/ }).click();
await page.getByRole("button", { name: "Four", exact: true }).click();
await page.waitForTimeout(300);
check("mange : filtres 30 min + four dans l'adresse", /t=30/.test(page.url()) && /m=four/.test(page.url()), page.url());
const filteredCards = await page.getByTestId("meal-card").count();
const emptyMsg = await page.getByText(/Aucune recette .* avec ces filtres/).count();
check("mange : résultats mis à jour (ou message clair)", filteredCards > 0 || emptyMsg === 1, `${filteredCards} cartes, message=${emptyMsg}`);
await page.screenshot({ path: `${SHOTS}/15-mange-filtres.png`, fullPage: true });
await page.getByRole("link", { name: /Retour aux types de plat/ }).click();
check("mange : retour aux types de plats", await visible(page.getByRole("link", { name: /^Gratin/ })));
await page.getByRole("link", { name: "Repas" }).click();
check("mange : retour au choix du moment", await visible(page.getByRole("link", { name: /^Entrée/ })));

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
