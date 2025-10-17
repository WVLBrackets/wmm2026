'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Trophy, Plus, Edit, Eye, Clock, CheckCircle, LogOut, Trash2, Copy, Printer } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { TournamentData, TournamentBracket } from '@/types/tournament';

interface Bracket {
  id: string;
  playerName: string;
  playerEmail: string;
  entryName?: string;
  tieBreaker?: string;
  submittedAt?: string;
  lastSaved?: string;
  picks: { [gameId: string]: string };
  status: 'in_progress' | 'submitted';
  totalPoints?: number;
}

interface MyPicksLandingProps {
  brackets?: Bracket[];
  onCreateNew: () => void;
  onEditBracket: (bracket: Bracket) => void;
  onDeleteBracket: (bracketId: string) => void;
  onCopyBracket: (bracket: Bracket) => void;
  deletingBracketId?: string | null;
  tournamentData?: TournamentData | null;
  bracket?: TournamentBracket | null;
}

export default function MyPicksLanding({ brackets = [], onCreateNew, onEditBracket, onDeleteBracket, onCopyBracket, deletingBracketId, tournamentData, bracket }: MyPicksLandingProps) {
  const { data: session } = useSession();

  const handleDeleteBracket = (bracketId: string) => {
    onDeleteBracket(bracketId);
  };

  const handlePrintBracket = (bracket: Bracket) => {
    // Store bracket data in session storage for security
    sessionStorage.setItem('printBracketData', JSON.stringify(bracket));
    // Navigate to the print page (no URL parameters)
    window.open('/print-bracket', '_blank');
  };

  const getStatusIcon = (status: string) => {
    if (status === 'submitted') {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    return <Clock className="h-5 w-5 text-yellow-500" />;
  };

  const getStatusText = (status: string) => {
    if (status === 'submitted') {
      return 'Submitted';
    }
    return 'In Progress';
  };

  const getStatusColor = (status: string) => {
    if (status === 'submitted') {
      return 'bg-green-100 text-green-800';
    }
    return 'bg-yellow-100 text-yellow-800';
  };

  const getPicksCount = (picks: { [gameId: string]: string }) => {
    return Object.keys(picks).length;
  };

  const getLastActivity = (bracket: Bracket) => {
    const date = bracket.submittedAt || bracket.lastSaved;
    if (!date) return 'Unknown';
    
    const activityDate = new Date(date);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - activityDate.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return activityDate.toLocaleDateString();
  };

  // Get first name from full name
  const getFirstName = (fullName: string | null | undefined) => {
    if (!fullName) return 'User';
    return fullName.split(' ')[0];
  };

  // Calculate submitted brackets count and cost
  const getSubmittedBracketsInfo = () => {
    const submittedCount = brackets.filter(bracket => bracket.status === 'submitted').length;
    const totalCost = submittedCount * 5;
    return { submittedCount, totalCost };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
            {/* Compact Header */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Welcome Back {getFirstName(session?.user?.name)}
                  </h1>
                  {(() => {
                    const { submittedCount, totalCost } = getSubmittedBracketsInfo();
                    return (
                      <p className="text-sm text-gray-600 mt-1">
                        You have submitted {submittedCount} {submittedCount === 1 ? 'entry' : 'entries'} at a cost of ${totalCost}.
                      </p>
                    );
                  })()}
                </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={onCreateNew}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>New Bracket</span>
              </button>
              
              <button
                onClick={() => signOut()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>


        {/* Brackets List */}
        <div className="bg-white rounded-lg shadow-lg p-6">

          {brackets.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No brackets yet</h3>
              <p className="text-gray-600">Use the "New Bracket" button to create your first bracket.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entry Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {brackets.map((bracket, index) => (
                    <tr key={bracket.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {bracket.entryName || `Bracket #${index + 1}`}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(bracket.status)}`}>
                          {getStatusIcon(bracket.status)}
                          <span className="ml-1">{getStatusText(bracket.status)}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => onCopyBracket(bracket)}
                            className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 flex items-center space-x-1 cursor-pointer"
                          >
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </button>
                          
                          {/* Print button - only for submitted brackets */}
                          {bracket.status === 'submitted' && (
                            <button
                              onClick={() => handlePrintBracket(bracket)}
                              className="bg-purple-600 text-white px-3 py-1 rounded text-xs hover:bg-purple-700 flex items-center space-x-1 cursor-pointer"
                            >
                              <Printer className="h-3 w-3" />
                              <span>Print</span>
                            </button>
                          )}
                          
                          <button
                            onClick={() => onEditBracket(bracket)}
                            className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 flex items-center space-x-1 cursor-pointer"
                          >
                            {bracket.status === 'submitted' ? (
                              <>
                                <Eye className="h-3 w-3" />
                                <span>View</span>
                              </>
                            ) : (
                              <>
                                <Edit className="h-3 w-3" />
                                <span>Edit</span>
                              </>
                            )}
                          </button>
                          
                          {/* Delete button - only for in-progress brackets */}
                          {bracket.status === 'in_progress' && (
                            <button
                              onClick={() => handleDeleteBracket(bracket.id)}
                              disabled={deletingBracketId === bracket.id}
                              className={`px-3 py-1 rounded text-xs flex items-center space-x-1 ${
                                deletingBracketId === bracket.id
                                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                  : 'bg-red-600 text-white hover:bg-red-700 cursor-pointer'
                              }`}
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>{deletingBracketId === bracket.id ? 'Deleting...' : 'Delete'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
