import StandingsShell from '@/components/StandingsShell';
import { PageLogger } from '@/components/PageLogger';

export default function LiveStandingsPage() {
  return (
    <>
      <PageLogger location="Live Standings" />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <StandingsShell />
        </div>
      </div>
    </>
  );
}
