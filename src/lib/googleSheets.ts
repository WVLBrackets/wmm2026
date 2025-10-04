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

// Function to fetch data from Google Sheets
export const getHallOfFameData = async (): Promise<HallOfFameEntry[]> => {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv&gid=0`;
  
  // Retry logic with exponential backoff
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`Attempting to fetch Google Sheets data (attempt ${attempt}/3)...`);
      
      // Add timeout and retry logic
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(csvUrl, {
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
        }
      });
      
      clearTimeout(timeoutId);
      
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
            team: fields[3], // Team name is in position 3, not 2
            score: parseInt(fields[4]) || 0 // Score is in position 4, not 3
          },
          secondPlace: {
            name: fields[5], // Second place name is in position 5, not 4
            score: parseInt(fields[6]) || 0 // Second place score is in position 6, not 5
          },
          thirdPlace: {
            name: fields[7], // Third place name is in position 7, not 6
            score: parseInt(fields[8]) || 0 // Third place score is in position 8, not 7
          },
          totalEntries: parseInt(fields[9]) || 0 // Total entries is in position 9, not 8
        });
      }
    }
    
      console.log('Successfully fetched Google Sheets data');
      return data;
      
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      
      if (attempt === 3) {
        console.error('All retry attempts failed, using fallback data');
        break;
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
  
  // If all retries failed, use fallback data
  console.log('Using fallback Hall of Fame data');
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
      },
      {
        year: "2020",
        firstPlace: {
          name: "HIATUS",
          team: "HIATUS",
          score: 0
        },
        secondPlace: {
          name: "HIATUS",
          score: 0
        },
        thirdPlace: {
          name: "HIATUS",
          score: 0
        },
        totalEntries: 0
      },
      {
        year: "2016",
        firstPlace: {
          name: "Villanova Wildcats",
          team: "Villanova Wildcats",
          score: 0
        },
        secondPlace: {
          name: "HIATUS",
          score: 0
        },
        thirdPlace: {
          name: "HIATUS",
          score: 0
        },
        totalEntries: 0
      }
    ];
}

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
