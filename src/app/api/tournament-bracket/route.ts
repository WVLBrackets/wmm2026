import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Environment-aware file-based storage for tournament brackets
const getBracketsFileName = () => {
  // Priority: ENVIRONMENT env var > NODE_ENV > default to 'development'
  const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'development';
  
  // Log the environment being used for debugging
  console.log(`[Bracket Storage] Using environment: ${environment}`);
  
  return `brackets-${environment}.json`;
};

const BRACKETS_FILE = path.join(process.cwd(), 'data', getBracketsFileName());

// Initialize storage
let tournamentBrackets: any[] = [];
let nextId = 1;

// Load brackets from file on startup
async function loadBrackets() {
  try {
    const data = await fs.readFile(BRACKETS_FILE, 'utf8');
    const parsed = JSON.parse(data);
    tournamentBrackets = parsed.brackets || [];
    nextId = parsed.nextId || 1;
  } catch (error) {
    // File doesn't exist yet, start with empty array
    tournamentBrackets = [];
    nextId = 1;
  }
}

// Save brackets to file
async function saveBrackets() {
  try {
    // Ensure data directory exists
    await fs.mkdir(path.dirname(BRACKETS_FILE), { recursive: true });
    
    const data = {
      brackets: tournamentBrackets,
      nextId: nextId
    };
    
    await fs.writeFile(BRACKETS_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving brackets:', error);
  }
}

// Load brackets on module initialization
loadBrackets();

/**
 * POST /api/tournament-bracket - Create a new tournament bracket
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.playerName || !body.playerEmail || !body.entryName || !body.picks) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: playerName, playerEmail, entryName, and picks are required'
        },
        { status: 400 }
      );
    }

    // Validate tie breaker for submitted brackets
    if (body.tieBreaker) {
      const tieBreakerNum = Number(body.tieBreaker);
      if (isNaN(tieBreakerNum) || tieBreakerNum < 100 || tieBreakerNum > 300) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Tie breaker must be a number between 100 and 300'
          },
          { status: 400 }
        );
      }
    }

    // Validate picks structure
    const picks = body.picks;
    if (typeof picks !== 'object' || Object.keys(picks).length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid picks data'
        },
        { status: 400 }
      );
    }

    // Check if there's already a submitted bracket with this name for this user
    const duplicateNameExists = tournamentBrackets.some(
      bracket => bracket.playerEmail === body.playerEmail && 
                 bracket.entryName === body.entryName && 
                 bracket.status === 'submitted'
    );

    if (duplicateNameExists) {
      return NextResponse.json(
        { 
          success: false, 
          error: `A submitted bracket with the name "${body.entryName}" already exists. Please choose a different name.`
        },
        { status: 400 }
      );
    }

    // Check if there's an existing in-progress bracket for this user
    const existingBracketIndex = tournamentBrackets.findIndex(
      bracket => bracket.playerEmail === body.playerEmail && bracket.status === 'in_progress'
    );

    let tournamentBracket;
    
    if (existingBracketIndex >= 0) {
      // Update existing in-progress bracket to submitted
      tournamentBracket = {
        ...tournamentBrackets[existingBracketIndex],
        entryName: body.entryName,
        tieBreaker: body.tieBreaker,
        submittedAt: new Date().toISOString(),
        picks: picks,
        isComplete: true,
        isPublic: true,
        status: 'submitted'
      };
      
      // Update the existing bracket
      tournamentBrackets[existingBracketIndex] = tournamentBracket;
    } else {
      // Create new tournament bracket
      tournamentBracket = {
        id: `tournament-bracket-${nextId++}`,
        playerName: body.playerName,
        playerEmail: body.playerEmail,
        entryName: body.entryName,
        tieBreaker: body.tieBreaker,
        submittedAt: new Date().toISOString(),
        picks: picks,
        totalPoints: 0, // Will be calculated when games are played
        isComplete: true,
        isPublic: true,
        status: 'submitted' // Track bracket status
      };
      
      // Add to storage
      tournamentBrackets.push(tournamentBracket);
    }
    
    // Save to file
    await saveBrackets();

    return NextResponse.json({
      success: true,
      data: tournamentBracket,
      message: 'Tournament bracket submitted successfully'
    });
  } catch (error) {
    console.error('Error creating tournament bracket:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create tournament bracket' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/tournament-bracket - Save in-progress bracket
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.playerName || !body.playerEmail || !body.entryName || !body.picks) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: playerName, playerEmail, entryName, and picks are required'
        },
        { status: 400 }
      );
    }

    // For PUT (save in-progress), always create a new bracket
    // Multiple in-progress brackets can have the same name
    const bracketData = {
      id: `tournament-bracket-${nextId++}`,
      playerName: body.playerName,
      playerEmail: body.playerEmail,
      entryName: body.entryName,
      tieBreaker: body.tieBreaker,
      lastSaved: new Date().toISOString(),
      picks: body.picks,
      totalPoints: 0,
      isComplete: false,
      isPublic: false,
      status: 'in_progress'
    };

    // Always create new in-progress bracket
    tournamentBrackets.push(bracketData);
    
    // Save to file
    await saveBrackets();

    return NextResponse.json({
      success: true,
      data: bracketData,
      message: 'Bracket saved successfully'
    });
  } catch (error) {
    console.error('Error saving bracket:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save bracket' },
      { status: 500 }
    );
  }
}


/**
 * GET /api/tournament-bracket - Get all tournament brackets
 */
export async function GET(request: NextRequest) {
  try {
    // Reload brackets from file to ensure we have the latest data
    await loadBrackets();
    
    return NextResponse.json({
      success: true,
      data: tournamentBrackets,
      count: tournamentBrackets.length
    });
  } catch (error) {
    console.error('Error fetching tournament brackets:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tournament brackets' },
      { status: 500 }
    );
  }
}
