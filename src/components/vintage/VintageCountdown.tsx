"use client";
import { useEffect, useState } from "react";
export default function VintageCountdown({ at }: { at: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds =
    now === null
      ? null
      : Math.max(0, Math.floor((Date.parse(at) - now) / 1000));
  if (seconds === 0)
    return <p className="v-countdown-started">Let the madness begin.</p>;
  const values =
    seconds === null
      ? ["—", "—", "—", "—"]
      : [
          Math.floor(seconds / 86400),
          Math.floor(seconds / 3600) % 24,
          Math.floor(seconds / 60) % 60,
          seconds % 60,
        ];
  return (
    <div className="v-countdown" aria-label="Time until tournament tipoff">
      {values.map((n, i) => (
        <div key={i}>
          <strong>{String(n).padStart(2, "0")}</strong>
          <span>{["Days", "Hours", "Minutes", "Seconds"][i]}</span>
        </div>
      ))}
    </div>
  );
}
