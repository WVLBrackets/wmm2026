import { NextRequest, NextResponse } from 'next/server';
import { Bracket, BracketSubmission } from '@/types/bracket';
import { validateBracketSubmission } from '@/lib/bracketValidation';
import { generateBracketStructure, calculateBracketPoints, isBracketComplete } from '@/lib/bracketTypes';

// Mock storage - in production, this would be a database
let brackets: Bracket[] = [];
let nextId = 1;

/**
 * GET /api/bracket - Get all brackets
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isPublic = searchParams.get('public') === 'true';
    
    let filteredBrackets = brackets;
    if (isPublic) {
      filteredBrackets = brackets.filter(bracket => bracket.isPublic);
    }

    return NextResponse.json({
      success: true,
      data: filteredBrackets,
      count: filteredBrackets.length
    });
  } catch (error) {
    console.error('Error fetching brackets:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch brackets' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bracket - Create a new bracket
 */
export async function POST(request: NextRequest) {
  try {
    const body: BracketSubmission = await request.json();
    
    // Validate the bracket submission
    const validation = validateBracketSubmission(body);
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid bracket submission',
          details: validation.errors 
        },
        { status: 400 }
      );
    }

    // Create the bracket
    const bracket: Bracket = {
      id: `bracket-${nextId++}`,
      playerName: body.playerName,
      playerEmail: body.playerEmail,
      submittedAt: new Date().toISOString(),
      games: body.games.map(game => ({
        ...game,
        id: `game-${Date.now()}-${Math.random()}`,
        completed: false
      })),
      totalPoints: 0,
      isComplete: true,
      isPublic: true
    };

    // Add to storage
    brackets.push(bracket);

    return NextResponse.json({
      success: true,
      data: bracket,
      message: 'Bracket submitted successfully'
    });
  } catch (error) {
    console.error('Error creating bracket:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create bracket' },
      { status: 500 }
    );
  }
}

