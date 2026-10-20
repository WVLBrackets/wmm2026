import { Fragment } from "react";
import { redirect } from "next/navigation";
import StandingsShell from "@/components/StandingsShell";
import LegacySiteChrome from "@/components/LegacySiteChrome";
import { PageLogger } from "@/components/PageLogger";
import { getBuildStamp } from "@/lib/buildStamp";
import { getSiteConfigFromGoogleSheets } from "@/lib/siteConfig";
import { vintageAdminEmail } from "@/lib/vintage/admin";

export const dynamic = "force-dynamic";

function LiveStandingsDisclaimerBanner({ text }: { text: string }) {
  const parts = text.split("||");
  const body =
    parts.length === 1 ? (
      <>{parts[0].trim()}</>
    ) : (
      <>
        {parts.map((part, index) => (
          <Fragment key={index}>
            {part.trim()}
            {index < parts.length - 1 ? <br /> : null}
          </Fragment>
        ))}
      </>
    );

  return (
    <div
      className="w-full bg-red-600 px-4 py-3 text-center text-sm font-medium text-white shadow-md"
      role="status"
      aria-live="polite"
      data-testid="live-standings-disclaimer-banner"
    >
      {body}
    </div>
  );
}

/**
 * Legacy Live Standings route. Primary vintage admin is sent to `/standings`
 * (Live-only vintage page). Everyone else keeps the existing Live shell.
 */
export default async function LiveStandingsPage() {
  if (await vintageAdminEmail()) {
    redirect("/standings");
  }

  const config = await getSiteConfigFromGoogleSheets();
  const disclaimerText = config?.liveStandingsDisclaimer?.trim() ?? "";

  return (
    <LegacySiteChrome buildStamp={getBuildStamp()}>
      <PageLogger location="Live Standings" />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {disclaimerText ? (
          <LiveStandingsDisclaimerBanner text={disclaimerText} />
        ) : null}
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <StandingsShell />
        </div>
      </div>
    </LegacySiteChrome>
  );
}
