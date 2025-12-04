/**
 * Usage Logger - Client-side utility for tracking user interactions
 * Implements batching to improve performance
 */

export type EventType = 'Page Visit' | 'Click';
export type Location = string;

export interface UsageLogEntry {
  eventType: EventType;
  location: Location;
  bracketId?: string | null;
  timestamp: Date;
  email?: string | null; // Optional email for logging when user is not logged in
}

/**
 * Detect if running in an automated test environment (Playwright, Selenium, etc.)
 * navigator.webdriver is set to true by automation tools
 */
const isTestEnvironment = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !!(navigator as Navigator & { webdriver?: boolean }).webdriver;
};

class UsageLogger {
  private queue: UsageLogEntry[] = [];
  private batchSize = 10;
  private batchInterval = 5000; // 5 seconds
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;

  /**
   * Add a log entry to the queue
   * Skips logging in automated test environments to keep usage data clean
   */
  log(eventType: EventType, location: Location, bracketId?: string | null, email?: string | null): void {
    // Skip logging in test environments (Playwright, Selenium, etc.)
    if (isTestEnvironment()) {
      return;
    }

    const entry: UsageLogEntry = {
      eventType,
      location,
      bracketId: bracketId || null,
      timestamp: new Date(),
      email: email || null,
    };

    this.queue.push(entry);

    // Flush if queue reaches batch size
    if (this.queue.length >= this.batchSize) {
      this.flush();
    } else if (!this.flushTimer) {
      // Start timer for periodic flush
      this.flushTimer = setTimeout(() => this.flush(), this.batchInterval);
    }
  }

  /**
   * Flush all queued logs to the server
   */
  async flush(): Promise<void> {
    if (this.isFlushing || this.queue.length === 0) {
      return;
    }

    this.isFlushing = true;

    // Clear the timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    // Copy and clear the queue
    const entries = [...this.queue];
    this.queue = [];

    try {
      // Send to API
      const response = await fetch('/api/log/usage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entries }),
      });

      if (!response.ok) {
        // If request fails, put entries back in queue (but limit queue size)
        console.error('Failed to log usage:', response.statusText);
        if (this.queue.length < 100) {
          this.queue.unshift(...entries);
        }
      }
    } catch (error) {
      console.error('Error logging usage:', error);
      // Put entries back in queue if there's space
      if (this.queue.length < 100) {
        this.queue.unshift(...entries);
      }
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Force flush (useful on page unload)
   */
  forceFlush(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }
}

// Singleton instance
export const usageLogger = new UsageLogger();

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    usageLogger.forceFlush();
  });

  // Also flush on visibility change (user switches tabs/apps)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      usageLogger.flush();
    }
  });
}

