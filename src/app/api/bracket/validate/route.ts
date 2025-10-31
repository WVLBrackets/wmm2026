import { NextRequest, NextResponse } from 'next/server';
import { BracketSubmission } from '@/types/bracket';
import { validateBracketSubmission } from '@/lib/bracketValidation';

/**
 * POST /api/bracket/validate - Validate a bracket submission
 */
export async function POST(request: NextRequest) {
  try {
    const submission: BracketSubmission = await request.json();
    
    // Validate the bracket submission
    const validation = validateBracketSubmission(submission);
    
    return NextResponse.json({
      success: true,
      validation
    });
  } catch (error) {
    console.error('Error validating bracket:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to validate bracket' },
      { status: 500 }
    );
  }
}

