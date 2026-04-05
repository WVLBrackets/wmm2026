'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Users,
  LaptopMinimalCheck,
  LogOut,
  Link2,
  Table,
  Zap,
  RefreshCw,
  Home,
  Info,
  Award,
  KeyRound,
  Power,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Database,
  DollarSign,
} from 'lucide-react';
import { useBracketMode } from '@/contexts/BracketModeContext';
import UsersTab from '@/components/admin/UsersTab';
import BracketsTab from '@/components/admin/BracketsTab';
import UsageMonitoringTab from '@/components/admin/UsageMonitoringTab';
import TeamDataTab from '@/components/admin/TeamDataTab';
import TourneyTab from '@/components/admin/TourneyTab';
import LogsTab from '@/components/admin/LogsTab';
import LiveResultsTab from '@/components/admin/LiveResultsTab';
import PaymentsTab from '@/components/admin/PaymentsTab';
import { getCSRFHeaders } from '@/hooks/useCSRF';

interface User {
  id: string;
  email: string;
  name: string;
  emailConfirmed: boolean;
  createdAt: string;
  lastLogin?: string | null;
  environment: string;
  bracketCounts?: {
    submitted: number;
    inProgress: number;
    deleted: number;
  };
}

interface Bracket {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  entryName: string;
  tieBreaker?: number;
  status: string;
  bracketNumber?: number;
  year?: number;
  createdAt: string;
  updatedAt: string;
  /** ISO string from `submitted_at`; absent/null until bracket is submitted. */
  submittedAt?: string | null;
  picks: Record<string, string>;
  isKey?: boolean;
}

interface ConfigValidationIssue {
  severity: 'error' | 'warning' | 'info';
  field: string;
  message: string;
}

interface ConfigValidationResult {
  summary: {
    errors: number;
    warnings: number;
    infos: number;
    activeCtaCount: number;
    checkedAt: string;
    isValid: boolean;
  };
  issues: ConfigValidationIssue[];
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setInBracketMode } = useBracketMode();

  const [users, setUsers] = useState<User[]>([]);
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Revalidation state
  const [revalidating, setRevalidating] = useState<string | null>(null);
  const [revalidateMessage, setRevalidateMessage] = useState<string | null>(null);
  const [isValidatingConfig, setIsValidatingConfig] = useState(false);
  const [configValidationError, setConfigValidationError] = useState<string | null>(null);
  const [configValidationResult, setConfigValidationResult] = useState<ConfigValidationResult | null>(null);
  const [showValidationDetails, setShowValidationDetails] = useState(false);
  const [killSwitchEnabled, setKillSwitchEnabled] = useState<boolean>(true);
  const [killSwitchMessage, setKillSwitchMessage] = useState<string>('Bracket actions are temporarily disabled by the administrator.');
  const [killSwitchLoading, setKillSwitchLoading] = useState(false);
  const [killSwitchError, setKillSwitchError] = useState<string | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<'brackets' | 'users' | 'live-results' | 'data' | 'tourney' | 'logs' | 'usage' | 'payments'>('users');

  // Ensure bracket mode is disabled when admin page loads
  useEffect(() => {
    setInBracketMode(false);
  }, [setInBracketMode]);

  const loadDataRef = useRef<((options?: { silent?: boolean }) => Promise<void>) | undefined>(undefined);
  const adminTabsNavRef = useRef<HTMLDivElement>(null);
  const [adminTabsCanScrollLeft, setAdminTabsCanScrollLeft] = useState(false);
  const [adminTabsCanScrollRight, setAdminTabsCanScrollRight] = useState(false);

  /** Below Tailwind `lg` (1024px): horizontal tab strip may overflow; update arrow affordances. */
  const updateAdminTabsScrollState = useCallback(() => {
    const el = adminTabsNavRef.current;
    if (!el || typeof window === 'undefined') return;
    if (window.innerWidth >= 1024) {
      setAdminTabsCanScrollLeft(false);
      setAdminTabsCanScrollRight(false);
      return;
    }
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setAdminTabsCanScrollLeft(scrollLeft > 2);
    setAdminTabsCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
  }, []);

  /** Scroll admin tab strip horizontally (mobile only control; no-op if ref missing). */
  const scrollAdminTabs = useCallback((direction: -1 | 1) => {
    const el = adminTabsNavRef.current;
    if (!el) return;
    const amount = Math.round(Math.min(240, el.clientWidth * 0.65));
    el.scrollBy({ left: direction * amount, behavior: 'smooth' });
  }, []);

  const loadData = async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        setIsLoading(true);
      }
      setError('');
      
      const [usersRes, bracketsRes, killSwitchRes] = await Promise.all([
        fetch('/api/admin/users', { cache: 'no-store' }),
        fetch('/api/admin/brackets', { cache: 'no-store' }),
        fetch('/api/admin/kill-switch', { cache: 'no-store' }),
      ]);
      
      const usersData = await usersRes.json();
      const bracketsData = await bracketsRes.json();
      const killSwitchData = await killSwitchRes.json();
      
      if (!usersRes.ok || !bracketsRes.ok) {
        if (usersRes.status === 403 || bracketsRes.status === 403) {
          setError('Unauthorized: Admin access required');
          setTimeout(() => router.push('/'), 2000);
          return;
        }
        throw new Error('Failed to load data');
      }
      
      setUsers(usersData.users || usersData.data || []);
      setBrackets(bracketsData.data || []);
      if (killSwitchRes.ok && killSwitchData.success && killSwitchData.data) {
        setKillSwitchEnabled(Boolean(killSwitchData.data.enabled));
        if (killSwitchData.data.message) {
          setKillSwitchMessage(String(killSwitchData.data.message));
        }
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
      setError('Failed to load admin data');
    } finally {
      if (!options?.silent) {
        setIsLoading(false);
      }
    }
  };

  /**
   * Toggle master kill switch for bracket actions.
   */
  const handleToggleKillSwitch = async () => {
    if (killSwitchLoading) return;
    setKillSwitchLoading(true);
    setKillSwitchError(null);
    const nextValue = !killSwitchEnabled;

    try {
      const csrfHeaders = await getCSRFHeaders();
      const response = await fetch('/api/admin/kill-switch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders },
        body: JSON.stringify({ enabled: nextValue }),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        setKillSwitchError(result.error || 'Failed to update kill switch');
        return;
      }

      setKillSwitchEnabled(Boolean(result.data?.enabled));
    } catch {
      setKillSwitchError('Failed to update kill switch');
    } finally {
      setKillSwitchLoading(false);
    }
  };

  /**
   * Trigger on-demand revalidation for a static page
   */
  const handleRevalidate = async (path: string, pageName: string) => {
    setRevalidating(path);
    setRevalidateMessage(null);

    try {
      const csrfHeaders = await getCSRFHeaders();
      const response = await fetch('/api/admin/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders },
        body: JSON.stringify({ path }),
      });

      const result = await response.json();

      if (result.success) {
        setRevalidateMessage(`✅ ${result.message || `${pageName} rebuilt successfully`}`);
      } else {
        setRevalidateMessage(`❌ Failed to rebuild ${pageName}: ${result.error}`);
      }
    } catch {
      setRevalidateMessage(`❌ Failed to rebuild ${pageName}`);
    } finally {
      setRevalidating(null);
      setTimeout(() => setRevalidateMessage(null), 5000);
    }
  };

  /**
   * Invalidate Next `site-config` tag + {@link invalidateSiteConfigModuleCache} only (no full page rebuild).
   */
  const handleFlushSiteConfigCache = async () => {
    setRevalidating('__site_config__');
    setRevalidateMessage(null);

    try {
      const csrfHeaders = await getCSRFHeaders();
      const response = await fetch('/api/admin/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders },
        body: JSON.stringify({ action: 'flush-site-config' }),
      });

      const result = await response.json();

      if (result.success) {
        setRevalidateMessage(`✅ ${result.message || 'Site config server caches cleared'}`);
      } else {
        setRevalidateMessage(`❌ ${result.error || 'Failed to flush site config cache'}`);
      }
    } catch {
      setRevalidateMessage('❌ Failed to flush site config cache');
    } finally {
      setRevalidating(null);
      setTimeout(() => setRevalidateMessage(null), 8000);
    }
  };

  /**
   * Run server-side validation against the latest Google Sheets config values.
   */
  const handleValidateConfig = async () => {
    setIsValidatingConfig(true);
    setConfigValidationError(null);

    try {
      const response = await fetch('/api/admin/validate-config', { cache: 'no-store' });
      const result = await response.json();

      if (!response.ok || !result.success) {
        setConfigValidationResult(null);
        setConfigValidationError(result.error || 'Failed to validate config');
        return;
      }

      setConfigValidationResult(result.data);
      setShowValidationDetails(true);
    } catch {
      setConfigValidationResult(null);
      setConfigValidationError('Failed to validate config');
    } finally {
      setIsValidatingConfig(false);
    }
  };

  // Helper function to update URL with new tab
  const updateUrlTab = (tab: 'brackets' | 'users' | 'live-results' | 'data' | 'tourney' | 'logs' | 'usage' | 'payments', logsTab?: 'summary' | 'usage' | 'error' | 'email', emailView?: 'summary' | 'detail') => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('tab', tab);
    
    if (tab === 'logs' && logsTab) {
      params.set('logsTab', logsTab);
    } else if (tab !== 'logs') {
      params.delete('logsTab');
    }
    
    if (tab === 'logs' && logsTab === 'email' && emailView) {
      params.set('emailView', emailView);
    } else if (tab !== 'logs' || logsTab !== 'email') {
      params.delete('emailView');
    }
    
    router.replace(`/admin?${params.toString()}`, { scroll: false });
  };

  // Wrapper functions that update both state and URL
  const handleSetActiveTab = (tab: 'brackets' | 'users' | 'live-results' | 'data' | 'tourney' | 'logs' | 'usage' | 'payments') => {
    setActiveTab(tab);
    // Update URL immediately to reflect the change
    updateUrlTab(tab);
  };

  // Assign functions to refs after they're declared
  loadDataRef.current = loadData;

  // Sync state from URL params when they change (e.g., on page refresh)
  useEffect(() => {
    if (!searchParams) return;
    
    const tabParam = searchParams.get('tab');
    if (tabParam && ['brackets', 'users', 'live-results', 'data', 'tourney', 'logs', 'usage', 'payments'].includes(tabParam)) {
      const newTab = tabParam as 'brackets' | 'users' | 'live-results' | 'data' | 'tourney' | 'logs' | 'usage' | 'payments';
      if (newTab !== activeTab) {
        setActiveTab(newTab);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // Only depend on searchParams to sync from URL, not state variables to avoid loops

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    
    
    loadDataRef.current?.();
  }, [status, router]);

  /**
   * Brackets tab shows DB `updated_at`; if the admin edits picks in `/bracket` in another tab,
   * refetch when this page becomes visible again so "Updated" is not stuck on the old snapshot.
   */
  useEffect(() => {
    if (activeTab !== 'brackets') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        loadDataRef.current?.({ silent: true });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [activeTab]);

  /** Mobile admin tab strip: scroll arrows reflect overflow; listen to scroll/resize. */
  useEffect(() => {
    if (isLoading) return;
    const el = adminTabsNavRef.current;
    updateAdminTabsScrollState();
    if (!el) return;
    el.addEventListener('scroll', updateAdminTabsScrollState, { passive: true });
    window.addEventListener('resize', updateAdminTabsScrollState);
    const ro = new ResizeObserver(() => updateAdminTabsScrollState());
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateAdminTabsScrollState);
      window.removeEventListener('resize', updateAdminTabsScrollState);
      ro.disconnect();
    };
  }, [activeTab, isLoading, updateAdminTabsScrollState]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header — desktop (lg+): unchanged layout; mobile: compact rebuild row, validate row, icon-only sign-out */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start justify-between gap-3 lg:block">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
                <p className="mt-1 hidden text-gray-600 lg:block">Manage users and brackets</p>
              </div>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="shrink-0 rounded-lg bg-red-600 p-2 text-white transition-colors hover:bg-red-700 lg:hidden"
                aria-label="Sign out"
                title="Sign out"
                data-testid="admin-sign-out-mobile"
              >
                <LogOut className="h-5 w-5" aria-hidden />
              </button>
            </div>

            {/* Desktop (lg+): two rows — Rebuild: … ; Actions: … — same pattern as mobile */}
            <div className="hidden flex-col gap-2 lg:flex">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs text-gray-500">Rebuild:</span>
                <button
                  type="button"
                  onClick={() => handleRevalidate('/', 'Home Page')}
                  disabled={revalidating !== null}
                  className={`flex items-center space-x-1 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    revalidating === '/'
                      ? 'cursor-wait bg-gray-300 text-gray-500'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  }`}
                  title="Rebuild Home Page (announcements)"
                >
                  {revalidating === '/' ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Home className="h-4 w-4" />
                  )}
                  <span>Home</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRevalidate('/info', 'Info Page')}
                  disabled={revalidating !== null}
                  className={`flex items-center space-x-1 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    revalidating === '/info'
                      ? 'cursor-wait bg-gray-300 text-gray-500'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                  title="Rebuild Info Page (entry, scoring, prizes)"
                >
                  {revalidating === '/info' ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Info className="h-4 w-4" />
                  )}
                  <span>Info</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRevalidate('/hall-of-fame', 'Hall of Fame')}
                  disabled={revalidating !== null}
                  className={`flex items-center space-x-1 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    revalidating === '/hall-of-fame'
                      ? 'cursor-wait bg-gray-300 text-gray-500'
                      : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                  }`}
                  title="Rebuild Hall of Fame"
                >
                  {revalidating === '/hall-of-fame' ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Award className="h-4 w-4" />
                  )}
                  <span>Hall of Fame</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRevalidate('/standings', 'Standings')}
                  disabled={revalidating !== null}
                  className={`flex items-center space-x-1 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    revalidating === '/standings'
                      ? 'cursor-wait bg-gray-300 text-gray-500'
                      : 'bg-violet-100 text-violet-800 hover:bg-violet-200'
                  }`}
                  title="Rebuild Daily + Live standings pages; clears server standings sheet cache (2 min)"
                  data-testid="admin-rebuild-standings-button-desktop"
                >
                  {revalidating === '/standings' ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Table className="h-4 w-4" />
                  )}
                  <span>Standings</span>
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs text-gray-500">Actions:</span>
                <button
                  type="button"
                  onClick={handleValidateConfig}
                  disabled={isValidatingConfig || revalidating !== null}
                  className={`flex items-center space-x-1 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    isValidatingConfig
                      ? 'cursor-wait bg-gray-300 text-gray-500'
                      : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                  }`}
                  title="Validate config values, CTA setup, and image references"
                >
                  {isValidatingConfig ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Info className="h-4 w-4" />
                  )}
                  <span>Validate Config</span>
                </button>
                <button
                  type="button"
                  onClick={handleFlushSiteConfigCache}
                  disabled={revalidating !== null}
                  className={`flex items-center space-x-1 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    revalidating === '__site_config__'
                      ? 'cursor-wait bg-gray-300 text-gray-500'
                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                  }`}
                  title="Clears Next.js site-config cache; /api/site-config may still be CDN-cached up to ~5 min without ?fresh=true"
                  data-testid="admin-flush-site-config-button-desktop"
                >
                  {revalidating === '__site_config__' ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                  <span>Site config cache</span>
                </button>
              </div>
              {revalidateMessage && (
                <span
                  className={`text-sm ${
                    revalidateMessage.startsWith('✅') ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {revalidateMessage}
                </span>
              )}
            </div>

            {/* Mobile: Rebuild: + icons; Actions: + Validate Config (and future buttons) */}
            <div className="flex flex-col gap-2 lg:hidden">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs text-gray-500">Rebuild:</span>
                <button
                  type="button"
                  onClick={() => handleRevalidate('/', 'Home Page')}
                  disabled={revalidating !== null}
                  className={`flex items-center justify-center rounded-lg p-2 transition-colors ${
                    revalidating === '/'
                      ? 'cursor-wait bg-gray-300 text-gray-500'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  }`}
                  title="Rebuild Home Page (announcements)"
                  aria-label="Rebuild Home Page"
                >
                  {revalidating === '/' ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Home className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleRevalidate('/info', 'Info Page')}
                  disabled={revalidating !== null}
                  className={`flex items-center justify-center rounded-lg p-2 transition-colors ${
                    revalidating === '/info'
                      ? 'cursor-wait bg-gray-300 text-gray-500'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                  title="Rebuild Info Page (entry, scoring, prizes)"
                  aria-label="Rebuild Info Page"
                >
                  {revalidating === '/info' ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Info className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleRevalidate('/hall-of-fame', 'Hall of Fame')}
                  disabled={revalidating !== null}
                  className={`flex items-center justify-center rounded-lg p-2 transition-colors ${
                    revalidating === '/hall-of-fame'
                      ? 'cursor-wait bg-gray-300 text-gray-500'
                      : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                  }`}
                  title="Rebuild Hall of Fame"
                  aria-label="Rebuild Hall of Fame"
                >
                  {revalidating === '/hall-of-fame' ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Award className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleRevalidate('/standings', 'Standings')}
                  disabled={revalidating !== null}
                  className={`flex items-center justify-center rounded-lg p-2 transition-colors ${
                    revalidating === '/standings'
                      ? 'cursor-wait bg-gray-300 text-gray-500'
                      : 'bg-violet-100 text-violet-800 hover:bg-violet-200'
                  }`}
                  title="Rebuild Daily + Live standings pages; clears server standings cache"
                  aria-label="Rebuild Standings"
                  data-testid="admin-rebuild-standings-button-mobile"
                >
                  {revalidating === '/standings' ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Table className="h-4 w-4" />
                  )}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs text-gray-500">Actions:</span>
                <button
                  type="button"
                  onClick={handleValidateConfig}
                  disabled={isValidatingConfig || revalidating !== null}
                  className={`flex items-center space-x-1 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    isValidatingConfig
                      ? 'cursor-wait bg-gray-300 text-gray-500'
                      : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                  }`}
                  title="Validate config values, CTA setup, and image references"
                >
                  {isValidatingConfig ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Info className="h-4 w-4" />
                  )}
                  <span>Validate Config</span>
                </button>
                <button
                  type="button"
                  onClick={handleFlushSiteConfigCache}
                  disabled={revalidating !== null}
                  className={`flex items-center space-x-1 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    revalidating === '__site_config__'
                      ? 'cursor-wait bg-gray-300 text-gray-500'
                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                  }`}
                  title="Clears server site-config cache; edge may cache API ~5 min"
                  data-testid="admin-flush-site-config-button-mobile"
                >
                  {revalidating === '__site_config__' ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                  <span>Site config</span>
                </button>
              </div>
              {revalidateMessage && (
                <span
                  className={`text-sm ${
                    revalidateMessage.startsWith('✅') ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {revalidateMessage}
                </span>
              )}
            </div>

            <div className="hidden items-center space-x-4 lg:flex">
              {session?.user && (
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{session.user.name || session.user.email}</p>
                  <p className="text-xs text-gray-500">{session.user.email}</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="flex items-center space-x-2 rounded-lg bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
                data-testid="admin-sign-out-desktop"
              >
                <LogOut className="h-5 w-5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {(configValidationResult || configValidationError) && (
          <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                {configValidationError ? (
                  <p className="text-red-600 text-sm font-medium">
                    Config validation failed: {configValidationError}
                  </p>
                ) : (
                  <p className="text-sm font-medium text-gray-900">
                    Config validation complete:
                    <span className={`ml-2 ${configValidationResult?.summary.isValid ? 'text-green-600' : 'text-red-600'}`}>
                      {configValidationResult?.summary.isValid ? 'No blocking errors' : 'Blocking errors found'}
                    </span>
                  </p>
                )}
                {configValidationResult && (
                  <p className="text-xs text-gray-600 mt-1">
                    Errors: {configValidationResult.summary.errors} | Warnings: {configValidationResult.summary.warnings} | Info: {configValidationResult.summary.infos} | Active CTAs: {configValidationResult.summary.activeCtaCount}
                  </p>
                )}
              </div>

              {configValidationResult && (
                <button
                  onClick={() => setShowValidationDetails((prev) => !prev)}
                  className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  {showValidationDetails ? 'Hide Details' : 'Show Details'}
                </button>
              )}
            </div>

            {configValidationResult && showValidationDetails && (
              <div className="mt-4 border-t border-gray-200 pt-3 space-y-2 max-h-80 overflow-auto">
                {configValidationResult.issues.length === 0 ? (
                  <p className="text-sm text-green-700">No issues found.</p>
                ) : (
                  configValidationResult.issues.map((issue, index) => (
                    <div
                      key={`${issue.field}-${index}`}
                      className={`text-sm px-3 py-2 rounded ${
                        issue.severity === 'error'
                          ? 'bg-red-50 text-red-700'
                          : issue.severity === 'warning'
                            ? 'bg-yellow-50 text-yellow-800'
                            : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      <span className="font-semibold uppercase mr-2">{issue.severity}</span>
                      <span className="font-mono text-xs mr-2">{issue.field}</span>
                      <span>{issue.message}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-3">
            <div className="min-w-0 w-full lg:flex-1">
              <div className="flex flex-row items-center justify-between gap-2 lg:block lg:justify-start">
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Power className={`h-4 w-4 shrink-0 ${killSwitchEnabled ? 'text-green-600' : 'text-red-600'}`} />
                  Master Kill Switch
                </p>
                <button
                  type="button"
                  onClick={handleToggleKillSwitch}
                  disabled={killSwitchLoading}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors lg:hidden ${
                    killSwitchLoading
                      ? 'cursor-wait bg-gray-300 text-gray-500'
                      : killSwitchEnabled
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                  data-testid="admin-kill-switch-toggle-mobile"
                >
                  <Power className="h-3.5 w-3.5" />
                  {killSwitchLoading ? '…' : killSwitchEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
              <p className="mt-1 hidden text-xs text-gray-600 lg:block">
                Controls New, Copy, Edit, Delete, Save, and Submit bracket actions.
              </p>
              {!killSwitchEnabled && (
                <p className="mt-1 hidden text-xs text-amber-700 lg:block">
                  Disabled hover message: {killSwitchMessage}
                </p>
              )}
              {killSwitchError && <p className="mt-1 text-xs text-red-600">{killSwitchError}</p>}
            </div>

            <button
              type="button"
              onClick={handleToggleKillSwitch}
              disabled={killSwitchLoading}
              className={`hidden items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors lg:inline-flex ${
                killSwitchLoading
                  ? 'cursor-wait bg-gray-300 text-gray-500'
                  : killSwitchEnabled
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-red-600 text-white hover:bg-red-700'
              }`}
              data-testid="admin-kill-switch-toggle-desktop"
            >
              <Power className="h-4 w-4" />
              {killSwitchLoading ? 'Updating...' : killSwitchEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Navigation Tabs — mobile: icon-only + edge arrows; lg+: icon + label */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-stretch border-b border-gray-200 lg:border-b-0">
            <button
              type="button"
              className="flex w-9 shrink-0 items-center justify-center bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-35 lg:hidden"
              aria-label="Scroll tabs left"
              title="More tabs this way"
              disabled={!adminTabsCanScrollLeft}
              onClick={() => scrollAdminTabs(-1)}
              data-testid="admin-tabs-scroll-left"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <nav
              ref={adminTabsNavRef}
              className="flex min-w-0 flex-1 flex-nowrap gap-2 overflow-x-auto border-b-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden lg:min-w-full lg:gap-4 lg:overflow-x-visible lg:border-b lg:border-gray-200"
            >
              <button
                type="button"
                aria-label="Users"
                onClick={() => handleSetActiveTab('users')}
                className={`flex shrink-0 items-center justify-center whitespace-nowrap border-b-2 px-2.5 py-2 text-sm font-medium lg:justify-start lg:px-4 ${
                  activeTab === 'users'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <Users className="inline h-5 w-5 shrink-0 lg:mr-2 lg:h-4 lg:w-4" aria-hidden />
                <span className="hidden lg:inline">Users</span>
              </button>
              <button
                type="button"
                aria-label="Brackets"
                onClick={() => handleSetActiveTab('brackets')}
                className={`flex shrink-0 items-center justify-center whitespace-nowrap border-b-2 px-2.5 py-2 text-sm font-medium lg:justify-start lg:px-4 ${
                  activeTab === 'brackets'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <LaptopMinimalCheck className="inline h-5 w-5 shrink-0 lg:mr-2 lg:h-4 lg:w-4" aria-hidden />
                <span className="hidden lg:inline">Brackets</span>
              </button>
              <button
                type="button"
                aria-label="Live results key"
                onClick={() => handleSetActiveTab('live-results')}
                className={`flex shrink-0 items-center justify-center whitespace-nowrap border-b-2 px-2.5 py-2 text-sm font-medium lg:justify-start lg:px-4 ${
                  activeTab === 'live-results'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <KeyRound className="inline h-5 w-5 shrink-0 lg:mr-2 lg:h-4 lg:w-4" aria-hidden />
                <span className="hidden lg:inline">Key</span>
              </button>
              <button
                type="button"
                aria-label="Teams"
                onClick={() => handleSetActiveTab('data')}
                className={`flex shrink-0 items-center justify-center whitespace-nowrap border-b-2 px-2.5 py-2 text-sm font-medium lg:justify-start lg:px-4 ${
                  activeTab === 'data'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <Table className="inline h-5 w-5 shrink-0 lg:mr-2 lg:h-4 lg:w-4" aria-hidden />
                <span className="hidden lg:inline">Teams</span>
              </button>
              <button
                type="button"
                aria-label="Tourney"
                onClick={() => handleSetActiveTab('tourney')}
                className={`flex shrink-0 items-center justify-center whitespace-nowrap border-b-2 px-2.5 py-2 text-sm font-medium lg:justify-start lg:px-4 ${
                  activeTab === 'tourney'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <Pencil className="inline h-5 w-5 shrink-0 lg:mr-2 lg:h-4 lg:w-4" aria-hidden />
                <span className="hidden lg:inline">Tourney</span>
              </button>
              <button
                type="button"
                aria-label="Logs"
                onClick={() => handleSetActiveTab('logs')}
                className={`flex shrink-0 items-center justify-center whitespace-nowrap border-b-2 px-2.5 py-2 text-sm font-medium lg:justify-start lg:px-4 ${
                  activeTab === 'logs'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <Link2 className="inline h-5 w-5 shrink-0 lg:mr-2 lg:h-4 lg:w-4" aria-hidden />
                <span className="hidden lg:inline">Logs</span>
              </button>
              <button
                type="button"
                aria-label="Usage"
                onClick={() => handleSetActiveTab('usage')}
                className={`flex shrink-0 items-center justify-center whitespace-nowrap border-b-2 px-2.5 py-2 text-sm font-medium lg:justify-start lg:px-4 ${
                  activeTab === 'usage'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <Zap className="inline h-5 w-5 shrink-0 lg:mr-2 lg:h-4 lg:w-4" aria-hidden />
                <span className="hidden lg:inline">Usage</span>
              </button>
              <button
                type="button"
                aria-label="Payments"
                onClick={() => handleSetActiveTab('payments')}
                className={`flex shrink-0 items-center justify-center whitespace-nowrap border-b-2 px-2.5 py-2 text-sm font-medium lg:justify-start lg:px-4 ${
                  activeTab === 'payments'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <DollarSign className="inline h-5 w-5 shrink-0 lg:mr-2 lg:h-4 lg:w-4" aria-hidden />
                <span className="hidden lg:inline">Payments</span>
              </button>
            </nav>
            <button
              type="button"
              className="flex w-9 shrink-0 items-center justify-center bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-35 lg:hidden"
              aria-label="Scroll tabs right"
              title="More tabs this way"
              disabled={!adminTabsCanScrollRight}
              onClick={() => scrollAdminTabs(1)}
              data-testid="admin-tabs-scroll-right"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'users' && (
          <UsersTab users={users} onReload={loadData} />
        )}

        {activeTab === 'brackets' && (
          <BracketsTab users={users} brackets={brackets} onReload={loadData} />
        )}

        {activeTab === 'live-results' && (
          <LiveResultsTab brackets={brackets} />
        )}

        {/* Teams tab (TeamDataTab) */}
        {activeTab === 'data' && (
          <TeamDataTab />
        )}

        {activeTab === 'tourney' && (
          <TourneyTab />
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <LogsTab />
        )}

        {/* Usage tab */}
        {activeTab === 'usage' && (
          <UsageMonitoringTab />
        )}

        {/* Payments tab */}
        {activeTab === 'payments' && (
          <PaymentsTab />
        )}

      </div>
    </div>
  );
}
