'use strict';
// Stan aplikacji, logowanie i wspólne funkcje interfejsu.
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
const date = value => value ? new Intl.DateTimeFormat('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value)) : '—';
const dateOnly = value => value ? new Intl.DateTimeFormat('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value)) : '—';
const targetHours = (priority,blocksSales) => blocksSales || priority === 'Wysoki' ? 4 : priority === 'Średni' ? 24 : 72;
const suggestedDeadline = ticket => new Date(Date.parse(ticket.createdAt) + targetHours(ticket.priority,ticket.blocksSales) * 3600000).toISOString();
const priorityScore = ticket => (ticket.blocksSales ? 4 : 0) + ({Wysoki:3,'Średni':2,Niski:1}[ticket.priority] || 0);
function dueCell(ticket){if(!canManage())return `<span class="cell-main">${ticket.dueAt?dateOnly(ticket.dueAt):'Nie ustalono'}</span>`;return `<span class="cell-main">${date(suggestedDeadline(ticket))}</span><span class="cell-sub">Sugerowany · ${targetHours(ticket.priority,ticket.blocksSales)} h</span>${ticket.dueAt?`<span class="cell-sub">Plan: ${dateOnly(ticket.dueAt)}</span>`:''}`;}
const sizeFmt = bytes => bytes < 1024*1024 ? Math.ceil(bytes/1024)+' KB' : (bytes/1024/1024).toFixed(1)+' MB';
const iconPaths={message:'M21 11a8 8 0 0 1-8 8H5l-3 3V5a3 3 0 0 1 3-3h8a8 8 0 0 1 8 9zM7 7h8M7 12h6',plus:'M12 5v14M5 12h14',home:'m3 10 9-7 9 7v10H3zM9 20v-7h6v7',list:'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',building:'M4 21V3h12v18M16 9h4v12M8 7h4M8 11h4M8 15h4M8 21v-3h4v3',chart:'M3 3v18h18M7 16v-4M12 16V7M17 16v-7',shield:'m12 3 9 4v6c0 5-9 9-9 9s-9-4-9-9V7zM8 12l3 3 5-6',clip:'m8 13 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7L13 2',arrow:'M5 12h14m-6-6 6 6-6 6',clock:'M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',alert:'m12 3 10 18H2zM12 9v5M12 17h.01',check:'m5 12 4 4L19 6',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',settings:'M4 7h16M4 17h16M8 4v6M16 14v6',user:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-2a8 8 0 0 1 16 0v2'};
const icon = name => `<span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${iconPaths[name]||iconPaths.list}"/></svg></span>`;
const option = (value,label=value,current='') => `<option value="${esc(value)}" ${String(value)===String(current)?'selected':''}>${esc(label)}</option>`;
const empty = (title,text,action='') => `<div class="empty">${icon('list')}<h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
const btn = (action,label,ic='plus',kind='') => `<button class="btn ${kind}" data-action="${action}">${icon(ic)}${esc(label)}</button>`;
const header = (title,description,action='') => `<div class="heading"><div><h1>${esc(title)}</h1>${description?`<p>${esc(description)}</p>`:''}</div>${action}</div>`;
let state, currentId, page='home', adminTab='users', selectedTicket=null, draftFiles=[], dirty=false, busy=false, editingUser=null, editingLocation=null;
let authUser=null, authClient=null;
let filters={q:'',status:'',city:'',priority:'',from:'',to:'',quick:'',sort:'urgent'};
let dashboardRange='30';
let scheduleMode='list',scheduleFilter='all',scheduleMonth=scheduleDateKey(new Date()).slice(0,7),scheduleSelectedDay=scheduleDateKey(new Date());
let quickCloseId=null,detailDirty=false,onlyUnreadNotifications=false,pendingRemote=null,syncing=false,updatesChannel=null,lastSeenProfile=null,seenNotificationIds=new Set(),syncErrorShown=false;
function user(){return state.users.find(u=>u.id===currentId&&u.active)||state.users.find(u=>u.active&&u.role==='Administrator');}
function loginView(message=''){return `<div class="auth-card"><div class="auth-brand"><span class="brand-mark" aria-hidden="true"><img src="./logo.svg?v=11" width="32" height="32" alt=""></span><div><strong>Serwis Lokali</strong><small>Zgłoszenia usterek</small></div></div><h1>Zaloguj się</h1><p class="auth-copy">Zaloguj się, aby zgłaszać i obsługiwać usterki.</p>${message?`<p class="form-error" role="alert">${esc(message)}</p>`:''}<form id="login-form"><div class="field"><label for="login-email">E-mail</label><input id="login-email" name="email" type="email" autocomplete="email" required></div><div class="field"><label for="login-password">Hasło</label><input id="login-password" name="password" type="password" autocomplete="current-password" required minlength="6"></div><button class="btn" type="submit">Zaloguj się</button></form></div>`;}
function showAuth(message=''){document.body.classList.add('auth-screen');$('#navigation').innerHTML='';$('#content').innerHTML=loginView(message);$('#notification-bell').hidden=true;$('.profile')?.classList.add('auth-hidden');}
function showApp(){document.body.classList.remove('auth-screen');$('#notification-bell').hidden=false;$('.profile')?.classList.remove('auth-hidden');shell();}
async function submitLogin(form){if(!authClient)throw Error('Supabase nie jest jeszcze skonfigurowany.');const values=Object.fromEntries(new FormData(form));const {error}=await authClient.auth.signInWithPassword({email:values.email.trim(),password:values.password});if(error)throw error;}
async function logout(){if(authClient)await authClient.auth.signOut();else{authUser=null;showAuth();}}
function canManage(){return ['Koordynator','Administrator'].includes(user().role);}
function canClose(ticket){const u=user();return ['Koordynator','Administrator'].includes(u.role)||u.role==='Kierownik lokalu'&&!!ticket&&(u.mpks||[]).includes(ticket.mpk);}
function availablePlaces(){const u=user(),mpks=u.mpks||[];return state.locations.filter(l=>l.active&&(u.role==='Kierownik lokalu'?mpks.includes(l.mpk):u.role==='Użytkownik'&&mpks.length?mpks.includes(l.mpk):true));}
function isAdmin(){return user().role==='Administrator';}
function currentTickets(){return Model.visible(state,user());}
function toast(message,error=false){const node=document.createElement('div');node.className='toast'+(error?' error':'');node.textContent=message;node.setAttribute('role',error?'alert':'status');mountToast(node);setTimeout(()=>node.remove(),error?10000:6500);}
function showNewFormFieldError(field,message){
 if(!field)return false;
 const host=field.closest('.field,.dropzone,fieldset')||field.parentElement;
 let note=host.querySelector('.new-form-field-error');
 if(!note){note=document.createElement('span');note.className='new-form-field-error';note.id='error-'+(field.id||field.name);note.setAttribute('role','alert');host.append(note);}
 note.textContent=message;field.setAttribute('aria-invalid','true');field.setAttribute('aria-describedby',note.id);return true;
}
function clearNewFormFieldError(field){
 if(!field?.closest?.('#new-form'))return;
 field.removeAttribute('aria-invalid');
 if(field.id==='attachments')field.setAttribute('aria-describedby','attachment-error');else field.removeAttribute('aria-describedby');
 field.closest('.field,.dropzone,fieldset')?.querySelector('.new-form-field-error')?.remove();
}
function fail(error,form){
 const message=error?.message||'Nie udało się wykonać operacji.';
 if(form?.id==='new-form'){
  const fieldId=message.startsWith('Podaj imię')?'reporter':message.startsWith('Podaj prawidłowy numer')?'reporter-phone':message.startsWith('Wybierz aktywny obiekt')?'mpk':message.startsWith('Wybierz rodzaj')?'category':message.startsWith('Opis musi')?'description':message.startsWith('Dodaj co najmniej')?'attachments':'';
  const field=fieldId&&form.querySelector('#'+fieldId);
  if(showNewFormFieldError(field,message)){field.focus();toast(message,true);return;}
 }
 if(form){let p=form.querySelector('.form-error');if(!p){p=document.createElement('p');p.className='form-error';p.setAttribute('role','alert');if(form.id==='user-form')form.prepend(p);else form.append(p);}p.textContent=message;if(form.id==='user-form')p.scrollIntoView({block:'center'});}
 toast(message,true);
}
async function mutate(change,files=[],replace=false){const next=structuredClone(state);change(next);await persist(next,files,replace);}
function statusPill(status){const kind=status==='Nowe'?'new':status==='Zamknięte'?'closed':status==='Odrzucone'?'rejected':'progress';return `<span class="pill ${kind}">${esc(status)}</span>`;}
function priorityPill(priority){return `<span class="pill ${priority==='Wysoki'?'high':priority==='Średni'?'medium':'low'}">${esc(priority)}</span>`;}
function scheduleDateKey(value){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
