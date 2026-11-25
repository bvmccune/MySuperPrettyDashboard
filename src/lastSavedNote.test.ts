import {findLastSavedNote} from './lastSavedNote';
const root='/storage/emulated/0/Note';
it('chooses the latest actual save, including nested folders, not PDFs or open history',async()=>{
  const files:Record<string,any[]>={
    [root]:[{name:'Opened.note',path:root+'/Opened.note',mtime:10,isDir:false},
      {name:'Project',path:root+'/Project',isDir:true},
      {name:'Newest.pdf',path:root+'/Newest.pdf',mtime:1000,isDir:false}],
    [root+'/Project']:[{name:'Saved.note',path:root+'/Project/Saved.note',mtime:50,isDir:false}],
  };
  expect(await findLastSavedNote(async dir=>files[dir]||[])).toBe(root+'/Project/Saved.note');
});
it('reads fresh timestamps on each invocation',async()=>{
  const a={name:'A.note',path:root+'/A.note',mtime:10,isDir:false};
  const b={name:'B.note',path:root+'/B.note',mtime:20,isDir:false};
  const list=async(dir:string)=>dir===root?[a,b]:[];
  expect(await findLastSavedNote(list)).toBe(b.path);
  a.mtime=30;
  expect(await findLastSavedNote(list)).toBe(a.path);
});
it('supports removable storage and returns null when no saved notes exist',async()=>{
  const path='/storage/ABCD/Note.note';
  expect(await findLastSavedNote(async dir=>dir==='/storage/ABCD'?[{path,name:'Note.note',mtime:1,isDir:false}]:[],['/storage/ABCD'])).toBe(path);
  expect(await findLastSavedNote(async()=>[])).toBeNull();
});
