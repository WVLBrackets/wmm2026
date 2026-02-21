/**
 * Application Constants
 * 
 * Centralized constants to avoid magic strings throughout the codebase.
 */

/**
 * Bracket status values
 */
export const BracketStatus = {
  DRAFT: 'draft',
  IN_PROGRESS: 'in_progress',
  SUBMITTED: 'submitted',
  INVALID: 'Invalid',
  DELETED: 'deleted',
} as const;

export type BracketStatusType = typeof BracketStatus[keyof typeof BracketStatus];

/**
 * Environment values
 */
export const Environment = {
  DEVELOPMENT: 'development',
  PREVIEW: 'preview',
  PRODUCTION: 'production',
} as const;

export type EnvironmentType = typeof Environment[keyof typeof Environment];

/**
 * Token types
 */
export const TokenType = {
  CONFIRMATION: 'confirmation',
  RESET: 'reset',
  AUTO_SIGNIN: 'auto_signin',
} as const;

export type TokenTypeValue = typeof TokenType[keyof typeof TokenType];

/**
 * API error codes
 */
export const ErrorCode = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  EMAIL_NOT_CONFIRMED: 'EMAIL_NOT_CONFIRMED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  USER_EXISTS: 'USER_EXISTS',
  SUBMISSION_CLOSED: 'SUBMISSION_CLOSED',
} as const;

export type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode];

/**
 * Token expiration times (in milliseconds)
 */
export const TokenExpiration = {
  CONFIRMATION: 24 * 60 * 60 * 1000,  // 24 hours
  RESET: 60 * 60 * 1000,               // 1 hour
  AUTO_SIGNIN: 5 * 60 * 1000,          // 5 minutes
} as const;

/**
 * Password requirements
 */
export const PasswordRequirements = {
  MIN_LENGTH: 6,
  BCRYPT_ROUNDS: 12,
} as const;

/**
 * Default pagination
 */
export const Pagination = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;
