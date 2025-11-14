'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Trophy, Plus, Edit, Eye, Clock, CheckCircle, LogOut, Trash2, Copy, Printer, Info, X, Mail } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { TournamentData, TournamentBracket } from '@/types/tournament';
import { SiteConfigData } from '@/lib/siteConfig';
import { LoggedButton } from '@/components/LoggedButton';

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
  pendingDeleteBracketId?: string | null;
  onConfirmDelete?: (bracketId: string) => void;
  onCancelDelete?: () => void;
  tournamentData?: TournamentData | null;
  bracket?: TournamentBracket | null;
  siteConfig?: SiteConfigData | null;
}

export default function MyPicksLanding({ brackets = [], onCreateNew, onEditBracket, onDeleteBracket, onCopyBracket, deletingBracketId, pendingDeleteBracketId, onConfirmDelete, onCancelDelete, tournamentData, siteConfig }: MyPicksLandingProps) {
  const { data: session } = useSession();
  const [expandedStatus, setExpandedStatus] = useState<'info' | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailBracket, setEmailBracket] = useState<Bracket | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
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


  const handlePrintBracket = (bracket: Bracket) => {
    // Store bracket data in session storage for security
    sessionStorage.setItem('printBracketData', JSON.stringify(bracket));
    // Navigate to the print page (no URL parameters)
    window.open('/print-bracket', '_blank');
  };

  const handleEmailBracket = (bracket: Bracket) => {
    if (bracket.status !== 'submitted') {
      return; // Only allow emailing submitted brackets
    }
    setEmailBracket(bracket);
    setEmailDialogOpen(true);
  };

  const confirmEmailBracket = async () => {
    if (!emailBracket || !session?.user?.email) {
      return;
    }

    setIsSendingEmail(true);
    setEmailMessage(null);

    try {
      const response = await fetch('/api/bracket/email-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bracketId: emailBracket.id,
          siteConfig: siteConfig, // Pass the already-loaded config to avoid re-fetching
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setEmailMessage({ type: 'success', text: 'Email sent successfully! Check your inbox for your bracket PDF.' });
        setEmailDialogOpen(false);
        setTimeout(() => setEmailMessage(null), 5000);
      } else {
        // Show detailed error message if available (staging/development)
        const errorText = data.details 
          ? `${data.error}: ${data.details}`
          : data.error || 'Failed to send email. Please try again.';
        setEmailMessage({ type: 'error', text: errorText });
        console.error('Email error details:', data);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setEmailMessage({ type: 'error', text: `An error occurred: ${errorMessage}` });
      console.error('Email error:', error);
    } finally {
      setIsSendingEmail(false);
    }
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

  // Get dynamic message based on bracket counts
  const getDynamicMessage = () => {
    const { submittedCount, inProgressCount, totalCost } = getBracketsInfo();
    
    let message = '';
    
    // Determine which message to use based on counts
    if (submittedCount === 0 && inProgressCount === 0) {
      message = siteConfig?.welcomeNoBrackets || 'Click New Bracket to start your first entry';
    } else if (submittedCount > 0 && inProgressCount === 0) {
      message = siteConfig?.welcomeNoInProgress || `Your total cost so far is $${totalCost}. You can create a new entry and save it for later without submitting it now.`;
    } else if (submittedCount === 0 && inProgressCount > 0) {
      message = siteConfig?.welcomeNoSubmitted || 'You have not submitted any brackets yet. Please complete and submit your bracket(s) to be included in the contest.';
    } else {
      message = siteConfig?.welcomeYourBrackets || `Your total cost so far is $${totalCost}. In Progress brackets are not included in the contest until submitted.`;
    }
    
    // Replace template variables
    message = message
      .replace(/{Submitted}/g, submittedCount.toString())
      .replace(/{In Progress}/g, inProgressCount.toString())
      .replace(/{cost}/g, totalCost.toString());
    
    return message;
  };

  // Helper function to render messages with line breaks (using || as delimiter)
  const renderMessageWithLineBreaks = (message: string) => {
    // Split by || delimiter and render each part
    const parts = message.split('||');
    
    if (parts.length === 1) {
      // No line breaks, return as single element
      return <>{message}</>;
    }
    
    // Render with line breaks
    return (
      <>
        {parts.map((part, index) => (
          <React.Fragment key={index}>
            {part}
            {index < parts.length - 1 && <br />}
          </React.Fragment>
        ))}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
            {/* Welcome Header */}
            <div className="bg-white rounded-lg shadow-lg p-4 md:p-6 mb-6">
              {/* Desktop Layout */}
              <div className="hidden md:block">
                <div className="flex items-start justify-between">
                  {/* Site Logo - Far Left */}
                  {siteConfig?.homePageLogo && (
                    <div className="flex-shrink-0 mr-4">
                      <div className="h-32 w-auto flex items-center justify-center">
                        {logoError ? (
                          <div className="text-red-600 text-xs text-center">
                            Image not Found
                          </div>
                        ) : (
                          <img
                            src={`/images/${siteConfig.homePageLogo}`}
                            alt="Site Logo"
                            className="h-full w-auto object-contain max-h-full"
                            onError={() => setLogoError(true)}
                          />
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex-1">
                    {/* Line 1: Welcome message with full name */}
                    <h1 className="text-2xl font-bold text-gray-900">
                      Welcome {session?.user?.name || 'User'}
                    </h1>
                    
                    {/* Line 2: Brackets message */}
                    {siteConfig?.bracketsMessage && (
                      <p className="text-sm text-gray-600 mt-1">
                        {renderMessageWithLineBreaks(siteConfig.bracketsMessage)}
                      </p>
                    )}
                    
                    {/* Line 3: Status bubbles - always shown */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                        Submitted {getBracketsInfo().submittedCount}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <Clock className="h-4 w-4 text-yellow-500 mr-1" />
                        In Progress {getBracketsInfo().inProgressCount}
                      </span>
                    </div>
                    
                    {/* Line 4: Dynamic message - always shown on desktop */}
                    <p className="text-sm text-gray-600 mt-2">
                      {renderMessageWithLineBreaks(getDynamicMessage())}
                    </p>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex items-center space-x-3 flex-shrink-0 ml-4">
                    <button
                      onClick={onCreateNew}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      <span>New Bracket</span>
                    </button>
                    
                    <LoggedButton
                      onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                      logLocation="Logout"
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Logout</span>
                    </LoggedButton>
                  </div>
                </div>
              </div>

              {/* Mobile Layout */}
              <div className="flex flex-col md:hidden gap-3">
                <div className="flex flex-col">
                  {/* Top row: Welcome message and buttons */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Line 1: Welcome message with first name only */}
                      <h1 className="text-xl font-bold text-gray-900">
                        Welcome {getFirstName(session?.user?.name)}
                      </h1>
                      
                      {/* Line 2: Mobile brackets message */}
                      {siteConfig?.mobileBracketsMessage && (
                        <p className="text-sm text-gray-600 mt-1">
                          {renderMessageWithLineBreaks(siteConfig.mobileBracketsMessage)}
                        </p>
                      )}
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                      <button
                        onClick={onCreateNew}
                        className="bg-blue-600 text-white px-2 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      
                      <LoggedButton
                        onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                        logLocation="Logout"
                        className="bg-blue-600 text-white px-2 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2 cursor-pointer"
                      >
                        <LogOut className="h-4 w-4" />
                      </LoggedButton>
                    </div>
                  </div>
                  
                  {/* Line 3: Status bubbles with info icon on same line - always shown */}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                        Submitted {getBracketsInfo().submittedCount}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <Clock className="h-4 w-4 text-yellow-500 mr-1" />
                        In Progress {getBracketsInfo().inProgressCount}
                      </span>
                    </div>
                    
                    {/* Info icon - aligned with logout button */}
                    <button
                      onClick={() => setExpandedStatus(expandedStatus === 'info' ? null : 'info')}
                      className="text-blue-600 hover:text-blue-700 cursor-pointer flex-shrink-0"
                      style={{ width: '16px', marginLeft: '8px' }}
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                {/* Line 4: Dynamic message - full width, hidden by default, shown when info icon is clicked */}
                {expandedStatus === 'info' && (
                  <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded relative w-full">
                    <button
                      onClick={() => setExpandedStatus(null)}
                      className="absolute top-2 text-gray-500 hover:text-gray-700 cursor-pointer"
                      style={{ right: '8px' }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="pr-6">
                      <p>{renderMessageWithLineBreaks(getDynamicMessage())}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>


        {/* Brackets List */}
        <div className="bg-white rounded-lg shadow-lg p-6">

          {visibleBrackets.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No brackets yet</h3>
              <p className="text-gray-600">
                <span className="hidden md:inline">Use the &quot;New Bracket&quot; button to create your first bracket.</span>
                <span className="md:hidden">Use the &quot;+&quot; button to create your first bracket.</span>
              </p>
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
                      ID
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
                    const number = (bracketData.bracketNumber as number) || 0;
                    const progress = calculateProgress(bracket.picks);
                    const finalFour = getFinalFourTeams(bracket.picks);
                    
                    return (
                    <tr key={bracket.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div 
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer ${getStatusColor(bracket.status)}`}
                          onClick={() => onEditBracket(bracket)}
                        >
                          {getStatusIcon(bracket.status)}
                          <span className="ml-1">{bracket.entryName || `Bracket #${index + 1}`}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div 
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer ${getStatusColor(bracket.status)}`}
                          onClick={() => onEditBracket(bracket)}
                        >
                          <span>{getStatusText(bracket.status)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="text-sm font-medium text-gray-600">
                          {String(number).padStart(6, '0')}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center space-y-1 mx-auto" style={{ width: 'fit-content' }}>
                          <div className="text-xs text-gray-600">
                            {progress.completed} / {progress.total} picks
                          </div>
                          <div className="bg-gray-200 rounded-full h-2" style={{ width: '60px' }}>
                            <div 
                              className="bg-green-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${progress.percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center">
                          <div className="w-12 h-8 flex items-center justify-center rounded border-2 border-gray-300 bg-gray-100 font-medium text-sm text-gray-700">
                            {bracket.tieBreaker || '?'}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center space-x-1">
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
                      <td className="px-4 py-3 text-center">
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
                      <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                        <div className="flex items-center justify-center space-x-2">
                          {/* Action buttons - icon-only squares with tooltips */}
                          {bracket.status === 'in_progress' ? (
                            <>
                              {pendingDeleteBracketId === bracket.id ? (
                                <>
                                  {/* Confirmation UI - embedded in the table */}
                                  <div className="flex items-center space-x-2 bg-red-50 border border-red-200 rounded px-2 py-1">
                                    <span className="text-xs text-red-700 font-medium whitespace-nowrap">Delete?</span>
                                    <button
                                      onClick={() => onConfirmDelete && onConfirmDelete(bracket.id)}
                                      disabled={deletingBracketId === bracket.id}
                                      className="bg-red-600 text-white text-xs px-2 py-1 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      Yes
                                    </button>
                                    <button
                                      onClick={() => onCancelDelete && onCancelDelete()}
                                      disabled={deletingBracketId === bracket.id}
                                      className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      No
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  {/* In Progress: Edit, Copy, Delete */}
                                  <LoggedButton
                                    onClick={() => onEditBracket(bracket)}
                                    logLocation="Edit"
                                    bracketId={number ? String(number).padStart(6, '0') : null}
                                    className="bg-blue-600 text-white w-8 h-8 rounded flex items-center justify-center hover:bg-blue-700 cursor-pointer transition-colors"
                                    title="Edit"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </LoggedButton>
                                  <LoggedButton
                                    onClick={() => onCopyBracket(bracket)}
                                    logLocation="Copy"
                                    bracketId={number ? String(number).padStart(6, '0') : null}
                                    className="bg-green-600 text-white w-8 h-8 rounded flex items-center justify-center hover:bg-green-700 cursor-pointer transition-colors"
                                    title="Copy"
                                  >
                                    <Copy className="h-4 w-4" />
                                  </LoggedButton>
                                  <LoggedButton
                                    onClick={() => onDeleteBracket(bracket.id)}
                                    logLocation="Delete"
                                    bracketId={number ? String(number).padStart(6, '0') : null}
                                    disabled={deletingBracketId === bracket.id || pendingDeleteBracketId === bracket.id}
                                    className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                                      deletingBracketId === bracket.id || pendingDeleteBracketId === bracket.id
                                        ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                        : 'bg-red-600 text-white hover:bg-red-700 cursor-pointer'
                                    }`}
                                    title={deletingBracketId === bracket.id ? 'Deleting...' : 'Delete'}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </LoggedButton>
                                </>
                              )}
                            </>
                          ) : (
                            <>
                              {/* Submitted: View, Copy, Print, Email */}
                              <LoggedButton
                                onClick={() => onEditBracket(bracket)}
                                logLocation="View"
                                bracketId={number ? String(number).padStart(6, '0') : null}
                                className="bg-blue-600 text-white w-8 h-8 rounded flex items-center justify-center hover:bg-blue-700 cursor-pointer transition-colors"
                                title="View"
                              >
                                <Eye className="h-4 w-4" />
                              </LoggedButton>
                              <LoggedButton
                                onClick={() => onCopyBracket(bracket)}
                                logLocation="Copy"
                                bracketId={number ? String(number).padStart(6, '0') : null}
                                className="bg-green-600 text-white w-8 h-8 rounded flex items-center justify-center hover:bg-green-700 cursor-pointer transition-colors"
                                title="Copy"
                              >
                                <Copy className="h-4 w-4" />
                              </LoggedButton>
                              <LoggedButton
                                onClick={() => handlePrintBracket(bracket)}
                                logLocation="Print"
                                bracketId={number ? String(number).padStart(6, '0') : null}
                                className="hidden md:flex bg-purple-600 text-white w-8 h-8 rounded items-center justify-center hover:bg-purple-700 cursor-pointer transition-colors"
                                title="Print"
                              >
                                <Printer className="h-4 w-4" />
                              </LoggedButton>
                              <LoggedButton
                                onClick={() => handleEmailBracket(bracket)}
                                logLocation="Email"
                                bracketId={number ? String(number).padStart(6, '0') : null}
                                className="bg-indigo-600 text-white w-8 h-8 rounded flex items-center justify-center hover:bg-indigo-700 cursor-pointer transition-colors"
                                title="Email PDF"
                              >
                                <Mail className="h-4 w-4" />
                              </LoggedButton>
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

      {/* Email Confirmation Dialog */}
      {emailDialogOpen && emailBracket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {siteConfig?.emailWindowTitle || 'Email Bracket PDF'}
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              {(siteConfig?.emailWindowMessage || 'Would you like to send yourself an email with a PDF of your bracket?')
                .replace(/\{Entry Name\}/g, emailBracket.entryName || `Bracket ${emailBracket.id}`)
                .replace(/\{email\}/g, session?.user?.email || 'your email address')}
            </p>
            {emailMessage && (
              <div className={`mb-4 p-3 rounded ${
                emailMessage.type === 'success' 
                  ? 'bg-green-50 text-green-800 border border-green-200' 
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                <p className="text-sm">{emailMessage.text}</p>
              </div>
            )}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setEmailDialogOpen(false);
                  setEmailBracket(null);
                  setEmailMessage(null);
                }}
                disabled={isSendingEmail}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={confirmEmailBracket}
                disabled={isSendingEmail}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSendingEmail ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Status Message */}
      {emailMessage && !emailDialogOpen && (
        <div className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
          emailMessage.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <p className="text-sm font-medium">{emailMessage.text}</p>
        </div>
      )}

    </div>
  );
}
