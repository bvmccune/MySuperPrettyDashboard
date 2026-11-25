/** Approved Rocky phrases; choose randomly when the Free Rest of Day illustration mounts. */
export const ROCKY_PHRASES=['Fist my bump.','Words of encouragement.','Words of GREAT encouragement!','Is perfect!'] as const;
export function rockyPhrase(random:()=>number=Math.random):typeof ROCKY_PHRASES[number]{
 const index=Math.max(0,Math.min(ROCKY_PHRASES.length-1,Math.floor(random()*ROCKY_PHRASES.length)));
 return ROCKY_PHRASES[index];
}
