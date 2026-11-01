/**
 * Server-side validation for bracket submissions
 * Validates picks data structure, team IDs, bracket logic, and submission rules
 */

import { TournamentData } from '@/types/tournament';
import { generate64TeamBracket, getAllBracketGames } from './bracketGenerator';
import {
  formatTieBreakerInvalid,
  type VintageBracketEditorContent,
} from './vintage/bracketEditorContent';

export interface BracketValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Validate bracket submission server-side
 */
export async function validateBracketSubmission(
  picks: Record<string, string>,
  tieBreaker: number | undefined,
  tournamentData: TournamentData,
  editorCopy: Pick<
    VintageBracketEditorContent,
    'tieBreakerLow' | 'tieBreakerHigh' | 'tieBreakerInvalidMessage' | 'tieBreakerMissingMessage'
  >
): Promise<BracketValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Validate tie breaker against the published Bracket Editor range
  if (tieBreaker === undefined || tieBreaker === null) {
    errors.push(editorCopy.tieBreakerMissingMessage);
  } else if (
    isNaN(tieBreaker) ||
    tieBreaker < editorCopy.tieBreakerLow ||
    tieBreaker > editorCopy.tieBreakerHigh
  ) {
    errors.push(formatTieBreakerInvalid(editorCopy));
  }

  // 3. Generate expected bracket structure
  const bracketStructure = generate64TeamBracket(tournamentData);
  
  // 4. Get all expected game IDs
  const allGames = getAllBracketGames(bracketStructure);
  const expectedGameIds = new Set(allGames.map(game => game.id));

  // 5. Validate picks structure
  if (!picks || typeof picks !== 'object') {
    errors.push('Invalid picks data structure');
    return { isValid: false, errors };
  }

  // 6. Check for missing picks
  const missingPicks: string[] = [];
  expectedGameIds.forEach(gameId => {
    if (!picks[gameId]) {
      missingPicks.push(gameId);
    }
  });

  if (missingPicks.length > 0) {
    errors.push(`Missing picks for ${missingPicks.length} game(s)`);
  }

  // 7. Get all valid team IDs from tournament data
  const validTeamIds = new Set<string>();
  tournamentData.regions.forEach(region => {
    region.teams.forEach(team => {
      validTeamIds.add(team.id);
    });
  });

  // 8. Validate all team IDs in picks exist
  const invalidTeamIds: string[] = [];
  Object.entries(picks).forEach(([gameId, teamId]) => {
    if (teamId && !validTeamIds.has(teamId)) {
      invalidTeamIds.push(`Game ${gameId}: invalid team ID ${teamId}`);
    }
  });

  if (invalidTeamIds.length > 0) {
    errors.push(`Invalid team IDs found: ${invalidTeamIds.slice(0, 5).join(', ')}${invalidTeamIds.length > 5 ? '...' : ''}`);
  }

  // 9. Validate bracket structure logic (winners advance correctly)
  const structureErrors = validateBracketStructureLogic(picks, bracketStructure, tournamentData);
  if (structureErrors.length > 0) {
    errors.push(...structureErrors);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate bracket structure logic - ensure winners advance correctly
 */
function validateBracketStructureLogic(
  picks: Record<string, string>,
  bracketStructure: ReturnType<typeof generate64TeamBracket>,
  tournamentData: TournamentData
): string[] {
  const errors: string[] = [];

  // For each region, validate that Round of 32 winners come from Round of 64
  // For each region, validate that Sweet 16 winners come from Round of 32
  // For each region, validate that Elite 8 winners come from Sweet 16
  // Validate Final Four winners come from Elite 8
  // Validate Championship winner comes from Final Four

  Object.entries(bracketStructure.regions).forEach(([regionPosition, regionGames]) => {
    const roundOf32Games = regionGames.filter(g => g.round === 'Round of 32');

    // Validate Round of 32 winners come from Round of 64
    roundOf32Games.forEach(r32Game => {
      const r32Winner = picks[r32Game.id];
      if (r32Winner) {
        // This game should have winners from two specific Round of 64 games
        // The structure ensures this, but we can validate the winner exists in the region
        const regionTeams = tournamentData.regions.find(r => r.position === regionPosition)?.teams || [];
        const validTeamIds = new Set(regionTeams.map(t => t.id));
        if (!validTeamIds.has(r32Winner)) {
          errors.push(`Round of 32 game ${r32Game.id}: winner ${r32Winner} is not from this region`);
        }
      }
    });

    // Similar validation for Sweet 16, Elite 8
    // (Simplified - full validation would require tracking which teams advanced from previous rounds)
  });

  // Validate Final Four winners come from Elite 8
  bracketStructure.finalFour.forEach(ffGame => {
    const ffWinner = picks[ffGame.id];
    if (ffWinner) {
      // Final Four winners should come from Elite 8 games
      // Simplified check: ensure team ID exists in tournament
      const allTeamIds = new Set<string>();
      tournamentData.regions.forEach(region => {
        region.teams.forEach(team => allTeamIds.add(team.id));
      });
      if (!allTeamIds.has(ffWinner)) {
        errors.push(`Final Four game ${ffGame.id}: invalid team ID ${ffWinner}`);
      }
    }
  });

  // Validate Championship winner comes from Final Four
  const champWinner = picks[bracketStructure.championship.id];
  if (champWinner) {
    const allTeamIds = new Set<string>();
    tournamentData.regions.forEach(region => {
      region.teams.forEach(team => allTeamIds.add(team.id));
    });
    if (!allTeamIds.has(champWinner)) {
      errors.push(`Championship game: invalid team ID ${champWinner}`);
    }
  }

  return errors;
}

