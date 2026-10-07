const path = require('path');
const siteRoot = path.resolve(__dirname, '..');
const fs=require('fs'),vm=require('vm'),assert=require('assert');
for(const file of ['app-sw.js','push-sw.js']){
 const handlers={};let shown;
 const context={URL,self:{addEventListener:(name,fn)=>handlers[name]=fn,registration:{scope:'https://example.org/usterki/',showNotification:(title,options)=>{shown={title,options};return Promise.resolve();}}}};
 vm.runInNewContext(fs.readFileSync(path.join(siteRoot,file),'utf8'),context);
 for(const [tag,title] of [['comment-123','Dodano komentarz do zgłoszenia'],['new-123','Nowe zgłoszenie'],['status-123','Zaktualizowano zgłoszenie']]){
  handlers.push({data:{json:()=>({tag,title:'UST-123',body:'Poufny komentarz',ticketId:'123'})},waitUntil:()=>{}});
  assert.equal(shown.title,title);assert.equal(shown.options.body,'');
  assert(!('icon' in shown.options));assert(!('image' in shown.options));
  assert(shown.options.badge.endsWith('/usterki/icon-transparent-192.png'));
  assert(shown.options.data.url.endsWith('index.html?ticket=123'));
 }
}
console.log('OK: krótkie treści, brak dużej ikony, znaczek aplikacji i link do zgłoszenia');
