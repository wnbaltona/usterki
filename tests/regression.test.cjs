const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const site = path.resolve(__dirname, '..');
const context = {
  console, crypto: require('crypto').webcrypto, Blob, structuredClone, Intl, Date,
  window: {}, document: {documentElement: {dataset: {}}, querySelector: () => null, addEventListener: () => {}},
  localStorage: {}, matchMedia: () => ({matches: false, addEventListener: () => {}}),
  FormData: class {constructor(values) {return Object.entries(values);}}
};
vm.createContext(context);
for (const file of ['locations.js','model.js','app-core.js','app-actions.js','app-data.js']) vm.runInContext(fs.readFileSync(path.join(site,file),'utf8'),context);
const run = code => vm.runInContext(code, context);
run(`state=Model.initial(window.BALTONA_LOCATIONS);authUser=null;currentId=state.users[0].id;`);
assert.equal(run('user()'), undefined);
assert.equal(run('isAdmin()'), false);
assert.equal(run('canManage()'), false);
assert.equal(run('canClose()'), false);
assert.equal(run('currentTickets().length'), 0);
(async () => {
  await assert.rejects(run('mutate(()=>{})'), /Zaloguj/);
  await run('openStore()');
  assert.equal(run('currentId'), null);
  run(`state.users[0].authUserId='auth-admin';authUser={id:'auth-admin'};currentId=state.users[0].id;
    mutate=async change=>change(state);shell=()=>{};toast=()=>{};`);
  const count = run('state.settings.categories.length');
  assert(count <= 40, 'Default category list fits the configured limit');
  await run(`submitSettings({categories:state.settings.categories.join(String.fromCharCode(10)),responseHours:'48',maxFiles:'5',maxMB:'10'})`);
  assert.equal(run('state.settings.categories.length'), count);
  await assert.rejects(run(`submitSettings({categories:'Inna',responseHours:'0',maxFiles:'5',maxMB:'10'})`), /zakresy/);
  await assert.rejects(run(`submitSettings({categories:'Inna',responseHours:'48',maxFiles:'6',maxMB:'10'})`), /zakresy/);
  context.file = Object.assign(new Blob([Uint8Array.from([137,80,78,71,13,10,26,10])]), {name:'test.png'});
  assert.equal(await run('validateFile(file)'), 'image/png');
  context.file = Object.assign(new Blob(['fake-image']), {name:'test.png'});
  await assert.rejects(run('validateFile(file)'), /poprawnym/);
  context.file = Object.assign(new Blob([]), {name:'test.pdf'});
  await assert.rejects(run('validateFile(file)'), /pusty/);
  run(`state.settings.maxMB=1`);
  context.file = Object.assign(new Blob([new Uint8Array(1024*1024+1)]), {name:'test.png'});
  await assert.rejects(run('validateFile(file)'), /przekracza/);
  run(`state.users[0].role='Użytkownik'`);
  await assert.rejects(run(`submitSettings({})`), /administratora/);
  console.log('OK: brak sesji i roli, zapis domyślnych kategorii, zakresy ustawień, zawartość i limity plików');
})().catch(error => {console.error(error);process.exitCode=1;});
