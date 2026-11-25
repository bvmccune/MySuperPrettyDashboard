/** Approved Rocky phrases. A date-seeded pseudorandom draw stays stable throughout the day. */
export const ROCKY_PHRASES=['Fist my bump.','Words of encouragement.','Words of GREAT encouragement!','Is perfect!'] as const;
export function rockyPhrase(date:Date):typeof ROCKY_PHRASES[number]{
  const day=Math.floor(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/86400000);
  let n=(day+0x9e3779b9)|0;
  n=Math.imul(n^(n>>>16),0x21f0aaad);
  n=Math.imul(n^(n>>>15),0x735a2d97);
  n=(n^(n>>>15))>>>0;
  return ROCKY_PHRASES[n%ROCKY_PHRASES.length];
}
