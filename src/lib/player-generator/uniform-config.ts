/**
 * Uniform configuration for football player image generation
 * Modify these values to customize the uniform appearance
 */

export interface UniformConfig {
  // Primary colors
  jerseyColor: string; // Main jersey color (hex)
  jerseySecondaryColor?: string; // Secondary jersey color for patterns
  pantsColor: string; // Pants color (hex)
  helmetColor: string; // Helmet color (hex)
  socksColor: string; // Socks color (hex)
  
  // Accent colors
  accentColor: string; // For numbers, stripes, etc.
  accentSecondaryColor?: string; // Additional accent (gold)
  numberOutlineColor?: string; // Number outline color
  
  // Logo configuration
  logoPath?: string; // Path to logo image file (optional)
  logoPosition: 'chest' | 'shoulder' | 'helmet' | 'none';
  logoSize: number; // Logo size in pixels
  
  // Number configuration
  numberColor: string; // Number color
  numberFont: 'block' | 'sans-serif' | 'serif';
  numberSize: number; // Number size (front/back)
  sleeveNumberSize?: number; // Smaller number size for sleeves
  numberPosition: 'front' | 'back' | 'both';
  
  // Pattern configuration
  jerseyPattern: 'solid' | 'stripes' | 'shoulder-stripes' | 'sleeve-stripes' | 'checkered';
  patternColor?: string; // Pattern color (if different from accent)
  
  // Additional details
  teamName?: string; // Optional team name on jersey
  teamNameColor?: string;
  teamNameSize?: number;
  roorTabText?: string; // Text for helmet tab (e.g., "ROOR" with backwards R)
  
  // Uniform style
  jerseyStyle: 'v-neck' | 'round-neck' | 'collar';
  sleeveLength: 'short' | 'long' | 'sleeveless';
  collarColor?: string; // Collar trim color
  sleeveTrimColor?: string; // Sleeve trim color
  
  // Pants details
  pantsStyle: 'solid' | 'stripes' | 'side-panel';
  pantsStripeColor?: string;
  
  // Helmet details
  helmetStripeColor?: string; // Color of stripe down middle of helmet
  helmetStripeWidth?: number; // Width of helmet stripe
  
  // Equipment
  cleatColor: string; // Cleat color
  cleatLaceColor?: string; // Cleat lace color
  cleatAccentColor?: string; // Optional accent on cleats
  gloveColor?: string; // Glove color (for pass catchers)
  gloveAccentColor?: string; // Glove accent color
  
  // Player style
  oversizedFeatures?: boolean; // Large heads and eyes
  animatedExpressions?: boolean; // Position-specific expressions
}

/**
 * Default uniform configuration - ROOR Team
 * Black, Purple (#542583), Gold (#FEB727), White
 */
export const defaultUniformConfig: UniformConfig = {
  // Primary colors
  jerseyColor: '#000000', // Black
  pantsColor: '#542583', // Purple
  helmetColor: '#000000', // Black
  socksColor: '#542583', // Purple
  
  // Accent colors
  accentColor: '#FEB727', // Gold
  accentSecondaryColor: '#ffffff', // White
  numberOutlineColor: '#FEB727', // Gold outline on numbers
  
  // Logo configuration
  logoPath: undefined, // Logo path to be set
  logoPosition: 'helmet', // Logo on helmet side
  logoSize: 50,
  
  // Number configuration
  numberColor: '#542583', // Purple numbers
  numberFont: 'block',
  numberSize: 120, // Large numbers front/back
  sleeveNumberSize: 40, // Smaller numbers on sleeves
  numberPosition: 'both', // Front and back
  
  // Pattern configuration
  jerseyPattern: 'solid', // Solid black
  patternColor: undefined,
  
  // Additional details
  teamName: undefined,
  roorTabText: 'ROOR', // Will be rendered with backwards R
  
  // Uniform style
  jerseyStyle: 'collar', // Collar style
  sleeveLength: 'short',
  collarColor: '#542583', // Purple collar
  sleeveTrimColor: '#542583', // Purple sleeve trim
  
  // Pants details
  pantsStyle: 'stripes', // Gold stripe
  pantsStripeColor: '#FEB727', // Gold stripe
  
  // Helmet details
  helmetStripeColor: '#FEB727', // Gold stripe down middle
  helmetStripeWidth: 8,
  
  // Equipment
  cleatColor: '#000000', // Black cleats
  cleatLaceColor: '#ffffff', // White laces
  cleatAccentColor: undefined, // Optional purple/gold accents
  gloveColor: '#542583', // Purple gloves (for pass catchers)
  gloveAccentColor: '#FEB727', // Gold accents on gloves
  
  // Player style
  oversizedFeatures: true, // Large heads and eyes
  animatedExpressions: true, // Position-specific expressions
};

/**
 * Variation options for batch generation
 */
export interface PlayerVariation {
  uniformNumber: number; // 0-99
  position: 'QB' | 'RB' | 'WR' | 'TE' | 'OL' | 'DL' | 'LB' | 'CB' | 'S' | 'K' | 'P';
  skinTone: 'light' | 'medium-light' | 'medium' | 'medium-dark' | 'dark';
  pose?: 'standing' | 'running' | 'throwing' | 'catching' | 'tackling';
  height?: number; // Relative height multiplier (0.8 - 1.2)
  build?: 'slim' | 'average' | 'muscular';
}

/**
 * Generate all possible variations
 */
export function generateAllVariations(): PlayerVariation[] {
  const variations: PlayerVariation[] = [];
  
  // Uniform numbers 0-99
  const numbers = Array.from({ length: 100 }, (_, i) => i);
  
  // Positions
  const positions: PlayerVariation['position'][] = [
    'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'CB', 'S', 'K', 'P'
  ];
  
  // Skin tones
  const skinTones: PlayerVariation['skinTone'][] = [
    'light', 'medium-light', 'medium', 'medium-dark', 'dark'
  ];
  
  // Generate all combinations
  for (const number of numbers) {
    for (const position of positions) {
      for (const skinTone of skinTones) {
        variations.push({
          uniformNumber: number,
          position,
          skinTone,
        });
      }
    }
  }
  
  return variations; // 100 numbers × 11 positions × 5 skin tones = 5,500 variations
}

