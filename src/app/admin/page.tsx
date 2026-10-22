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
  KeyRound,
  Pencil,
  ChevronLeft,
  ChevronRight,
  DollarSign,
} from 'lucide-react';
import { useBracketMode } from '@/contexts/BracketModeContext';
import UsersTab from '@/components/admin/UsersTab';
import BracketsTab from '@/components/admin/BracketsTab';
import TeamDataTab from '@/components/admin/TeamDataTab';
import TourneyTab from '@/components/admin/TourneyTab';
import LogsTab from '@/components/admin/LogsTab';
import LiveResultsTab from '@/components/admin/LiveResultsTab';
import PaymentsTab from '@/components/admin/PaymentsTab';

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

type AdminTab =
  | 'brackets'
  | 'users'
  | 'live-results'
  | 'data'
  | 'tourney'
  | 'logs'
  | 'payments';

const ADMIN_TABS: AdminTab[] = [
  'brackets',
  'users',
  'live-results',
  'data',
  'tourney',
  'logs',
  'payments',
];

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setInBracketMode } = useBracketMode();

  const [users, setUsers] = useState<User[]>([]);
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  useEffect(() => {
    setInBracketMode(false);
  }, [setInBracketMode]);

  const loadDataRef = useRef<((options?: { silent?: boolean }) => Promise<void>) | undefined>(
    undefined,
  );
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

      const [usersRes, bracketsRes] = await Promise.all([
        fetch('/api/admin/users', { cache: 'no-store' }),
        fetch('/api/admin/brackets', { cache: 'no-store' }),
      ]);

      const usersData = await usersRes.json();
      const bracketsData = await bracketsRes.json();

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
    } catch (err) {
      console.error('Error loading admin data:', err);
      setError('Failed to load admin data');
    } finally {
      if (!options?.silent) {
        setIsLoading(false);
      }
    }
  };

  /** Helper function to update URL with new tab. */
  const updateUrlTab = (
    tab: AdminTab,
    logsTab?: 'summary' | 'usage' | 'error' | 'email',
    emailView?: 'summary' | 'detail',
  ) => {
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

  const handleSetActiveTab = (tab: AdminTab) => {
    setActiveTab(tab);
    updateUrlTab(tab);
  };

  loadDataRef.current = loadData;

  useEffect(() => {
    if (!searchParams) return;

    const tabParam = searchParams.get('tab');
    if (tabParam && ADMIN_TABS.includes(tabParam as AdminTab)) {
      const newTab = tabParam as AdminTab;
      if (newTab !== activeTab) {
        setActiveTab(newTab);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 lg:text-3xl">Admin Panel</h1>
              <p className="mt-1 text-sm text-gray-600 lg:text-base">
                Welcome, {session?.user?.name || session?.user?.email}
              </p>
            </div>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="flex items-center space-x-2 rounded-lg bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
              data-testid="admin-sign-out-button"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

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

        {activeTab === 'users' && <UsersTab users={users} onReload={loadData} />}

        {activeTab === 'brackets' && (
          <BracketsTab users={users} brackets={brackets} onReload={loadData} />
        )}

        {activeTab === 'live-results' && <LiveResultsTab brackets={brackets} />}

        {activeTab === 'data' && <TeamDataTab />}

        {activeTab === 'tourney' && <TourneyTab />}

        {activeTab === 'logs' && <LogsTab />}

        {activeTab === 'payments' && <PaymentsTab />}
      </div>
    </div>
  );
}
