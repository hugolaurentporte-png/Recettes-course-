"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface ToastData {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

const ToastContext = createContext<(message: string, action?: ToastData["action"], durationMs?: number) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, action?: ToastData["action"], durationMs?: number) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, action });
    timer.current = setTimeout(() => setToast(null), durationMs ?? (action ? 5000 : 2500));
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
        {toast && (
          <div key={toast.id} role="status"
            className="pointer-events-auto flex max-w-md items-center gap-4 rounded-2xl bg-stone-900 px-4 py-3 text-sm text-white shadow-lg">
            <span>{toast.message}</span>
            {toast.action && (
              <button type="button" className="font-semibold text-brand-100 underline"
                onClick={() => { toast.action?.run(); setToast(null); }}>
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
