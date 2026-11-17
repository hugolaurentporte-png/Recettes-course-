"use client";

import { useEffect } from "react";

/** Enregistre le service worker (fonctionnement hors connexion) en production uniquement. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/sw.js`).catch((e) => console.warn("Service worker non enregistré", e));
  }, []);
  return null;
}
