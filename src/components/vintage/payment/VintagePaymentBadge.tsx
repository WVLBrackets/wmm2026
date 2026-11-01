import type { VintagePaymentBadgeStyle } from "@/lib/vintage/picksContent";
import "./paymentBadge.css";

export type PaymentBadgeKind = "paid" | "pending" | "unpaid";

/**
 * Resolve Paid / Pending / Unpaid from live `paymentStatus` or legacy `paid` boolean.
 *
 * @param paymentStatus - Bracket payment_status when known
 * @param paid - Legacy standings boolean (sheet / older snapshots)
 */
export function resolvePaymentBadgeKind(
  paymentStatus?: string | null,
  paid?: boolean,
): PaymentBadgeKind {
  const raw = (paymentStatus ?? "").trim().toLowerCase();
  if (raw === "paid" || raw === "pending" || raw === "unpaid") {
    return raw;
  }
  return paid ? "paid" : "unpaid";
}

type VintagePaymentBadgeProps = {
  kind: PaymentBadgeKind;
  /** Caption / icon / colors from My Picks CMS `payment[kind]`. */
  style: VintagePaymentBadgeStyle;
  /** Optional test id override (default `standings-pay-badge-{kind}`). */
  testId?: string;
  className?: string;
};

/**
 * Paid / Pending / Unpaid pill — same treatment as My Picks desktop Progress.
 */
export default function VintagePaymentBadge({
  kind,
  style: badge,
  testId,
  className,
}: VintagePaymentBadgeProps) {
  const showIcon = Boolean(badge.icon.trim());
  return (
    <span
      className={`v-pay-badge v-pay-badge--${kind}${className ? ` ${className}` : ""}`}
      title={badge.caption}
      aria-label={badge.caption}
      data-testid={testId ?? `standings-pay-badge-${kind}`}
    >
      {showIcon ? (
        <span className="v-pay-badge__icon" aria-hidden>
          {badge.icon}
        </span>
      ) : null}
      <span className="v-pay-badge__caption">{badge.caption}</span>
    </span>
  );
}
