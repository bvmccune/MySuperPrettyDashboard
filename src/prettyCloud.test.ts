jest.mock('react-native',()=>({NativeModules:{DashboardNative:{secureLoadTodoToken:jest.fn(async()=> 'session')}}}));
jest.mock('sn-plugin-lib',()=>({PluginManager:{hasPermission:jest.fn(async()=>1)}}));
import {readNativeSupernoteTasks,updateNativeTodo,noteLink} from './prettyCloud';
import {resolveTaskNote} from './prettyTaskLink';
const row={taskId:'one',taskListId:'list',title:'Old',detail:'Keep',dueTime:0,status:'needsAction',completedTime:123,links:[{fileName:'Old.note',fileId:'F123',pageId:'P123',pageNo:3}],reminder:{type:'unchanged'},recurrence:{rule:'unknown'},isDeleted:'N'};
const ok=(body:unknown)=>Promise.resolve({ok:true,status:200,json:async()=>body});
let fetcher:jest.Mock;
beforeEach(()=>{fetcher=jest.fn();(globalThis as any).fetch=fetcher;});
it('reads only incomplete real tasks, and uses status not completedTime',async()=>{
 fetcher.mockImplementationOnce(()=>ok({scheduleTask:[row,{...row,taskId:'done',status:'completed'},{...row,taskId:'deleted',isDeleted:'Y'}],nextPageToken:null}));
 const result=await readNativeSupernoteTasks();expect(result.tasks).toHaveLength(1);expect(result.tasks[0].link).toMatchObject({fileId:'F123',pageId:'P123',page:3});
 expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({maxResults:1000});
});
it('completes with PUT only and preserves all untouched server metadata',async()=>{
 fetcher.mockImplementationOnce(()=>ok({scheduleTask:[row]})).mockImplementationOnce(()=>ok({success:true})).mockImplementationOnce(()=>ok({scheduleTask:[{...row,status:'completed'}]}));
 await updateNativeTodo('one',{complete:true});
 const req=fetcher.mock.calls[1][1];const body=JSON.parse(req.body);
 expect(req.method).toBe('PUT');expect(body).toMatchObject({...row,status:'completed',completedTime:expect.any(Number),lastModified:expect.any(Number)});
 expect(fetcher.mock.calls.map(c=>c[1].method)).toEqual(['POST','PUT','POST']);
});
it('edits name/date at local midnight without discarding links or changing status',async()=>{
 const due=new Date(2026,10,27).getTime();
 fetcher.mockImplementationOnce(()=>ok({scheduleTask:[row]})).mockImplementationOnce(()=>ok({success:true})).mockImplementationOnce(()=>ok({scheduleTask:[{...row,title:'New',dueTime:due}]}));
 await updateNativeTodo('one',{title:'New',due:'2026-11-27'});
 expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({...row,title:'New',dueTime:due});
});
it('rejects server refusals and never creates a duplicate',async()=>{
 fetcher.mockImplementationOnce(()=>ok({scheduleTask:[row]})).mockImplementationOnce(()=>ok({success:false,errorMsg:'Rejected'}));
 await expect(updateNativeTodo('one',{complete:true})).rejects.toThrow('Rejected');expect(fetcher).toHaveBeenCalledTimes(2);
});
it('rejects unconfirmed completion instead of treating it as success',async()=>{
 fetcher.mockImplementationOnce(()=>ok({scheduleTask:[row]})).mockImplementationOnce(()=>ok({success:true})).mockImplementationOnce(()=>ok({scheduleTask:[row]}));
 await expect(updateNativeTodo('one',{complete:true})).rejects.toThrow('did not confirm');
});
it('does not write when the source task is missing, or date is impossible',async()=>{
 fetcher.mockImplementationOnce(()=>ok({scheduleTask:[]}));await expect(updateNativeTodo('one',{complete:true})).rejects.toThrow('no longer open');
 fetcher.mockImplementationOnce(()=>ok({scheduleTask:[row]}));await expect(updateNativeTodo('one',{due:'2026-02-30'})).rejects.toThrow('Invalid due date');
 expect(fetcher.mock.calls.every(c=>c[1].method==='POST')).toBe(true);
});
it('retains page-only and file-only stable link metadata',()=>{
 expect(noteLink([{pageId:'p',fileId:'f'}])).toMatchObject({pageId:'p',fileId:'f'});
});
const root='/storage/emulated/0/Note',a=root+'/A/Old.note',b=root+'/B/Old.note';
const dir=async(path:string)=>path===root?[{path:root+'/A',name:'A',isDir:true},{path:root+'/B',name:'B',isDir:true}]:path===root+'/A'?[{path:a,name:'Old.note',isDir:false}]:path===root+'/B'?[{path:b,name:'Old.note',isDir:false}]:[];
it('resolves duplicate names and reordered pages by stable identity',async()=>{
 expect(await resolveTaskNote({name:'Old.note',fileId:'F123',pageId:'P123',page:3},dir,async p=>p===b?'F123':'other',async(p,id)=>p===b&&id==='P123'?5:null)).toEqual({path:b,page:5});
});
it('rejects ambiguous filenames, missing and stale page IDs',async()=>{
 expect(await resolveTaskNote({name:'Old.note',page:3},dir,async()=>'',async()=>null)).toBeNull();
 expect(await resolveTaskNote({name:'Old.note',fileId:'F123',pageId:'missing',page:3},dir,async p=>p===b?'F123':'other',async()=>null)).toBeNull();
});
it('follows moved pages without trusting a stale page number',async()=>{
 expect(await resolveTaskNote({name:'Old.note',fileId:'F123',pageId:'moved',page:3},dir,async p=>p===a?'F123':'other',async p=>p===b?1:null)).toEqual({path:b,page:1});
});
