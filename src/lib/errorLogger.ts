/**
 * Error Logger - Utility for logging application errors
 */

export interface ErrorLogEntry {
  errorMessage: string;
  errorStack?: string;
  errorType?: string;
  location?: string;
  timestamp: Date;
}

class ErrorLogger {
  /**
   * Log an error to the server
   */
  async logError(
    error: Error | string,
    location?: string
  ): Promise<void> {
    const entry: ErrorLogEntry = {
      errorMessage: error instanceof Error ? error.message : error,
      errorStack: error instanceof Error ? error.stack : undefined,
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      location: location || 'Unknown',
      timestamp: new Date(),
    };

    try {
      const response = await fetch('/api/log/error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entry }),
      });

      if (!response.ok) {
        console.error('Failed to log error:', response.statusText);
      }
    } catch (err) {
      // Don't throw - error logging should never break the app
      console.error('Error logging error:', err);
    }
  }
}

// Singleton instance
export const errorLogger = new ErrorLogger();

