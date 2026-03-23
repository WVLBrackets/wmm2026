/**
 * Input Validation Utilities
 * 
 * Reusable validation functions for API input.
 * Use these instead of duplicating validation logic in each route.
 */

import { normalizeStoredDisplayName } from '../stringNormalize';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validation function type
 */
export type Validator<T> = (value: T) => ValidationResult;

/**
 * Combine multiple validators
 */
export function combine<T>(...validators: Validator<T>[]): Validator<T> {
  return (value: T) => {
    for (const validator of validators) {
      const result = validator(value);
      if (!result.valid) {
        return result;
      }
    }
    return { valid: true };
  };
}

// =============================================================================
// STRING VALIDATORS
// =============================================================================

/**
 * Check if value is a non-empty string
 */
export function required(fieldName: string): Validator<unknown> {
  return (value) => {
    if (value === null || value === undefined || value === '') {
      return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true };
  };
}

/**
 * Check string minimum length
 */
export function minLength(min: number, fieldName: string): Validator<string> {
  return (value) => {
    if (typeof value !== 'string' || value.length < min) {
      return { valid: false, error: `${fieldName} must be at least ${min} characters` };
    }
    return { valid: true };
  };
}

/**
 * Check string maximum length
 */
export function maxLength(max: number, fieldName: string): Validator<string> {
  return (value) => {
    if (typeof value !== 'string' || value.length > max) {
      return { valid: false, error: `${fieldName} must be no more than ${max} characters` };
    }
    return { valid: true };
  };
}

/**
 * Check if string matches a regex pattern
 */
export function pattern(regex: RegExp, message: string): Validator<string> {
  return (value) => {
    if (typeof value !== 'string' || !regex.test(value)) {
      return { valid: false, error: message };
    }
    return { valid: true };
  };
}

// =============================================================================
// EMAIL VALIDATION
// =============================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate email format
 */
export function email(fieldName: string = 'Email'): Validator<string> {
  return (value) => {
    if (typeof value !== 'string' || !EMAIL_REGEX.test(value)) {
      return { valid: false, error: `${fieldName} must be a valid email address` };
    }
    return { valid: true };
  };
}

// =============================================================================
// PASSWORD VALIDATION
// =============================================================================

/**
 * Validate password meets minimum requirements
 */
export function password(minLen: number = 6): Validator<string> {
  return (value) => {
    if (typeof value !== 'string' || value.length < minLen) {
      return { valid: false, error: `Password must be at least ${minLen} characters` };
    }
    return { valid: true };
  };
}

// =============================================================================
// NUMBER VALIDATORS
// =============================================================================

/**
 * Check if value is a number within range
 */
export function numberInRange(
  min: number, 
  max: number, 
  fieldName: string
): Validator<unknown> {
  return (value) => {
    const num = typeof value === 'string' ? parseInt(value, 10) : value;
    
    if (typeof num !== 'number' || isNaN(num)) {
      return { valid: false, error: `${fieldName} must be a number` };
    }
    
    if (num < min || num > max) {
      return { valid: false, error: `${fieldName} must be between ${min} and ${max}` };
    }
    
    return { valid: true };
  };
}

// =============================================================================
// OBJECT VALIDATORS
// =============================================================================

/**
 * Check if value is a non-empty object
 */
export function nonEmptyObject(fieldName: string): Validator<unknown> {
  return (value) => {
    if (typeof value !== 'object' || value === null || Object.keys(value).length === 0) {
      return { valid: false, error: `${fieldName} must be a non-empty object` };
    }
    return { valid: true };
  };
}

// =============================================================================
// COMPOSITE VALIDATORS
// =============================================================================

/**
 * Validate user registration input
 */
export interface RegistrationInput {
  email: string;
  name: string;
  password: string;
}

export function validateRegistration(input: RegistrationInput): ValidationResult {
  // Email validation
  const emailResult = combine(
    required('Email'),
    email('Email')
  )(input.email);
  if (!emailResult.valid) return emailResult;
  
  // Name validation (trim first so pasted trailing spaces do not bypass length rules)
  const nameForValidation = normalizeStoredDisplayName(String(input.name ?? ''));
  const nameResult = combine(
    required('Name'),
    minLength(1, 'Name'),
    maxLength(255, 'Name')
  )(nameForValidation);
  if (!nameResult.valid) return nameResult;
  
  // Password validation
  const passwordResult = password(6)(input.password);
  if (!passwordResult.valid) return passwordResult;
  
  return { valid: true };
}

/**
 * Validate bracket submission input
 */
export interface BracketInput {
  playerName: string;
  playerEmail: string;
  entryName: string;
  picks: Record<string, string>;
  tieBreaker?: number;
}

export function validateBracketInput(input: BracketInput): ValidationResult {
  // Required fields
  if (!input.playerName) {
    return { valid: false, error: 'Player name is required' };
  }
  
  if (!input.playerEmail) {
    return { valid: false, error: 'Player email is required' };
  }
  
  const entryName = normalizeStoredDisplayName(String(input.entryName ?? ''));
  if (!entryName) {
    return { valid: false, error: 'Entry name is required' };
  }
  
  // Picks validation
  const picksResult = nonEmptyObject('Picks')(input.picks);
  if (!picksResult.valid) return picksResult;
  
  return { valid: true };
}

/**
 * Validate tie breaker value
 */
export function validateTieBreaker(
  value: unknown, 
  low: number = 50, 
  high: number = 500
): ValidationResult {
  if (value === undefined || value === null) {
    return { valid: false, error: 'Tie breaker is required' };
  }
  
  return numberInRange(low, high, 'Tie breaker')(value);
}
