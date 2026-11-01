"use client";

import { useMemo, useState } from "react";
import PaymentModal from "@/components/bracket/PaymentModal";
import {
  getAvailablePaymentMethods,
  normalizePaymentProviderConfig,
  type PaymentMethod,
} from "@/lib/payments/paymentProviders";

type FixtureId = "two" | "one" | "long" | "many" | "none";
type MethodFixture = "both" | "venmo" | "zelle";

const FIXTURES: Record<
  FixtureId,
  { id: string; entryName: string; bracketNumber?: number }[]
> = {
  two: [
    { id: "a1", entryName: "Warren VL - Copy", bracketNumber: 1 },
    { id: "a2", entryName: "Warren VL", bracketNumber: 2 },
  ],
  one: [{ id: "b1", entryName: "Solo Entry", bracketNumber: 1 }],
  long: [
    {
      id: "c1",
      entryName:
        "The Extremely Long Family Reunion Bracket Name That Should Wrap Cleanly Beside The Price",
      bracketNumber: 1,
    },
    { id: "c2", entryName: "Short", bracketNumber: 2 },
  ],
  many: Array.from({ length: 12 }, (_, i) => ({
    id: `m${i + 1}`,
    entryName: `Entry ${i + 1} — Sample Bracket`,
    bracketNumber: i + 1,
  })),
  none: [],
};

/**
 * Client fixture UI — opens PaymentModal with mock unpaid brackets and provider combos.
 * Confirm hits the real API and will fail safely without auth.
 */
export default function PaymentSlipPreviewClient() {
  const [open, setOpen] = useState(true);
  const [fixture, setFixture] = useState<FixtureId>("two");
  const [methodFixture, setMethodFixture] = useState<MethodFixture>("both");
  const unpaid = useMemo(() => FIXTURES[fixture], [fixture]);

  const paymentConfig = useMemo(() => {
    const base = normalizePaymentProviderConfig({
      enablePayCapability: true,
      enableVenmo: methodFixture !== "zelle",
      enableZelle: methodFixture !== "venmo",
      venmoUser: "preview-only-do-not-pay",
      zelleDisplayName: "Warren’s March Madness",
      zelleEmail: "ncaatourney@example.com",
      zellePhone: "",
      zelleQrEnabled: true,
      zelleQrImageSrc: "/images/vintage/zelle-qr-fpo.svg",
    });
    return base;
  }, [methodFixture]);

  const availableMethods = useMemo(
    () => getAvailablePaymentMethods(paymentConfig, true) as PaymentMethod[],
    [paymentConfig],
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: 24,
        fontFamily: "Arial, Helvetica, sans-serif",
        background: "#dcd5c6",
        color: "#152c3a",
      }}
      data-testid="payment-slip-preview"
    >
      <h1 style={{ fontFamily: "Oswald, Impact, sans-serif", letterSpacing: "0.06em" }}>
        Payment Slip preview (dev only)
      </h1>
      <p style={{ maxWidth: 520, lineHeight: 1.45 }}>
        Safe visual fixture. Does not record payments. Use the scenarios below, then open the
        modal. Do not use Confirm Sent against a live session unless you intend to exercise the
        API.
      </p>
      <label style={{ display: "block", marginTop: 16 }}>
        Entries{" "}
        <select
          value={fixture}
          onChange={(e) => {
            setFixture(e.target.value as FixtureId);
            setOpen(true);
          }}
          data-testid="payment-slip-fixture"
        >
          <option value="two">Two entries (mockup-like)</option>
          <option value="one">One entry</option>
          <option value="long">Long entry names</option>
          <option value="many">Long entry list</option>
          <option value="none">No unpaid entries (additional-only)</option>
        </select>
      </label>
      <label style={{ display: "block", marginTop: 12 }}>
        Providers{" "}
        <select
          value={methodFixture}
          onChange={(e) => {
            setMethodFixture(e.target.value as MethodFixture);
            setOpen(true);
          }}
          data-testid="payment-slip-methods"
        >
          <option value="both">Venmo + Zelle</option>
          <option value="venmo">Venmo only</option>
          <option value="zelle">Zelle only</option>
        </select>
      </label>
      <button
        type="button"
        style={{
          marginTop: 12,
          minHeight: 44,
          padding: "10px 16px",
          border: "1px solid #152c3a",
          background: "#152c3a",
          color: "#f2ead8",
          fontFamily: "Oswald, Impact, sans-serif",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
        onClick={() => setOpen(true)}
        data-testid="payment-slip-open"
      >
        Open payment modal
      </button>

      {open ? (
        <PaymentModal
          key={`${fixture}-${methodFixture}`}
          isOpen={open}
          onClose={() => setOpen(false)}
          unpaidBrackets={unpaid}
          entryCost={5}
          paymentConfig={paymentConfig}
          availableMethods={availableMethods}
          onPaymentCreated={() => {
            /* no-op: preview must not treat recording as success */
          }}
        />
      ) : null}
    </main>
  );
}
