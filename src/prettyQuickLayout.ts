/** null = add tile, undefined = unused cell. Add never displaces a real pin. */
export type QuickRow<T>=[T|null|undefined,T|null|undefined];
export const MAX_QUICK_PINS=30;
export function quickRows<T>(pins:readonly T[]):QuickRow<T>[]{
  const cells:(T|null|undefined)[]=pins.slice(0,MAX_QUICK_PINS);
  if(cells.length<MAX_QUICK_PINS)cells.push(null);
  const rows:QuickRow<T>[]=[];
  for(let i=0;i<cells.length;i+=2)rows.push([cells[i],cells[i+1]]);
  return rows;
}
export function hiddenQuickPins<T>(rows:QuickRow<T>[],hiddenRows:number):number{
  const visible=Math.max(0,rows.length-hiddenRows);
  return rows.slice(visible).flat().filter(pin=>pin!=null).length;
}
