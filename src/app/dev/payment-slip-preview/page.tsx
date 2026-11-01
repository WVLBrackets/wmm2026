import { notFound } from "next/navigation";
import PaymentSlipPreviewClient from "./PaymentSlipPreviewClient";

export const dynamic = "force-dynamic";

/**
 * Local-only visual fixture for the Payment Slip modal.
 * Does not call payment APIs or open real Venmo links from Confirm.
 */
export default function PaymentSlipPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <PaymentSlipPreviewClient />;
}
