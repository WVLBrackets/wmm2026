import { NextResponse } from 'next/server';

const TEAM_REF_SHEET_ID = '1X2J_UsBAnIaxdGQt1nF0DN9llkky1zFcPU_nky01pAI';

export async function GET() {
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${TEAM_REF_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=RefData`;
    
    const response = await fetch(csvUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const csvText = await response.text();
    
    // Parse CSV data
    const lines = csvText.split('\n').filter(line => line.trim());
    const teamData: { abbr: string; id: string }[] = [];
    
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns = parseCSVLine(line);
      if (columns.length >= 3) {
        const abbr = columns[1] || ''; // Column B (Abbr)
        const id = columns[2] || '';   // Column C (Id)
        
        if (abbr && id) {
          teamData.push({ abbr, id });
        }
      }
    }
    
    return NextResponse.json(teamData);
  } catch (error) {
    console.error('Error fetching team mapping data:', error);
    return NextResponse.json({ error: 'Failed to fetch team mapping data' }, { status: 500 });
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}
