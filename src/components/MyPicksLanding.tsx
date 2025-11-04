'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Trophy, Plus, Edit, Eye, Clock, CheckCircle, LogOut, Trash2, Copy, Printer, Info, X } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { TournamentData, TournamentBracket } from '@/types/tournament';
import { SiteConfigData } from '@/lib/siteConfig';
import Image from 'next/image';

interface Bracket {
  id: string;
  playerName: string;
  playerEmail: string;
  entryName?: string;
  tieBreaker?: string;
  submittedAt?: string;
  lastSaved?: string;
  picks: { [gameId: string]: string };
  status: 'in_progress' | 'submitted' | 'deleted';
  totalPoints?: number;
  year?: number;
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
  siteConfig?: SiteConfigData | null;
}

export default function MyPicksLanding({ brackets = [], onCreateNew, onEditBracket, onDeleteBracket, onCopyBracket, deletingBracketId, tournamentData, bracket, siteConfig }: MyPicksLandingProps) {
  const { data: session } = useSession();
  const [expandedStatus, setExpandedStatus] = useState<'info' | null>(null);
  
  // Get tournament year from config or tournament data
  const tournamentYear = siteConfig?.tournamentYear ? parseInt(siteConfig.tournamentYear) : (tournamentData?.year ? parseInt(tournamentData.year) : new Date().getFullYear());
  
  // Filter out deleted brackets and filter by tournament year
  const visibleBrackets = brackets.filter(b => 
    b.status !== 'deleted' && 
    (b.year === tournamentYear || (!b.year && tournamentYear === new Date().getFullYear()))
  );

  // Calculate bracket progress (number of picks out of 63)
  const calculateProgress = (picks: { [gameId: string]: string }) => {
    const totalGames = 63;
    const completedPicks = Object.keys(picks).filter(key => picks[key] && picks[key] !== '').length;
    return { completed: completedPicks, total: totalGames, percentage: (completedPicks / totalGames) * 100 };
  };

  // Helper function to find team by ID in tournament data and return the logo
  const findTeamLogoById = (teamId: string | null): string | null => {
    if (!teamId || !tournamentData) return null;
    
    // Search through all regions to find the team
    for (const region of tournamentData.regions) {
      const team = region.teams.find(t => t.id === teamId);
      if (team) {
        return team.logo; // Return the logo path directly from team object
      }
    }
    return null;
  };

  // Get Final Four teams from picks
  const getFinalFourTeams = (picks: { [gameId: string]: string }) => {
    // The Final Four consists of the 4 Elite Eight winners who compete in final-four-1 and final-four-2
    // We need to find the winners of each region's Elite Eight game
    
    // Get the team IDs from picks
    const topLeftId = picks['Top Left-e8-1'] || null;
    const bottomLeftId = picks['Bottom Left-e8-1'] || null;
    const topRightId = picks['Top Right-e8-1'] || null;
    const bottomRightId = picks['Bottom Right-e8-1'] || null;
    
    // Get the finalists (winners of Final Four games)
    const finalist1Id = picks['final-four-1'] || null;
    const finalist2Id = picks['final-four-2'] || null;
    
    // Get the champion (winner of championship game)
    const championId = picks['championship'] || null;
    
    // Convert team IDs to logo paths
    const finalFour = {
      topLeft: findTeamLogoById(topLeftId),
      bottomLeft: findTeamLogoById(bottomLeftId),
      topRight: findTeamLogoById(topRightId),
      bottomRight: findTeamLogoById(bottomRightId),
      finalist1: findTeamLogoById(finalist1Id),
      finalist2: findTeamLogoById(finalist2Id),
      champion: findTeamLogoById(championId),
      // Store IDs to check which teams are finalists
      finalist1Id,
      finalist2Id,
      topLeftId,
      bottomLeftId,
      topRightId,
      bottomRightId
    };

    return finalFour;
  };

  // Component to render a Final Four team logo with error handling
  const FinalFourLogo = ({ logoPath }: { logoPath: string | null }) => {
    const [imageError, setImageError] = React.useState(false);
    
    if (!logoPath || imageError) {
      return <span className="text-gray-400 text-xs">?</span>;
    }
    
    return (
      <img 
        src={logoPath} 
        alt="Team logo"
        width={24}
        height={24}
        className="object-contain"
        onError={() => setImageError(true)}
      />
    );
  };

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

  // Calculate submitted and in-progress brackets count
  const getBracketsInfo = () => {
    const submittedCount = visibleBrackets.filter(bracket => bracket.status === 'submitted').length;
    const inProgressCount = visibleBrackets.filter(bracket => bracket.status === 'in_progress').length;
    const entryCost = siteConfig?.entryCost || 5;
    const totalCost = submittedCount * entryCost;
    return { submittedCount, inProgressCount, totalCost };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
            {/* Compact Header */}
            <div className="bg-white rounded-lg shadow-lg p-4 md:p-6 mb-6">
              {/* Desktop: Logo and welcome in one row, buttons on right */}
              <div className="hidden md:flex md:items-center md:justify-between">
                <div className="flex items-center space-x-4">
                  {/* WMM Logo - Desktop only */}
                  <div className="flex-shrink-0">
                    <Image 
                      src="/images/warrens-march-madness.png" 
                      alt="Warren's March Madness" 
                      width={80} 
                      height={40} 
                      className="object-contain"
                    />
                  </div>
                  
                  {/* Welcome text - Desktop */}
                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-bold text-gray-900">
                      {(siteConfig?.welcomeGreeting || 'Welcome back {name}').replace('{name}', session?.user?.name || 'User')}
                    </h1>
                    {(() => {
                      const { submittedCount, inProgressCount, totalCost } = getBracketsInfo();
                      
                      // Helper functions to replace placeholders
                      const replaceSubmittedPlaceholders = (text: string) => {
                        return text
                          .replace('{count}', submittedCount.toString())
                          .replace('{cost}', totalCost.toString());
                      };
                      
                      const replaceInProgressPlaceholders = (text: string) => {
                        const entryText = inProgressCount === 1 
                          ? (siteConfig?.entrySingular || 'this entry')
                          : (siteConfig?.entryPlural || 'these entries');
                        
                        return text
                          .replace('{count}', inProgressCount.toString())
                          .replace('{entry_text}', entryText);
                      };
                      
                      // Case 1: Both counts are 0
                      if (submittedCount === 0 && inProgressCount === 0) {
                        return (
                          <>
                            <p className="text-sm text-gray-600 mt-1">
                              {siteConfig?.welcomeNoBracketsLine2 || 'Click New Bracket to start your entry'}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              {siteConfig?.welcomeNoBracketsLine3 || 'You can start a new entry and save it for later without submitting it now'}
                            </p>
                          </>
                        );
                      }
                      
                      // Case 2: Submitted is non-zero and In Progress is zero
                      if (submittedCount > 0 && inProgressCount === 0) {
                        return (
                          <>
                            <p className="text-sm text-gray-600 mt-1">
                              {replaceSubmittedPlaceholders(siteConfig?.welcomeSubmittedText || 'Submitted Count: {count} - your total cost is ${cost} so far')}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              {siteConfig?.welcomeCanStartNew || 'You can start a new entry and save it for later without submitting it now'}
                            </p>
                          </>
                        );
                      }
                      
                      // Case 3: Submitted is zero and In Progress is non-zero
                      if (submittedCount === 0 && inProgressCount > 0) {
                        return (
                          <>
                            <p className="text-sm text-gray-600 mt-1">
                              {siteConfig?.welcomeInprogressReminder || 'Be sure to submit your picks so they can be included in the contest'}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              {replaceInProgressPlaceholders(siteConfig?.welcomeInprogressText || 'In Progress Count: {count} - be sure to \'Submit\' if you want {entry_text} to count')}
                            </p>
                          </>
                        );
                      }
                      
                      // Case 4: Both counts are non-zero (default case)
                      return (
                        <>
                          <p className="text-sm text-gray-600 mt-1">
                            {replaceSubmittedPlaceholders(siteConfig?.welcomeSubmittedText || 'Submitted Count: {count} - your total cost is ${cost} so far')}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {replaceInProgressPlaceholders(siteConfig?.welcomeInprogressText || 'In Progress Count: {count} - be sure to \'Submit\' if you want {entry_text} to count')}
                          </p>
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex items-center space-x-3 flex-shrink-0">
              <button
                onClick={onCreateNew}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>New Bracket</span>
              </button>
              
              <button
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>

              {/* Mobile: Welcome and buttons on same line, details below */}
              <div className="flex flex-col md:hidden gap-3">
                <div className="flex items-center justify-between">
                  {/* Welcome text - Mobile */}
                  <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-bold text-gray-900">
                      Welcome {(() => {
                        const fullName = session?.user?.name || 'User';
                        const firstName = fullName.split(' ')[0];
                        return firstName;
                      })()}
                    </h1>
                    {siteConfig?.mobileBracketsMessage && (
                      <p className="text-sm text-gray-600 mt-1">
                        {siteConfig.mobileBracketsMessage}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                    <button
                      onClick={onCreateNew}
                      className="bg-blue-600 text-white px-2 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    
                    <button
                      onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                      className="bg-blue-600 text-white px-2 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                {/* Mobile: Simplified counts with info icon */}
                {(() => {
                  const { submittedCount, inProgressCount, totalCost } = getBracketsInfo();
                  
                  // Helper functions to replace placeholders
                  const replaceSubmittedPlaceholders = (text: string) => {
                    return text
                      .replace('{count}', submittedCount.toString())
                      .replace('{cost}', totalCost.toString());
                  };
                  
                  const replaceInProgressPlaceholders = (text: string) => {
                    const entryText = inProgressCount === 1 
                      ? (siteConfig?.entrySingular || 'this entry')
                      : (siteConfig?.entryPlural || 'these entries');
                    
                    return text
                      .replace('{count}', inProgressCount.toString())
                      .replace('{entry_text}', entryText);
                  };
                  
                  // Case 1: Both counts are 0
                  if (submittedCount === 0 && inProgressCount === 0) {
                    return (
                      <p className="text-sm text-gray-600">
                        {siteConfig?.welcomeNoBracketsLine2 || 'Click New Bracket to start your entry'}
                      </p>
                    );
                  }
                  
                  return (
                    <div className="flex flex-col gap-2">
                      {/* Simplified count line */}
                      <div className="text-sm text-gray-700 flex items-center gap-2">
                        <span className={submittedCount === 0 ? 'text-gray-400' : ''}>
                          Submitted: {submittedCount}
                        </span>
                        <Image 
                          src="/images/basketball icon.png" 
                          alt="Basketball" 
                          width={16} 
                          height={16} 
                          className="object-contain"
                        />
                        <span className={inProgressCount === 0 ? 'text-gray-400' : ''}>
                          In Progress: {inProgressCount}
                        </span>
                        <button
                          onClick={() => setExpandedStatus(expandedStatus === 'info' ? null : 'info')}
                          className="ml-auto text-blue-600 hover:text-blue-700 cursor-pointer"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </div>
                      
                      {/* Expanded details - showing same message as desktop */}
                      {expandedStatus === 'info' && (
                        <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded relative">
                          <button
                            onClick={() => setExpandedStatus(null)}
                            className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          
                          {/* Case 2: Submitted is non-zero and In Progress is zero */}
                          {submittedCount > 0 && inProgressCount === 0 && (
                            <>
                              <p>
                                {replaceSubmittedPlaceholders(siteConfig?.welcomeSubmittedText || 'Submitted Count: {count} - your total cost is ${cost} so far')}
                              </p>
                              <p className="mt-1">
                                {siteConfig?.welcomeCanStartNew || 'You can start a new entry and save it for later without submitting it now'}
                              </p>
                            </>
                          )}
                          
                          {/* Case 3: Submitted is zero and In Progress is non-zero */}
                          {submittedCount === 0 && inProgressCount > 0 && (
                            <>
                              <p>
                                {siteConfig?.welcomeInprogressReminder || 'Be sure to submit your picks so they can be included in the contest'}
                              </p>
                              <p className="mt-1">
                                {replaceInProgressPlaceholders(siteConfig?.welcomeInprogressText || 'In Progress Count: {count} - be sure to \'Submit\' if you want {entry_text} to count')}
                              </p>
                            </>
                          )}
                          
                          {/* Case 4: Both counts are non-zero */}
                          {submittedCount > 0 && inProgressCount > 0 && (
                            <>
                              <p>
                                {replaceSubmittedPlaceholders(siteConfig?.welcomeSubmittedText || 'Submitted Count: {count} - your total cost is ${cost} so far')}
                              </p>
                              <p className="mt-1">
                                {replaceInProgressPlaceholders(siteConfig?.welcomeInprogressText || 'In Progress Count: {count} - be sure to \'Submit\' if you want {entry_text} to count')}
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
        </div>


        {/* Brackets List */}
        <div className="bg-white rounded-lg shadow-lg p-6">

          {visibleBrackets.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No brackets yet</h3>
              <p className="text-gray-600">Use the &quot;New Bracket&quot; button to create your first bracket.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entry Name
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bracket ID
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Progress
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      TB
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Final Four
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Champ
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {[...visibleBrackets].sort((a, b) => {
                    // First, sort by status: in_progress first, submitted last
                    if (a.status !== b.status) {
                      return a.status === 'in_progress' ? -1 : 1;
                    }
                    
                    // For in_progress brackets: sort by progress (least to most), then by bracket ID
                    if (a.status === 'in_progress') {
                      const progressA = calculateProgress(a.picks).completed;
                      const progressB = calculateProgress(b.picks).completed;
                      
                      if (progressA !== progressB) {
                        return progressA - progressB; // Ascending order (least to most)
                      }
                      
                      // If progress is the same, sort by bracket ID (year-number)
                      const aData = a as unknown as Record<string, unknown>;
                      const bData = b as unknown as Record<string, unknown>;
                      const aYear = (aData.year as number) || 0;
                      const bYear = (bData.year as number) || 0;
                      const aNumber = (aData.bracketNumber as number) || 0;
                      const bNumber = (bData.bracketNumber as number) || 0;
                      
                      if (aYear !== bYear) {
                        return aYear - bYear;
                      }
                      return aNumber - bNumber;
                    }
                    
                    // For submitted brackets: sort by entry name alphabetically
                    const nameA = (a.entryName || '').toLowerCase();
                    const nameB = (b.entryName || '').toLowerCase();
                    return nameA.localeCompare(nameB);
                  }).map((bracket, index) => {
                    const bracketData = bracket as unknown as Record<string, unknown>;
                    const year = (bracketData.year as number) || new Date().getFullYear();
                    const number = (bracketData.bracketNumber as number) || 0;
                    const progress = calculateProgress(bracket.picks);
                    const finalFour = getFinalFourTeams(bracket.picks);
                    
                    return (
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
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-600">
                          {year}-{String(number).padStart(6, '0')}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col space-y-1" style={{ minWidth: '150px' }}>
                          <div className="text-xs text-gray-600">
                            {progress.completed} / {progress.total} picks
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${progress.percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <div className={`w-12 h-8 flex items-center justify-center rounded border-2 font-medium text-sm ${
                            bracket.tieBreaker 
                              ? 'bg-green-100 border-green-500 text-green-900' 
                              : 'bg-yellow-100 border-yellow-500'
                          }`}>
                            {bracket.tieBreaker || ''}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-1">
                          {/* Top Left */}
                          <div className={`w-8 h-8 flex items-center justify-center bg-gray-100 rounded ${
                            finalFour.topLeftId && (finalFour.topLeftId === finalFour.finalist1Id || finalFour.topLeftId === finalFour.finalist2Id)
                              ? 'border-2 border-blue-600'
                              : 'border border-gray-300'
                          }`}>
                            <FinalFourLogo logoPath={finalFour.topLeft} />
                          </div>
                          {/* Bottom Left */}
                          <div className={`w-8 h-8 flex items-center justify-center bg-gray-100 rounded ${
                            finalFour.bottomLeftId && (finalFour.bottomLeftId === finalFour.finalist1Id || finalFour.bottomLeftId === finalFour.finalist2Id)
                              ? 'border-2 border-blue-600'
                              : 'border border-gray-300'
                          }`}>
                            <FinalFourLogo logoPath={finalFour.bottomLeft} />
                          </div>
                          {/* Top Right */}
                          <div className={`w-8 h-8 flex items-center justify-center bg-gray-100 rounded ${
                            finalFour.topRightId && (finalFour.topRightId === finalFour.finalist1Id || finalFour.topRightId === finalFour.finalist2Id)
                              ? 'border-2 border-blue-600'
                              : 'border border-gray-300'
                          }`}>
                            <FinalFourLogo logoPath={finalFour.topRight} />
                          </div>
                          {/* Bottom Right */}
                          <div className={`w-8 h-8 flex items-center justify-center bg-gray-100 rounded ${
                            finalFour.bottomRightId && (finalFour.bottomRightId === finalFour.finalist1Id || finalFour.bottomRightId === finalFour.finalist2Id)
                              ? 'border-2 border-blue-600'
                              : 'border border-gray-300'
                          }`}>
                            <FinalFourLogo logoPath={finalFour.bottomRight} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <div className={`w-10 h-10 flex items-center justify-center rounded border-2 ${
                            finalFour.champion
                              ? 'bg-green-50 border-green-600'
                              : 'bg-gray-100 border-gray-300'
                          }`}>
                            <FinalFourLogo logoPath={finalFour.champion} />
                          </div>
                        </div>
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
                          
                          {/* Action buttons - icon-only squares with tooltips */}
                          {bracket.status === 'in_progress' ? (
                            <>
                              {/* In Progress: Edit, Copy, Delete */}
                              <button
                                onClick={() => onEditBracket(bracket)}
                                className="bg-blue-600 text-white w-8 h-8 rounded flex items-center justify-center hover:bg-blue-700 cursor-pointer transition-colors"
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => onCopyBracket(bracket)}
                                className="bg-green-600 text-white w-8 h-8 rounded flex items-center justify-center hover:bg-green-700 cursor-pointer transition-colors"
                                title="Copy"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteBracket(bracket.id)}
                                disabled={deletingBracketId === bracket.id}
                                className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                                  deletingBracketId === bracket.id
                                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                    : 'bg-red-600 text-white hover:bg-red-700 cursor-pointer'
                                }`}
                                title={deletingBracketId === bracket.id ? 'Deleting...' : 'Delete'}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              {/* Submitted: View, Copy, Print */}
                              <button
                                onClick={() => onEditBracket(bracket)}
                                className="bg-blue-600 text-white w-8 h-8 rounded flex items-center justify-center hover:bg-blue-700 cursor-pointer transition-colors"
                                title="View"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => onCopyBracket(bracket)}
                                className="bg-green-600 text-white w-8 h-8 rounded flex items-center justify-center hover:bg-green-700 cursor-pointer transition-colors"
                                title="Copy"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handlePrintBracket(bracket)}
                                className="bg-purple-600 text-white w-8 h-8 rounded flex items-center justify-center hover:bg-purple-700 cursor-pointer transition-colors"
                                title="Print"
                              >
                                <Printer className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
