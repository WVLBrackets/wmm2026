'use client';

import { useBracketMode } from '@/contexts/BracketModeContext';
import DynamicNavigation from './DynamicNavigation';

export default function NavigationWrapper() {
  const { isInBracketMode, isInPrintMode } = useBracketMode();
  
  return <DynamicNavigation hideInBracketMode={isInBracketMode || isInPrintMode} />;
}
