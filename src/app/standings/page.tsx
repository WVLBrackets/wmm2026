import StandingsTable from '@/components/StandingsTable';

export default function StandingsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <StandingsTable />
      </div>
    </div>
  );
}
