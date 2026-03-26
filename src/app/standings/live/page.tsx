import { Fragment } from 'react';
import StandingsShell from '@/components/StandingsShell';
import { PageLogger } from '@/components/PageLogger';
import { getAppEnvironment } from '@/lib/appEnvironment';
import { getSiteConfigFromGoogleSheets } from '@/lib/siteConfig';

function LiveStandingsDisclaimerBanner({ text }: { text: string }) {
  const parts = text.split('||');
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
      data-testid="live-standings-local-disclaimer-banner"
    >
      {body}
    </div>
  );
}

export default async function LiveStandingsPage() {
  const isLocal = getAppEnvironment() === 'local';
  let disclaimerText = '';
  if (isLocal) {
    const config = await getSiteConfigFromGoogleSheets();
    disclaimerText = config?.liveStandingsDisclaimer?.trim() ?? '';
  }

  return (
    <>
      <PageLogger location="Live Standings" />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {disclaimerText ? <LiveStandingsDisclaimerBanner text={disclaimerText} /> : null}
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <StandingsShell />
        </div>
      </div>
    </>
  );
}
