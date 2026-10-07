const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.resolve(__dirname,'..');
let mode='success',uploads=[],removed=[],notified=0;
const context={Date,console,Model:{migrate:x=>x,ticketEvents:()=>[],notificationEvents:()=>[]},currentId:'actor',
  refreshNotificationsUI:()=>notified++,updatesChannel:null,state:{revision:10},
  authClient:{storage:{from:()=>({upload:async id=>{if(mode==='upload-fails'&&id==='b')return {error:Error('upload rejected')};uploads.push(id);return {error:null};},remove:async ids=>{removed.push(...ids);return {error:null};}})},
  from:()=>{const chain={update:()=>chain,select:()=>chain,eq:()=>chain,maybeSingle:async()=>({data:mode==='success'?{revision:11}:null,error:null})};return chain;}}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'app-data.js'),'utf8'),context);
function prepare(){uploads=[];removed=[];context.state={revision:10};context.next={revision:10,events:[],notifications:[]};context.files=[{id:'a',blob:1,type:'x'},{id:'b',blob:2,type:'x'}];}
(async()=>{
  prepare();mode='success';await vm.runInContext('persist(next,files)',context);
  assert.equal(context.state.revision,11);assert.equal(notified,1);assert.deepEqual(uploads,['a','b']);
  prepare();mode='upload-fails';const before=context.state;
  await assert.rejects(vm.runInContext('persist(next,files)',context),/upload rejected/);
  assert.equal(context.state,before);assert.deepEqual(removed,['a']);
  prepare();mode='conflict';const previous=context.state;
  await assert.rejects(vm.runInContext('persist(next,files)',context),/Inna osoba/);
  assert.equal(context.state,previous);assert.deepEqual(removed,['a','b']);
  await assert.rejects(vm.runInContext('persist(next,[],true)',context),/wyłączone/);
  console.log('OK: zapis, błąd uploadu, konflikt wersji, sprzątanie plików i zachowanie wcześniejszego stanu');
})().catch(e=>{console.error(e);process.exitCode=1;});
