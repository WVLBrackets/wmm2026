'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Trash2, Edit, Save, X, Users, Trophy, CheckCircle, Key, Edit3, LogOut, Link2, Table, Plus, Download, AlertCircle, Power, PowerOff, Zap } from 'lucide-react';
import { useBracketMode } from '@/contexts/BracketModeContext';

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

interface UsageLog {
  id: string;
  environment: string;
  timestamp: string;
  isLoggedIn: boolean;
  username: string | null;
  eventType: string;
  location: string;
  bracketId: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface ErrorLog {
  id: string;
  environment: string;
  timestamp: string;
  isLoggedIn: boolean;
  username: string | null;
  errorMessage: string;
  errorStack: string | null;
  errorType: string | null;
  location: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface EmailLog {
  id: string;
  environment: string;
  timestamp: string;
  eventType: string;
  destinationEmail: string;
  attachmentExpected: boolean;
  attachmentSuccess: boolean | null;
  emailSuccess: boolean;
  createdAt: string;
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
  
  // Get initial tab from URL, default to 'users'
  const getInitialTab = (): 'brackets' | 'users' | 'data' | 'logs' | 'usage' => {
    const tabParam = searchParams?.get('tab');
    if (tabParam && ['brackets', 'users', 'data', 'logs', 'usage'].includes(tabParam)) {
      return tabParam as 'brackets' | 'users' | 'data' | 'logs' | 'usage';
    }
    return 'users';
  };

  // Get initial logsTab from URL
  const getInitialLogsTab = (): 'summary' | 'usage' | 'error' | 'email' => {
    const logsTabParam = searchParams?.get('logsTab');
    if (logsTabParam && ['summary', 'usage', 'error', 'email'].includes(logsTabParam)) {
      return logsTabParam as 'summary' | 'usage' | 'error' | 'email';
    }
    return 'summary';
  };

  // Get initial emailLogsView from URL
  const getInitialEmailLogsView = (): 'summary' | 'detail' => {
    const viewParam = searchParams?.get('emailView');
    if (viewParam && ['summary', 'detail'].includes(viewParam)) {
      return viewParam as 'summary' | 'detail';
    }
    return 'summary';
  };
  
  const [users, setUsers] = useState<User[]>([]);
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [filteredBrackets, setFilteredBrackets] = useState<Bracket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'brackets' | 'users' | 'data' | 'logs' | 'usage'>(getInitialTab());
  const [logsTab, setLogsTab] = useState<'summary' | 'usage' | 'error' | 'email'>(getInitialLogsTab());
  const [emailLogsView, setEmailLogsView] = useState<'summary' | 'detail'>(getInitialEmailLogsView());
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [allUsageLogs, setAllUsageLogs] = useState<UsageLog[]>([]); // Store all logs for dropdown options
  const [loadAllLogs, setLoadAllLogs] = useState(false);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [usageSummary, setUsageSummary] = useState<{
    gridData: Array<{
      date: string;
      locations: Array<{ location: string; pageVisits: number; clicks: number }>;
      dayTotal: { pageVisits: number; clicks: number };
    }>;
    locationTotals: Array<{ location: string; pageVisits: number; clicks: number }>;
    totals: { pageVisits: number; clicks: number };
  }>({
    gridData: [],
    locationTotals: [],
    totals: { pageVisits: 0, clicks: 0 },
  });
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState('');
  const [logStartDate, setLogStartDate] = useState<string>('');
  const [logEndDate, setLogEndDate] = useState<string>('');
  const [logUsernameFilter, setLogUsernameFilter] = useState<string>('');
  const [logEventTypeFilter, setLogEventTypeFilter] = useState<string>('');
  const [logLocationFilter, setLogLocationFilter] = useState<string>('');
  const [deletingLogs, setDeletingLogs] = useState(false);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [emailSummary, setEmailSummary] = useState<{
    gridData: Array<{
      date: string;
      events: Array<{ eventType: string; count: number }>;
      dayTotal: { emails: number; pdfs: number; pdfSuccess: number };
    }>;
    eventTotals: Array<{ eventType: string; count: number }>;
    totals: { emails: number; pdfs: number; pdfSuccess: number };
  }>({
    gridData: [],
    eventTotals: [],
    totals: { emails: 0, pdfs: 0, pdfSuccess: 0 },
  });
  const [emailLogEventTypeFilter, setEmailLogEventTypeFilter] = useState<string>('all');
  const [emailLogEmailFilter, setEmailLogEmailFilter] = useState<string>('');
  const [emailLogAttachmentExpectedFilter, setEmailLogAttachmentExpectedFilter] = useState<string>('');
  const [emailLogAttachmentSuccessFilter, setEmailLogAttachmentSuccessFilter] = useState<string>('');
  const [emailLogEmailSuccessFilter, setEmailLogEmailSuccessFilter] = useState<string>('');
  const [usageMonitoring, setUsageMonitoring] = useState<{
    usage: {
      emails: {
        monthly: { used: number; successful: number; limit: number; percent: number; alertLevel: string; projected: number; daysRemaining: number; daysInMonth: number };
        daily: { used: number; successful: number; limit: number; percent: number; alertLevel: string };
        provider?: string;
        providerName?: string;
      };
      pdfs: {
        monthly: { generated: number; successful: number };
        daily: { generated: number; successful: number };
      };
    };
    limits: {
      email: {
        monthly: number;
        daily: number;
        name: string;
        upgradeCost: {
          tier1: { range: string; cost: number; description: string };
          tier2?: { range: string; cost: number; description: string };
          tier3?: { range: string; cost: number; description: string };
        };
      };
      vercel: {
        name: string;
        functionExecution: { limit: number; description: string };
        bandwidth: { limit: number; description: string };
        upgradeCost: {
          pro: { cost: number; description: string };
          additional: { description: string };
        };
      };
    };
    recommendations: { emails: string; actions: { immediate: string[]; optimization: string[] } };
  } | null>(null);
  const [usageMonitoringLoading, setUsageMonitoringLoading] = useState(false);
  const [initializingDatabase, setInitializingDatabase] = useState(false);
  const [databaseInitMessage, setDatabaseInitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingBracket, setEditingBracket] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Bracket>>({});
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterCreatedDate, setFilterCreatedDate] = useState<string>('');
  const [filterUpdatedDate, setFilterUpdatedDate] = useState<string>('');
  const [changingPasswordUserId, setChangingPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');
  const [showEndpoints, setShowEndpoints] = useState(false);
  const [teamData, setTeamData] = useState<Record<string, { id: string; name: string; mascot?: string; logo: string; active?: boolean }>>({});
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editingTeamData, setEditingTeamData] = useState<{ key: string; id: string; name: string; mascot?: string; logo: string; active?: boolean } | null>(null);
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncTeamId, setSyncTeamId] = useState('');
  const [syncResult, setSyncResult] = useState<{ report: { id?: string; action?: string; dbName?: string; espnName?: string; mascot?: string; logoUrl?: string; message?: string; details?: string } | null; loading: boolean } | null>(null);
  const [newTeamData, setNewTeamData] = useState<{ key: string; id: string; name: string; mascot?: string; logo: string; active?: boolean }>({ key: '', id: '', name: '', mascot: '', logo: '', active: true });
  const [teamDataError, setTeamDataError] = useState('');
  const [teamFilters, setTeamFilters] = useState<{ key: string; id: string; name: string; mascot: string; logo: string }>({ key: '', id: '', name: '', mascot: '', logo: '' });
  const [teamSortColumn, setTeamSortColumn] = useState<'name' | 'mascot' | 'key' | 'id' | null>('name');
  const [teamSortOrder, setTeamSortOrder] = useState<'asc' | 'desc'>('asc');
  const [duplicateCheck, setDuplicateCheck] = useState<{ hasDuplicates: boolean; duplicateIds: string[] }>({ hasDuplicates: false, duplicateIds: [] });
  const [teamActiveFilter, setTeamActiveFilter] = useState<'all' | 'active' | 'inactive'>('active');

  // Ensure bracket mode is disabled when admin page loads
  useEffect(() => {
    setInBracketMode(false);
  }, [setInBracketMode]);

  const loadDataRef = useRef<(() => Promise<void>) | undefined>(undefined);

  useEffect(() => {
    // Filter brackets when filters change
    let filtered = brackets;
    
    if (filterUser !== 'all') {
      filtered = filtered.filter(b => b.userId === filterUser);
    }
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(b => b.status === filterStatus);
    }
    
    if (filterYear !== 'all') {
      const yearNum = parseInt(filterYear);
      filtered = filtered.filter(b => b.year === yearNum);
    }
    
    // Filter by created date (match date only, ignore time)
    // Handle timezone properly: date input gives YYYY-MM-DD in local timezone
    if (filterCreatedDate) {
      // Parse the date string (YYYY-MM-DD) and create date in local timezone
      const [year, month, day] = filterCreatedDate.split('-').map(Number);
      const filterDateStart = new Date(year, month - 1, day, 0, 0, 0, 0); // Local midnight start
      
      filtered = filtered.filter(b => {
        const createdDate = new Date(b.createdAt);
        // Compare dates by converting both to local date strings
        const createdDateStr = createdDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit' 
        });
        const filterDateStr = filterDateStart.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit' 
        });
        return createdDateStr === filterDateStr;
      });
    }
    
    // Filter by updated date (match date only, ignore time)
    // Handle timezone properly: date input gives YYYY-MM-DD in local timezone
    if (filterUpdatedDate) {
      // Parse the date string (YYYY-MM-DD) and create date in local timezone
      const [year, month, day] = filterUpdatedDate.split('-').map(Number);
      const filterDateStart = new Date(year, month - 1, day, 0, 0, 0, 0); // Local midnight start
      
      filtered = filtered.filter(b => {
        const updatedDate = new Date(b.updatedAt);
        // Compare dates by converting both to local date strings
        const updatedDateStr = updatedDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit' 
        });
        const filterDateStr = filterDateStart.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit' 
        });
        return updatedDateStr === filterDateStr;
      });
    }
    
    setFilteredBrackets(filtered);
  }, [brackets, filterUser, filterStatus, filterYear, filterCreatedDate, filterUpdatedDate]);

  const loadTeamDataRef = useRef<(() => Promise<void>) | undefined>(undefined);

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
      setFilteredBrackets(bracketsData.data || []);
    } catch (error) {
      console.error('Error loading admin data:', error);
      setError('Failed to load admin data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsageLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      setLogsError('');
      
      const params = new URLSearchParams();
      if (!loadAllLogs) {
        params.append('limit', '100');
      }
      if (logStartDate) {
        // Convert datetime-local (user's local time) to UTC ISO string
        // datetime-local format: "YYYY-MM-DDTHH:mm"
        const localDate = new Date(logStartDate);
        params.append('startDate', localDate.toISOString());
      }
      if (logEndDate) {
        // Convert datetime-local (user's local time) to UTC ISO string
        const localDate = new Date(logEndDate);
        // For end date, include the entire second
        localDate.setMilliseconds(999);
        params.append('endDate', localDate.toISOString());
      }
      if (logUsernameFilter) {
        params.append('username', logUsernameFilter);
      }
      if (logEventTypeFilter) {
        params.append('eventType', logEventTypeFilter);
      }
      if (logLocationFilter) {
        params.append('location', logLocationFilter);
      }
      
      const response = await fetch(`/api/admin/logs/usage?${params.toString()}`);
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        const errorMsg = data.error || data.details || 'Failed to load usage logs';
        throw new Error(errorMsg);
      }
      
      const logs = data.logs || [];
      setUsageLogs(logs);
      
      // If no filters are applied, update allUsageLogs for dropdown options
      // This ensures dropdowns always show all available options
      if (!logUsernameFilter && !logEventTypeFilter && !logLocationFilter) {
        setAllUsageLogs(logs);
      }
    } catch (error) {
      console.error('Error loading usage logs:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load usage logs';
      setLogsError(errorMessage);
    } finally {
      setLogsLoading(false);
    }
  }, [logStartDate, logEndDate, logUsernameFilter, logEventTypeFilter, logLocationFilter, loadAllLogs]);

  const loadErrorLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      setLogsError('');
      
      const params = new URLSearchParams({ limit: '100' });
      if (logStartDate) {
        // Convert datetime-local (user's local time) to UTC ISO string
        const localDate = new Date(logStartDate);
        params.append('startDate', localDate.toISOString());
      }
      if (logEndDate) {
        // Convert datetime-local (user's local time) to UTC ISO string
        const localDate = new Date(logEndDate);
        // For end date, include the entire second
        localDate.setMilliseconds(999);
        params.append('endDate', localDate.toISOString());
      }
      
      const response = await fetch(`/api/admin/logs/error?${params.toString()}`);
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        const errorMsg = data.error || data.details || 'Failed to load error logs';
        throw new Error(errorMsg);
      }
      
      setErrorLogs(data.logs || []);
    } catch (error) {
      console.error('Error loading error logs:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load error logs';
      setLogsError(errorMessage);
    } finally {
      setLogsLoading(false);
    }
  }, [logStartDate, logEndDate]);

  const loadUsageSummary = useCallback(async () => {
    try {
      setLogsLoading(true);
      setLogsError('');
      
      const params = new URLSearchParams();
      if (logStartDate) {
        // Convert datetime-local (user's local time) to UTC ISO string
        const localDate = new Date(logStartDate);
        params.append('startDate', localDate.toISOString());
      }
      if (logEndDate) {
        // Convert datetime-local (user's local time) to UTC ISO string
        const localDate = new Date(logEndDate);
        // For end date, include the entire second
        localDate.setMilliseconds(999);
        params.append('endDate', localDate.toISOString());
      }
      
      const response = await fetch(`/api/admin/logs/usage/summary?${params.toString()}`);
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        const errorMsg = data.error || data.details || 'Failed to load usage summary';
        throw new Error(errorMsg);
      }
      
      setUsageSummary(data.summary || {
        gridData: [],
        locationTotals: [],
        totals: { pageVisits: 0, clicks: 0 },
      });
    } catch (error) {
      console.error('Error loading usage summary:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load usage summary';
      setLogsError(errorMessage);
    } finally {
      setLogsLoading(false);
    }
  }, [logStartDate, logEndDate]);

  const loadEmailSummary = useCallback(async () => {
    try {
      setLogsLoading(true);
      setLogsError('');
      
      const params = new URLSearchParams();
      if (logStartDate) {
        const localDate = new Date(logStartDate);
        params.append('startDate', localDate.toISOString());
      }
      if (logEndDate) {
        const localDate = new Date(logEndDate);
        localDate.setMilliseconds(999);
        params.append('endDate', localDate.toISOString());
      }
      
      const response = await fetch(`/api/admin/logs/email/summary?${params.toString()}`);
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        const errorMsg = data.error || data.details || 'Failed to load email summary';
        throw new Error(errorMsg);
      }
      
      setEmailSummary(data.summary || {
        gridData: [],
        eventTotals: [],
        totals: { emails: 0, pdfs: 0, pdfSuccess: 0 },
      });
    } catch (error) {
      console.error('Error loading email summary:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load email summary';
      setLogsError(errorMessage);
    } finally {
      setLogsLoading(false);
    }
  }, [logStartDate, logEndDate]);

  const loadEmailLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      setLogsError('');
      
      const params = new URLSearchParams({ limit: '100' });
      if (logStartDate) {
        const localDate = new Date(logStartDate);
        params.append('startDate', localDate.toISOString());
      }
      if (logEndDate) {
        const localDate = new Date(logEndDate);
        localDate.setMilliseconds(999);
        params.append('endDate', localDate.toISOString());
      }
      if (emailLogEventTypeFilter && emailLogEventTypeFilter !== 'all') {
        params.append('eventType', emailLogEventTypeFilter);
      }
      if (emailLogEmailFilter) {
        params.append('destinationEmail', emailLogEmailFilter);
      }
      if (emailLogAttachmentExpectedFilter !== '') {
        params.append('attachmentExpected', emailLogAttachmentExpectedFilter);
      }
      if (emailLogAttachmentSuccessFilter !== '') {
        params.append('attachmentSuccess', emailLogAttachmentSuccessFilter);
      }
      if (emailLogEmailSuccessFilter !== '') {
        params.append('emailSuccess', emailLogEmailSuccessFilter);
      }
      
      const response = await fetch(`/api/admin/logs/email?${params.toString()}`);
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        const errorMsg = data.error || data.details || 'Failed to load email logs';
        throw new Error(errorMsg);
      }
      
      setEmailLogs(data.logs || []);
    } catch (error) {
      console.error('Error loading email logs:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load email logs';
      setLogsError(errorMessage);
    } finally {
      setLogsLoading(false);
    }
  }, [logStartDate, logEndDate, emailLogEventTypeFilter, emailLogEmailFilter, emailLogAttachmentExpectedFilter, emailLogAttachmentSuccessFilter, emailLogEmailSuccessFilter]);

  const loadUsageMonitoring = useCallback(async () => {
    try {
      setUsageMonitoringLoading(true);
      setLogsError('');
      
      const response = await fetch('/api/admin/usage-monitoring');
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        const errorMsg = data.error || data.details || 'Failed to load usage monitoring data';
        throw new Error(errorMsg);
      }
      
      setUsageMonitoring(data);
    } catch (error) {
      console.error('Error loading usage monitoring:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load usage monitoring data';
      setLogsError(errorMessage);
    } finally {
      setUsageMonitoringLoading(false);
    }
  }, []);

  const handleDeleteLogs = async () => {
    const logType = logsTab === 'usage' ? 'usage' : 'error';
    const count = logsTab === 'usage' ? usageLogs.length : errorLogs.length;
    
    if (count === 0) {
      alert('No logs to delete');
      return;
    }
    
    // Show confirmation with count of records to be deleted
    const dateRange = (logStartDate && logEndDate) ? ` from ${logStartDate} to ${logEndDate}` : '';
    const confirmMessage = `Are you sure you want to delete ${count} ${logType} log${count !== 1 ? 's' : ''}${dateRange}? This action cannot be undone.`;
    if (!confirm(confirmMessage)) {
      return;
    }
    
    try {
      setDeletingLogs(true);
      
      const params = new URLSearchParams();
      // Only include date filters if they are set
      if (logStartDate) {
        const startDateUTC = new Date(logStartDate).toISOString();
        params.append('startDate', startDateUTC);
      }
      if (logEndDate) {
        const endDateUTC = new Date(logEndDate).toISOString();
        params.append('endDate', endDateUTC);
      }
      
      const response = await fetch(`/api/admin/logs/${logType}/delete?${params.toString()}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete logs');
      }
      
      // Reload logs after deletion
      if (logsTab === 'usage') {
        await loadUsageLogs();
      } else {
        await loadErrorLogs();
      }
    } catch (error) {
      console.error('Error deleting logs:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete logs');
    } finally {
      setDeletingLogs(false);
    }
  };

  const handleInitializeDatabase = async () => {
    if (!confirm('This will create the usage_logs and error_logs tables if they don\'t exist. Continue?')) {
      return;
    }

    try {
      setInitializingDatabase(true);
      setDatabaseInitMessage(null);
      setLogsError('');

      const response = await fetch('/api/init-database', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setDatabaseInitMessage({ type: 'success', text: 'Database tables initialized successfully!' });
        // Reload logs after initialization
        if (logsTab === 'summary') {
          await loadUsageSummary();
        } else if (logsTab === 'usage') {
          await loadUsageLogs();
        } else if (logsTab === 'error') {
          await loadErrorLogs();
        } else if (logsTab === 'email') {
          await loadEmailSummary();
        }
      } else {
        setDatabaseInitMessage({ type: 'error', text: data.error || 'Failed to initialize database' });
      }
    } catch (error) {
      console.error('Error initializing database:', error);
      setDatabaseInitMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to initialize database' });
    } finally {
      setInitializingDatabase(false);
    }
  };

  const loadTeamData = async () => {
    try {
      setTeamDataError('');
      setIsLoading(true);
      
      // Build URL with active filter
      let url = '/api/admin/team-data';
      if (teamActiveFilter === 'active') {
        url += '?activeOnly=true';
      } else if (teamActiveFilter === 'inactive') {
        // For inactive, we need all teams and filter client-side
        url += '';
      } else {
        // 'all' - get all teams
        url += '';
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        const errorMessage = data.error || 'Failed to load team data';
        throw new Error(errorMessage);
      }
      
      // Type assertion for team data from API
      const loadedData = (data.data as Record<string, { id: string; name: string; mascot?: string; logo: string; active?: boolean }>) || {};
      
      // Filter by active status if needed
      let filteredData = loadedData;
      if (teamActiveFilter === 'inactive') {
        // Filter to show only teams where active is explicitly false
        // Debug: Log what we're filtering
        const allEntries = Object.entries(loadedData);
        const inactiveEntries: Array<[string, { id: string; name: string; mascot?: string; logo: string; active?: boolean }]> = [];
        const activeEntries: Array<[string, { id: string; name: string; mascot?: string; logo: string; active?: boolean }]> = [];
        const otherEntries: Array<[string, { id: string; name: string; mascot?: string; logo: string; active?: boolean }]> = [];
        
        allEntries.forEach(([key, team]) => {
          const activeValue = team.active;
          const isStrictFalse = activeValue === false;
          const isStrictTrue = activeValue === true;
          
          if (isStrictFalse) {
            inactiveEntries.push([key, team]);
          } else if (isStrictTrue) {
            activeEntries.push([key, team]);
          } else {
            otherEntries.push([key, team]);
          }
        });
        
        filteredData = Object.fromEntries(inactiveEntries);
      } else if (teamActiveFilter === 'active') {
        // Filter to show only teams where active is true (or undefined/null which should be treated as active)
        filteredData = Object.fromEntries(
          Object.entries(loadedData).filter(([, team]) => team.active === true)
        );
      }
      // 'all' filter doesn't need client-side filtering - show everything from API
      setTeamData(filteredData);
      setTeamDataError(''); // Clear any previous errors
      
      // Run duplicate check after loading data
      checkForDuplicates(filteredData);
    } catch (error) {
      console.error('Error loading team data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load team data';
      setTeamDataError(errorMessage);
      setTeamData({}); // Clear team data on error
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Check for duplicate values in Team (name), Abbreviation (key), and ID columns
   */
  const checkForDuplicates = (data: Record<string, { id: string; name: string; logo: string }>) => {
    const nameCounts: Record<string, string[]> = {};
    const keyCounts: Record<string, string[]> = {};
    const idCounts: Record<string, string[]> = {};
    const duplicateIds: Set<string> = new Set();

    // Count occurrences of each value
    Object.entries(data).forEach(([key, team]) => {
      // Check for duplicate names
      if (team.name) {
        const nameKey = team.name.toLowerCase();
        if (!nameCounts[nameKey]) {
          nameCounts[nameKey] = [];
        }
        nameCounts[nameKey].push(key);
      }

      // Check for duplicate keys
      if (key) {
        const keyLower = key.toLowerCase();
        if (!keyCounts[keyLower]) {
          keyCounts[keyLower] = [];
        }
        keyCounts[keyLower].push(key);
      }

      // Check for duplicate IDs
      if (team.id) {
        const idKey = team.id.toLowerCase();
        if (!idCounts[idKey]) {
          idCounts[idKey] = [];
        }
        idCounts[idKey].push(key);
      }
    });

    // Find duplicates (values that appear more than once)
    Object.entries(nameCounts).forEach(([, keys]) => {
      if (keys.length > 1) {
        keys.forEach(k => duplicateIds.add(k));
      }
    });

    Object.entries(keyCounts).forEach(([, keys]) => {
      if (keys.length > 1) {
        keys.forEach(k => duplicateIds.add(k));
      }
    });

    Object.entries(idCounts).forEach(([, keys]) => {
      if (keys.length > 1) {
        keys.forEach(k => duplicateIds.add(k));
      }
    });

    // Get the IDs of teams with duplicates
    const duplicateIdList = Array.from(duplicateIds).map(key => {
      const team = data[key];
      return team ? team.id : key;
    });

    setDuplicateCheck({
      hasDuplicates: duplicateIds.size > 0,
      duplicateIds: duplicateIdList
    });
  };

  /**
   * Handle column sorting
   */
  const handleSort = (column: 'name' | 'mascot' | 'key' | 'id') => {
    if (teamSortColumn === column) {
      // Same column, toggle order
      setTeamSortOrder(teamSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setTeamSortColumn(column);
      setTeamSortOrder('asc');
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
    if (tab === 'logs') {
      updateUrlTab(tab, logsTab, emailLogsView);
    } else {
      updateUrlTab(tab);
    }
  };

  const handleSetLogsTab = (tab: 'summary' | 'usage' | 'error' | 'email') => {
    setLogsTab(tab);
    updateUrlTab(activeTab, tab, tab === 'email' ? emailLogsView : undefined);
  };

  const handleSetEmailLogsView = (view: 'summary' | 'detail') => {
    setEmailLogsView(view);
    updateUrlTab(activeTab, logsTab, view);
  };

  // Assign functions to refs after they're declared
  loadDataRef.current = loadData;
  loadTeamDataRef.current = loadTeamData;

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
    
    const logsTabParam = searchParams.get('logsTab');
    if (logsTabParam && ['summary', 'usage', 'error', 'email'].includes(logsTabParam)) {
      const newLogsTab = logsTabParam as 'summary' | 'usage' | 'error' | 'email';
      if (newLogsTab !== logsTab) {
        setLogsTab(newLogsTab);
      }
    }
    
    const emailViewParam = searchParams.get('emailView');
    if (emailViewParam && ['summary', 'detail'].includes(emailViewParam)) {
      const newEmailView = emailViewParam as 'summary' | 'detail';
      if (newEmailView !== emailLogsView) {
        setEmailLogsView(newEmailView);
      }
    }
  }, [searchParams]); // Only depend on searchParams, not state variables to avoid loops

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    
    
    loadDataRef.current?.();
  }, [status, router]);

  useEffect(() => {
    // Load team data when Data tab is active
    if (activeTab === 'data') {
      loadTeamDataRef.current?.();
    } else if (activeTab === 'logs') {
      if (logsTab === 'summary') {
        loadUsageSummary();
      } else if (logsTab === 'usage') {
        loadUsageLogs();
      } else if (logsTab === 'error') {
        loadErrorLogs();
      } else if (logsTab === 'email') {
        if (emailLogsView === 'summary') {
          loadEmailSummary();
        } else {
          loadEmailLogs();
        }
      }
    } else if (activeTab === 'usage') {
      loadUsageMonitoring();
    }
  }, [activeTab, logsTab, emailLogsView, logStartDate, logEndDate, logUsernameFilter, logEventTypeFilter, logLocationFilter, loadUsageSummary, loadUsageLogs, loadErrorLogs, loadEmailSummary, loadEmailLogs, loadUsageMonitoring]);

  // Reload team data when filter changes
  useEffect(() => {
    if (activeTab === 'data' && loadTeamDataRef.current) {
      loadTeamDataRef.current();
    }
  }, [teamActiveFilter, activeTab]);

  const handleEditTeam = (key: string) => {
    const team = teamData[key];
    setEditingTeam(key);
    setEditingTeamData({
      key,
      id: team.id,
      name: team.name,
      mascot: team.mascot,
      logo: team.logo,
      active: team.active ?? false,
    });
  };

  const handleCancelEditTeam = () => {
    setEditingTeam(null);
    setEditingTeamData(null);
  };

  const handleSaveTeam = async () => {
    if (!editingTeam || !editingTeamData) return;

    setTeamDataError('');

    // Validate
    if (!editingTeamData.key || !editingTeamData.id || !editingTeamData.name) {
      setTeamDataError('Key, ID, and Name are required');
      return;
    }

    // Check if new key conflicts with existing team (unless it's the same team)
    if (editingTeam !== editingTeamData.key && teamData[editingTeamData.key]) {
      setTeamDataError('Team with this key already exists');
      return;
    }

    try {
      const updatedTeamData = { ...teamData };
      
      // If key changed, remove old entry
      if (editingTeam !== editingTeamData.key) {
        delete updatedTeamData[editingTeam];
      }
      
      // Update/add the team
      updatedTeamData[editingTeamData.key] = {
        id: editingTeamData.id,
        name: editingTeamData.name,
        mascot: editingTeamData.mascot || undefined,
        logo: editingTeamData.logo,
        active: editingTeamData.active ?? false,
      };

      const response = await fetch('/api/admin/team-data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teams: updatedTeamData }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save team data');
      }

      // Reload team data to get sorted version
      await loadTeamData();
      setEditingTeam(null);
      setEditingTeamData(null);
      
      // Duplicate check will run in loadTeamData
    } catch (error) {
      console.error('Error saving team data:', error);
      setTeamDataError(error instanceof Error ? error.message : 'Failed to save team data');
    }
  };

  const handleDeleteTeam = async (key: string) => {
    if (!confirm(`Are you sure you want to delete team "${teamData[key]?.name || key}"? This action cannot be undone.`)) {
      return;
    }

    setTeamDataError('');

    try {
      const response = await fetch(`/api/admin/team-data?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete team');
      }

      // Reload team data
      await loadTeamData();
      
      // Duplicate check will run in loadTeamData
    } catch (error) {
      console.error('Error deleting team:', error);
      setTeamDataError(error instanceof Error ? error.message : 'Failed to delete team');
    }
  };

  const handleAddTeam = () => {
    setIsAddingTeam(true);
    setNewTeamData({ key: '', id: '', name: '', mascot: '', logo: '', active: true });
  };

  const handleCancelAddTeam = () => {
    setIsAddingTeam(false);
    setNewTeamData({ key: '', id: '', name: '', mascot: '', logo: '', active: true });
  };

  const handleSyncTeam = async (mode: 'report' | 'update') => {
    const teamId = parseInt(syncTeamId);
    if (!teamId || teamId < 1 || teamId > 9999) {
      setSyncResult({ report: { message: 'Invalid team ID. Must be a number between 1 and 9999' }, loading: false });
      return;
    }

    setSyncResult({ report: null, loading: true });

    try {
      const response = await fetch('/api/admin/sync-team-from-espn', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ teamId, mode }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSyncResult({ report: data.report, loading: false });
        // If update mode and successful, reload team data
        if (mode === 'update') {
          await loadTeamData();
        }
      } else {
        setSyncResult({ report: { message: data.error || 'Failed to sync team', details: data.details }, loading: false });
      }
    } catch (error) {
      setSyncResult({ report: { message: 'Error syncing team', details: error instanceof Error ? error.message : 'Unknown error' }, loading: false });
    }
  };

  const handleSaveNewTeam = async () => {
    setTeamDataError('');

    // Validate
    if (!newTeamData.key || !newTeamData.id || !newTeamData.name) {
      setTeamDataError('Key, ID, and Name are required');
      return;
    }

    // Check if key already exists
    if (teamData[newTeamData.key]) {
      setTeamDataError('Team with this key already exists');
      return;
    }

    try {
      const updatedTeamData = {
        ...teamData,
        [newTeamData.key]: {
          id: newTeamData.id,
          name: newTeamData.name,
          mascot: newTeamData.mascot || undefined,
          logo: newTeamData.logo,
          active: newTeamData.active ?? true,
        },
      };

      const response = await fetch('/api/admin/team-data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teams: updatedTeamData }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save team data');
      }

      // Reload team data to get sorted version
      await loadTeamData();
      setIsAddingTeam(false);
      setNewTeamData({ key: '', id: '', name: '', mascot: '', logo: '', active: true });
      
      // Duplicate check will run in loadTeamData
    } catch (error) {
      console.error('Error saving new team:', error);
      setTeamDataError(error instanceof Error ? error.message : 'Failed to save new team');
    }
  };

  const handleExportTeamData = async () => {
    try {
      // Filter team data based on current view filters
      const filteredTeams = Object.entries(teamData)
        .filter(([key, team]) => {
          // Apply active filter
          if (teamActiveFilter === 'active') {
            if (!(team.active ?? false)) return false;
          } else if (teamActiveFilter === 'inactive') {
            if (team.active ?? false) return false;
          }
          // else 'all' - no active filter

          // Apply text filters (same logic as table display)
          const keyMatch = !teamFilters.key || key.toLowerCase().includes(teamFilters.key.toLowerCase());
          const idMatch = !teamFilters.id || team.id.toLowerCase().includes(teamFilters.id.toLowerCase());
          const nameMatch = !teamFilters.name || team.name.toLowerCase().includes(teamFilters.name.toLowerCase());
          const mascotMatch = !teamFilters.mascot || (team.mascot && team.mascot.toLowerCase().includes(teamFilters.mascot.toLowerCase()));
          
          return keyMatch && idMatch && nameMatch && mascotMatch;
        })
        .reduce((acc, [key, team]) => {
          acc[key] = {
            id: team.id,
            name: team.name,
            mascot: team.mascot || undefined,
            logo: team.logo,
            active: team.active ?? undefined,
          };
          return acc;
        }, {} as Record<string, { id: string; name: string; mascot?: string; logo: string; active?: boolean }>);

      // Create JSON blob from filtered data
      const jsonString = JSON.stringify(filteredTeams, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'team-mappings.json';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting team data:', error);
      setTeamDataError(error instanceof Error ? error.message : 'Failed to export team data');
    }
  };

  const handleToggleActive = async (key: string, currentActive: boolean) => {
    // Optimistically update the UI immediately
    const newActiveStatus = !currentActive;
    setTeamData(prev => {
      const updated = { ...prev };
      if (updated[key]) {
        updated[key] = { ...updated[key], active: newActiveStatus };
      }
      return updated;
    });

    try {
      setTeamDataError('');
      
      const response = await fetch('/api/admin/team-data', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key,
          active: newActiveStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        // Revert the optimistic update on error
        setTeamData(prev => {
          const updated = { ...prev };
          if (updated[key]) {
            updated[key] = { ...updated[key], active: currentActive };
          }
          return updated;
        });
        throw new Error(data.error || 'Failed to update team active status');
      }

      // Reload team data from database to ensure we have the latest state
      // This is important because the filter view needs fresh data from DB
      if (loadTeamDataRef.current) {
        await loadTeamDataRef.current();
      }
    } catch (error) {
      console.error('Error toggling team active status:', error);
      setTeamDataError(error instanceof Error ? error.message : 'Failed to toggle team active status');
    }
  };

  // Helper function to get filtered teams based on current filters
  const getFilteredTeams = (): Array<[string, { id: string; name: string; mascot?: string; logo: string; active?: boolean }]> => {
    return Object.entries(teamData).filter(([key, team]) => {
      const keyMatch = !teamFilters.key || key.toLowerCase().includes(teamFilters.key.toLowerCase());
      const idMatch = !teamFilters.id || team.id.toLowerCase().includes(teamFilters.id.toLowerCase());
      const nameMatch = !teamFilters.name || team.name.toLowerCase().includes(teamFilters.name.toLowerCase());
      const mascotMatch = !teamFilters.mascot || (team.mascot && team.mascot.toLowerCase().includes(teamFilters.mascot.toLowerCase()));
      return keyMatch && idMatch && nameMatch && mascotMatch;
    });
  };

  const handleDeleteFilteredTeams = async () => {
    const filteredTeams = getFilteredTeams();
    
    if (filteredTeams.length === 0) {
      setTeamDataError('No teams to delete');
      return;
    }

    const confirmMessage = `Are you sure you want to delete ${filteredTeams.length} team(s) from the database?\n\nThis action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setIsLoading(true);
      setTeamDataError('');

      // Delete all filtered teams
      const deletePromises = filteredTeams.map(([key]) =>
        fetch(`/api/admin/team-data?key=${encodeURIComponent(key)}`, {
          method: 'DELETE',
        })
      );

      const results = await Promise.all(deletePromises);
      const dataResults = await Promise.all(results.map(r => r.json()));

      // Check for any failures
      const failures = dataResults.filter(d => !d.success);

      if (failures.length > 0) {
        setTeamDataError(`Failed to delete ${failures.length} team(s). ${dataResults.length - failures.length} team(s) deleted successfully.`);
      } else {
        setTeamDataError('');
      }

      // Reload team data
      if (loadTeamDataRef.current) {
        await loadTeamDataRef.current();
      }

      if (failures.length === 0) {
        alert(`Successfully deleted ${filteredTeams.length} team(s).`);
      }
    } catch (error) {
      console.error('Error deleting filtered teams:', error);
      setTeamDataError('Failed to delete teams. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivateFilteredTeams = async () => {
    const filteredTeams = getFilteredTeams();
    
    if (filteredTeams.length === 0) {
      setTeamDataError('No teams to activate');
      return;
    }

    try {
      setIsLoading(true);
      setTeamDataError('');

      // Activate all filtered teams
      const activatePromises = filteredTeams.map(([key]) =>
        fetch('/api/admin/team-data', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key,
            active: true,
          }),
        })
      );

      const results = await Promise.all(activatePromises);
      const dataResults = await Promise.all(results.map(r => r.json()));

      // Check for any failures
      const failures = dataResults.filter(d => !d.success);

      if (failures.length > 0) {
        setTeamDataError(`Failed to activate ${failures.length} team(s). ${dataResults.length - failures.length} team(s) activated successfully.`);
      } else {
        setTeamDataError('');
      }

      // Reload team data
      if (loadTeamDataRef.current) {
        await loadTeamDataRef.current();
      }

      if (failures.length === 0) {
        alert(`Successfully activated ${filteredTeams.length} team(s).`);
      }
    } catch (error) {
      console.error('Error activating filtered teams:', error);
      setTeamDataError('Failed to activate teams. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivateFilteredTeams = async () => {
    const filteredTeams = getFilteredTeams();
    
    if (filteredTeams.length === 0) {
      setTeamDataError('No teams to deactivate');
      return;
    }

    try {
      setIsLoading(true);
      setTeamDataError('');

      // Deactivate all filtered teams
      const deactivatePromises = filteredTeams.map(([key]) =>
        fetch('/api/admin/team-data', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key,
            active: false,
          }),
        })
      );

      const results = await Promise.all(deactivatePromises);
      const dataResults = await Promise.all(results.map(r => r.json()));

      // Check for any failures
      const failures = dataResults.filter(d => !d.success);

      if (failures.length > 0) {
        setTeamDataError(`Failed to deactivate ${failures.length} team(s). ${dataResults.length - failures.length} team(s) deactivated successfully.`);
      } else {
        setTeamDataError('');
      }

      // Reload team data
      if (loadTeamDataRef.current) {
        await loadTeamDataRef.current();
      }

      if (failures.length === 0) {
        alert(`Successfully deactivated ${filteredTeams.length} team(s).`);
      }
    } catch (error) {
      console.error('Error deactivating filtered teams:', error);
      setTeamDataError('Failed to deactivate teams. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to manually confirm this user? This will allow them to login.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}/confirm`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        // Reload data to reflect changes
        loadData();
      } else {
        setError(data.error || 'Failed to confirm user');
      }
    } catch (error) {
      console.error('Error confirming user:', error);
      setError('Failed to confirm user');
    }
  };

  const handleOpenPasswordChange = (userId: string) => {
    setChangingPasswordUserId(userId);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
  };

  const handleCancelPasswordChange = () => {
    setChangingPasswordUserId(null);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
  };

  const handleChangePassword = async (userId: string) => {
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setPasswordError('');

    try {
      const response = await fetch(`/api/admin/users/${userId}/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPassword }),
      });

      const data = await response.json();

      if (data.success) {
        setChangingPasswordUserId(null);
        setNewPassword('');
        setConfirmPassword('');
        setPasswordError('');
        // Reload data to reflect changes
        await loadData();
      } else {
        setPasswordError(data.error || 'Failed to change password');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      setPasswordError('An error occurred. Please try again.');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string, bracketCounts?: { submitted: number; inProgress: number; deleted: number }) => {
    // Check if user has any brackets
    if (bracketCounts && (bracketCounts.submitted > 0 || bracketCounts.inProgress > 0 || bracketCounts.deleted > 0)) {
      alert(`Cannot delete user "${userName}". User has brackets: ${bracketCounts.submitted} submitted, ${bracketCounts.inProgress} in progress, ${bracketCounts.deleted} deleted.`);
      return;
    }

    if (confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      try {
        const response = await fetch(`/api/admin/users/${userId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error || 'Failed to delete user');
          return;
        }

        // Reload data after successful deletion
        await loadData();
      } catch (error) {
        console.error('Error deleting user:', error);
        setError('Failed to delete user');
      }
    }
  };


  const handleEdit = (bracket: Bracket) => {
    setEditingBracket(bracket.id);
    setEditForm({
      entryName: bracket.entryName,
      tieBreaker: bracket.tieBreaker,
      status: bracket.status,
      userId: bracket.userId,
    });
  };

  const handleEditPicks = (bracketId: string) => {
    // Redirect to bracket editing page with admin mode
    router.push(`/bracket?edit=${bracketId}&admin=true`);
  };

  const handleCancelEdit = () => {
    setEditingBracket(null);
    setEditForm({});
  };

  const handleSaveEdit = async (bracketId: string) => {
    try {
      const response = await fetch(`/api/admin/brackets/${bracketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      });

      const data = await response.json();
      
      if (data.success) {
        await loadData();
        setEditingBracket(null);
        setEditForm({});
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error updating bracket:', error);
      alert('Failed to update bracket');
    }
  };

  const handleDelete = async (bracketId: string, entryName: string) => {
    if (!confirm(`Are you sure you want to delete the bracket "${entryName}"? This cannot be undone.`)) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/brackets/${bracketId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        await loadData();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error deleting bracket:', error);
      alert('Failed to delete bracket');
    }
  };

  const handleExportBrackets = async () => {
    if (filteredBrackets.length === 0) {
      alert('No brackets to export');
      return;
    }
    
    try {
      setIsExporting(true);
      
      // Build query parameters matching current filters
      const params = new URLSearchParams();
      if (filterStatus && filterStatus !== 'all') {
        params.append('status', filterStatus);
      }
      if (filterUser && filterUser !== 'all') {
        params.append('userId', filterUser);
      }
      if (filterYear && filterYear !== 'all') {
        params.append('year', filterYear);
      }
      
      // Fetch CSV file
      const response = await fetch(`/api/admin/brackets/export?${params.toString()}`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to export brackets');
      }
      
      // Get CSV content
      const csvContent = await response.text();
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'brackets-export.csv';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting brackets:', error);
      alert(error instanceof Error ? error.message : 'Failed to export brackets');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAllFiltered = async () => {
    if (filteredBrackets.length === 0) {
      return;
    }

    const confirmMessage = `Are you sure you want to delete ${filteredBrackets.length} bracket(s)?\n\nThis action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      
      // Delete all filtered brackets
      const deletePromises = filteredBrackets.map(bracket => 
        fetch(`/api/admin/brackets/${bracket.id}`, {
          method: 'DELETE',
        })
      );

      const results = await Promise.all(deletePromises);
      const dataResults = await Promise.all(results.map(r => r.json()));
      
      // Check for any failures
      const failures = dataResults.filter(d => !d.success);
      
      if (failures.length > 0) {
        alert(`Failed to delete ${failures.length} bracket(s). ${dataResults.length - failures.length} bracket(s) deleted successfully.`);
      }

      // Reload data
      await loadData();
      
      if (failures.length === 0) {
        alert(`Successfully deleted ${filteredBrackets.length} bracket(s).`);
      }
    } catch (error) {
      console.error('Error deleting filtered brackets:', error);
      alert('Failed to delete brackets. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

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
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <div className="text-red-600 text-center">
            <p className="text-xl font-bold mb-2">Error</p>
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
              <p className="text-gray-600 mt-1">Manage users and brackets</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Logged in as</p>
                <p className="font-semibold text-gray-900">{session?.user?.email}</p>
              </div>
              <button
                onClick={() => setShowEndpoints(!showEndpoints)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center space-x-2"
              >
                <Link2 className="h-4 w-4" />
                <span>Endpoints</span>
              </button>
              <button
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 flex items-center space-x-2"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Endpoints Modal */}
        {showEndpoints && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">API Endpoints</h2>
              <button
                onClick={() => setShowEndpoints(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Endpoint
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Method
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      /api/admin/users
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">GET</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      Get all users with bracket counts and last login info (Admin only)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <a
                        href="/api/admin/users"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Open →
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      /api/admin/users/[id]
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">DELETE</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      Delete a user (only if all bracket counts are 0) (Admin only)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      Requires ID parameter
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      /api/admin/users/[id]/confirm
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">POST</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      Manually confirm a user&apos;s email address (Admin only)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      Requires ID parameter
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      /api/admin/users/[id]/change-password
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">POST</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      Change a user&apos;s password and auto-confirm their account (Admin only)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      Requires ID parameter
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      /api/admin/brackets
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">GET</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      Get all brackets with user information (Admin only)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <a
                        href="/api/admin/brackets"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Open →
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      /api/admin/brackets/[id]
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">PUT</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      Update bracket details including ownership (Admin only)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      Requires ID parameter
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      /api/admin/users-across-environments
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">GET</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      View users from both preview and production environments (Admin only)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <a
                        href="/admin/users-across-environments"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Open →
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      /api/init-database
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">GET/POST</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      Initialize database tables and schema (Admin only)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <a
                        href="/api/init-database"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Open →
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      /api/email-status
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">GET/POST</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      Check email service status and send test emails (Admin only)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <a
                        href="/api/email-status"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Open →
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      /api/check-admin
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">GET</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      Check if current authenticated user is an admin (Requires authentication, returns boolean)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <a
                        href="/api/check-admin"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Open →
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => handleSetActiveTab('users')}
                className={`flex items-center space-x-2 px-6 py-4 border-b-2 font-medium text-sm ${
                  activeTab === 'users'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Users className="w-5 h-5" />
                <span>Users ({users.length})</span>
              </button>
              <button
                onClick={() => handleSetActiveTab('brackets')}
                className={`flex items-center space-x-2 px-6 py-4 border-b-2 font-medium text-sm ${
                  activeTab === 'brackets'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Trophy className="w-5 h-5" />
                <span>Brackets ({brackets.length})</span>
              </button>
              <button
                onClick={() => handleSetActiveTab('data')}
                className={`flex items-center space-x-2 px-6 py-4 border-b-2 font-medium text-sm ${
                  activeTab === 'data'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Table className="w-5 h-5" />
                <span>Team Data ({Object.keys(teamData).length})</span>
              </button>
              <button
                onClick={() => handleSetActiveTab('logs')}
                className={`flex items-center space-x-2 px-6 py-4 border-b-2 font-medium text-sm ${
                  activeTab === 'logs'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <AlertCircle className="w-5 h-5" />
                <span>Logs</span>
              </button>
              <button
                onClick={() => handleSetActiveTab('usage')}
                className={`flex items-center space-x-2 px-6 py-4 border-b-2 font-medium text-sm ${
                  activeTab === 'usage'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Zap className="w-5 h-5" />
                <span>Usage Monitoring</span>
              </button>
            </nav>
          </div>
        </div>

        {/* Brackets Tab */}
        {activeTab === 'brackets' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            {/* Filters */}
            <div className="mb-6">
              <div className="flex items-center space-x-4 mb-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Filter by User
                  </label>
                  <select
                    value={filterUser}
                    onChange={(e) => setFilterUser(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="all">All Users</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Filter by Status
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="all">All Statuses</option>
                    <option value="submitted">Submitted</option>
                    <option value="in_progress">In Progress</option>
                    <option value="deleted">Deleted</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Filter by Year
                  </label>
                  <select
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="all">All Years</option>
                    {Array.from(new Set(brackets.map(b => b.year).filter(y => y !== undefined && y !== null)))
                      .sort((a, b) => (b || 0) - (a || 0))
                      .map(year => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Filter by Created Date
                  </label>
                  <input
                    type="date"
                    value={filterCreatedDate}
                    onChange={(e) => setFilterCreatedDate(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Filter by Updated Date
                  </label>
                  <input
                    type="date"
                    value={filterUpdatedDate}
                    onChange={(e) => setFilterUpdatedDate(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                
                <div className="ml-auto">
                  <button
                    onClick={() => {
                      setFilterUser('all');
                      setFilterStatus('all');
                      setFilterYear('all');
                      setFilterCreatedDate('');
                      setFilterUpdatedDate('');
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-600 text-white hover:bg-gray-700"
                    title="Clear all filters"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
              
              {/* Action buttons on second line */}
              <div className="flex gap-2">
                <button
                  onClick={handleExportBrackets}
                  disabled={filteredBrackets.length === 0 || isExporting}
                  className={`px-3 py-1.5 rounded text-sm font-medium ${
                    filteredBrackets.length === 0 || isExporting
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                  title={filteredBrackets.length === 0 ? 'No brackets to export' : `Export ${filteredBrackets.length} filtered bracket(s) to CSV`}
                >
                  {isExporting ? (
                    <>
                      <span className="animate-spin inline-block mr-1">⏳</span>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 inline mr-1" />
                      Extract ({filteredBrackets.length})
                    </>
                  )}
                </button>
                <button
                  onClick={handleDeleteAllFiltered}
                  disabled={filteredBrackets.length === 0}
                  className={`px-3 py-1.5 rounded text-sm font-medium ${
                    filteredBrackets.length === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                  title={filteredBrackets.length === 0 ? 'No brackets to delete' : `Delete ${filteredBrackets.length} filtered bracket(s)`}
                >
                  <Trash2 className="w-4 h-4 inline mr-1" />
                  Delete All ({filteredBrackets.length})
                </button>
              </div>
            </div>

            {/* Brackets Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bracket ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entry Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tie Breaker
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Updated
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredBrackets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                        No brackets found
                      </td>
                    </tr>
                  ) : (
                    filteredBrackets.map((bracket) => (
                      <tr key={bracket.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-600">
                            {bracket.year || new Date().getFullYear()}-{String(bracket.bracketNumber || '?').padStart(6, '0')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingBracket === bracket.id ? (
                            <select
                              value={editForm.userId || ''}
                              onChange={(e) => setEditForm({ ...editForm, userId: e.target.value })}
                              className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                            >
                              {users.map((user) => (
                                <option key={user.id} value={user.id}>
                                  {user.name} ({user.email})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <>
                              <div className="text-sm font-medium text-gray-900">{bracket.userName}</div>
                              <div className="text-sm text-gray-500">{bracket.userEmail}</div>
                            </>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingBracket === bracket.id ? (
                            <input
                              type="text"
                              value={editForm.entryName || ''}
                              onChange={(e) => setEditForm({ ...editForm, entryName: e.target.value })}
                              className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                            />
                          ) : (
                            <div className="text-sm text-gray-900">{bracket.entryName}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingBracket === bracket.id ? (
                            <input
                              type="number"
                              min="100"
                              max="300"
                              value={editForm.tieBreaker || ''}
                              onChange={(e) => setEditForm({ ...editForm, tieBreaker: parseInt(e.target.value) })}
                              className="border border-gray-300 rounded px-2 py-1 text-sm w-20"
                            />
                          ) : (
                            <div className="text-sm text-gray-900">{bracket.tieBreaker || 'N/A'}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingBracket === bracket.id ? (
                            <select
                              value={editForm.status || ''}
                              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                              className="border border-gray-300 rounded px-2 py-1 text-sm"
                            >
                              <option value="in_progress">In Progress</option>
                              <option value="submitted">Submitted</option>
                              <option value="deleted">Deleted</option>
                            </select>
                          ) : (
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              bracket.status === 'submitted'
                                ? 'bg-green-100 text-green-800'
                                : bracket.status === 'in_progress'
                                ? 'bg-yellow-100 text-yellow-800'
                                : bracket.status === 'deleted'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {bracket.status}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(bracket.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(bracket.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {editingBracket === bracket.id ? (
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => handleSaveEdit(bracket.id)}
                                className="text-green-600 hover:text-green-900"
                                title="Save"
                              >
                                <Save className="w-5 h-5" />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="text-gray-600 hover:text-gray-900"
                                title="Cancel"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => handleEditPicks(bracket.id)}
                                className="text-purple-600 hover:text-purple-900"
                                title="Edit Picks"
                              >
                                <Edit3 className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleEdit(bracket)}
                                className="text-blue-600 hover:text-blue-900"
                                title="Edit Details"
                              >
                                <Edit className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleDelete(bracket.id, bracket.entryName)}
                                className="text-red-600 hover:text-red-900"
                                title="Delete"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Login
                    </th>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-help"
                      title="Bracket counts: Submitted / In Progress / Deleted"
                    >
                      Brackets
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => {
                      // Check if this user is the admin (matches session email)
                      const isUserAdmin = session?.user?.email?.toLowerCase() === user.email.toLowerCase();
                      return (
                        <tr key={user.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{user.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{user.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              user.emailConfirmed
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {user.emailConfirmed ? 'Confirmed' : 'Pending'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              isUserAdmin
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {isUserAdmin ? 'Admin' : 'User'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {user.lastLogin 
                              ? new Date(user.lastLogin).toLocaleString()
                              : <span className="text-gray-400 italic">Never</span>
                            }
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span 
                              title="Submitted / In Progress / Deleted"
                              className="font-mono"
                            >
                              {user.bracketCounts?.submitted ?? 0} / {user.bracketCounts?.inProgress ?? 0} / {user.bracketCounts?.deleted ?? 0}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {changingPasswordUserId === user.id ? (
                              <div className="space-y-2 min-w-[300px]">
                                <div className="flex flex-col space-y-2">
                                  <input
                                    type="password"
                                    placeholder="New password (min 6 characters)"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                                    minLength={6}
                                  />
                                  <input
                                    type="password"
                                    placeholder="Confirm password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                                    minLength={6}
                                  />
                                </div>
                                {passwordError && (
                                  <div className="text-xs text-red-600">{passwordError}</div>
                                )}
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => handleChangePassword(user.id)}
                                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={handleCancelPasswordChange}
                                    className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white text-xs rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-1">
                                {!user.emailConfirmed && (
                                  <button
                                    onClick={() => handleConfirmUser(user.id)}
                                    className="p-1.5 rounded border border-transparent bg-green-600 hover:bg-green-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-green-500 transition-colors"
                                    title="Manually confirm this user"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleOpenPasswordChange(user.id)}
                                  className="p-1.5 rounded border border-transparent bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 transition-colors"
                                  title="Change user password"
                                >
                                  <Key className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(user.id, user.name, user.bracketCounts)}
                                  disabled={
                                    user.bracketCounts && (
                                      (user.bracketCounts.submitted > 0) || 
                                      (user.bracketCounts.inProgress > 0) || 
                                      (user.bracketCounts.deleted > 0)
                                    )
                                  }
                                  className={`p-1.5 rounded border border-transparent focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors ${
                                    (user.bracketCounts && (
                                      (user.bracketCounts.submitted > 0) || 
                                      (user.bracketCounts.inProgress > 0) || 
                                      (user.bracketCounts.deleted > 0)
                                    ))
                                      ? 'bg-gray-400 text-white cursor-not-allowed opacity-50'
                                      : 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500'
                                  }`}
                                  title={
                                    (user.bracketCounts && (
                                      (user.bracketCounts.submitted > 0) || 
                                      (user.bracketCounts.inProgress > 0) || 
                                      (user.bracketCounts.deleted > 0)
                                    ))
                                      ? 'Cannot delete user with existing brackets'
                                      : 'Delete User'
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Data Tab */}
        {activeTab === 'data' && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="mb-4">
            {/* Header with title and first row of buttons */}
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-gray-900">Team Reference Data</h2>
              {!isAddingTeam && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleAddTeam}
                    className="flex items-center justify-center w-8 h-8 text-sm bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                    title="Add Team"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      setIsSyncModalOpen(true);
                      setSyncTeamId('');
                      setSyncResult(null);
                    }}
                    className="flex items-center justify-center w-8 h-8 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    title="Sync Team from ESPN"
                  >
                    <Zap className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleActivateFilteredTeams}
                    disabled={getFilteredTeams().length === 0}
                    className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={`Activate all ${getFilteredTeams().length} team(s) in current view`}
                  >
                    <Power className="h-4 w-4" />
                    <span>Activate</span>
                  </button>
                  <button
                    onClick={handleDeactivateFilteredTeams}
                    disabled={getFilteredTeams().length === 0}
                    className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={`Deactivate all ${getFilteredTeams().length} team(s) in current view`}
                  >
                    <PowerOff className="h-4 w-4" />
                    <span>Deactivate</span>
                  </button>
                  <button
                    onClick={handleDeleteFilteredTeams}
                    disabled={getFilteredTeams().length === 0}
                    className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={getFilteredTeams().length === 0 ? 'No teams to delete' : `Delete ${getFilteredTeams().length} filtered team(s)`}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete All ({getFilteredTeams().length})</span>
                  </button>
                </div>
              )}
            </div>
            
            {/* Active Filter Toggles with second row of buttons */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-700">Show:</span>
                <button
                  onClick={() => setTeamActiveFilter('active')}
                  className={`px-3 py-1 text-sm rounded ${
                    teamActiveFilter === 'active'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setTeamActiveFilter('inactive')}
                  className={`px-3 py-1 text-sm rounded ${
                    teamActiveFilter === 'inactive'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Inactive
                </button>
                <button
                  onClick={() => setTeamActiveFilter('all')}
                  className={`px-3 py-1 text-sm rounded ${
                    teamActiveFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  All
                </button>
              </div>
              {!isAddingTeam && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => router.push('/admin/tournament-builder')}
                    className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>New Bracket</span>
                  </button>
                  <button
                    onClick={handleExportTeamData}
                    className="flex items-center space-x-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    title="Export team data to JSON file for git commit"
                  >
                    <Download className="h-4 w-4" />
                    <span>Export JSON</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {teamDataError && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded">
              <p className="text-sm text-red-800">{teamDataError}</p>
            </div>
          )}

          {/* Add Team Form */}
          {isAddingTeam && (
            <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Team</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Key (Abbreviation) *
                  </label>
                  <input
                    type="text"
                    value={newTeamData.key}
                    onChange={(e) => setNewTeamData({ ...newTeamData, key: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="e.g., UConn"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID *
                  </label>
                  <input
                    type="text"
                    value={newTeamData.id}
                    onChange={(e) => setNewTeamData({ ...newTeamData, id: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="e.g., 41"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={newTeamData.name}
                    onChange={(e) => setNewTeamData({ ...newTeamData, name: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="e.g., Connecticut"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mascot
                  </label>
                  <input
                    type="text"
                    value={newTeamData.mascot || ''}
                    onChange={(e) => setNewTeamData({ ...newTeamData, mascot: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="e.g., Huskies"
                  />
                </div>
                <div>
                  <label className="flex items-center space-x-2 mt-6">
                    <input
                      type="checkbox"
                      checked={newTeamData.active ?? true}
                      onChange={(e) => setNewTeamData({ ...newTeamData, active: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Active</span>
                  </label>
                </div>
              </div>
              <div className="mt-4 flex justify-end space-x-3">
                <button
                  onClick={handleCancelAddTeam}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNewTeam}
                  className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Sync Team from ESPN Modal */}
          {isSyncModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Sync Team from ESPN</h3>
                  <button
                    onClick={() => {
                      setIsSyncModalOpen(false);
                      setSyncTeamId('');
                      setSyncResult(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Team ID (1-9999)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="9999"
                    value={syncTeamId}
                    onChange={(e) => setSyncTeamId(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    placeholder="Enter team ID"
                    disabled={syncResult?.loading}
                  />
                </div>

                {syncResult && (
                  <div className={`mb-4 p-3 rounded ${
                    syncResult.report?.action === 'match' 
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : syncResult.report?.action === 'error' || syncResult.report?.action === 'not_found'
                      ? 'bg-red-50 text-red-800 border border-red-200'
                      : syncResult.report?.action === 'mismatch' || syncResult.report?.action === 'created'
                      ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                      : 'bg-gray-50 text-gray-800 border border-gray-200'
                  }`}>
                    {syncResult.loading ? (
                      <p className="text-sm">Loading...</p>
                    ) : (
                      <div className="text-sm">
                        <p className="font-semibold mb-2">
                          {syncResult.report?.action === 'match' && '✓ Match'}
                          {syncResult.report?.action === 'mismatch' && '⚠ Mismatch'}
                          {syncResult.report?.action === 'created' && '➕ New Team'}
                          {syncResult.report?.action === 'not_found' && '❌ Not Found'}
                          {syncResult.report?.action === 'error' && '❌ Error'}
                        </p>
                        {syncResult.report?.dbName && (
                          <p><strong>DB:</strong> {syncResult.report.dbName}</p>
                        )}
                        {syncResult.report?.espnName && (
                          <p><strong>ESPN:</strong> {syncResult.report.espnName}</p>
                        )}
                        {syncResult.report?.mascot && (
                          <p><strong>Mascot:</strong> {syncResult.report.mascot}</p>
                        )}
                        {syncResult.report?.message && (
                          <p className="mt-2">{syncResult.report.message}</p>
                        )}
                        {syncResult.report?.details && (
                          <p className="mt-2 text-xs">{syncResult.report.details}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setIsSyncModalOpen(false);
                      setSyncTeamId('');
                      setSyncResult(null);
                    }}
                    disabled={syncResult?.loading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => handleSyncTeam('report')}
                    disabled={syncResult?.loading || !syncTeamId}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {syncResult?.loading ? 'Loading...' : 'Report'}
                  </button>
                  <button
                    onClick={() => handleSyncTeam('update')}
                    disabled={syncResult?.loading || !syncTeamId}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {syncResult?.loading ? 'Loading...' : 'Update'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Duplicate Check Indicator */}
          <div className="mb-4 bg-white rounded-lg shadow p-4">
            <div className="flex items-center space-x-2">
              <span className="font-medium text-gray-700">Duplicate Check:</span>
              {duplicateCheck.hasDuplicates ? (
                <>
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="text-red-600 font-semibold">Failed</span>
                  {duplicateCheck.duplicateIds.length > 0 && (
                    <span className="text-sm text-red-600 ml-2">
                      (Duplicate IDs: {duplicateCheck.duplicateIds.join(', ')})
                    </span>
                  )}
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-green-600 font-semibold">Passed</span>
                </>
              )}
            </div>
          </div>

          {/* Team Data Table */}
          <div className="overflow-x-auto">
            <div className="overflow-y-auto max-h-[calc(100vh-400px)]">
              <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th 
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>School</span>
                      {teamSortColumn === 'name' && (
                        <span className="text-gray-400">
                          {teamSortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('mascot')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Mascot</span>
                      {teamSortColumn === 'mascot' && (
                        <span className="text-gray-400">
                          {teamSortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('key')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Abbreviation</span>
                      {teamSortColumn === 'key' && (
                        <span className="text-gray-400">
                          {teamSortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('id')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Index</span>
                      {teamSortColumn === 'id' && (
                        <span className="text-gray-400">
                          {teamSortOrder === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                    Logo
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                    Active
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                    Actions
                  </th>
                </tr>
                <tr className="bg-gray-100 sticky top-[48px] z-10">
                  <th className="px-3 py-2 bg-gray-100">
                    <input
                      type="text"
                      value={teamFilters.name}
                      onChange={(e) => setTeamFilters({ ...teamFilters, name: e.target.value })}
                      placeholder="Filter Team..."
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                    />
                  </th>
                  <th className="px-3 py-2 bg-gray-100">
                    <input
                      type="text"
                      value={teamFilters.mascot}
                      onChange={(e) => setTeamFilters({ ...teamFilters, mascot: e.target.value })}
                      placeholder="Filter Mascot..."
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                    />
                  </th>
                  <th className="px-3 py-2 bg-gray-100">
                    <input
                      type="text"
                      value={teamFilters.key}
                      onChange={(e) => setTeamFilters({ ...teamFilters, key: e.target.value })}
                      placeholder="Filter Abbreviation..."
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                    />
                  </th>
                  <th className="px-3 py-2 bg-gray-100">
                    <input
                      type="text"
                      value={teamFilters.id}
                      onChange={(e) => setTeamFilters({ ...teamFilters, id: e.target.value })}
                      placeholder="Filter ID..."
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs"
                    />
                  </th>
                  <th className="px-3 py-2 bg-gray-100">
                    {/* Empty cell for logo image column filter */}
                  </th>
                  <th className="px-3 py-2 bg-gray-100">
                    {/* Empty cell for active column filter */}
                  </th>
                  <th className="px-3 py-2 bg-gray-100">
                    {/* Empty cell for actions column filter */}
                  </th>
                </tr>
              </thead>
               <tbody className="bg-white divide-y divide-gray-200">
                 {teamDataError ? (
                   <tr>
                     <td colSpan={7} className="px-3 py-4 text-center">
                       <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                         <p className="text-sm font-medium text-red-800">Error loading team data</p>
                         <p className="text-sm text-red-700 mt-1">{teamDataError}</p>
                         <button
                           onClick={loadTeamData}
                           className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                         >
                           Retry
                         </button>
                       </div>
                     </td>
                   </tr>
                 ) : Object.keys(teamData).length === 0 && isLoading ? (
                   <tr>
                     <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                       Loading team data...
                     </td>
                   </tr>
                 ) : Object.keys(teamData).length === 0 ? (
                   <tr>
                     <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                       No team data found. Click &quot;Add Team&quot; to add your first team.
                     </td>
                   </tr>
                 ) : (
                  Object.entries(teamData)
                    .filter(([key, team]) => {
                      const keyMatch = !teamFilters.key || key.toLowerCase().includes(teamFilters.key.toLowerCase());
                      const idMatch = !teamFilters.id || team.id.toLowerCase().includes(teamFilters.id.toLowerCase());
                      const nameMatch = !teamFilters.name || team.name.toLowerCase().includes(teamFilters.name.toLowerCase());
                      const mascotMatch = !teamFilters.mascot || (team.mascot && team.mascot.toLowerCase().includes(teamFilters.mascot.toLowerCase()));
                      return keyMatch && idMatch && nameMatch && mascotMatch;
                    })
                    .sort((a, b) => {
                      if (teamSortColumn === 'name') {
                        const compareA = a[1].name.toLowerCase();
                        const compareB = b[1].name.toLowerCase();
                        if (teamSortOrder === 'asc') {
                          return compareA.localeCompare(compareB);
                        } else {
                          return compareB.localeCompare(compareA);
                        }
                      } else if (teamSortColumn === 'mascot') {
                        const mascotA = (a[1].mascot || '').toLowerCase();
                        const mascotB = (b[1].mascot || '').toLowerCase();
                        if (teamSortOrder === 'asc') {
                          return mascotA.localeCompare(mascotB);
                        } else {
                          return mascotB.localeCompare(mascotA);
                        }
                      } else if (teamSortColumn === 'key') {
                        const compareA = a[0].toLowerCase();
                        const compareB = b[0].toLowerCase();
                        if (teamSortOrder === 'asc') {
                          return compareA.localeCompare(compareB);
                        } else {
                          return compareB.localeCompare(compareA);
                        }
                      } else if (teamSortColumn === 'id') {
                        // Sort ID as numeric
                        const numA = parseInt(a[1].id) || 0;
                        const numB = parseInt(b[1].id) || 0;
                        if (teamSortOrder === 'asc') {
                          return numA - numB;
                        } else {
                          return numB - numA;
                        }
                      } else {
                        return 0;
                      }
                    })
                    .map(([key, team]) => (
                    <tr key={key}>
                      {editingTeam === key ? (
                        <>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <input
                              type="text"
                              value={editingTeamData?.name || ''}
                              onChange={(e) => setEditingTeamData({ ...editingTeamData!, name: e.target.value })}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <input
                              type="text"
                              value={editingTeamData?.mascot || ''}
                              onChange={(e) => setEditingTeamData({ ...editingTeamData!, mascot: e.target.value })}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <input
                              type="text"
                              value={editingTeamData?.key || ''}
                              onChange={(e) => setEditingTeamData({ ...editingTeamData!, key: e.target.value })}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <input
                              type="text"
                              value={editingTeamData?.id || ''}
                              onChange={(e) => setEditingTeamData({ ...editingTeamData!, id: e.target.value })}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            {editingTeamData?.logo ? (
                              <Image
                                src={editingTeamData.logo}
                                alt="Preview"
                                width={32}
                                height={32}
                                className="h-8 w-8 object-contain"
                                unoptimized
                              />
                            ) : (
                              <span className="text-gray-400 text-xs">No logo</span>
                            )}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={editingTeamData?.active ?? false}
                                onChange={(e) => setEditingTeamData({ ...editingTeamData!, active: e.target.checked })}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                            </label>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={handleSaveTeam}
                                className="text-green-600 hover:text-green-900"
                                title="Save"
                              >
                                <Save className="w-5 h-5" />
                              </button>
                              <button
                                onClick={handleCancelEditTeam}
                                className="text-gray-600 hover:text-gray-900"
                                title="Cancel"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {team.name}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {team.mascot || <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {key}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {team.id}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            {team.logo ? (
                              <Image
                                src={team.logo}
                                alt={team.name}
                                width={32}
                                height={32}
                                className="h-8 w-8 object-contain"
                                unoptimized
                              />
                            ) : (
                              <span className="text-gray-400 text-xs">No logo</span>
                            )}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <label className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={team.active ?? false}
                                onChange={() => handleToggleActive(key, team.active ?? false)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">{team.active ? 'Active' : 'Inactive'}</span>
                            </label>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEditTeam(key)}
                                className="text-blue-600 hover:text-blue-900"
                                title="Edit"
                              >
                                <Edit className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleDeleteTeam(key)}
                                className="text-red-600 hover:text-red-900"
                                title="Delete"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            {/* Date Filters - Top Level */}
            <div className="mb-6 pb-4 border-b border-gray-200">
              <div className="flex items-center space-x-4 flex-wrap">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">Low End:</label>
                  <input
                    type="datetime-local"
                    value={logStartDate}
                    onChange={(e) => setLogStartDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium text-gray-700">High End:</label>
                  <input
                    type="datetime-local"
                    value={logEndDate}
                    onChange={(e) => setLogEndDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <button
                  onClick={() => {
                    if (logsTab === 'summary') {
                      loadUsageSummary();
                    } else if (logsTab === 'usage') {
                      loadUsageLogs();
                    } else {
                      loadErrorLogs();
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                  disabled={logsLoading}
                >
                  {logsLoading ? 'Loading...' : 'Refresh'}
                </button>
                <button
                  onClick={handleInitializeDatabase}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 flex items-center space-x-2"
                  disabled={initializingDatabase}
                  title="Create usage_logs and error_logs tables if they don't exist"
                >
                  <Power className="h-4 w-4" />
                  <span>{initializingDatabase ? 'Initializing...' : 'Initialize Tables'}</span>
                </button>
              </div>
              {databaseInitMessage && (
                <div className={`mt-3 p-3 rounded ${
                  databaseInitMessage.type === 'success' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {databaseInitMessage.text}
                </div>
              )}
            </div>

            <div className="mb-6 border-b border-gray-200">
              <nav className="flex -mb-px">
                <button
                  onClick={() => handleSetLogsTab('summary')}
                  className={`px-4 py-2 border-b-2 font-medium text-sm ${
                    logsTab === 'summary'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Usage Summary
                </button>
                <button
                  onClick={() => handleSetLogsTab('usage')}
                  className={`px-4 py-2 border-b-2 font-medium text-sm ${
                    logsTab === 'usage'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Usage Logs ({usageLogs.length})
                </button>
                <button
                  onClick={() => handleSetLogsTab('error')}
                  className={`px-4 py-2 border-b-2 font-medium text-sm ${
                    logsTab === 'error'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Error Logs ({errorLogs.length})
                </button>
                <button
                  onClick={() => handleSetLogsTab('email')}
                  className={`px-4 py-2 border-b-2 font-medium text-sm ${
                    logsTab === 'email'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Email Logs
                </button>
              </nav>
            </div>

            {logsTab === 'summary' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Usage Summary - Last 7 Days</h3>
                {logsError && (
                  <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
                    {logsError}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Page Visits Grid */}
                  <div>
                    <h4 className="text-md font-semibold mb-3 text-gray-800">Page Visits</h4>
                    {logsLoading ? (
                      <div className="text-gray-500">Loading...</div>
                    ) : usageSummary.gridData.length === 0 ? (
                      <div className="text-gray-500">No page visits found</div>
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-300">
                              <th className="text-left py-2 px-2 font-medium text-gray-700 sticky left-0 bg-gray-50 z-10">Location</th>
                              {usageSummary.gridData.map((day) => (
                                <th key={day.date} className="text-center py-2 px-2 font-medium text-gray-700">
                                  {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </th>
                              ))}
                              <th className="text-center py-2 px-2 font-medium text-gray-700 bg-gray-200">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {usageSummary.locationTotals
                              .filter(locationTotal => locationTotal.pageVisits > 0)
                              .sort((a, b) => b.pageVisits - a.pageVisits)
                              .map((locationTotal, idx) => (
                              <tr key={idx} className="border-b border-gray-200">
                                <td className="py-2 px-2 text-gray-900 sticky left-0 bg-gray-50 z-10 font-medium">
                                  {locationTotal.location}
                                </td>
                                {usageSummary.gridData.map((day) => {
                                  const locationData = day.locations.find(l => l.location === locationTotal.location);
                                  return (
                                    <td key={day.date} className="py-2 px-2 text-center text-gray-900">
                                      {locationData?.pageVisits || 0}
                                    </td>
                                  );
                                })}
                                <td className="py-2 px-2 text-center text-gray-900 font-semibold bg-gray-200">
                                  {locationTotal.pageVisits}
                                </td>
                              </tr>
                            ))}
                            <tr className="border-t-2 border-gray-400 bg-gray-200">
                              <td className="py-2 px-2 font-semibold text-gray-900 sticky left-0 bg-gray-200 z-10">
                                Day Total
                              </td>
                              {usageSummary.gridData.map((day) => (
                                <td key={day.date} className="py-2 px-2 text-center font-semibold text-gray-900">
                                  {day.dayTotal.pageVisits}
                                </td>
                              ))}
                              <td className="py-2 px-2 text-center font-bold text-gray-900 bg-gray-300">
                                {usageSummary.totals.pageVisits}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Clicks Grid */}
                  <div>
                    <h4 className="text-md font-semibold mb-3 text-gray-800">Clicks</h4>
                    {logsLoading ? (
                      <div className="text-gray-500">Loading...</div>
                    ) : usageSummary.gridData.length === 0 ? (
                      <div className="text-gray-500">No clicks found</div>
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
                        <table className="min-w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-300">
                              <th className="text-left py-2 px-2 font-medium text-gray-700 sticky left-0 bg-gray-50 z-10">Location</th>
                              {usageSummary.gridData.map((day) => (
                                <th key={day.date} className="text-center py-2 px-2 font-medium text-gray-700">
                                  {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </th>
                              ))}
                              <th className="text-center py-2 px-2 font-medium text-gray-700 bg-gray-200">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {usageSummary.locationTotals
                              .filter(locationTotal => locationTotal.clicks > 0)
                              .sort((a, b) => b.clicks - a.clicks)
                              .map((locationTotal, idx) => (
                              <tr key={idx} className="border-b border-gray-200">
                                <td className="py-2 px-2 text-gray-900 sticky left-0 bg-gray-50 z-10 font-medium">
                                  {locationTotal.location}
                                </td>
                                {usageSummary.gridData.map((day) => {
                                  const locationData = day.locations.find(l => l.location === locationTotal.location);
                                  return (
                                    <td key={day.date} className="py-2 px-2 text-center text-gray-900">
                                      {locationData?.clicks || 0}
                                    </td>
                                  );
                                })}
                                <td className="py-2 px-2 text-center text-gray-900 font-semibold bg-gray-200">
                                  {locationTotal.clicks}
                                </td>
                              </tr>
                            ))}
                            <tr className="border-t-2 border-gray-400 bg-gray-200">
                              <td className="py-2 px-2 font-semibold text-gray-900 sticky left-0 bg-gray-200 z-10">
                                Day Total
                              </td>
                              {usageSummary.gridData.map((day) => (
                                <td key={day.date} className="py-2 px-2 text-center font-semibold text-gray-900">
                                  {day.dayTotal.clicks}
                                </td>
                              ))}
                              <td className="py-2 px-2 text-center font-bold text-gray-900 bg-gray-300">
                                {usageSummary.totals.clicks}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {logsTab === 'usage' && (
              <div>
                <div className="mb-4 flex justify-between items-center">
                  <h3 className="text-lg font-semibold">
                    Usage Logs {usageLogs.length > 0 && !loadAllLogs && `(${usageLogs.length} of many)`}
                  </h3>
                  <div className="flex gap-2">
                    {!loadAllLogs && (
                      <button
                        onClick={() => {
                          setLoadAllLogs(true);
                          loadUsageLogs();
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        disabled={logsLoading || deletingLogs}
                      >
                        {logsLoading ? 'Loading...' : 'Load All'}
                      </button>
                    )}
                    <button
                      onClick={handleDeleteLogs}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                      disabled={logsLoading || deletingLogs || usageLogs.length === 0}
                    >
                      {deletingLogs ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
                {logsError && (
                  <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
                    {logsError}
                  </div>
                )}
                {/* Filter Dropdowns */}
                <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Username
                    </label>
                    <select
                      value={logUsernameFilter}
                      onChange={(e) => setLogUsernameFilter(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">All Usernames</option>
                      {Array.from(new Set((allUsageLogs.length > 0 ? allUsageLogs : usageLogs).map(log => log.username).filter((u): u is string => Boolean(u)))).sort().map((username) => (
                        <option key={username} value={username}>
                          {username}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Event Type
                    </label>
                    <select
                      value={logEventTypeFilter}
                      onChange={(e) => setLogEventTypeFilter(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">All Event Types</option>
                      {Array.from(new Set((allUsageLogs.length > 0 ? allUsageLogs : usageLogs).map(log => log.eventType))).sort().map((eventType) => (
                        <option key={eventType} value={eventType}>
                          {eventType}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Location
                    </label>
                    <select
                      value={logLocationFilter}
                      onChange={(e) => setLogLocationFilter(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">All Locations</option>
                      {Array.from(new Set((allUsageLogs.length > 0 ? allUsageLogs : usageLogs).map(log => log.location))).sort().map((location) => (
                        <option key={location} value={location}>
                          {location}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Environment</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Logged In</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bracket ID</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {usageLogs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                            {logsLoading ? 'Loading logs...' : 'No usage logs found'}
                          </td>
                        </tr>
                      ) : (
                        usageLogs.map((log) => (
                          <tr key={log.id}>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{log.environment}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {log.isLoggedIn ? 'Yes' : 'No'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {log.username || '—'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{log.eventType}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{log.location}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {log.bracketId || '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {logsTab === 'error' && (
              <div>
                <div className="mb-4 flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Error Logs</h3>
                  <button
                    onClick={handleDeleteLogs}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    disabled={logsLoading || deletingLogs || errorLogs.length === 0}
                  >
                    {deletingLogs ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
                {logsError && (
                  <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
                    {logsError}
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Environment</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Logged In</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {errorLogs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                            {logsLoading ? 'Loading logs...' : 'No error logs found'}
                          </td>
                        </tr>
                      ) : (
                        errorLogs.map((log) => (
                          <tr key={log.id}>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{log.environment}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {log.isLoggedIn ? 'Yes' : 'No'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {log.username || '—'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {log.errorType || '—'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {log.location || '—'}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              <div className="max-w-md truncate" title={log.errorMessage}>
                                {log.errorMessage}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {logsTab === 'email' && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Email Logs</h3>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        handleSetEmailLogsView('summary');
                        loadEmailSummary();
                      }}
                      className={`px-4 py-2 text-sm font-medium rounded-lg ${
                        emailLogsView === 'summary'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Summary
                    </button>
                    <button
                      onClick={() => {
                        handleSetEmailLogsView('detail');
                        loadEmailLogs();
                      }}
                      className={`px-4 py-2 text-sm font-medium rounded-lg ${
                        emailLogsView === 'detail'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Detail
                    </button>
                  </div>
                </div>

                {logsError && (
                  <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded">
                    <p className="text-sm text-red-800">{logsError}</p>
                  </div>
                )}

                {/* Email Summary View */}
                {emailLogsView === 'summary' && emailSummary.gridData.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-md font-semibold mb-3">Email Summary - Last 7 Days</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Date</th>
                            {['Account Creation', 'Password Reset', 'Bracket Submit', 'Bracket Email'].map(eventType => (
                              <th key={eventType} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                                {eventType}
                              </th>
                            ))}
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">Total Emails</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">PDFs Generated</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">PDFs Success</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {emailSummary.gridData.map((day) => (
                            <tr key={day.date} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                {new Date(day.date).toLocaleDateString()}
                              </td>
                              {['Account Creation', 'Password Reset', 'Bracket Submit', 'Bracket Email'].map(eventType => {
                                const event = day.events.find(e => e.eventType === eventType);
                                return (
                                  <td key={eventType} className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">
                                    {event?.count || 0}
                                  </td>
                                );
                              })}
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-semibold text-gray-900">
                                {day.dayTotal.emails}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">
                                {day.dayTotal.pdfs}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">
                                {day.dayTotal.pdfSuccess}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-gray-50 font-semibold">
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">Totals</td>
                            {['Account Creation', 'Password Reset', 'Bracket Submit', 'Bracket Email'].map(eventType => {
                              const total = emailSummary.eventTotals.find(e => e.eventType === eventType);
                              return (
                                <td key={eventType} className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">
                                  {total?.count || 0}
                                </td>
                              );
                            })}
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">
                              {emailSummary.totals.emails}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">
                              {emailSummary.totals.pdfs}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">
                              {emailSummary.totals.pdfSuccess}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Email Detail View */}
                {emailLogsView === 'detail' && (
                  <>
                <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Event Type
                    </label>
                    <select
                      value={emailLogEventTypeFilter}
                      onChange={(e) => setEmailLogEventTypeFilter(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="all">All Event Types</option>
                      <option value="Account Creation">Account Creation</option>
                      <option value="Password Reset">Password Reset</option>
                      <option value="Bracket Submit">Bracket Submit</option>
                      <option value="Bracket Email">Bracket Email</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="text"
                      value={emailLogEmailFilter}
                      onChange={(e) => setEmailLogEmailFilter(e.target.value)}
                      placeholder="Filter by email..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Attachment Expected
                    </label>
                    <select
                      value={emailLogAttachmentExpectedFilter}
                      onChange={(e) => setEmailLogAttachmentExpectedFilter(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">All</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Attachment Success
                    </label>
                    <select
                      value={emailLogAttachmentSuccessFilter}
                      onChange={(e) => setEmailLogAttachmentSuccessFilter(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">All</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                      <option value="null">N/A</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Success
                    </label>
                    <select
                      value={emailLogEmailSuccessFilter}
                      onChange={(e) => setEmailLogEmailSuccessFilter(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">All</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={loadEmailLogs}
                      disabled={logsLoading}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {logsLoading ? 'Loading...' : 'Apply Filters'}
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Attachment Expected</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Attachment Success</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Email Success</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {logsLoading ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                            Loading email logs...
                          </td>
                        </tr>
                      ) : emailLogs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                            No email logs found
                          </td>
                        </tr>
                      ) : (
                        emailLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {log.eventType}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                              {log.destinationEmail}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                              {log.attachmentExpected ? (
                                <span className="text-green-600">Yes</span>
                              ) : (
                                <span className="text-gray-400">No</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                              {log.attachmentSuccess === null ? (
                                <span className="text-gray-400">N/A</span>
                              ) : log.attachmentSuccess ? (
                                <span className="text-green-600">Yes</span>
                              ) : (
                                <span className="text-red-600">No</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                              {log.emailSuccess ? (
                                <span className="text-green-600">Yes</span>
                              ) : (
                                <span className="text-red-600">No</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Usage Monitoring Tab */}
        {activeTab === 'usage' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Usage Monitoring Dashboard</h2>
              <p className="text-gray-600">Monitor your free tier usage and get upgrade recommendations</p>
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">📊 How to Monitor Vercel Usage:</h3>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Go to your <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline font-medium">Vercel Dashboard</a> → Select your project → Settings → Usage</li>
                  <li>Check Function Execution (100 GB-hours/month limit) and Bandwidth (100 GB/month limit)</li>
                  <li><strong>Note:</strong> Built-in alerts are only available on Pro/Enterprise plans ($20/month)</li>
                  <li><strong>Upgrade:</strong> Dashboard → Settings → Billing → Upgrade (takes effect immediately)</li>
                </ul>
                <h3 className="font-semibold text-blue-900 mt-3 mb-2">📧 Email Service Monitoring:</h3>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Your current email provider is shown in the dashboard below</li>
                  <li><strong>Gmail SMTP:</strong> 500 emails/day limit (no built-in dashboard, monitor via this page)</li>
                  <li><strong>SendGrid:</strong> Check <a href="https://app.sendgrid.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">SendGrid Dashboard</a> for usage</li>
                  <li><strong>Upgrade Options:</strong> See recommendations below based on your current provider</li>
                </ul>
              </div>
            </div>

            {usageMonitoringLoading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">Loading usage data...</p>
              </div>
            ) : logsError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800">{logsError}</p>
              </div>
            ) : usageMonitoring ? (
              <div className="space-y-6">
                {/* Email Usage Section */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-4 flex items-center">
                    <span className="mr-2">📧</span>
                    Email Usage - {usageMonitoring.usage.emails.providerName || 'Email Service'}
                  </h3>
                  
                  {/* Monthly Email Usage */}
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Monthly Usage</span>
                      <span className={`font-bold ${
                        usageMonitoring.usage.emails.monthly.alertLevel === 'critical' ? 'text-red-600' :
                        usageMonitoring.usage.emails.monthly.alertLevel === 'warning' ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {usageMonitoring.usage.emails.monthly.used.toLocaleString()} / {usageMonitoring.usage.emails.monthly.limit.toLocaleString()} 
                        ({usageMonitoring.usage.emails.monthly.percent.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                      <div
                        className={`h-4 rounded-full ${
                          usageMonitoring.usage.emails.monthly.alertLevel === 'critical' ? 'bg-red-600' :
                          usageMonitoring.usage.emails.monthly.alertLevel === 'warning' ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(usageMonitoring.usage.emails.monthly.percent, 100)}%` }}
                      ></div>
                    </div>
                    <div className="text-sm text-gray-600">
                      Successful: {usageMonitoring.usage.emails.monthly.successful.toLocaleString()} | 
                      Projected Monthly: {usageMonitoring.usage.emails.monthly.projected.toLocaleString()} | 
                      Days Remaining: {usageMonitoring.usage.emails.monthly.daysRemaining}
                    </div>
                  </div>

                  {/* Daily Email Usage */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Daily Usage</span>
                      <span className={`font-bold ${
                        usageMonitoring.usage.emails.daily.alertLevel === 'critical' ? 'text-red-600' :
                        usageMonitoring.usage.emails.daily.alertLevel === 'warning' ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {usageMonitoring.usage.emails.daily.used.toLocaleString()} / {usageMonitoring.usage.emails.daily.limit.toLocaleString()} 
                        ({usageMonitoring.usage.emails.daily.percent.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div
                        className={`h-4 rounded-full ${
                          usageMonitoring.usage.emails.daily.alertLevel === 'critical' ? 'bg-red-600' :
                          usageMonitoring.usage.emails.daily.alertLevel === 'warning' ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(usageMonitoring.usage.emails.daily.percent, 100)}%` }}
                      ></div>
                    </div>
                    <div className="text-sm text-gray-600 mt-2">
                      Successful: {usageMonitoring.usage.emails.daily.successful.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* PDF Generation Section */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-4 flex items-center">
                    <span className="mr-2">📄</span>
                    PDF Generation
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Monthly</div>
                      <div className="text-2xl font-bold">{usageMonitoring.usage.pdfs.monthly.generated.toLocaleString()}</div>
                      <div className="text-sm text-gray-500">Generated | {usageMonitoring.usage.pdfs.monthly.successful.toLocaleString()} Successful</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Daily</div>
                      <div className="text-2xl font-bold">{usageMonitoring.usage.pdfs.daily.generated.toLocaleString()}</div>
                      <div className="text-sm text-gray-500">Generated | {usageMonitoring.usage.pdfs.daily.successful.toLocaleString()} Successful</div>
                    </div>
                  </div>
                </div>

                {/* Recommendations Section */}
                <div className={`border rounded-lg p-6 ${
                  usageMonitoring.usage.emails.monthly.alertLevel === 'critical' ? 'border-red-300 bg-red-50' :
                  usageMonitoring.usage.emails.monthly.alertLevel === 'warning' ? 'border-yellow-300 bg-yellow-50' :
                  'border-blue-300 bg-blue-50'
                }`}>
                  <h3 className="text-xl font-semibold mb-4 flex items-center">
                    <span className="mr-2">💡</span>
                    Recommendations
                  </h3>
                  <div className="mb-4">
                    <p className={`font-medium ${
                      usageMonitoring.usage.emails.monthly.alertLevel === 'critical' ? 'text-red-800' :
                      usageMonitoring.usage.emails.monthly.alertLevel === 'warning' ? 'text-yellow-800' :
                      'text-blue-800'
                    }`}>
                      {usageMonitoring.recommendations.emails}
                    </p>
                  </div>
                  
                  {usageMonitoring.recommendations.actions.immediate.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold mb-2">Immediate Actions:</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {usageMonitoring.recommendations.actions.immediate.map((action, idx) => (
                          <li key={idx} className="text-sm">{action}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <h4 className="font-semibold mb-2">Optimization Suggestions:</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {usageMonitoring.recommendations.actions.optimization.map((action, idx) => (
                        <li key={idx} className="text-sm">{action}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Upgrade Options Section */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold mb-4 flex items-center">
                    <span className="mr-2">💰</span>
                    Upgrade Options
                  </h3>
                  
                  <div className="mb-6">
                    <h4 className="font-semibold mb-3 text-lg">{usageMonitoring.usage.emails.providerName || 'Email Service'}</h4>
                    <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                      <div className="text-sm text-gray-600">Current Provider: <span className="font-semibold text-gray-900">{usageMonitoring.usage.emails.providerName}</span></div>
                    </div>
                    <div className="space-y-3">
                      {usageMonitoring.limits.email.upgradeCost.tier1 && (
                        <div className="border border-gray-300 rounded-lg p-4">
                          <div className="font-semibold">Option 1: {usageMonitoring.limits.email.upgradeCost.tier1.range}</div>
                          <div className="text-2xl font-bold text-blue-600">${usageMonitoring.limits.email.upgradeCost.tier1.cost}/month</div>
                          <div className="text-sm text-gray-600 mt-1">{usageMonitoring.limits.email.upgradeCost.tier1.description}</div>
                        </div>
                      )}
                      {usageMonitoring.limits.email.upgradeCost.tier2 && (
                        <div className="border border-gray-300 rounded-lg p-4">
                          <div className="font-semibold">Option 2: {usageMonitoring.limits.email.upgradeCost.tier2.range}</div>
                          <div className="text-2xl font-bold text-blue-600">${usageMonitoring.limits.email.upgradeCost.tier2.cost}/month</div>
                          <div className="text-sm text-gray-600 mt-1">{usageMonitoring.limits.email.upgradeCost.tier2.description}</div>
                        </div>
                      )}
                      {usageMonitoring.limits.email.upgradeCost.tier3 && (
                        <div className="border border-gray-300 rounded-lg p-4">
                          <div className="font-semibold">Option 3: {usageMonitoring.limits.email.upgradeCost.tier3.range}</div>
                          <div className="text-2xl font-bold text-blue-600">${usageMonitoring.limits.email.upgradeCost.tier3.cost}/month</div>
                          <div className="text-sm text-gray-600 mt-1">{usageMonitoring.limits.email.upgradeCost.tier3.description}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 text-lg">Vercel Hosting</h4>
                    <div className="border border-gray-300 rounded-lg p-4">
                      <div className="font-semibold">Pro Plan</div>
                      <div className="text-2xl font-bold text-blue-600">${usageMonitoring.limits.vercel.upgradeCost.pro.cost}/month</div>
                      <div className="text-sm text-gray-600 mt-1">{usageMonitoring.limits.vercel.upgradeCost.pro.description}</div>
                      <div className="text-sm text-gray-500 mt-2">{usageMonitoring.limits.vercel.upgradeCost.additional.description}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No usage data available
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

