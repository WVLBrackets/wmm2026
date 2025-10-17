import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Determine the environment for file naming
const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'development';
const getBracketsFileName = () => `brackets-${environment}.json`;
const BRACKETS_FILE = path.join(process.cwd(), 'data', getBracketsFileName());

// In-memory storage for development, will be replaced by a database
let tournamentBrackets: any[] = [];
let nextId = 1;

// Load brackets from file on startup
async function loadBrackets() {
  try {
    const data = await fs.readFile(BRACKETS_FILE, 'utf8');
    const parsed = JSON.parse(data);
    tournamentBrackets = parsed.brackets || [];
    nextId = parsed.nextId || 1;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('Brackets file not found, starting with empty array.');
      tournamentBrackets = [];
      nextId = 1;
    } else {
      console.error('Error loading brackets:', error);
    }
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
 * GET /api/tournament-bracket/[id] - Get a specific tournament bracket
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // Reload brackets from file to ensure we have the latest data
    await loadBrackets();

    const bracket = tournamentBrackets.find(b => b.id === id);

    if (!bracket) {
      return NextResponse.json(
        { success: false, error: 'Bracket not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: bracket
    });
  } catch (error) {
    console.error('Error getting tournament bracket:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get tournament bracket' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/tournament-bracket/[id] - Update a specific tournament bracket
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const body = await request.json();

    // Reload brackets from file to ensure we have the latest data
    await loadBrackets();

    const bracketIndex = tournamentBrackets.findIndex(b => b.id === id);

    if (bracketIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Bracket not found' },
        { status: 404 }
      );
    }

    // Only allow updating of in-progress brackets
    if (tournamentBrackets[bracketIndex].status !== 'in_progress') {
      return NextResponse.json(
        { success: false, error: 'Only in-progress brackets can be updated' },
        { status: 403 }
      );
    }

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

    // Update the existing bracket
    tournamentBrackets[bracketIndex] = {
      ...tournamentBrackets[bracketIndex],
      playerName: body.playerName,
      playerEmail: body.playerEmail,
      entryName: body.entryName,
      tieBreaker: body.tieBreaker,
      picks: body.picks,
      lastSaved: new Date().toISOString()
    };
    
    // Save to file
    await saveBrackets();

    return NextResponse.json({
      success: true,
      data: tournamentBrackets[bracketIndex],
      message: 'Bracket updated successfully'
    });
  } catch (error) {
    console.error('Error updating tournament bracket:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update tournament bracket' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tournament-bracket/[id] - Delete a specific tournament bracket
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    // Reload brackets from file to ensure we have the latest data
    await loadBrackets();

    const bracketIndex = tournamentBrackets.findIndex(b => b.id === id);

    if (bracketIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Bracket not found' },
        { status: 404 }
      );
    }

    // Only allow deletion of in-progress brackets
    if (tournamentBrackets[bracketIndex].status !== 'in_progress') {
      return NextResponse.json(
        { success: false, error: 'Only in-progress brackets can be deleted' },
        { status: 403 }
      );
    }

    // Remove the bracket
    tournamentBrackets.splice(bracketIndex, 1);
    
    // Save to file
    await saveBrackets();

    return NextResponse.json({ 
      success: true, 
      message: 'Bracket deleted successfully' 
    }, { status: 200 });
  } catch (error) {
    console.error('Error deleting tournament bracket:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete tournament bracket' },
      { status: 500 }
    );
  }
}
