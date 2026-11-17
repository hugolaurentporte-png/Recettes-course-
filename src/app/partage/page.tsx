"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { isHouseholdCode } from "@/lib/sync/engine";
import { useToast } from "@/components/Toast";
import { BackIcon } from "@/components/Icons";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function shareLink(code: string) {
  return `${window.location.origin}${BASE}/partage/?code=${code}`;
}

function since(ts: number | null, now: number) {
  if (!ts) return "jamais";
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 10) return "à l'instant";
  if (s < 60) return `il y a ${s} s`;
  return `il y a ${Math.round(s / 60)} min`;
}

export default function PartagePage() {
  const store = useStore();
  const toast = useToast();
  const [invite, setInvite] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (isHouseholdCode(code)) setInvite(code);
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const household = store.household;
  const pendingInvite = invite && invite !== household ? invite : null;

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await fn();
      toast(done);
    } catch {
      toast("Ça n'a pas marché. Vérifiez la connexion internet.");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!household) return;
    const url = shareLink(household);
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Notre liste de courses",
          text: `Rejoins ma liste de courses. Si tu utilises l'appli installée sur l'écran d'accueil, ouvre-la, va dans Courses › 👥 Partager et colle ce code : ${household}\n\nSinon, ouvre ce lien :`,
          url,
        });
        return;
      }
    } catch {
      return; // partage annulé
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Lien copié");
    } catch {
      window.prompt("Copiez ce lien :", url);
    }
  }

  return (
    <div className="px-4 pb-8">
      <header className="sticky top-0 z-20 -mx-4 flex items-center gap-2 bg-[#f7f7f5]/95 px-4 pb-3 pt-4 backdrop-blur">
        <Link href="/courses/" aria-label="Retour aux courses" className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm">
          <BackIcon />
        </Link>
        <h1 className="text-2xl font-bold">Liste partagée</h1>
      </header>

      {pendingInvite ? (
        <section className="card space-y-4 p-5">
          <p className="text-lg font-semibold">On vous invite à partager une liste de courses 👥</p>
          <p className="text-sm text-stone-600">
            Vous verrez la même liste sur vos deux téléphones. Les articles déjà dans votre liste y seront ajoutés.
            {household && " Ce téléphone quittera la liste partagée actuelle."}
          </p>
          <button type="button" className="btn-primary w-full" disabled={busy}
            onClick={() => void run(async () => {
              await store.startSharing(pendingInvite);
              setInvite(null);
              window.history.replaceState(null, "", `${BASE}/partage/`);
            }, "Liste partagée rejointe")}>
            {busy ? "Connexion…" : "Rejoindre la liste"}
          </button>
          <button type="button" className="btn-secondary w-full" onClick={() => setInvite(null)}>Non merci</button>
        </section>
      ) : household ? (
        <section className="space-y-4">
          <div className="card p-5">
            <p className="text-lg font-semibold">✅ Votre liste de courses est partagée</p>
            <p className="mt-1 text-sm text-stone-600">
              Ce que chacun ajoute, coche ou supprime apparaît sur l'autre téléphone en quelques secondes.
              Sans réseau, la liste marche quand même : tout part au retour de la connexion.
            </p>
            <p className={`mt-3 text-sm ${store.syncStatus.failing ? "font-semibold text-warm-700" : "text-stone-500"}`}>
              {store.syncStatus.failing
                ? "Pas de connexion pour l'instant : les changements partiront plus tard."
                : `Dernière mise à jour : ${since(store.syncStatus.lastSync, now)}`}
            </p>
            {store.syncStatus.planFailing && !store.syncStatus.failing && (
              <p className="mt-2 text-sm text-warm-600">Le planning n&apos;est pas encore partagé : il reste sur ce téléphone pour l&apos;instant.</p>
            )}
          </div>
          <button type="button" className="btn-primary w-full" onClick={() => void share()}>Envoyer le lien à mon/ma partenaire</button>
          <button type="button" className="btn-secondary w-full" disabled={busy} onClick={() => void run(() => store.syncNow(), "Liste à jour")}>
            Mettre à jour maintenant
          </button>
          <div className="card p-4">
            <p className="text-xs text-stone-500">Code de la liste (si l'appli est installée sur l'écran d'accueil)</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 select-all break-all text-sm font-semibold">{household}</code>
              <button type="button" className="btn-secondary h-10 min-h-0 px-3 text-sm"
                onClick={() => void navigator.clipboard?.writeText(household).then(() => toast("Code copié"), () => {})}>Copier</button>
            </div>
          </div>
          <p className="px-1 text-xs text-stone-500">
            Le lien et le code donnent accès à la liste : ne les envoyez qu'aux personnes du foyer. Le planning des repas est partagé aussi ; le frigo et le budget restent sur chaque téléphone.
          </p>
          <button type="button" className="w-full py-3 text-sm font-semibold text-red-700"
            onClick={() => void run(() => store.stopSharing(), "Ce téléphone ne partage plus la liste")}>
            Arrêter le partage sur ce téléphone
          </button>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="card p-5">
            <p className="text-lg font-semibold">Faites les courses à deux 👥</p>
            <p className="mt-1 text-sm text-stone-600">
              Partagez votre liste avec votre partenaire : quand l'un pense à un article, l'autre le voit tout de suite sur son téléphone.
            </p>
          </div>
          <button type="button" className="btn-primary w-full" disabled={busy}
            onClick={() => void run(async () => { await store.startSharing(); }, "Liste partagée : envoyez le lien")}>
            {busy ? "Création…" : "Partager ma liste"}
          </button>
          <p className="px-1 text-xs text-stone-500">Ensuite, envoyez le lien par SMS ou WhatsApp. Votre partenaire l'ouvre et touche « Rejoindre ».</p>
          <form className="card space-y-3 p-4" onSubmit={(e) => {
            e.preventDefault();
            const code = typed.trim().toLowerCase().replace(/^.*code=/, "").replace(/[^a-z0-9]/g, "");
            if (isHouseholdCode(code)) setInvite(code);
            else toast("Ce code n'est pas valide");
          }}>
            <label htmlFor="join-code" className="block text-sm font-semibold">On m'a envoyé un code ou un lien</label>
            <input id="join-code" className="input" value={typed} onChange={(e) => setTyped(e.target.value)}
              placeholder="Collez le code ici" autoComplete="off" autoCapitalize="none" />
            <button type="submit" className="btn-secondary w-full" disabled={!typed.trim()}>Continuer</button>
          </form>
        </section>
      )}
    </div>
  );
}
