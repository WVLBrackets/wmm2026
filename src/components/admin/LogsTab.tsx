'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Power } from 'lucide-react';

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

export default function LogsTab() {
  const router = useRouter();
  const searchParams = useSearchParams();

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
  const [initializingDatabase, setInitializingDatabase] = useState(false);
  const [databaseInitMessage, setDatabaseInitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Helper function to update URL with new tab
  const updateUrlTab = (logsTab: 'summary' | 'usage' | 'error' | 'email', emailView?: 'summary' | 'detail') => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    params.set('tab', 'logs');
    params.set('logsTab', logsTab);
    
    if (logsTab === 'email' && emailView) {
      params.set('emailView', emailView);
    } else if (logsTab !== 'email') {
      params.delete('emailView');
    }
    
    router.replace(`/admin?${params.toString()}`, { scroll: false });
  };

  // Wrapper functions that update both state and URL
  const handleSetLogsTab = (tab: 'summary' | 'usage' | 'error' | 'email') => {
    setLogsTab(tab);
    updateUrlTab(tab, tab === 'email' ? emailLogsView : undefined);
  };

  const handleSetEmailLogsView = (view: 'summary' | 'detail') => {
    setEmailLogsView(view);
    updateUrlTab(logsTab, view);
  };

  const loadUsageLogs = useCallback(async (forceLoadAll?: boolean) => {
    try {
      setLogsLoading(true);
      setLogsError('');
      
      const params = new URLSearchParams();
      const shouldLoadAll = forceLoadAll !== undefined ? forceLoadAll : loadAllLogs;
      if (!shouldLoadAll) {
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

  // Sync state from URL params when they change (e.g., on page refresh)
  useEffect(() => {
    if (!searchParams) return;
    
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // Only depend on searchParams to sync from URL, not state variables to avoid loops

  // Load logs when tab/view changes
  useEffect(() => {
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
  }, [logsTab, emailLogsView, logStartDate, logEndDate, logUsernameFilter, logEventTypeFilter, logLocationFilter, loadUsageSummary, loadUsageLogs, loadErrorLogs, loadEmailSummary, loadEmailLogs]);

  return (
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
                    loadUsageLogs(true); // Pass true to force load all
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
  );
}

