// Test du bouton « À découvrir » du planning (idées pour ce soir selon le frigo et la saison).
// Usage : npm run build && (servir out/ sur le port 4173) && node e2e/a-decouvrir.cjs
const { chromium, devices } = require("playwright");
const { mkdirSync } = require("node:fs");

const BASE = process.env.BASE_URL ?? "http://localhost:4173";
const SHOTS = process.env.SHOTS ?? "e2e/screens";
mkdirSync(SHOTS, { recursive: true });

const results = [];
const visible = (loc, timeout = 8000) => loc.first().waitFor({ timeout }).then(() => true, () => false);
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices["iPhone 13"], locale: "fr-FR" });
  const page = await context.newPage();
  page.on("pageerror", (e) => check("aucune erreur JavaScript", false, e.message));

  // Frigo vide : le panneau s'ouvre quand même, avec la saison et un lien vers Mon frigo.
  await page.goto(`${BASE}/planning/`);
  await page.getByRole("button", { name: /À découvrir/ }).click();
  check("le panneau « À découvrir » s'ouvre", await visible(page.getByRole("dialog", { name: "À découvrir ce soir" })));
  check("frigo vide : invitation à remplir Mon frigo", await visible(page.getByRole("link", { name: "Remplir Mon frigo" })));
  check("légumes de saison affichés", await visible(page.getByText(/De saison en/)));
  await page.screenshot({ path: `${SHOTS}/decouvrir-vide.png` });
  await page.getByRole("button", { name: "Fermer" }).click();

  // Remplir le frigo.
  await page.goto(`${BASE}/frigo/`);
  for (const name of ["poireau", "pomme de terre", "oignon", "creme", "oeuf", "fromage rape", "lardon", "beurre"]) {
    await page.getByLabel("Ajouter un ingrédient").fill(name);
    await page.keyboard.press("Enter");
  }
  await page.waitForTimeout(300);

  await page.goto(`${BASE}/planning/`);
  await page.getByRole("button", { name: /À découvrir/ }).click();
  const dialog = page.getByRole("dialog", { name: "À découvrir ce soir" });
  check("idées avec le frigo", await visible(dialog.getByText("Avec ce que vous avez")));
  const ideas = dialog.getByTestId("discover-idea");
  check("au moins 2 idées proposées", (await ideas.count()) >= 2, `${await ideas.count()} idées`);
  check("produits du frigo de saison mis en avant", await visible(dialog.getByText(/Dans votre frigo et de saison/)));
  await page.screenshot({ path: `${SHOTS}/decouvrir-frigo.png` });
  await dialog.getByRole("button", { name: /Surprenez-moi/ }).click();
  check("tirage au sort", await visible(dialog.getByTestId("discover-draw")));
  await dialog.getByTestId("discover-draw").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/decouvrir-tirage.png` });

  // Prévoir ce soir.
  const first = (await ideas.first().locator("p").first().textContent()).trim();
  await ideas.first().getByRole("button", { name: /Prévoir ce soir/ }).click();
  check("prévu ce soir dans le planning", await visible(page.locator("li", { hasText: "Soir" }).getByText(first)), first);

  // Ce soir déjà pris : on demande avant de remplacer.
  await page.getByRole("button", { name: /À découvrir/ }).click();
  check("le plat prévu n'est plus reproposé", (await dialog.getByTestId("discover-idea").filter({ hasText: first }).count()) === 0);
  await dialog.getByTestId("discover-idea").first().getByRole("button", { name: /Prévoir ce soir/ }).click();
  check("demande avant de remplacer le plat de ce soir", await visible(dialog.getByText("Remplacer le plat prévu ?")));
  await page.screenshot({ path: `${SHOTS}/decouvrir-remplacer.png` });
  await dialog.getByRole("button", { name: /^Garder/ }).click();

  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} vérifications OK`);
  process.exit(failed ? 1 : 0);
})();
