// Test du mode cuisine et des portions sur la fiche recette.
// Usage : npm run build && (servir out/ sur le port 4173) && node e2e/mode-cuisine.cjs
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
  // Faux Wake Lock (comme sur iPhone) et horloge accélérée pour les minuteurs.
  await context.addInitScript(() => {
    window.__wake = { requests: 0, released: 0 };
    Object.defineProperty(navigator, "wakeLock", {
      value: {
        request: async () => {
          window.__wake.requests++;
          const listeners = [];
          return { released: false, addEventListener: (_t, f) => listeners.push(f),
            release: async function () { this.released = true; window.__wake.released++; listeners.forEach((f) => f()); } };
        },
      },
    });
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/`);
  const skip = page.getByRole("button", { name: "Passer" });
  if (await visible(skip, 3000)) await skip.click();

  // ---- Portions ----
  await page.goto(`${BASE}/recettes/tm-risotto-champignons/`);
  await page.getByRole("heading", { name: /Risotto/ }).waitFor();
  const step4 = page.locator("ol li").nth(3);
  check("étape d'origine : 850 ml d'eau", (await step4.textContent()).includes("850 ml d'eau"));
  await page.getByRole("button", { name: "Moins de portions" }).click();
  await page.getByRole("button", { name: "Moins de portions" }).click();
  check("2 pers. : riz 150 g", await visible(page.getByText(/^150 g\s*Riz/)));
  check("2 pers. : ½ oignon", await visible(page.getByText(/^½\s*Oignon/)));
  check("2 pers. : l'eau de l'étape passe à 425 ml", (await step4.textContent()).includes("425 ml d'eau"));
  check("2 pers. : la cuisson reste à 16 min", (await step4.textContent()).includes("16 min"));
  check("encadré « quantités recalculées »", await visible(page.getByText(/Quantités recalculées pour/)));
  await page.screenshot({ path: `${SHOTS}/mc-1-portions-2.png`, fullPage: true });
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Plus de portions" }).click();
  check("6 pers. : avertissement bol du Thermomix", await visible(page.getByText(/repère maximal du bol/)));
  check("6 pers. : eau à 1,3 l", (await step4.textContent()).includes("1,3 l d'eau"));
  await page.getByRole("button", { name: /Revenir à 4 pers/ }).click();
  check("retour à 4 pers.", (await step4.textContent()).includes("850 ml d'eau"));

  // ---- Mode cuisine ----
  await page.getByRole("button", { name: "Plus de portions" }).click(); // 5 pers.
  await page.getByRole("button", { name: /Mode cuisine/ }).click();
  const dialog = page.getByRole("dialog", { name: /Mode cuisine/ });
  check("le mode cuisine s'ouvre", await visible(dialog));
  check("étape 1 sur 5", await visible(dialog.getByText("Étape 1 sur 5")));
  check("l'écran reste allumé (Wake Lock demandé)", (await page.evaluate(() => window.__wake.requests)) >= 1);
  check("message écran allumé", await visible(dialog.getByText(/L'écran reste allumé/)));
  await page.screenshot({ path: `${SHOTS}/mc-2-etape1.png` });
  await dialog.getByRole("button", { name: /Suivante/ }).click();
  check("étape 2 : minuteur de 3 min proposé", await visible(dialog.getByRole("button", { name: "⏱ Minuteur 3 min" })));
  await dialog.getByRole("button", { name: /Suivante/ }).click();
  await dialog.getByRole("button", { name: /Suivante/ }).click();
  check("étape 4 : eau recalculée pour 5 pers. (1,05 l)", await visible(dialog.getByText("1,05 l")));
  await dialog.getByRole("button", { name: "⏱ Minuteur 16 min" }).click();
  check("le minuteur tourne", await visible(dialog.getByText(/^1[56]:\d\d$/)));
  await page.screenshot({ path: `${SHOTS}/mc-3-minuteur.png` });
  // On avance l'horloge du minuteur : il doit sonner.
  await page.clock?.install?.().catch(() => {});
  await page.evaluate(() => { const real = Date.now; const t0 = real(); Date.now = () => t0 + 16 * 60 * 1000 + (real() - t0); });
  check("le minuteur sonne à la fin", await visible(dialog.getByText("⏰ C'est l'heure"), 5000));
  await page.screenshot({ path: `${SHOTS}/mc-4-sonnerie.png` });
  await dialog.getByRole("button", { name: /Arrêter le minuteur/ }).click();
  check("on arrête la sonnerie", !(await visible(dialog.getByText("⏰ C'est l'heure"), 1500)));

  await dialog.getByRole("button", { name: "Ingrédients" }).click();
  check("ingrédients pour 5 pers.", await visible(dialog.getByText("Ingrédients pour 5 pers.")));
  check("riz 375 g", await visible(dialog.getByText("375 g")));
  await page.screenshot({ path: `${SHOTS}/mc-5-ingredients.png` });
  await dialog.getByRole("button", { name: /Revenir à l'étape 4/ }).click();
  await dialog.getByRole("button", { name: /Suivante/ }).click();
  await dialog.getByRole("button", { name: /C'est prêt/ }).click();
  check("à la fin, le mode cuisine se ferme", !(await visible(dialog, 1500)));
  check("et l'écran peut se remettre en veille", (await page.evaluate(() => window.__wake.released)) >= 1);
  const cooked = page.getByRole("dialog", { name: "Tu as fini quelque chose ?" });
  const toast = page.getByText("Aucun ingrédient de cette recette n'était dans Mon frigo");
  await page.screenshot({ path: `${SHOTS}/mc-6-fin.png` });
  check("puis « J'ai cuisiné » prend le relais", await visible(cooked.or(toast), 3000));

  // Quitter avec un minuteur en cours demande confirmation.
  await page.goto(`${BASE}/recettes/tm-risotto-champignons/`);
  await page.getByRole("button", { name: /Mode cuisine/ }).click();
  await dialog.getByRole("button", { name: /Suivante/ }).click();
  await dialog.getByRole("button", { name: "⏱ Minuteur 3 min" }).click();
  await dialog.getByRole("button", { name: "Quitter le mode cuisine" }).click();
  check("quitter avec un minuteur demande confirmation", await visible(dialog.getByText(/Un minuteur tourne encore/)));
  await dialog.getByRole("button", { name: "Quitter", exact: true }).click();
  check("puis se ferme", !(await visible(dialog, 1500)));

  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} vérifications réussies`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
