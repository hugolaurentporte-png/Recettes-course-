"use client";

import { useEffect, useState } from "react";

export type WakeLockState = "on" | "unsupported" | "off";

interface Sentinel { released: boolean; release(): Promise<void>; addEventListener(t: "release", f: () => void): void }
interface WakeLockApi { request(type: "screen"): Promise<Sentinel> }

/**
 * Garde l'écran allumé tant que `active` est vrai (API Wake Lock, iPhone avec iOS 16.4 ou plus récent).
 * Le verrou tombe quand on quitte l'appli : on le reprend au retour.
 */
export function useWakeLock(active: boolean): WakeLockState {
  const [state, setState] = useState<WakeLockState>("off");

  useEffect(() => {
    if (!active) return;
    const api = (navigator as Navigator & { wakeLock?: WakeLockApi }).wakeLock;
    if (!api) {
      setState("unsupported");
      return;
    }
    let sentinel: Sentinel | null = null;
    let stopped = false;

    async function acquire() {
      if (stopped || document.visibilityState !== "visible" || (sentinel && !sentinel.released)) return;
      try {
        const s = await api!.request("screen");
        if (stopped) {
          void s.release();
          return;
        }
        sentinel = s;
        setState("on");
        s.addEventListener("release", () => {
          if (!stopped) setState("off");
        });
      } catch {
        setState("off");
      }
    }

    const onVisible = () => void acquire();
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (sentinel && !sentinel.released) void sentinel.release();
      setState("off");
    };
  }, [active]);

  return state;
}
