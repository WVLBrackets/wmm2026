import { redirect } from "next/navigation";

/**
 * Legacy Live Standings URL — always redirect to canonical `/standings`.
 */
export default function LiveStandingsPage() {
  redirect("/standings");
}
