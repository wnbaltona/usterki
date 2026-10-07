const path=require('path');const root=path.resolve(__dirname,'..');
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx=vm.createContext({console,crypto:require('crypto').webcrypto,window:{},document:{documentElement:{dataset:{}},querySelector:()=>null,addEventListener:()=>{}},localStorage:{},matchMedia:()=>({matches:false,addEventListener:()=>{}}),Intl,Date,Set,Map,FormData:class{constructor(f){return Object.entries(f)}}});
for(const f of ['model.js','app-core.js','app-actions.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
vm.runInContext(`
state={users:[{id:'legacy',email:'legacy@example.test',role:'Administrator',active:true},{id:'a',authUserId:'auth-a',role:'Administrator',active:true,name:'Admin',email:'admin@firma.pl'},{id:'b',authUserId:'auth-b',role:'Koordynator',active:true,email:'b@firma.pl',name:'B'}],locations:[{mpk:'178'}]};
authUser={id:'unknown'};currentId='legacy';if(user()!==undefined)throw Error('Nieznane konto uzyskało profil');
authUser={id:'auth-b'};if(user().role!=='Koordynator'||isAdmin())throw Error('Przełączenie konta');
state.users[2].active=false;if(user()!==undefined)throw Error('Nieaktywne konto');state.users[2].active=true;
authUser={id:'auth-a'};authAccounts=[{id:'auth-c',email:'c@firma.pl'}];
mutate=async fn=>fn(state);savePreference=()=>{};shell=()=>{};toast=()=>{};page='home';
`,ctx);
(async()=>{
await vm.runInContext(`submitUser({id:'',name:'C',email:'c@firma.pl',role:'Koordynator',mpks:'',active:'on'})`,ctx);
assert(vm.runInContext(`state.users.some(u=>u.authUserId==='auth-c'&&u.role==='Koordynator')`,ctx));
await assert.rejects(vm.runInContext(`submitUser({id:'',name:'D',email:'d@firma.pl',role:'Koordynator',mpks:'',active:'on'})`,ctx),/Najpierw utwórz/);
await assert.rejects(vm.runInContext(`submitUser({id:'',name:'C',email:'c@firma.pl',role:'Kierownik lokalu',mpks:'',active:'on'})`,ctx),/Kierownik/);
vm.runInContext(`authUser={id:'auth-b'}`,ctx);
await assert.rejects(vm.runInContext(`submitUser({})`,ctx),/administrator/);
console.log('PASS: unknown account, disabled account, role binding, grant, unknown email, manager MPK, coordinator denied');
})().catch(e=>{console.error(e);process.exit(1)});



