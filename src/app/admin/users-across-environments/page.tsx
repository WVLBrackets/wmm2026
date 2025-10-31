'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface UserInfo {
  name: string;
  email: string;
  emailConfirmed: boolean;
  createdAt: string;
  lastLogin: string | null;
}

interface EnvironmentUsers {
  count: number;
  users: UserInfo[];
}

export default function UsersAcrossEnvironmentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [previewUsers, setPreviewUsers] = useState<EnvironmentUsers | null>(null);
  const [productionUsers, setProductionUsers] = useState<EnvironmentUsers | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }
    
    loadUsers();
  }, [status, router]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const response = await fetch('/api/debug-all-environments');
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || 'Failed to load users');
        if (data.debug) {
          console.error('Debug info:', data.debug);
        }
        return;
      }
      
      setPreviewUsers(data.preview);
      setProductionUsers(data.production);
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h2 className="text-red-800 font-semibold">Error</h2>
            <p className="text-red-600">{error}</p>
            <button
              onClick={() => router.push('/admin')}
              className="mt-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Back to Admin Panel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => router.push('/admin')}
            className="text-blue-600 hover:text-blue-800"
          >
            ← Back to Admin Panel
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mt-4">
            Users Across Environments
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Preview Environment */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Preview Environment
            </h2>
            <div className="mb-4">
              <span className="text-sm font-medium text-gray-500">
                Total Users: 
              </span>
              <span className="ml-2 text-lg font-bold text-gray-900">
                {previewUsers?.count || 0}
              </span>
            </div>
            <div className="space-y-2">
              {previewUsers && previewUsers.users.length > 0 ? (
                previewUsers.users.map((user, index) => (
                  <div key={index} className="border-b border-gray-200 pb-2">
                    <div className="font-medium text-gray-900">{user.name}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Created: {new Date(user.createdAt).toLocaleDateString()}
                      {user.lastLogin && (
                        <> | Last Login: {new Date(user.lastLogin).toLocaleDateString()}</>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No users found</p>
              )}
            </div>
          </div>

          {/* Production Environment */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Production Environment
            </h2>
            <div className="mb-4">
              <span className="text-sm font-medium text-gray-500">
                Total Users: 
              </span>
              <span className="ml-2 text-lg font-bold text-gray-900">
                {productionUsers?.count || 0}
              </span>
            </div>
            <div className="space-y-2">
              {productionUsers && productionUsers.users.length > 0 ? (
                productionUsers.users.map((user, index) => (
                  <div key={index} className="border-b border-gray-200 pb-2">
                    <div className="font-medium text-gray-900">{user.name}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      Created: {new Date(user.createdAt).toLocaleDateString()}
                      {user.lastLogin && (
                        <> | Last Login: {new Date(user.lastLogin).toLocaleDateString()}</>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No users found</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

