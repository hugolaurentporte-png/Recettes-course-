"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import type { HouseholdMember } from "@/lib/sync/docs";
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
  const [name, setName] = useState("");
  const [members, setMembers] = useState<HouseholdMember[] | null>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (isHouseholdCode(code)) setInvite(code);
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const household = store.household;
  const { householdMembers, syncStatus, fridgeShared } = store;
  useEffect(() => {
    if (!household || !fridgeShared) return;
    householdMembers().then(setMembers, () => {});
  }, [household, fridgeShared, householdMembers, syncStatus.lastSync]);

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
          title: "Notre foyer : courses et frigo",
          text: `Rejoins notre foyer (liste de courses et frigo). Si tu utilises l'appli installée sur l'écran d'accueil, ouvre-la, va dans Courses › 👥 Partager et colle ce code : ${household}\n\nSinon, ouvre ce lien :`,
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
        <h1 className="text-2xl font-bold">Foyer partagé</h1>
      </header>

      {pendingInvite ? (
        <section className="card space-y-4 p-5">
          <p className="text-lg font-semibold">On vous invite à rejoindre un foyer 👥</p>
          <p className="text-sm text-stone-600">
            Vous verrez la même liste de courses et le même frigo sur vos deux téléphones.
            Ce que vous avez déjà saisi est conservé et ajouté au foyer.
            {household && " Ce téléphone quittera le foyer actuel."}
          </p>
          <label className="block">
            <span className="text-sm font-semibold">Votre prénom <span className="font-normal text-stone-500">(facultatif)</span></span>
            <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} maxLength={40}
              placeholder="Pour savoir qui est dans le foyer" autoComplete="given-name" />
          </label>
          <button type="button" className="btn-primary w-full" disabled={busy}
            onClick={() => void run(async () => {
              await store.startSharing(pendingInvite, { fridge: true, name });
              setInvite(null);
              window.history.replaceState(null, "", `${BASE}/partage/`);
            }, "Foyer rejoint")}>
            {busy ? "Connexion…" : "Rejoindre le foyer"}
          </button>
          <button type="button" className="btn-secondary w-full" onClick={() => setInvite(null)}>Non merci</button>
        </section>
      ) : household ? (
        <section className="space-y-4">
          <div className="card p-5">
            <p className="text-lg font-semibold">
              ✅ {fridgeShared ? "Votre liste de courses et votre frigo sont partagés" : "Votre liste de courses est partagée"}
            </p>
            <p className="mt-1 text-sm text-stone-600">
              Ce que chacun ajoute, modifie ou retire apparaît sur l'autre téléphone en quelques secondes.
              Sans réseau, tout marche quand même : les changements partent au retour de la connexion.
            </p>
            {members && members.length > 0 && (
              <p className="mt-3 text-sm">
                <span className="font-semibold">Dans le foyer : </span>
                {members.map((m, i) => `${m.nom || `Téléphone ${i + 1}`}${m.moi ? " (ce téléphone)" : ""}`).join(", ")}
              </p>
            )}
            <p className={`mt-3 text-sm ${store.syncStatus.failing ? "font-semibold text-warm-700" : "text-stone-500"}`}>
              {store.syncStatus.failing
                ? "Pas de connexion pour l'instant : les changements partiront plus tard."
                : `Dernière mise à jour : ${since(store.syncStatus.lastSync, now)}`}
            </p>
            {store.syncStatus.planFailing && !store.syncStatus.failing && (
              <p className="mt-2 text-sm text-warm-600">Le planning n&apos;est pas encore partagé : il reste sur ce téléphone pour l&apos;instant.</p>
            )}
          </div>
          {!fridgeShared && (
            <button type="button" className="btn-primary w-full" disabled={busy}
              onClick={() => void run(() => store.shareFridge(), "Frigo partagé avec le foyer")}>
              Partager aussi mon frigo
            </button>
          )}
          <button type="button" className={fridgeShared ? "btn-primary w-full" : "btn-secondary w-full"} onClick={() => void share()}>Envoyer le lien à mon/ma partenaire</button>
          <button type="button" className="btn-secondary w-full" disabled={busy} onClick={() => void run(() => store.syncNow(), "Tout est à jour")}>
            Mettre à jour maintenant
          </button>
          <div className="card p-4">
            <p className="text-xs text-stone-500">Code du foyer (si l'appli est installée sur l'écran d'accueil)</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 select-all break-all text-sm font-semibold">{household}</code>
              <button type="button" className="btn-secondary h-10 min-h-0 px-3 text-sm"
                onClick={() => void navigator.clipboard?.writeText(household).then(() => toast("Code copié"), () => {})}>Copier</button>
            </div>
          </div>
          <p className="px-1 text-xs text-stone-500">
            Le lien et le code permettent de rejoindre le foyer : ne les envoyez qu'aux personnes qui vivent avec vous.
            {fridgeShared ? " Le planning des repas est partagé aussi ; le budget reste sur chaque téléphone." : " Le planning des repas est partagé aussi ; le frigo et le budget restent sur chaque téléphone."}
          </p>
          <button type="button" className="w-full py-3 text-sm font-semibold text-red-700"
            onClick={() => void run(() => store.stopSharing(), "Ce téléphone a quitté le foyer")}>
            Arrêter le partage sur ce téléphone
          </button>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="card p-5">
            <p className="text-lg font-semibold">Faites les courses à deux 👥</p>
            <p className="mt-1 text-sm text-stone-600">
              Créez votre foyer : la liste de courses et le frigo sont les mêmes sur vos deux téléphones.
              Quand l'un ajoute des œufs ou cuisine les dernières pommes de terre, l'autre le voit.
            </p>
          </div>
          <label className="block px-1">
            <span className="text-sm font-semibold">Votre prénom <span className="font-normal text-stone-500">(facultatif)</span></span>
            <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} maxLength={40}
              placeholder="Pour savoir qui est dans le foyer" autoComplete="given-name" />
          </label>
          <button type="button" className="btn-primary w-full" disabled={busy}
            onClick={() => void run(async () => { await store.startSharing(undefined, { fridge: true, name }); }, "Foyer créé : envoyez le lien")}>
            {busy ? "Création…" : "Créer mon foyer"}
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
