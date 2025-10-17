'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface BracketModeContextType {
  isInBracketMode: boolean;
  setInBracketMode: (inBracketMode: boolean) => void;
  isInPrintMode: boolean;
  setInPrintMode: (inPrintMode: boolean) => void;
}

const BracketModeContext = createContext<BracketModeContextType | undefined>(undefined);

export function BracketModeProvider({ children }: { children: ReactNode }) {
  const [isInBracketMode, setIsInBracketMode] = useState(false);
  const [isInPrintMode, setIsInPrintMode] = useState(false);

  return (
    <BracketModeContext.Provider value={{ 
      isInBracketMode, 
      setInBracketMode: setIsInBracketMode,
      isInPrintMode,
      setInPrintMode: setIsInPrintMode
    }}>
      {children}
    </BracketModeContext.Provider>
  );
}

export function useBracketMode() {
  const context = useContext(BracketModeContext);
  if (context === undefined) {
    throw new Error('useBracketMode must be used within a BracketModeProvider');
  }
  return context;
}
