// Génère out/sw.js après `next build` : met en cache toutes les pages et ressources
// pour que l'application fonctionne entièrement hors connexion.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const OUT = "out";
const BASE = process.env.BASE_PATH || "";
const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
})(OUT);

const urls = files
  .map((p) => "/" + relative(OUT, p).split(sep).join("/"))
  .filter((u) => u !== "/sw.js" && !u.endsWith(".txt") && !u.endsWith(".map"))
  // Recettes importées (plusieurs centaines) : mises en cache à la première visite, pas à l'installation,
  // sinon chaque mise à jour retéléchargerait ~25 Mo sur le téléphone.
  .filter((u) => !u.startsWith("/recettes/imp-"))
  .map((u) => u.replace(/index\.html$/, ""))
  // Next demande ces fichiers avec les crochets encodés ([id] -> %5Bid%5D).
  .map((u) => BASE + u)
  .map((u) => u.replace(/\[/g, "%5B").replace(/\]/g, "%5D"));

const hash = createHash("sha256");
for (const p of files) hash.update(readFileSync(p));
const version = hash.digest("hex").slice(0, 12);

const sw = `// Généré automatiquement par scripts/gen-sw.mjs — ne pas modifier.
const CACHE = "app-${version}";
const PRECACHE = ${JSON.stringify(urls)};

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  const url = new URL(req.url);
  // Les pages : réseau d'abord (pour les mises à jour), cache si hors connexion.
  if (req.mode === "navigate") {
    e.respondWith(
      // no-cache : on redemande toujours la page au serveur (GitHub garde sinon l'ancienne 10 minutes).
      fetch(new Request(req, { cache: "no-cache" }))
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
        .catch(async () => (await caches.match(req, { ignoreSearch: true }))
          ?? (await caches.match(url.pathname.endsWith("/") ? url.pathname : url.pathname + "/"))
          ?? (await caches.match("${BASE}/"))),
    );
    return;
  }
  // Ressources (JS, CSS, images) : cache d'abord.
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit ?? fetch(req)));
});
`;
writeFileSync(join(OUT, "sw.js"), sw);
console.log(`sw.js généré : ${urls.length} fichiers en cache (version ${version})`);
