'use client';

import { useState, useEffect, useCallback } from 'react';
import { CSRF_HEADER_NAME, CSRF_COOKIE_NAME } from '@/lib/csrf';

/**
 * Client-side CSRF token management hook
 * 
 * Usage:
 *   const { csrfToken, fetchWithCSRF, isLoading } = useCSRF();
 *   
 *   // Option 1: Use fetchWithCSRF helper
 *   const response = await fetchWithCSRF('/api/tournament-bracket', {
 *     method: 'POST',
 *     body: JSON.stringify(data)
 *   });
 *   
 *   // Option 2: Manually add header
 *   const response = await fetch('/api/endpoint', {
 *     headers: { 'x-csrf-token': csrfToken }
 *   });
 */
export function useCSRF() {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch CSRF token on mount
  useEffect(() => {
    async function fetchToken() {
      try {
        // First check if we have a token in cookies
        const existingToken = getCookieValue(CSRF_COOKIE_NAME);
        if (existingToken) {
          setCsrfToken(existingToken);
          setIsLoading(false);
          return;
        }

        // Fetch new token from API
        const response = await fetch('/api/csrf-token');
        if (!response.ok) {
          throw new Error('Failed to fetch CSRF token');
        }
        
        const data = await response.json();
        setCsrfToken(data.csrfToken);
        setError(null);
      } catch (err) {
        console.error('Error fetching CSRF token:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch CSRF token');
      } finally {
        setIsLoading(false);
      }
    }

    fetchToken();
  }, []);

  /**
   * Refresh the CSRF token
   */
  const refreshToken = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/csrf-token');
      if (!response.ok) {
        throw new Error('Failed to refresh CSRF token');
      }
      
      const data = await response.json();
      setCsrfToken(data.csrfToken);
      setError(null);
      return data.csrfToken;
    } catch (err) {
      console.error('Error refreshing CSRF token:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh CSRF token');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Fetch wrapper that automatically includes CSRF token
   */
  const fetchWithCSRF = useCallback(async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    // Get current token (from state or cookie)
    let token = csrfToken || getCookieValue(CSRF_COOKIE_NAME);
    
    // If no token and this is a state-changing request, fetch one first
    if (!token && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method?.toUpperCase() || 'GET')) {
      token = await refreshToken();
    }

    const headers = new Headers(options.headers);
    if (token) {
      headers.set(CSRF_HEADER_NAME, token);
    }
    
    // Ensure JSON content type for body requests
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Important: include cookies
    });

    // If CSRF validation failed, try to refresh token and retry once
    if (response.status === 403) {
      const errorData = await response.clone().json().catch(() => ({}));
      if (errorData.error === 'CSRF validation failed') {
        const newToken = await refreshToken();
        if (newToken) {
          headers.set(CSRF_HEADER_NAME, newToken);
          return fetch(url, {
            ...options,
            headers,
            credentials: 'include',
          });
        }
      }
    }

    return response;
  }, [csrfToken, refreshToken]);

  return {
    csrfToken,
    isLoading,
    error,
    refreshToken,
    fetchWithCSRF,
  };
}

/**
 * Get a cookie value by name
 */
function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * Get CSRF headers for use with standard fetch
 * Call this before making state-changing requests
 */
export async function getCSRFHeaders(): Promise<Record<string, string>> {
  // Try to get from cookie first
  let token = getCookieValue(CSRF_COOKIE_NAME);
  
  // If no cookie, fetch from API
  if (!token) {
    try {
      const response = await fetch('/api/csrf-token');
      if (response.ok) {
        const data = await response.json();
        token = data.csrfToken;
      }
    } catch (error) {
      console.error('Error fetching CSRF token:', error);
    }
  }

  return token ? { [CSRF_HEADER_NAME]: token } : {};
}
