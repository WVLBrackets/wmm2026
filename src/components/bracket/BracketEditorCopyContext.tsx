"use client";

import { createContext, useContext } from "react";
import type { VintageBracketEditorContent } from "@/lib/vintage/bracketEditorContent";

const BracketEditorCopyContext = createContext<VintageBracketEditorContent | null>(null);

/**
 * Provides published Bracket Editor Messages CMS copy to editor chrome.
 */
export function BracketEditorCopyProvider({
  copy,
  children,
}: {
  copy: VintageBracketEditorContent;
  children: React.ReactNode;
}) {
  return (
    <BracketEditorCopyContext.Provider value={copy}>{children}</BracketEditorCopyContext.Provider>
  );
}

/**
 * Bracket Editor Messages CMS copy. Throws outside a provider so missing wiring
 * fails loudly instead of rendering literal fallbacks.
 */
export function useBracketEditorCopy(): VintageBracketEditorContent {
  const copy = useContext(BracketEditorCopyContext);
  if (!copy) {
    throw new Error("useBracketEditorCopy must be used inside BracketEditorCopyProvider");
  }
  return copy;
}
