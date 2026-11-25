/** Use actual on-disk modification time only; never use the recent-open list,
 *  synthesized activity timestamps, creation times, or documents. */
type Entry={path:string;name:string;isDir:boolean;mtime?:number};
type ListDir=(path:string)=>Promise<Entry[]>;
const NOTE_ROOTS=['/storage/emulated/0/Note','/storage/emulated/0/Document'];
const SKIP=/^(Android|\..*|LOST\.DIR|System Volume Information|\$RECYCLE\.BIN)$/i;
export async function findLastSavedNote(listDir:ListDir,cardRoots:string[]=[]):Promise<string|null>{
  let latest:{path:string;mtime:number}|undefined;
  const scan=async(roots:string[],limit:number)=>{
    const queue=[...roots],seen=new Set<string>();
    while(queue.length){
      const dir=queue.shift()!;
      if(seen.has(dir))continue;
      if(seen.size>=limit)throw new Error('Too many folders to verify the last saved note.');
      seen.add(dir);
      let entries:Entry[];
      try{entries=await listDir(dir);}catch{continue;}
      for(const e of entries||[]){
        if(e.isDir){if(!SKIP.test(e.name))queue.push(e.path);continue;}
        const mtime=e.mtime;
        if(!/\.note$/i.test(e.name)||typeof mtime!=='number'||!Number.isFinite(mtime)||mtime<=0)continue;
        if(!latest||mtime>latest.mtime||(mtime===latest.mtime&&e.path<latest.path))
          latest={path:e.path,mtime};
      }
    }
  };
  await scan(NOTE_ROOTS,400);
  for(const root of cardRoots)await scan([root],200);
  return latest?.path??null;
}
