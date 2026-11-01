"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import type { VintageToolbarItem } from "@/lib/vintage/content";

type VintageToolbarSessionValue = {
  /** Locked CMS toolbar slots for this browser session (null until first persist). */
  sessionItems: VintageToolbarItem[] | null;
  /**
   * Persist toolbar items once for the session.
   * Loading shells should pass `persist={false}` so DEFAULT chrome cannot lock first.
   */
  registerItems: (items: VintageToolbarItem[]) => void;
  viewerIsAdmin: boolean;
  /** True after the first admin check for the current auth status completes. */
  adminCheckReady: boolean;
};

const VintageToolbarSessionContext =
  createContext<VintageToolbarSessionValue | null>(null);

/**
 * Session-scoped vintage toolbar: CMS slots lock after first real page paint;
 * ops-admin visibility refreshes only on login/logout (not on every soft nav).
 */
export function VintageToolbarSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { status } = useSession();
  const [sessionItems, setSessionItems] = useState<VintageToolbarItem[] | null>(
    null,
  );
  const [viewerIsAdmin, setViewerIsAdmin] = useState(false);
  const [adminCheckReady, setAdminCheckReady] = useState(false);
  const lastAuthStatus = useRef<string | null>(null);

  const registerItems = useCallback((items: VintageToolbarItem[]) => {
    setSessionItems((prev) => (prev == null ? items : prev));
  }, []);

  useEffect(() => {
    if (status === "loading") return;

    const previous = lastAuthStatus.current;
    const authChanged = previous !== null && previous !== status;
    lastAuthStatus.current = status;

    // Login/logout: allow the next real page to re-lock CMS toolbar if needed.
    if (authChanged) {
      setSessionItems(null);
    }

    if (status === "unauthenticated") {
      setViewerIsAdmin(false);
      setAdminCheckReady(true);
      return;
    }

    let cancelled = false;
    // First check of this auth state: hide admin-only until ready.
    // Auth change: keep prior visibility until the new check returns (no flicker).
    if (!authChanged) {
      setAdminCheckReady(false);
    }

    /**
     * Resolve ops-admin status for admin-only toolbar slots.
     */
    async function loadAdminStatus() {
      try {
        const response = await fetch("/api/check-admin", { cache: "no-store" });
        if (!response.ok) {
          if (!cancelled) {
            setViewerIsAdmin(false);
            setAdminCheckReady(true);
          }
          return;
        }
        const data = (await response.json()) as { isAdmin?: boolean };
        if (!cancelled) {
          setViewerIsAdmin(Boolean(data.isAdmin));
          setAdminCheckReady(true);
        }
      } catch {
        if (!cancelled) {
          setViewerIsAdmin(false);
          setAdminCheckReady(true);
        }
      }
    }

    void loadAdminStatus();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const value = useMemo(
    () => ({
      sessionItems,
      registerItems,
      viewerIsAdmin,
      adminCheckReady,
    }),
    [sessionItems, registerItems, viewerIsAdmin, adminCheckReady],
  );

  return (
    <VintageToolbarSessionContext.Provider value={value}>
      {children}
    </VintageToolbarSessionContext.Provider>
  );
}

/**
 * Session toolbar cache. Falls back to a no-op local mode if provider is missing.
 */
export function useVintageToolbarSession(): VintageToolbarSessionValue {
  const ctx = useContext(VintageToolbarSessionContext);
  if (ctx) return ctx;

  return {
    sessionItems: null,
    registerItems: () => {},
    viewerIsAdmin: false,
    adminCheckReady: true,
  };
}
