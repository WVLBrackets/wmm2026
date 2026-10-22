"use client";
import { useEffect, useState } from "react";

const DEFAULT_LIVE = "The tournament is underway!";

/**
 * Tipoff countdown clock. When the target time has passed, shows the live
 * tourney message in place of the timer digits.
 */
export default function VintageCountdown({
  at,
  liveMessage = DEFAULT_LIVE,
}: {
  at: string;
  /** Shown once tipoff has passed (same copy as countdown-off mode). */
  liveMessage?: string;
}) {
  const target = Date.parse(at);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!Number.isFinite(target)) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [target]);
  const configured = Number.isFinite(target);
  const seconds =
    now === null || !configured
      ? null
      : Math.max(0, Math.floor((target - now) / 1000));
  if (seconds === 0) {
    const message = liveMessage.trim() || DEFAULT_LIVE;
    return (
      <p
        className="v-live-tourney-message"
        data-testid="vintage-live-tourney-message"
      >
        {message}
      </p>
    );
  }
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
    <>
      <div
        className="v-countdown"
        role="timer"
        aria-live="off"
        aria-label="Time until tournament tipoff"
        data-testid="vintage-countdown"
      >
        {values.map((n, i) => (
          <div key={i}>
            <strong>
              {typeof n === "number" ? String(n).padStart(2, "0") : n}
            </strong>
            <span>{["Days", "Hours", "Minutes", "Seconds"][i]}</span>
          </div>
        ))}
      </div>
      {!configured && (
        <p className="v-countdown-pending">Tipoff date to be announced</p>
      )}
    </>
  );
}
