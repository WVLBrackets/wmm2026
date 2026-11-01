'use client';

import { useEffect, useMemo, useState } from 'react';
import { getCSRFHeaders } from '@/hooks/useCSRF';
import type { ScoreboardGamePatch } from '@/lib/types/scoreboard';
import type {
  PublicScoreboardGame,
  PublicScoreboardPayload,
} from '@/lib/types/publicScoreboard';
import {
  sortFinalGames,
  sortLiveGames,
  sortUpcomingGames,
} from '@/lib/scoreboardSort';
import ScoreboardGameCard from './ScoreboardGameCard';

type ScoreboardEditPanelProps = {
  year: number;
  board: PublicScoreboardPayload;
  availableYears: number[];
  defaultYear: number;
  onUpdated: (board: PublicScoreboardPayload) => void;
  onDefaultYearChange?: (year: number) => void;
  onClose: () => void;
};

/**
 * Diff a draft game against the published board into a ScoreboardGamePatch.
 */
function patchFromDraft(
  original: PublicScoreboardGame | undefined,
  draft: PublicScoreboardGame,
): ScoreboardGamePatch | null {
  const baseline = original || draft;
  const patch: ScoreboardGamePatch = {};
  let changed = false;

  const assign = <K extends keyof ScoreboardGamePatch>(
    key: K,
    next: ScoreboardGamePatch[K],
    prev: unknown,
  ) => {
    if (next !== prev) {
      patch[key] = next;
      changed = true;
    }
  };

  assign('status', draft.status, baseline.status);
  assign('score1', draft.score1, baseline.score1);
  assign('score2', draft.score2, baseline.score2);
  assign('winnerId', draft.winnerId, baseline.winnerId);
  assign('periodLabel', draft.periodLabel, baseline.periodLabel);
  assign('clock', draft.clock, baseline.clock);
  assign('tipoffAt', draft.tipoffAt, baseline.tipoffAt);

  return changed ? patch : null;
}

/**
 * Admin editor: same card layout as public, scores + game state editable in place.
 * One Publish writes everything (no drafts / no per-game Save).
 */
export default function ScoreboardEditPanel({
  year,
  board,
  availableYears,
  defaultYear,
  onUpdated,
  onDefaultYearChange,
  onClose,
}: ScoreboardEditPanelProps) {
  const publishedByKey = useMemo(() => {
    const map = new Map<string, PublicScoreboardGame>();
    for (const g of [...board.live, ...board.upcoming, ...board.completed]) {
      map.set(g.gameKey, g);
    }
    return map;
  }, [board]);

  const [drafts, setDrafts] = useState<PublicScoreboardGame[]>(() =>
    [...board.live, ...board.upcoming, ...board.completed].map((g) => ({
      ...g,
    })),
  );
  const [draftDefaultYear, setDraftDefaultYear] = useState(String(defaultYear));
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setDrafts(
      [...board.live, ...board.upcoming, ...board.completed].map((g) => ({
        ...g,
      })),
    );
  }, [board]);

  useEffect(() => {
    setDraftDefaultYear(String(defaultYear));
  }, [defaultYear]);

  const live = useMemo(
    () => sortLiveGames(drafts.filter((g) => g.status === 'live')),
    [drafts],
  );
  const upcoming = useMemo(
    () => sortUpcomingGames(drafts.filter((g) => g.status === 'scheduled')),
    [drafts],
  );
  const completed = useMemo(
    () => sortFinalGames(drafts.filter((g) => g.status === 'final')),
    [drafts],
  );

  /**
   * Update one draft game in local state.
   */
  function updateDraft(gameKey: string, patch: Partial<PublicScoreboardGame>) {
    setDrafts((prev) =>
      prev.map((g) => (g.gameKey === gameKey ? { ...g, ...patch } : g)),
    );
  }

  /**
   * Publish all local score/status edits in one request.
   */
  async function publish() {
    setPublishing(true);
    setMessage('');
    setError('');
    try {
      const games = drafts
        .map((draft) => {
          const patch = patchFromDraft(publishedByKey.get(draft.gameKey), draft);
          return patch ? { gameKey: draft.gameKey, patch } : null;
        })
        .filter((row): row is { gameKey: string; patch: ScoreboardGamePatch } =>
          Boolean(row),
        );

      const nextDefault = Number(draftDefaultYear);
      const defaultChanged = nextDefault !== defaultYear;

      const res = await fetch('/api/admin/vintage-scoreboard', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(await getCSRFHeaders()),
        },
        body: JSON.stringify({
          year,
          slug: board.page.slug,
          ...(defaultChanged ? { defaultYear: nextDefault } : {}),
          ...(games.length > 0
            ? { games }
            : defaultChanged
              ? {}
              : { rebuild: true }),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Publish failed');
      }
      onUpdated(json.data.board);
      if (
        typeof json.data.defaultYear === 'number' &&
        onDefaultYearChange
      ) {
        onDefaultYearChange(json.data.defaultYear);
      }
      setMessage('Published.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <section
      className="v-scoreboard__edit"
      data-testid="scoreboard-edit-panel"
      aria-label="Scoreboard admin editor"
    >
      <div className="v-scoreboard__edit-publish-bar">
        <div className="v-scoreboard__edit-publish-copy">
          <h3>Edit scoreboard</h3>
          <p>
            Same layout as the public board. Edit scores and game state on each
            card, then Publish. Closing without Publish discards changes.
          </p>
        </div>
        <div className="v-scoreboard__edit-actions">
          <button
            type="button"
            disabled={publishing}
            onClick={() => void publish()}
            data-testid="scoreboard-publish"
          >
            {publishing ? 'Publishing…' : 'Publish'}
          </button>
          <button
            type="button"
            data-variant="secondary"
            disabled={publishing}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>

      {message ? (
        <p role="status" className="v-scoreboard__edit-ok">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="v-scoreboard__edit-err">
          {error}
        </p>
      ) : null}

      <div className="v-scoreboard__edit-settings">
        <label htmlFor="scoreboard-default-year">
          Default scoreboard year
          <select
            id="scoreboard-default-year"
            value={draftDefaultYear}
            onChange={(e) => setDraftDefaultYear(e.target.value)}
            data-testid="scoreboard-default-year"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <p className="v-scoreboard__edit-settings-hint">
          Visitors land on this year when opening Scoreboard with no year in
          the URL. Publish to save.
        </p>
      </div>

      <EditableSection
        id="edit-live"
        title="Live"
        games={live}
        onChange={updateDraft}
      />
      <EditableSection
        id="edit-upcoming"
        title="Upcoming"
        games={upcoming}
        onChange={updateDraft}
      />
      <EditableSection
        id="edit-final"
        title="Final"
        games={completed}
        onChange={updateDraft}
        empty="No completed games yet."
      />
    </section>
  );
}

function EditableSection({
  id,
  title,
  games,
  onChange,
  empty,
}: {
  id: string;
  title: string;
  games: PublicScoreboardGame[];
  onChange: (gameKey: string, patch: Partial<PublicScoreboardGame>) => void;
  empty?: string;
}) {
  return (
    <section className="v-scoreboard__section" aria-labelledby={id}>
      <div className="v-scoreboard__section-head">
        <h3 id={id} className="v-scoreboard__section-title">
          {title}
        </h3>
      </div>
      {games.length === 0 ? (
        <p className="v-scoreboard__empty">{empty || 'None.'}</p>
      ) : (
        <div className="v-scoreboard__grid">
          {games.map((g) => (
            <ScoreboardGameCard
              key={g.gameKey}
              game={g}
              editable
              onChange={(patch) => onChange(g.gameKey, patch)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
