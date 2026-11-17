"use client";

import { useStore } from "@/lib/store";

export function StorageBanner() {
  const { storageError, dismissStorageError } = useStore();
  if (!storageError) return null;
  return (
    <div role="alert" className="sticky top-0 z-50 flex items-start gap-3 bg-warm-100 px-4 py-3 text-sm text-warm-600">
      <span className="flex-1">{storageError}</span>
      <button type="button" onClick={dismissStorageError} className="font-semibold underline">OK</button>
    </div>
  );
}
