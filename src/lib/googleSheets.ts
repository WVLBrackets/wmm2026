// Google Sheets API integration for Hall of Fame data

export interface HallOfFameEntry {
  year: string;
  firstPlace: {
    name: string;
    team: string;
    score: number;
  };
  secondPlace: {
    name: string;
    score: number;
  };
  thirdPlace: {
    name: string;
    score: number;
  };
  totalEntries: number;
}

// Google Sheet ID from your URL: 1qFjvpimsmilkuJT_zOn3IhidkqLpzbX8MRn1cQxjuHw
const GOOGLE_SHEET_ID = '1qFjvpimsmilkuJT_zOn3IhidkqLpzbX8MRn1cQxjuHw';
const GOOGLE_SHEET_RANGE = 'Sheet1!A1:I100'; // Adjust range as needed

// Function to fetch data from Google Sheets
export const getHallOfFameData = async (): Promise<HallOfFameEntry[]> => {
  try {
    // Use Google Sheets public CSV export
    const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv&gid=0`;
    
    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.status}`);
    }
    
    const csvText = await response.text();
    const lines = csvText.split('\n');
    
    // Skip header row and parse data
    const data: HallOfFameEntry[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines
      
      // Parse CSV line (handle commas within quoted fields)
      const fields = parseCSVLine(line);
      
      if (fields.length >= 9 && fields[0] && fields[0] !== 'Year') {
        data.push({
          year: fields[0],
          firstPlace: {
            name: fields[1],
            team: fields[2],
            score: parseInt(fields[3]) || 0
          },
          secondPlace: {
            name: fields[4],
            score: parseInt(fields[5]) || 0
          },
          thirdPlace: {
            name: fields[6],
            score: parseInt(fields[7]) || 0
          },
          totalEntries: parseInt(fields[8]) || 0
        });
      }
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching Google Sheets data:', error);
    
    // Fallback to static data if Google Sheets fails
    return [
      {
        year: "2025",
        firstPlace: {
          name: "Randy Phillips",
          team: "Florida Gators",
          score: 156
        },
        secondPlace: {
          name: "Craig Veldhuizen",
          score: 155
        },
        thirdPlace: {
          name: "Tim Roche",
          score: 152
        },
        totalEntries: 420
      },
      {
        year: "2024",
        firstPlace: {
          name: "Darren Miranda",
          team: "UConn Huskies",
          score: 142
        },
        secondPlace: {
          name: "Brian Hodack",
          score: 138
        },
        thirdPlace: {
          name: "Joey Frontczak",
          score: 132
        },
        totalEntries: 454
      },
      {
        year: "2023",
        firstPlace: {
          name: "Jose Jimenez",
          team: "UConn Huskies",
          score: 116
        },
        secondPlace: {
          name: "Geoff MacPherson",
          score: 105
        },
        thirdPlace: {
          name: "Brett Barry",
          score: 101
        },
        totalEntries: 457
      }
    ];
  }
};

// Helper function to parse CSV line with proper handling of quoted fields
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
