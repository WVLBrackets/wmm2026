/**
 * Secure Database - Backward Compatibility Layer
 * 
 * This file re-exports from the new modular structure for backward compatibility.
 * New code should import directly from the specific modules:
 * 
 * - Types: @/lib/types/database
 * - Users: @/lib/repositories/userRepository
 * - Brackets: @/lib/repositories/bracketRepository
 * - Team Data: @/lib/repositories/teamDataRepository
 * - Tokens: @/lib/services/tokenService
 * - Auth: @/lib/services/authService
 * - Migrations: @/lib/database/migrations
 * 
 * @deprecated Import from specific modules instead
 */

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type { 
  User, 
  Bracket, 
  ConfirmationToken,
  BracketWithUser,
  TeamReferenceData,
  BracketCounts,
} from './types/database';

// =============================================================================
// DATABASE MIGRATIONS
// =============================================================================

export { 
  initializeDatabase,
  initializeTeamDataTable,
} from './database/migrations';

// =============================================================================
// USER REPOSITORY
// =============================================================================

export { 
  createUser,
  getUserByEmail,
  getUserById,
  getAllUsers,
  deleteUser,
  getUserCount,
  getConfirmedUserCount,
  getUserBracketCounts,
} from './repositories/userRepository';

// =============================================================================
// BRACKET REPOSITORY
// =============================================================================

export { 
  createBracket,
  getBracketsByUserId,
  getBracketById,
  updateBracket,
  deleteBracket,
  getAllBrackets,
} from './repositories/bracketRepository';

// =============================================================================
// TEAM DATA REPOSITORY
// =============================================================================

export { 
  getAllTeamReferenceData,
  updateTeamReferenceData,
  updateTeamActiveStatus,
  deleteTeamReferenceData,
  syncTeamDataFromJSON,
} from './repositories/teamDataRepository';

// =============================================================================
// TOKEN SERVICE
// =============================================================================

export { 
  confirmUserEmail,
  createPasswordResetToken,
  resetPassword,
  cleanupExpiredTokens,
} from './services/tokenService';

// =============================================================================
// AUTH SERVICE
// =============================================================================

export { 
  verifyPassword,
} from './services/authService';
