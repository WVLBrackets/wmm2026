/**
 * API Response Helpers
 * 
 * Standardized response format for all API endpoints.
 * Use these helpers instead of creating NextResponse.json directly.
 * 
 * Standard format:
 * - Success: { success: true, data: T, message?: string }
 * - Error: { success: false, error: string, code?: string }
 */

import { NextResponse } from 'next/server';

/**
 * Standard success response structure
 */
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
}

/**
 * Union type for any API response
 */
export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

/**
 * Create a success response
 * 
 * @param data - Response payload
 * @param message - Optional success message
 * @param status - HTTP status code (default 200)
 */
export function successResponse<T>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse<SuccessResponse<T>> {
  const body: SuccessResponse<T> = {
    success: true,
    data,
  };
  
  if (message) {
    body.message = message;
  }
  
  return NextResponse.json(body, { status });
}

/**
 * Create a created response (201)
 * 
 * @param data - Created resource
 * @param message - Optional success message
 */
export function createdResponse<T>(
  data: T,
  message?: string
): NextResponse<SuccessResponse<T>> {
  return successResponse(data, message, 201);
}

/**
 * Create an error response
 * 
 * @param error - Error message for the user
 * @param status - HTTP status code (default 400)
 * @param code - Optional machine-readable error code
 */
export function errorResponse(
  error: string,
  status: number = 400,
  code?: string
): NextResponse<ErrorResponse> {
  const body: ErrorResponse = {
    success: false,
    error,
  };
  
  if (code) {
    body.code = code;
  }
  
  return NextResponse.json(body, { status });
}

/**
 * Common error responses
 */
export const ApiErrors = {
  /**
   * 400 Bad Request - Missing or invalid input
   */
  badRequest: (message: string = 'Bad request', code?: string) => 
    errorResponse(message, 400, code),

  /**
   * 401 Unauthorized - Not authenticated
   */
  unauthorized: (message: string = 'Unauthorized') => 
    errorResponse(message, 401, 'UNAUTHORIZED'),

  /**
   * 403 Forbidden - Not authorized for this action
   */
  forbidden: (message: string = 'Forbidden') => 
    errorResponse(message, 403, 'FORBIDDEN'),

  /**
   * 404 Not Found - Resource doesn't exist
   */
  notFound: (resource: string = 'Resource') => 
    errorResponse(`${resource} not found`, 404, 'NOT_FOUND'),

  /**
   * 409 Conflict - Resource already exists
   */
  conflict: (message: string = 'Resource already exists') => 
    errorResponse(message, 409, 'CONFLICT'),

  /**
   * 422 Unprocessable Entity - Validation failed
   */
  validationError: (message: string) => 
    errorResponse(message, 422, 'VALIDATION_ERROR'),

  /**
   * 429 Too Many Requests - Rate limited
   */
  rateLimited: (message: string = 'Too many requests. Please try again later.') => 
    errorResponse(message, 429, 'RATE_LIMITED'),

  /**
   * 500 Internal Server Error - Unexpected error
   */
  internalError: (message: string = 'An unexpected error occurred. Please try again later.') => 
    errorResponse(message, 500, 'INTERNAL_ERROR'),
};

/**
 * Type guard to check if a response is successful
 */
export function isSuccessResponse<T>(
  response: ApiResponse<T>
): response is SuccessResponse<T> {
  return response.success === true;
}

/**
 * Type guard to check if a response is an error
 */
export function isErrorResponse(
  response: ApiResponse<unknown>
): response is ErrorResponse {
  return response.success === false;
}
