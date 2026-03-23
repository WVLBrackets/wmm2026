'use client';

import { useState, useEffect } from 'react';

/** `true` when viewport is Tailwind `lg` (min-width: 1024px). SSR-safe initial `false`. */
export function useIsLgUp(): boolean {
  const [isLgUp, setIsLgUp] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsLgUp(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isLgUp;
}
