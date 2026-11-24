// « J'ai » sur un ingrédient manquant de la fiche recette : il entre au frigo et ne part pas dans les courses.
// Usage : npm run build && (servir out/ sur le port 4173) && node e2e/j-ai-deja.cjs
const { chromium, devices } = require("playwright");
const { mkdirSync } = require("node:fs");

const BASE = process.env.BASE_URL ?? "http://localhost:4173";
const SHOTS = process.env.SHOTS ?? "e2e/screens";
mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}
const visible = (loc, timeout = 10000) => loc.first().waitFor({ timeout }).then(() => true, () => false);

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices["iPhone 13"], locale: "fr-FR", serviceWorkers: "block" });
  const page = await context.newPage();
  await page.goto(`${BASE}/`);
  const skip = page.getByRole("button", { name: "Passer" });
  if (await visible(skip, 3000)) await skip.click();

  await page.goto(`${BASE}/recettes/tm-risotto-champignons/`);
  await page.getByRole("heading", { name: /Risotto/ }).waitFor();
  const riz = page.getByRole("button", { name: "J'ai déjà : Riz arborio" });
  check("bouton « J'ai » sur le riz manquant", await visible(riz));
  await page.screenshot({ path: `${SHOTS}/j-ai-avant.png` });
  await riz.click();
  check("message « Riz ajouté à Mon frigo »", await visible(page.getByText("Riz arborio ajouté à Mon frigo")));
  check("le riz est maintenant disponible", !(await visible(page.getByRole("button", { name: "J'ai déjà : Riz arborio" }), 1500)));
  await page.screenshot({ path: `${SHOTS}/j-ai-apres.png` });

  // Annuler puis refaire
  await page.getByRole("button", { name: "Annuler" }).click();
  check("Annuler remet le riz en manquant", await visible(page.getByRole("button", { name: "J'ai déjà : Riz arborio" })));
  await page.getByRole("button", { name: "J'ai déjà : Riz arborio" }).click();
  await page.waitForTimeout(500);

  await page.getByRole("button", { name: /Ajouter ce qu.il manque aux courses/ }).click();
  await page.goto(`${BASE}/courses/`);
  await page.waitForTimeout(800);
  const text = await page.locator("main").textContent();
  check("les courses ont d'autres ingrédients de la recette", /Champignon/i.test(text));
  check("le riz n'est pas dans les courses", !/Riz arborio/.test(text));

  await page.goto(`${BASE}/frigo/`);
  check("le riz est dans Mon frigo", await visible(page.getByText(/Riz arborio/)));

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications OK`);
  process.exit(failed.length ? 1 : 0);
})();
