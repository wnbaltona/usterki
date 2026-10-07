const path=require('path');const root=path.resolve(__dirname,'..');
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx=vm.createContext({console,crypto:require('crypto').webcrypto,window:{},document:{documentElement:{dataset:{}},querySelector:()=>null,addEventListener:()=>{}},localStorage:{},matchMedia:()=>({matches:false,addEventListener:()=>{}}),Intl,Date,Set,Map,structuredClone});
for(const f of ['model.js','app-core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
vm.runInContext(`state={users:[{id:'admin',authUserId:'a',email:'admin@firma.pl',name:'Admin',role:'Administrator',active:true},{id:'real-c',authUserId:'c',email:'c@firma.pl',role:'Koordynator',active:true}],locations:[{mpk:'178',active:true}]};authUser={id:'a'};currentId='admin';`,ctx);
(async()=>{
assert(vm.runInContext(`canPreviewProfiles()&&testProfiles().length===3`,ctx));
assert(vm.runInContext(`switchTestProfile('preview-0')&&user().role==='Koordynator'&&!isAdmin()&&canPreviewProfiles()`,ctx));
await assert.rejects(vm.runInContext(`mutate(()=>{})`,ctx),/podgląd/);
assert(vm.runInContext(`switchTestProfile('preview-1')&&user().role==='Kierownik lokalu'&&user().mpks[0]==='178'`,ctx));
assert(vm.runInContext(`switchTestProfile('preview-2')&&user().role==='Użytkownik'`,ctx));
assert(vm.runInContext(`switchTestProfile('admin')&&isAdmin()&&previewProfileId===null`,ctx));
assert(!vm.runInContext(`switchTestProfile('real-c')`,ctx));
vm.runInContext(`authUser={id:'c'};previewProfileId='preview-1';`,ctx);
assert(vm.runInContext(`!canPreviewProfiles()&&user().role==='Koordynator'&&!switchTestProfile('admin')&&previewProfileId===null`,ctx));
vm.runInContext(`authUser={id:'a'};switchTestProfile('preview-0');state.users[0].active=false;`,ctx);
assert(vm.runInContext(`user()===undefined&&!canPreviewProfiles()`,ctx));
console.log('PASS: administrator preview for 3 roles, MPK, read-only preview, return, real accounts excluded, coordinator blocked, inactive administrator blocked');
})().catch(e=>{console.error(e);process.exit(1)});
