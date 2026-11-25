/** Manta supports 16 grayscale levels. These are evenly spaced UI target values, not a measured hardware luminance table. */
export const GRAYSCALE=['#000000','#111111','#222222','#333333','#444444','#555555','#666666','#777777','#888888','#999999','#AAAAAA','#BBBBBB','#CCCCCC','#DDDDDD','#EEEEEE','#FFFFFF'] as const;
export const INK=GRAYSCALE[0];
export const PAPER=GRAYSCALE[15];
export const DARK_GRAY=GRAYSCALE[9];
export const LIGHT_GRAY=GRAYSCALE[12];
