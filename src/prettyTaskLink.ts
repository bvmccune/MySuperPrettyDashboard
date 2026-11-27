import type {NativeTodo} from './prettyCloud';
type Link=NonNullable<NativeTodo['link']>;
type Entry={path:string;name:string;isDir:boolean};
type Target={path:string;page:number};
/** Scan accessible notes when the user taps a link, not during dashboard load.
 * A stable ID outranks a filename. Never guess between duplicate names.
 * pageNo is one-based, while the SDK accepts zero-based indexes. */
export async function resolveTaskNote(
 link:Link,listDir:(path:string)=>Promise<Entry[]>,
 fileId:(path:string)=>Promise<string>,
 pageIndex:(path:string,id:string,hint:number)=>Promise<number|null>,
):Promise<Target|null>{
 const roots=['/storage/emulated/0/Note','/storage/emulated/0/Document'];
 const queue=[...roots],seen=new Set<string>(),files=new Set<string>();
 let incomplete=false;
 while(queue.length){
   const dir=queue.shift()!;
   if(seen.has(dir))continue;
   if(seen.size>=2000){incomplete=true;break;}
   seen.add(dir);
   try{
     const entries=await listDir(dir);
     for(const e of entries??[]){
       if(e.name.startsWith('.'))continue;
       if(e.isDir)queue.push(e.path);
       else if(/\.note$/i.test(e.path))files.add(e.path);
     }
   }catch{incomplete=true;}
 }
 const paths=[...files];
 const leaf=(s:string)=>s.split('/').pop()?.replace(/\.note$/i,'').toLowerCase()??'';
 const direct=link.path&&paths.includes(link.path)?link.path:undefined;
 const same=paths.filter(p=>leaf(p)===leaf(link.name));
 const hint=link.page?link.page-1:-1;
 if(link.fileId){
   const matches:string[]=[];
   for(const path of paths)if(await fileId(path)===link.fileId)matches.push(path);
   const preferred=matches.length===1?matches[0]:direct&&matches.includes(direct)?direct:undefined;
   if(preferred){
     if(link.pageId){const page=await pageIndex(preferred,link.pageId,hint);if(page!==null)return {path:preferred,page};}
     else if(hint>=0)return {path:preferred,page:hint};
   }
   // A moved page may now live in a renamed or different notebook.
   if(!link.pageId)return null;
 }
 if(link.pageId){
   const matches:Target[]=[];
   for(const path of paths){const page=await pageIndex(path,link.pageId,hint);if(page!==null)matches.push({path,page});}
   return matches.length===1&&!incomplete?matches[0]:null;
 }
 if(hint<0)return null;
 if(direct)return {path:direct,page:hint};
 return same.length===1&&!incomplete?{path:same[0],page:hint}:null;
}
