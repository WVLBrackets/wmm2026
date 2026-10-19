import { Calendar, Crown, Medal, Shield, Star, Trophy, Users } from "lucide-react";
import TeamLogo from "@/app/hall-of-fame/TeamLogo";
import type { HofViewModel } from "@/lib/hallOfFameStats";
import { formatHofDollars } from "@/lib/hallOfFameStats";

/**
 * Legacy (non-vintage) Hall of Fame body. Uses sheet-derived view model only.
 */
export default function LegacyHallOfFamePage({
  model,
}: {
  model: HofViewModel;
}) {
  const {
    reigningChampion,
    lifetime,
    seasons,
    careerLeaders,
    singleSeasonLeaders,
  } = model;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg shadow-lg p-6 mb-8">
          <div className="flex items-center text-white">
            <Crown className="h-16 w-16 mr-4 flex-shrink-0" />
            <div>
              <h2 className="text-2xl font-bold mb-1">Reigning Champion</h2>
              <p className="text-3xl font-bold">
                {reigningChampion?.name || "—"}
              </p>
              {reigningChampion ? (
                <p className="text-sm mt-1 opacity-90">
                  {[
                    reigningChampion.year,
                    reigningChampion.points != null
                      ? `${reigningChampion.points} pts`
                      : null,
                    reigningChampion.entryCount != null
                      ? `${reigningChampion.entryCount} entries`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="flex items-center mb-6">
            <Users className="h-8 w-8 text-blue-600 mr-3" />
            <h2 className="text-2xl font-bold text-gray-900">
              Tournament Statistics
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <h3 className="text-2xl font-bold text-blue-600 mb-1">
                {lifetime.tournamentsCompleted}
              </h3>
              <p className="text-sm text-gray-600">Tournaments Completed</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <h3 className="text-2xl font-bold text-green-600 mb-1">
                {lifetime.uniqueMoneyWinners}
              </h3>
              <p className="text-sm text-gray-600">Unique Money Winners</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <h3 className="text-2xl font-bold text-purple-600 mb-1">
                {lifetime.totalEntries != null
                  ? lifetime.totalEntries.toLocaleString()
                  : "—"}
              </h3>
              <p className="text-sm text-gray-600">Total Entries</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <h3 className="text-2xl font-bold text-yellow-600 mb-1">
                {lifetime.totalPrizeDollars != null
                  ? formatHofDollars(lifetime.totalPrizeDollars)
                  : "—"}
              </h3>
              <p className="text-sm text-gray-600">Total Prize Dollars</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="flex items-center mb-6">
            <Calendar className="h-8 w-8 text-blue-600 mr-3" />
            <h2 className="text-2xl font-bold text-gray-900">
              Tournament History
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {seasons.map((season) => {
              const isSpecial = season.kind !== "normal";
              return (
                <div
                  key={season.year}
                  className={`relative rounded-lg border-l-4 ${
                    isSpecial
                      ? "bg-gray-100 border-gray-400"
                      : "bg-yellow-50 border-yellow-500"
                  }`}
                >
                  <div
                    className={`absolute left-2 top-2 px-2 py-1 rounded text-xs font-bold ${
                      isSpecial
                        ? "bg-gray-500 text-white"
                        : "bg-yellow-600 text-white"
                    }`}
                  >
                    {season.kind === "cancelled2020"
                      ? `${season.year} - Tournament Cancelled`
                      : season.kind === "hiatus2016"
                        ? `${season.year} - WMM Hiatus`
                        : season.kind === "hiatus"
                          ? `${season.year} - Tournament Not Held`
                          : season.entryCount == null
                            ? `${season.year} - unknown`
                            : `${season.year} - ${season.entryCount} entries`}
                  </div>
                  <div className="absolute top-4 right-4 w-12 h-12 flex items-center justify-center">
                    {season.kind === "cancelled2020" ||
                    season.kind === "hiatus" ? (
                      <div className="w-12 h-12 rounded-full flex items-center justify-center bg-red-500">
                        <Shield className="h-6 w-6 text-white" />
                      </div>
                    ) : season.ncaaChampionTeam ? (
                      <TeamLogo teamName={season.ncaaChampionTeam} size={48} />
                    ) : null}
                  </div>
                  <div className="p-4 pl-6 pt-10">
                    {season.kind === "cancelled2020" ? (
                      <div className="flex items-center gap-3">
                        <Shield className="h-5 w-5 text-red-500" />
                        <span className="font-medium text-gray-700">
                          Global Pandemic
                        </span>
                      </div>
                    ) : season.kind === "hiatus2016" ? (
                      <p className="text-sm text-gray-600">WMM Hiatus</p>
                    ) : season.kind === "hiatus" ? (
                      <p className="text-gray-500 font-medium italic">
                        Tournament Not Held
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {season.finishers.map((finisher) => (
                          <div
                            key={`${season.year}-${finisher.place}`}
                            className="flex items-center gap-3"
                          >
                            {finisher.place === 1 ? (
                              <Crown className="h-5 w-5 text-yellow-600" />
                            ) : finisher.place === 2 ? (
                              <Trophy className="h-5 w-5 text-gray-400" />
                            ) : (
                              <Medal className="h-5 w-5 text-amber-600" />
                            )}
                            <span className="font-medium text-gray-700">
                              {finisher.name}
                              {finisher.points > 0
                                ? ` - ${finisher.points}`
                                : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="text-center mb-8">
            <Trophy className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-gray-900">All Time Leaders</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-6 border border-yellow-200">
              <div className="text-center mb-6">
                <Crown className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                <h3 className="text-lg font-bold text-gray-900">Career</h3>
                <p className="text-sm text-gray-600">
                  Top 25 highest total money winners
                </p>
              </div>
              <div className="space-y-2">
                {careerLeaders.map((finisher, index) => (
                  <div
                    key={`career-${finisher.name}`}
                    className="rounded-lg p-3 border-l-4 bg-white border-yellow-500 min-h-[60px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-yellow-500 text-white">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-gray-900 truncate">
                            {finisher.name}
                          </h4>
                          <p className="text-xs text-gray-600">
                            {finisher.finishes
                              .slice(0, 5)
                              .map((f) => f.year)
                              .join(" · ")}
                            {finisher.finishes.length > 5
                              ? ` +${finisher.finishes.length - 5} more`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <span className="text-lg font-bold text-yellow-700 whitespace-nowrap">
                        {formatHofDollars(finisher.totalWinnings)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
              <div className="text-center mb-6">
                <Star className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <h3 className="text-lg font-bold text-gray-900">
                  Single Season
                </h3>
                <p className="text-sm text-gray-600">
                  Top 25 highest point totals in any single year
                </p>
              </div>
              <div className="space-y-2">
                {singleSeasonLeaders.map((record, index) => (
                  <div
                    key={`season-${record.name}-${record.year}-${record.place}`}
                    className="rounded-lg p-3 border-l-4 bg-white border-blue-500 min-h-[60px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-blue-500 text-white">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {record.name}
                          </p>
                          <p className="text-xs text-gray-600">{record.year}</p>
                        </div>
                      </div>
                      <span className="text-lg font-bold text-blue-600 whitespace-nowrap">
                        {record.points} pts
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
