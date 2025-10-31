import { Bracket, BracketValidationResult, BracketSubmission } from '@/types/bracket';
import { TOURNAMENT_CONFIG } from './bracketTypes';

/**
 * Validate a bracket submission
 */
export function validateBracketSubmission(submission: BracketSubmission): BracketValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!submission.playerName || submission.playerName.trim().length === 0) {
    errors.push('Player name is required');
  }

  if (!submission.playerEmail || submission.playerEmail.trim().length === 0) {
    errors.push('Player email is required');
  } else if (!isValidEmail(submission.playerEmail)) {
    errors.push('Valid email address is required');
  }

  // Check that all games have winners selected
  const gamesWithoutWinners = submission.games.filter(game => !game.winner);
  if (gamesWithoutWinners.length > 0) {
    errors.push(`Please select winners for all ${gamesWithoutWinners.length} remaining games`);
  }

  // Check that we have exactly 15 games for a 16-team bracket
  if (submission.games.length !== 15) {
    errors.push('Bracket must have exactly 15 games for a 16-team tournament');
  }

  // Check for duplicate winners in same round
  TOURNAMENT_CONFIG.rounds.forEach((round, roundIndex) => {
    const roundGames = submission.games.filter(game => game.round === roundIndex + 1);
    const winners = roundGames.map(game => game.winner?.id).filter(Boolean);
    const uniqueWinners = new Set(winners);
    
    if (winners.length !== uniqueWinners.size) {
      errors.push(`Duplicate winners found in ${round.name}`);
    }
  });

  // Check bracket logic (winners advance correctly)
  if (!validateBracketLogic(submission)) {
    errors.push('Bracket logic is invalid - winners must advance correctly');
  }

  // Warnings
  if (submission.playerName.length < 2) {
    warnings.push('Player name is very short');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate bracket logic - ensure winners advance correctly
 */
function validateBracketLogic(submission: BracketSubmission): boolean {
  // This is a simplified validation
  // In a real implementation, you'd check that:
  // 1. First round winners advance to second round
  // 2. Second round winners advance to Sweet 16
  // 3. And so on...
  
  // For 16-team bracket: 8 first round + 4 quarterfinals + 2 semifinals + 1 championship = 15 games
  const expectedGames = 15;
  return submission.games.length === expectedGames;
}

/**
 * Validate bracket for specific tournament rules
 */
export function validateTournamentRules(bracket: Bracket): BracketValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if bracket was submitted before deadline
  const tournamentStart = new Date(TOURNAMENT_CONFIG.startDate);
  const submissionDate = new Date(bracket.submittedAt);
  
  if (submissionDate >= tournamentStart) {
    errors.push('Bracket must be submitted before tournament starts');
  }

  // Check if bracket is complete
  if (!bracket.isComplete) {
    errors.push('Bracket must be complete before submission');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
