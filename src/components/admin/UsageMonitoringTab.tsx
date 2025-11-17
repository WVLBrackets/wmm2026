'use client';

import { useState, useEffect } from 'react';

interface UsageMonitoringData {
  usage: {
    emails: {
      provider: string;
      providerName: string;
      monthly: { used: number; successful: number; limit: number; percent: number; alertLevel: string; projected: number; daysRemaining: number; daysInMonth: number };
      daily: { used: number; successful: number; limit: number; percent: number; alertLevel: string };
    };
    pdfs: {
      monthly: { generated: number; successful: number };
      daily: { generated: number; successful: number };
    };
  };
  limits: {
    email: {
      upgradeCost: {
        tier1?: { range: string; cost: number; description: string };
        tier2?: { range: string; cost: number; description: string };
        tier3?: { range: string; cost: number; description: string };
      };
    };
    vercel: {
      upgradeCost: {
        pro: { cost: number; description: string };
        additional: { description: string };
      };
    };
  };
  recommendations: { emails: string; actions: { immediate: string[]; optimization: string[] } };
}

export default function UsageMonitoringTab() {
  const [usageMonitoring, setUsageMonitoring] = useState<UsageMonitoringData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadUsageMonitoring = async () => {
    try {
      setLoading(true);
      setError('');
      
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
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsageMonitoring();
  }, []);

  return (
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

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading usage data...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
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
  );
}

