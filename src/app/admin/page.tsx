'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Users, Trophy, LogOut, Link2, Table, Zap, RefreshCw, Home, Info, Award } from 'lucide-react';
import { useBracketMode } from '@/contexts/BracketModeContext';
import UsersTab from '@/components/admin/UsersTab';
import BracketsTab from '@/components/admin/BracketsTab';
import UsageMonitoringTab from '@/components/admin/UsageMonitoringTab';
import TeamDataTab from '@/components/admin/TeamDataTab';
import LogsTab from '@/components/admin/LogsTab';

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
  picks: Record<string, string>;
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

  // Tab state
  const [activeTab, setActiveTab] = useState<'brackets' | 'users' | 'data' | 'logs' | 'usage'>('users');

  // Ensure bracket mode is disabled when admin page loads
  useEffect(() => {
    setInBracketMode(false);
  }, [setInBracketMode]);

  const loadDataRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const [usersRes, bracketsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/brackets')
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
    } catch (error) {
      console.error('Error loading admin data:', error);
      setError('Failed to load admin data');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Trigger on-demand revalidation for a static page
   */
  const handleRevalidate = async (path: string, pageName: string) => {
    setRevalidating(path);
    setRevalidateMessage(null);
    
    try {
      const response = await fetch('/api/admin/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setRevalidateMessage(`✅ ${pageName} rebuilt successfully`);
      } else {
        setRevalidateMessage(`❌ Failed to rebuild ${pageName}: ${result.error}`);
      }
    } catch {
      setRevalidateMessage(`❌ Failed to rebuild ${pageName}`);
    } finally {
      setRevalidating(null);
      // Clear message after 3 seconds
      setTimeout(() => setRevalidateMessage(null), 3000);
    }
  };

  // Helper function to update URL with new tab
  const updateUrlTab = (tab: 'brackets' | 'users' | 'data' | 'logs' | 'usage', logsTab?: 'summary' | 'usage' | 'error' | 'email', emailView?: 'summary' | 'detail') => {
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
  const handleSetActiveTab = (tab: 'brackets' | 'users' | 'data' | 'logs' | 'usage') => {
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
    if (tabParam && ['brackets', 'users', 'data', 'logs', 'usage'].includes(tabParam)) {
      const newTab = tabParam as 'brackets' | 'users' | 'data' | 'logs' | 'usage';
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
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
              <p className="text-gray-600 mt-1">Manage users and brackets</p>
            </div>
            
            {/* Rebuild Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500 mr-1">Rebuild:</span>
              <button
                onClick={() => handleRevalidate('/', 'Home Page')}
                disabled={revalidating !== null}
                className={`flex items-center space-x-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  revalidating === '/'
                    ? 'bg-gray-300 text-gray-500 cursor-wait'
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
                onClick={() => handleRevalidate('/info', 'Info Page')}
                disabled={revalidating !== null}
                className={`flex items-center space-x-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  revalidating === '/info'
                    ? 'bg-gray-300 text-gray-500 cursor-wait'
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
                onClick={() => handleRevalidate('/hall-of-fame', 'Hall of Fame')}
                disabled={revalidating !== null}
                className={`flex items-center space-x-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  revalidating === '/hall-of-fame'
                    ? 'bg-gray-300 text-gray-500 cursor-wait'
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
              
              {/* Revalidate message */}
              {revalidateMessage && (
                <span className={`text-sm ml-2 ${
                  revalidateMessage.startsWith('✅') ? 'text-green-600' : 'text-red-600'
                }`}>
                  {revalidateMessage}
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              {session?.user && (
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{session.user.name || session.user.email}</p>
                  <p className="text-xs text-gray-500">{session.user.email}</p>
                </div>
              )}
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <nav className="flex space-x-4 border-b border-gray-200">
            <button
              onClick={() => handleSetActiveTab('users')}
              className={`px-4 py-2 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="inline h-4 w-4 mr-2" />
              Users
            </button>
            <button
              onClick={() => handleSetActiveTab('brackets')}
              className={`px-4 py-2 border-b-2 font-medium text-sm ${
                activeTab === 'brackets'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Trophy className="inline h-4 w-4 mr-2" />
              Brackets
            </button>
            <button
              onClick={() => handleSetActiveTab('data')}
              className={`px-4 py-2 border-b-2 font-medium text-sm ${
                activeTab === 'data'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Table className="inline h-4 w-4 mr-2" />
              Team Data
            </button>
            <button
              onClick={() => handleSetActiveTab('logs')}
              className={`px-4 py-2 border-b-2 font-medium text-sm ${
                activeTab === 'logs'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Link2 className="inline h-4 w-4 mr-2" />
              Logs
            </button>
            <button
              onClick={() => handleSetActiveTab('usage')}
              className={`px-4 py-2 border-b-2 font-medium text-sm ${
                activeTab === 'usage'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Zap className="inline h-4 w-4 mr-2" />
              Usage Monitoring
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'users' && (
          <UsersTab users={users} onReload={loadData} />
        )}

        {activeTab === 'brackets' && (
          <BracketsTab users={users} brackets={brackets} onReload={loadData} />
        )}

        {/* Data Tab */}
        {activeTab === 'data' && (
          <TeamDataTab />
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <LogsTab />
        )}

        {/* Usage Monitoring Tab */}
        {activeTab === 'usage' && (
          <UsageMonitoringTab />
        )}

      </div>
    </div>
  );
}
