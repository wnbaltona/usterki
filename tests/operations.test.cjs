const path = require('path');
const siteRoot = path.resolve(__dirname, '..');
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(path.join(siteRoot,'app-events.js'),'utf8');
const classes=new Set(),errors=[];
const ctx={busy:false,document:{body:{classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}}},fail:e=>errors.push(e)};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function perform'),source.indexOf("document.addEventListener('click'")),ctx);
(async()=>{
 let finish;const pending=ctx.perform(()=>new Promise(r=>finish=r));
 assert(ctx.busy);assert(classes.has('operation-pending'));
 let duplicates=0;await ctx.perform(()=>duplicates++);assert.equal(duplicates,0);
 finish();await pending;assert(!ctx.busy);assert.equal(classes.size,0);
 await ctx.perform(()=>{throw Error('Błąd serwera');});assert.equal(errors.length,1);assert(!ctx.busy);assert.equal(classes.size,0);
 console.log('OK: blokada powtórnej operacji i przywrócenie interfejsu po sukcesie oraz błędzie');
})().catch(e=>{console.error(e);process.exitCode=1;});
