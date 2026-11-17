// Frigo partagé : deux téléphones, deux membres distincts, vrai SQL (supabase/foyer.sql) sur un Postgres local.
// Les appels de l'appli vers Supabase sont redirigés vers ce Postgres (même règles d'accès qu'en ligne).
//
// Usage :
//   npm run build && (servir out/ sur le port 4173)
//   DATABASE_URL=postgres://postgres@localhost:5432/test node e2e/foyer.cjs
// Base vide conseillée : le script crée les rôles anon/authenticated comme Supabase et charge les scripts SQL.
const { chromium, devices } = require("playwright");
const { readFileSync, mkdirSync } = require("node:fs");
const path = require("node:path");
const { Pool } = require(process.env.PG_MODULE ?? "pg");

const BASE = process.env.BASE_URL ?? "http://localhost:4173";
const SHOTS = process.env.SHOTS ?? "e2e/screens";
const SUPABASE = "https://hevradrkdhfntxqcyrbz.supabase.co";
mkdirSync(SHOTS, { recursive: true });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const SETUP = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
`;

// Fonctions exposées comme par PostgREST : [renvoie une table ?]
const RPC = {
  courses_push: false, courses_pull: true,
  foyer_entrer: false, foyer_quitter: false, foyer_liste_membres: true, foyer_push: false, foyer_pull: true,
};
let calls = 0;

/** Faux PostgREST : POST /rest/v1/rpc/<fonction> exécuté en tant que rôle « anon ». */
async function rpcRoute(route, offline) {
  // Les requêtes interceptées ne voient pas setOffline : on simule nous-mêmes la coupure.
  if (offline()) return route.abort("internetdisconnected");
  const req = route.request();
  const name = new URL(req.url()).pathname.split("/").pop();
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors() });
  if (!(name in RPC)) return route.fulfill({ status: 404, headers: cors(), body: "{}" });
  const args = JSON.parse(req.postData() || "{}");
  const keys = Object.keys(args);
  const params = keys.map((k) => (typeof args[k] === "object" && args[k] !== null ? JSON.stringify(args[k]) : args[k]));
  const call = `${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")})`;
  const sql = RPC[name] ? `select coalesce(json_agg(t), '[]'::json) as r from ${call} t` : `select ${call}`;
  const client = await pool.connect();
  calls++;
  try {
    await client.query("begin");
    await client.query("set local role anon");
    const r = await client.query(sql, params);
    await client.query("commit");
    return route.fulfill({ status: 200, headers: cors(), contentType: "application/json", body: RPC[name] ? JSON.stringify(r.rows[0].r) : "" });
  } catch (e) {
    await client.query("rollback").catch(() => {});
    return route.fulfill({ status: 400, headers: cors(), contentType: "application/json", body: JSON.stringify({ message: e.message }) });
  } finally {
    client.release();
  }
}
const cors = () => ({ "access-control-allow-origin": "*", "access-control-allow-headers": "*" });

async function phone(browser, label) {
  const context = await browser.newContext({ ...devices["iPhone 13"], locale: "fr-FR", serviceWorkers: "block" });
  const state = { offline: false };
  await context.route(`${SUPABASE}/**`, (route) => rpcRoute(route, () => state.offline));
  /** Coupe / rétablit le réseau du téléphone (événements online/offline compris). */
  context.network = async (online) => {
    state.offline = !online;
    await context.setOffline(!online);
  };
  const page = await context.newPage();
  page.on("pageerror", (e) => check(`${label} : aucune erreur JavaScript`, false, e.message));
  await page.goto(`${BASE}/`);
  const skip = page.getByRole("button", { name: "Passer" });
  if (await skip.count()) await skip.click();
  return { context, page };
}

async function addToFridge(page, name, qty, unit) {
  await page.getByLabel("Ajouter un ingrédient").fill(name);
  await page.keyboard.press("Enter");
  if (qty) {
    await page.waitForTimeout(150);
    const row = page.getByRole("button", { name: new RegExp(`^${qty.label}`) }).first();
    await row.click();
    await page.getByLabel("Quantité").fill(String(qty.value));
    await page.getByLabel("Unité").selectOption(unit);
    await page.getByRole("button", { name: "Enregistrer" }).click();
  }
}

/** Attend qu'une condition devienne vraie (synchronisation toutes les 5 s au plus). */
async function eventually(fn, timeout = 15000) {
  const end = Date.now() + timeout;
  for (;;) {
    if (await fn()) return true;
    if (Date.now() > end) return false;
    await new Promise((r) => setTimeout(r, 300));
  }
}

/** Lignes du frigo (le bouton « Retirer … » n'existe que pour un produit présent, pas dans « Ajout rapide »). */
const rowCount = (page, name) => page.getByRole("button", { name: `Retirer ${name}`, exact: true }).count();

(async () => {
  await pool.query(SETUP);
  const dir = path.join(__dirname, "..", "supabase");
  await pool.query(readFileSync(path.join(dir, "partage.sql"), "utf8"));
  await pool.query(readFileSync(path.join(dir, "foyer.sql"), "utf8"));

  const browser = await chromium.launch();
  const A = await phone(browser, "téléphone A");
  const B = await phone(browser, "téléphone B");

  // 1. Chacun a déjà un frigo sur son téléphone, avec une quantité de lait différente.
  await A.page.goto(`${BASE}/frigo/`);
  await addToFridge(A.page, "pomme de terre", { label: "Pommes de terre", value: 2 }, "piece");
  await addToFridge(A.page, "lait", { label: "Lait", value: 1 }, "l");
  await B.page.goto(`${BASE}/frigo/`);
  await addToFridge(B.page, "carotte");
  await addToFridge(B.page, "lait", { label: "Lait", value: 50 }, "cl");

  // 2. A crée le foyer, B le rejoint avec le lien.
  await A.page.goto(`${BASE}/partage/`);
  await A.page.getByLabel(/Votre prénom/).fill("Hugo");
  await A.page.getByRole("button", { name: "Créer mon foyer" }).click();
  await A.page.getByText(/liste de courses et votre frigo sont partagés/).waitFor();
  const code = (await A.page.locator("code").textContent()).trim();
  check("A : foyer créé", /^[a-z0-9]{24}$/.test(code), code);

  await B.page.goto(`${BASE}/partage/?code=${code}`);
  await B.page.getByLabel(/Votre prénom/).fill("Marie");
  await B.page.getByRole("button", { name: "Rejoindre le foyer" }).click();
  await B.page.getByText(/liste de courses et votre frigo sont partagés/).waitFor();
  check("B : membres du foyer affichés", await eventually(async () =>
    (await B.page.getByText(/Hugo, Marie \(ce téléphone\)/).count()) === 1));
  await B.page.screenshot({ path: `${SHOTS}/foyer-1-partage.png` });

  // 3. Fusion : les deux voient tout, le lait est « à vérifier ».
  for (const [label, p] of [["A", A.page], ["B", B.page]]) {
    await p.goto(`${BASE}/frigo/`);
    const ok = await eventually(async () =>
      (await rowCount(p, "Pommes de terre")) === 1 && (await rowCount(p, "Carottes")) === 1 && (await rowCount(p, "Lait")) === 1);
    check(`${label} : les produits des deux téléphones sont conservés`, ok);
    check(`${label} : lait signalé « Quantité à vérifier » (1 l ou 500 ml)`, await eventually(async () =>
      (await p.getByText(/Quantité à vérifier : 1 l ou 500 ml/).count()) === 1));
  }
  await B.page.screenshot({ path: `${SHOTS}/foyer-2-fusion.png`, fullPage: true });

  // B choisit la bonne quantité : A la voit.
  await B.page.getByRole("button", { name: /^Lait/ }).click();
  await B.page.getByRole("button", { name: "500 ml", exact: true }).click();
  check("A : quantité du lait corrigée par B", await eventually(async () =>
    (await A.page.getByText("Quantité à vérifier").count()) === 0 && (await A.page.getByText("500 ml").count()) === 1));

  // 4. B passe hors ligne et ajoute des œufs ; pendant ce temps A retire les dernières pommes de terre.
  await B.context.network(false);
  await addToFridge(B.page, "oeuf", { label: "Œufs", value: 6 }, "piece");
  const cook = A.page.getByRole("button", { name: /J'ai cuisiné/ });
  if (process.env.COOK_RECIPE) {
    // Avec « J'ai cuisiné » (COOK_RECIPE=gratin-pdt-carottes) : on cuisine une recette avec les pommes de terre
    // et on coche « terminé » pour les pommes de terre.
    await A.page.goto(`${BASE}/recettes/${process.env.COOK_RECIPE}/`);
    await cook.first().click();
    await A.page.getByRole("checkbox", { name: /Pommes de terre/ }).check();
    await A.page.getByRole("button", { name: /Retirer les produits terminés/ }).click();
    await A.page.getByRole("link", { name: /Mon frigo/ }).click(); // navigation dans l'appli, sans recharger
  } else {
    await A.page.getByRole("button", { name: "Retirer Pommes de terre" }).click();
  }
  check("A : pommes de terre retirées", await eventually(async () => (await rowCount(A.page, "Pommes de terre")) === 0));
  await A.page.waitForTimeout(6000); // plus qu'un cycle de synchronisation (5 s)
  check("B hors ligne : les œufs sont dans son frigo", (await rowCount(B.page, "Œufs")) === 1);
  check("B hors ligne : il voit encore les pommes de terre (pas de réseau)", (await rowCount(B.page, "Pommes de terre")) === 1);

  // 5. Retour du réseau.
  await B.context.network(true);
  for (const [label, p] of [["A", A.page], ["B", B.page]]) {
    check(`${label} : voit les œufs après la reconnexion`, await eventually(async () => (await rowCount(p, "Œufs")) === 1));
    check(`${label} : les pommes de terre restent retirées`, await eventually(async () => (await rowCount(p, "Pommes de terre")) === 0));
  }
  await B.page.reload();
  check("B : toujours correct après rechargement", await eventually(async () =>
    (await rowCount(B.page, "Œufs")) === 1 && (await rowCount(B.page, "Pommes de terre")) === 0));
  await A.page.screenshot({ path: `${SHOTS}/foyer-3-apres-reconnexion.png`, fullPage: true });

  // 6. « Terminer mes courses » chez A remplit le frigo partagé.
  await A.page.goto(`${BASE}/courses/`);
  await A.page.getByLabel("Ajouter un article").fill("3 courgettes");
  await A.page.keyboard.press("Enter");
  await A.page.getByRole("checkbox", { name: /Cocher Courgettes/ }).click();
  await A.page.getByRole("button", { name: "Terminer mes courses" }).click();
  await A.page.getByRole("button", { name: /^Ranger \d+ article/ }).click();
  await B.page.goto(`${BASE}/frigo/`);
  check("B : les courgettes achetées par A arrivent dans le frigo", await eventually(async () => (await rowCount(B.page, "Courgettes")) === 1));

  // 7. Serveur : un téléphone qui n'est pas membre ne lit rien, même avec le bon nom de foyer.
  const C = await phone(browser, "téléphone C");
  const denied = await C.page.evaluate(async ({ url }) => {
    const r = await fetch(`${url}/rest/v1/rpc/foyer_pull`, {
      method: "POST", headers: { "Content-Type": "application/json", apikey: "x" },
      body: JSON.stringify({ p_membre: "intrus-0000000000000000000000000000000000", p_kind: "frigo", p_since: 0 }),
    });
    return r.status;
  }, { url: SUPABASE });
  check("serveur : un non-membre est refusé", denied === 400, `HTTP ${denied}`);
  const cl = await pool.connect();
  let direct = "lu";
  try {
    await cl.query("set role anon");
    await cl.query("select * from foyer_docs");
  } catch (e) {
    direct = e.message;
  } finally {
    await cl.query("reset role");
    cl.release();
  }
  check("serveur : la table du frigo n'est pas lisible directement", /permission/.test(direct), direct);

  // 8. B quitte le foyer : le serveur ne lui répond plus.
  await B.page.goto(`${BASE}/partage/`);
  await B.page.getByRole("button", { name: /Arrêter le partage/ }).click();
  await B.page.waitForTimeout(500);
  const { rows } = await pool.query("select count(*)::int as n from foyer_membres");
  check("B a quitté le foyer (un seul membre restant)", rows[0].n === 1, `${rows[0].n} membre(s)`);

  console.log(`\n${calls} appels serveur.`);
  await browser.close();
  await pool.end();
  const failed = results.filter((r) => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} vérifications réussies`);
  process.exit(failed.length ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
