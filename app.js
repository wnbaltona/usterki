'use strict';
const Model = (() => {
  const statuses = ['Nowe', 'W realizacji', 'Oczekuje na naprawę', 'Oczekuje na informację', 'Zamknięte', 'Odrzucone'];
  const priorities = ['Niski', 'Średni', 'Wysoki'];
  const roles = ['Użytkownik', 'Kierownik lokalu', 'Koordynator', 'Administrator'];
  const closed = t => ['Zamknięte', 'Odrzucone'].includes(t.status);
  const numberFor = counter => 'UST-' + String(counter).padStart(3,'0');
  const visible = (state, user) => user.role === 'Kierownik lokalu' ? state.tickets.filter(t => (user.mpks||[]).includes(t.mpk)) : user.role === 'Użytkownik' ? state.tickets.filter(t => t.creatorId === user.id || (user.mpks||[]).includes(t.mpk)) : state.tickets;
  const critical = t => !closed(t) && (t.priority === 'Wysoki' || t.blocksSales);
  const overdue = (t, now = Date.now()) => { if (closed(t) || !t.dueAt) return false; const due = new Date(t.dueAt), today = new Date(now); return new Date(due.getFullYear(),due.getMonth(),due.getDate()) < new Date(today.getFullYear(),today.getMonth(),today.getDate()); };
  const waiting = (t, hours = 48, now = Date.now()) => !closed(t) && !t.firstResponseAt && now - Date.parse(t.createdAt) >= hours * 3600000;
  function metrics(tickets, now = Date.now(), hours = 48) {
    const completed = tickets.filter(t => t.status === 'Zamknięte' && t.closedAt);
    return { total: tickets.length, fresh: tickets.filter(t => t.status === 'Nowe').length, progress: tickets.filter(t => t.status !== 'Nowe' && !closed(t)).length, completed: completed.length, finished: tickets.filter(closed).length, critical: tickets.filter(critical).length, overdue: tickets.filter(t => overdue(t, now)).length, waiting: tickets.filter(t => waiting(t, hours, now)).length, meanHours: completed.length ? completed.reduce((n, t) => n + Math.max(0, Date.parse(t.closedAt) - Date.parse(t.createdAt)), 0) / completed.length / 3600000 : null };
  }
  function validateTicket(data, state, actor) {
    const place = state.locations.find(l => l.mpk === data.mpk && l.active);
    if (!place || place.city !== data.city) throw Error('Wybierz aktywny obiekt z wybranego miasta.');
    if (actor && ['Użytkownik','Kierownik lokalu'].includes(actor.role) && (actor.mpks||[]).length && !actor.mpks.includes(place.mpk)) throw Error('Ten profil nie jest przypisany do wybranego lokalu.');
    if (actor?.role === 'Kierownik lokalu' && !(actor.mpks||[]).length) throw Error('Kierownik nie ma przypisanego lokalu.');
    const reporter = String(data.reporter ?? '').trim();
    if (reporter.length > 150 || !/^\S{2,}(?:\s+\S{2,})+$/.test(reporter)) throw Error('Podaj imię i nazwisko zgłaszającego (do 150 znaków).');
    const phone = String(data.reporterPhone ?? '').trim();
    const digits = phone.replace(/\D/g,'');
    if (phone.length > 30 || !/^\+?[0-9()\s-]+$/.test(phone) || digits.length < 7 || digits.length > 15) throw Error('Podaj prawidłowy numer telefonu kontaktowego (7–15 cyfr).');
    if (!state.settings.categories.includes(data.category)) throw Error('Wybierz rodzaj usterki.');
    if (!priorities.includes(data.priority)) throw Error('Wybierz poziom alertu.');
    if (String(data.description).trim().length < 10 || String(data.description).length > 10000) throw Error('Opis musi zawierać od 10 do 10 000 znaków.');
    return place;
  }
  function updateTicket(ticket, values, user, now) {
    const managerClose = values.status === 'Zamknięte' && user.role === 'Kierownik lokalu' && (user.mpks||[]).includes(ticket.mpk);
    if (!['Koordynator', 'Administrator'].includes(user.role) && !managerClose) throw Error('Brak uprawnień do obsługi tego zgłoszenia.');
    if (managerClose && (values.priority !== ticket.priority || values.dueAt !== ticket.dueAt)) throw Error('Kierownik może zamknąć zgłoszenie bez zmiany priorytetu i terminu.');
    if (closed(ticket)) throw Error('Zgłoszenie jest zakończone; dane obsługi są zablokowane.');
    if (!statuses.includes(values.status) || !priorities.includes(values.priority)) throw Error('Nieprawidłowy status lub alert.');
    const isEnd = ['Zamknięte', 'Odrzucone'].includes(values.status);
    if (managerClose && values.closureAttachment?.purpose !== 'closure') throw Error('Kierownik musi dodać załącznik potwierdzający zamknięcie.');
    if (isEnd && !['Koordynator', 'Administrator'].includes(user.role) && !managerClose) throw Error('Zgłoszenie może zakończyć koordynator, administrator lub kierownik przypisanego lokalu.');
    const closingComment = String(values.closingComment ?? '').trim();
    if (isEnd && !closingComment) throw Error(values.status === 'Odrzucone' ? 'Podaj powód odrzucenia.' : 'Opisz wykonane prace.');
    if (isEnd && closingComment.length > 5000) throw Error('Komentarz może mieć do 5000 znaków.');
    if (values.dueAt && !Number.isFinite(Date.parse(values.dueAt))) throw Error('Nieprawidłowy termin realizacji.');
    return { ...ticket, status: values.status, priority: values.priority, dueAt: values.dueAt || null, closingComment: isEnd ? closingComment : '', firstResponseAt: ticket.firstResponseAt || now, closedAt: isEnd ? now : null, updatedAt: now };
  }
  function validateUserChange(users, proposed) {
    if (!roles.includes(proposed.role)) throw Error('Nieprawidłowa rola.');
    if (!Array.isArray(proposed.mpks) || (proposed.role === 'Kierownik lokalu' && !proposed.mpks.length)) throw Error('Kierownik lokalu musi mieć przypisane co najmniej jedno MPK.');
    if (!proposed.name.trim() || proposed.name.length > 150) throw Error('Podaj nazwę użytkownika (do 150 znaków).');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(proposed.email)) throw Error('Podaj poprawny adres e-mail.');
    const phone = String(proposed.phone ?? '').trim();
    const phoneDigits = phone.replace(/\D/g,'');
    if (phone && (phone.length > 30 || !/^\+?[0-9()\s-]+$/.test(phone) || phoneDigits.length < 7 || phoneDigits.length > 15)) throw Error('Podaj poprawny numer telefonu (7–15 cyfr) lub pozostaw pole puste.');
    if (users.some(u => u.id !== proposed.id && u.email.toLowerCase() === proposed.email.toLowerCase())) throw Error('Ten e-mail jest już przypisany do profilu.');
    const next = users.filter(u => u.id !== proposed.id).concat(proposed);
    if (!next.some(u => u.active && u.role === 'Administrator')) throw Error('Musi pozostać co najmniej jeden aktywny administrator.');
  }
  function csvCell(value) {
    let text = String(value ?? '');
    if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  }
  function initial(locations) {
    return { version: 1, revision: 0, counter: 0, locations, tickets: [], comments: [], notifications: [], events: [], users: [
      {id: 'demo-admin', name: 'Administrator testowy', email: 'administrator@example.test', role: 'Administrator', active: true},
      {id: 'demo-coord', name: 'Koordynator testowy', email: 'koordynator@example.test', role: 'Koordynator', active: true},
      {id: 'demo-user', name: 'Użytkownik testowy', email: 'uzytkownik@example.test', role: 'Użytkownik', active: true},
      {id: 'demo-manager', name: 'Kierownik lokalu 178', email: 'kierownik178@example.test', role: 'Kierownik lokalu', mpks: ['178'], active: true}
    ], settings: { categories: ['Elektryka i oświetlenie','Klimatyzacja i wentylacja','Instalacja wodna i kanalizacja','Urządzenia chłodnicze','Sprzęt gastronomiczny','Drzwi, zamki i zabezpieczenia','Wyposażenie lokalu','IT i system sprzedażowy','Inna'], responseHours:48, maxFiles:5, maxMB:10 } };
  }
  function migrate(state) {
    // Zachowaj zgłoszenia i pliki przy uzupełnianiu starszej bazy.
    if (state.notifications === undefined) state.notifications = [];
    if (state.events === undefined) state.events = [];
    for (const ticket of state.tickets) if (ticket.status === 'Oczekuje na części') ticket.status = 'Oczekuje na naprawę';
    for (const event of state.events) if (event.type === 'update' && event.text?.includes('Status:')) event.text = event.text.replaceAll('Oczekuje na części','Oczekuje na naprawę');
    for (const notification of state.notifications) {
      if (notification.type === 'update' && notification.body) notification.body = notification.body.replaceAll('Oczekuje na części','Oczekuje na naprawę');
    }
    if (!state.users.some(u=>u.id==='demo-manager'||u.email==='kierownik178@example.test')) state.users.push({id:'demo-manager',name:'Kierownik lokalu 178',email:'kierownik178@example.test',role:'Kierownik lokalu',mpks:['178'],active:true});
    const knownEvents = new Set(state.events.map(event => event.id));
    for (const ticket of state.tickets) {
      const id = 'created-' + ticket.id;
      if (!knownEvents.has(id)) state.events.push({id,ticketId:ticket.id,actorId:ticket.creatorId,actorName:state.users.find(u=>u.id===ticket.creatorId)?.name||ticket.reporter,type:'created',text:'Utworzono zgłoszenie',createdAt:ticket.createdAt});
    }
    const removedMpks = new Set(['FR','001','002']);
    if (state.locations.some(place => removedMpks.has(place.mpk))) {
      state.locations = state.locations.filter(place => !removedMpks.has(place.mpk));
    }
    const renamed = new Map();
    const used = new Set(state.tickets.filter(t => /^UST-\d+$/.test(t.number)).map(t => t.number));
    let next = Math.max(state.counter, ...[...used].map(n => Number(n.slice(4))));
    for (const ticket of state.tickets) {
      const match = /^UST-\d{4}-(\d+)$/.exec(ticket.number);
      if (!match) continue;
      let candidate = numberFor(Number(match[1]));
      while (used.has(candidate)) candidate = numberFor(++next);
      used.add(candidate);
      next = Math.max(next, Number(candidate.slice(4)));
      renamed.set(ticket.id, [ticket.number, candidate]);
      ticket.previousNumber ||= ticket.number;
      ticket.number = candidate;
    }
    state.counter = next;
    for (const notification of state.notifications) {
      const names = renamed.get(notification.ticketId);
      if (names) {
        notification.title = notification.title.replaceAll(names[0], names[1]);
        notification.body = notification.body.replaceAll(names[0], names[1]);
      }
    }
    return state;
  }
  function notificationsFor(state, user) {
    if (!user || !user.active) return [];
    const allowed = new Set(visible(state,user).map(t=>t.id));
    return (state.notifications || []).filter(n => n.recipientId === user.id && allowed.has(n.ticketId))
      .sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
  }
  function notificationEvents(before, after, actorId, now) {
    const actor=after.users.find(u=>u.id===actorId);
    if (!actor) return [];
    const result=[], previousTickets=new Map(before.tickets.map(t=>[t.id,t]));
    const oldComments=new Set(before.comments.map(c=>c.id));
    const previousNotifications=new Set((after.notifications||[]).map(n=>n.id));
    function emit(ticket,eventId,type,title,body) {
      const recipients=after.users.filter(u=>u.active && !u.deletedAt && u.id!==actorId && (u.id===ticket.creatorId || ['Koordynator','Administrator'].includes(u.role) || (u.mpks||[]).includes(ticket.mpk)));
      for (const recipient of recipients) {
        const id=eventId+'-'+recipient.id;
        if (!previousNotifications.has(id)) result.push({id,eventId,ticketId:ticket.id,recipientId:recipient.id,actorId,type,title,body,createdAt:now,readAt:null});
      }
    }
    for (const ticket of after.tickets) {
      const old=previousTickets.get(ticket.id);
      if (!old) {emit(ticket,'new-'+ticket.id,'new','Nowe zgłoszenie · '+ticket.number,actor.name+' zgłasza: '+ticket.mpk+' · '+ticket.locationName+'. Alert: '+ticket.priority+'.');continue;}
      const changes=[];
      if(old.status!==ticket.status)changes.push('Status: '+old.status+' → '+ticket.status);
      if(old.priority!==ticket.priority)changes.push('Alert: '+ticket.priority);
      if(old.assigneeId!==ticket.assigneeId)changes.push('Przypisanie: '+(after.users.find(u=>u.id===ticket.assigneeId)?.name||'Nie przypisano'));
      if(old.dueAt!==ticket.dueAt)changes.push('Zmieniono termin realizacji');
      if(changes.length)emit(ticket,'update-'+after.revision+'-'+ticket.id,'update',(closed(ticket)?'Zakończono zgłoszenie':'Aktualizacja zgłoszenia')+' · '+ticket.number,actor.name+': '+changes.join(' · ')+'.');
    }
    for(const comment of after.comments) {
      if(oldComments.has(comment.id))continue;
      const ticket=after.tickets.find(t=>t.id===comment.ticketId);
      if(ticket)emit(ticket,'comment-'+comment.id,'comment','Nowy komentarz · '+ticket.number,actor.name+': '+comment.text.slice(0,200)+(comment.text.length>200?'…':''));
    }
    return result;
  }
  function ticketEvents(before, after, actorId, now) {
    const actor = after.users.find(u=>u.id===actorId);
    if (!actor) return [];
    const previous = new Map(before.tickets.map(t=>[t.id,t]));
    const result = [];
    for (const ticket of after.tickets) {
      const old = previous.get(ticket.id);
      if (!old) continue;
      const changes = [];
      if (old.status !== ticket.status) changes.push('Status: '+old.status+' → '+ticket.status);
      if (old.priority !== ticket.priority) changes.push('Priorytet: '+old.priority+' → '+ticket.priority);
      if (old.dueAt !== ticket.dueAt) changes.push(ticket.dueAt?'Zmieniono termin realizacji':'Usunięto termin realizacji');
      if (!changes.length) continue;
      result.push({id:'change-'+(before.revision+1)+'-'+ticket.id,ticketId:ticket.id,actorId,actorName:actor.name,type:ticket.status==='Zamknięte'?'closed':ticket.status==='Odrzucone'?'rejected':'update',text:changes.join(' · '),createdAt:now});
    }
    return result;
  }
  function businessChanged(a,b) {
    return ['counter','tickets','comments','users','locations','settings','events'].some(key=>JSON.stringify(a[key])!==JSON.stringify(b[key]));
  }
  function validateBackup(data) {
    const error = () => { throw Error('Kopia danych ma nieprawidłowy format lub niespójne powiązania. Nie zmieniono bazy.'); };
    const str = (x, max = 10000) => typeof x === 'string' && x.length <= max;
    const id = x => str(x,100) && /^[a-zA-Z0-9-]+$/.test(x);
    const validDate = x => str(x,50) && /^\d{4}-\d\d-\d\dT/.test(x) && Number.isFinite(Date.parse(x));
    const dateOrNull = x => x === null || validDate(x);
    const unique = (items, key) => new Set(items.map(x => x[key])).size === items.length;
    if (!data || data.format !== 'baltona-usterki-backup' || data.version !== 1 || !data.state) error();
    const s = data.state;
    for (const key of ['users','locations','tickets','comments']) if (!Array.isArray(s[key]) || s[key].length > 100000) error();
    if (!Array.isArray(data.files) || data.files.length > 100000 || s.version !== 1 || !Number.isInteger(s.counter) || s.counter < 0 || !Number.isInteger(s.revision)) error();
    if (!s.users.length || !unique(s.users,'id') || !unique(s.tickets,'id') || !unique(s.tickets,'number') || !unique(s.comments,'id') || !unique(s.locations,'mpk') || !unique(data.files,'id')) error();
    for (const u of s.users) if (!id(u.id) || !str(u.name,150) || !u.name.trim() || !str(u.email,254) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.email) || !roles.includes(u.role) || typeof u.active !== 'boolean') error();
    for (const u of s.users) if (u.phone !== undefined && (!str(u.phone,30) || (u.phone && (!/^\+?[0-9()\s-]+$/.test(u.phone) || u.phone.replace(/\D/g,'').length < 7 || u.phone.replace(/\D/g,'').length > 15)))) error();
    if (new Set(s.users.map(u=>u.email.toLowerCase())).size!==s.users.length || !s.users.some(u=>u.active&&!u.deletedAt&&u.role==='Administrator')) error();
    for (const u of s.users) if(u.deletedAt !== undefined && !dateOrNull(u.deletedAt)) error();
    for (const l of s.locations) if (!str(l.mpk,40)||!l.mpk||!str(l.name,150)||!str(l.city,100)||!l.city||!str(l.location,150)||!['Lokal','Magazyn'].includes(l.type)||typeof l.active!=='boolean') error();
    const userIds=new Set(s.users.map(u=>u.id)),ticketIds=new Set(s.tickets.map(t=>t.id)),locationMpks=new Set(s.locations.map(l=>l.mpk));
    for(const u of s.users)if(u.mpks!==undefined&&(!Array.isArray(u.mpks)||u.mpks.length>100||new Set(u.mpks).size!==u.mpks.length||u.mpks.some(mpk=>!locationMpks.has(mpk))))error();
    const references=[];
    for (const t of s.tickets) {
      if (!id(t.id)||!str(t.number,60)||!/^UST-(?:\d{4}-)?\d+$/.test(t.number)||Number(t.number.split('-').at(-1))>s.counter||!userIds.has(t.creatorId)||!validDate(t.createdAt)||!validDate(t.updatedAt)||!dateOrNull(t.closedAt)||!dateOrNull(t.firstResponseAt)||!dateOrNull(t.dueAt)||!(statuses.includes(t.status)||t.status==='Oczekuje na części')||!priorities.includes(t.priority)||typeof t.blocksSales!=='boolean') error();
      for (const key of ['reporter','reporterEmail','city','mpk','locationName','location','category','description','closingComment']) if(!str(t[key])) error();
      if(t.previousNumber !== undefined && (!str(t.previousNumber,60) || !/^UST-\d{4}-\d+$/.test(t.previousNumber))) error();
      if(t.reporterPhone !== undefined && (!str(t.reporterPhone,30) || !/^\+?[0-9()\s-]+$/.test(t.reporterPhone) || t.reporterPhone.replace(/\D/g,'').length < 7 || t.reporterPhone.replace(/\D/g,'').length > 15)) error();
      if(!str(t.assigneeId,100)||(t.assigneeId&&!userIds.has(t.assigneeId))) error();
      if(t.costCents!==null&&(!Number.isSafeInteger(t.costCents)||t.costCents<0))error();
      if(closed(t)!==!!t.closedAt) error();
      if(!Array.isArray(t.attachments)||t.attachments.length>6)error();
      for(const f of t.attachments){if(!id(f.id)||f.ticketId!==t.id||!str(f.name,255)||!Number.isSafeInteger(f.size)||f.size<1||f.size>10*1024*1024||!['image/jpeg','image/png','application/pdf'].includes(f.type))error();references.push(f);}
    }
    if(!unique(references,'id')||references.length!==data.files.length)error();
    for(const c of s.comments)if(!id(c.id)||!ticketIds.has(c.ticketId)||!userIds.has(c.authorId)||!str(c.authorName,150)||!roles.includes(c.role)||!str(c.text,5000)||!c.text.trim()||!validDate(c.createdAt))error();
    for(const f of data.files){const ref=references.find(r=>r.id===f.id);if(!ref||f.name!==ref.name||f.ticketId!==ref.ticketId||f.size!==ref.size||f.type!==ref.type||!str(f.base64,15*1024*1024)||!/^[A-Za-z0-9+/]*={0,2}$/.test(f.base64)||f.base64.length%4!==0)error();}
    if(s.notifications!==undefined) {
      if(!Array.isArray(s.notifications)||s.notifications.length>500000||!unique(s.notifications,'id'))error();
      for(const n of s.notifications)if(!str(n.id,300)||!n.id||!str(n.eventId,200)||!ticketIds.has(n.ticketId)||!userIds.has(n.recipientId)||!userIds.has(n.actorId)||!['new','comment','update'].includes(n.type)||!str(n.title,200)||!str(n.body,1000)||!validDate(n.createdAt)||!dateOrNull(n.readAt))error();
    }
    if(s.events!==undefined) {
      if(!Array.isArray(s.events)||s.events.length>500000||!unique(s.events,'id'))error();
      for(const e of s.events)if(!str(e.id,150)||!/^[a-zA-Z0-9-]+$/.test(e.id)||!ticketIds.has(e.ticketId)||!userIds.has(e.actorId)||!str(e.actorName,150)||!str(e.text,1000)||!['created','update','closed','rejected'].includes(e.type)||!validDate(e.createdAt))error();
    }
    const cfg=s.settings;if(!cfg||!Array.isArray(cfg.categories)||!cfg.categories.length||cfg.categories.length>40||cfg.categories.some(c=>!str(c,100)||!c.trim())||new Set(cfg.categories).size!==cfg.categories.length||!Number.isInteger(cfg.responseHours)||cfg.responseHours<1||cfg.responseHours>720||!Number.isInteger(cfg.maxFiles)||cfg.maxFiles<1||cfg.maxFiles>5||!Number.isInteger(cfg.maxMB)||cfg.maxMB<1||cfg.maxMB>10)error();
    return migrate(s);
  }
  return { statuses, priorities, roles, closed, numberFor, visible, critical, overdue, waiting, metrics, validateTicket, updateTicket, validateUserChange, csvCell, initial, migrate, notificationsFor, notificationEvents, ticketEvents, businessChanged, validateBackup };
})();

'use strict';
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
let db, state, currentId, page='home', adminTab='users', selectedTicket=null, draftFiles=[], dirty=false, busy=false, editingUser=null, editingLocation=null;
let authUser=null, authClient=null, authConfigured=false, authReady=false;
const SUPABASE_URL='https://uwavvvcacsxqkitmfank.supabase.co', SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3YXZ2dmNhY3N4cWtpdG1mYW5rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MTM0OTEsImV4cCI6MjEwMzQ4OTQ5MX0.MzAdRypyHWdMIZWrQJ5agus25l0na_QB1iGWiVAFrk8';
let filters={q:'',status:'',city:'',priority:'',from:'',to:'',quick:'',sort:'urgent'};
let scheduleMode='list',scheduleFilter='all',scheduleMonth=scheduleDateKey(new Date()).slice(0,7),scheduleSelectedDay=scheduleDateKey(new Date());
let quickCloseId=null,detailDirty=false,onlyUnreadNotifications=false,pendingRemote=null,syncing=false,updatesChannel=null,lastSeenProfile=null,seenNotificationIds=new Set(),syncErrorShown=false;
function user(){return state.users.find(u=>u.id===currentId&&u.active)||state.users.find(u=>u.active&&u.role==='Administrator');}
function authRole(){const value=authUser?.app_metadata?.role;return Model.roles.includes(value)?value:'Użytkownik';}
function loginView(message=''){return `<div class="auth-card"><div class="auth-brand"><span class="brand-mark" aria-hidden="true"><img src="./logo.svg?v=11" width="32" height="32" alt=""></span><div><strong>Serwis Lokali</strong><small>Zgłoszenia usterek</small></div></div><h1>Zaloguj się</h1><p class="auth-copy">Zaloguj się, aby zgłaszać i obsługiwać usterki.</p>${message?`<p class="form-error" role="alert">${esc(message)}</p>`:''}<form id="login-form"><div class="field"><label for="login-email">E-mail</label><input id="login-email" name="email" type="email" autocomplete="email" required></div><div class="field"><label for="login-password">Hasło</label><input id="login-password" name="password" type="password" autocomplete="current-password" required minlength="6"></div><button class="btn" type="submit">Zaloguj się</button></form></div>`;}
function showAuth(message=''){document.body.classList.add('auth-screen');$('#navigation').innerHTML='';$('#content').innerHTML=loginView(message);$('#notification-bell').hidden=true;$('.profile')?.classList.add('auth-hidden');}
function showApp(){document.body.classList.remove('auth-screen');$('#notification-bell').hidden=false;$('.profile')?.classList.remove('auth-hidden');shell();window.onPushAppReady?.();}
async function initializeAuth(){
 authConfigured=SUPABASE_URL.startsWith('https://')&&SUPABASE_ANON_KEY.length>20&&!SUPABASE_URL.includes('TWOJ-');
 if(!authConfigured||!window.supabase){authReady=true;showAuth('Uzupełnij konfigurację Supabase w pliku HTML, aby włączyć logowanie.');return;}
 authClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
 const {data,error}=await authClient.auth.getSession();if(error)throw error;authUser=data.session?.user||null;
 authClient.auth.onAuthStateChange((_event,session)=>{authUser=session?.user||null;authReady=true;if(authUser){ensureAuthProfile().then(showApp).catch(e=>showAuth(e.message));}else showAuth();});
 authReady=true;if(!authUser){showAuth();return;}
 await ensureAuthProfile();
}
async function ensureAuthProfile(){
 const role=authRole(),email=authUser.email||'',name=authUser.user_metadata?.full_name||authUser.user_metadata?.name||email.split('@')[0]||'Użytkownik';
 const assigned=Array.isArray(authUser.app_metadata?.mpks)?authUser.app_metadata.mpks.filter(mpk=>state.locations.some(l=>l.mpk===mpk)):null;
 let profile=state.users.find(u=>u.authUid===authUser.id||u.id==='auth-'+authUser.id);
 if(!profile)profile=state.users.find(u=>u.email.toLowerCase()===email.toLowerCase());
 if(!profile){profile={id:'auth-'+authUser.id,name,email,role,mpks:assigned||[],active:true};state.users.push(profile);}
 profile.authUid=authUser.id;
 if(!profile.active||profile.deletedAt)throw Error('Profil powiązany z tym kontem jest nieaktywny. Skontaktuj się z administratorem.');
 if(!state.users.some(u=>u.id===currentId&&u.active&&!u.deletedAt))currentId=profile.id;
 savePreference();
}
async function submitLogin(form){if(!authClient)throw Error('Supabase nie jest jeszcze skonfigurowany.');const values=Object.fromEntries(new FormData(form));const {error}=await authClient.auth.signInWithPassword({email:values.email.trim(),password:values.password});if(error)throw error;}
async function logout(){try{await window.removePushForLogout?.();}catch(error){toast('Nie udało się wyłączyć powiadomień na tym urządzeniu: '+error.message,true);}if(authClient)await authClient.auth.signOut();else{authUser=null;showAuth();}}
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
function requestValue(request){return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function openStore(){
 if(!('indexedDB' in window)) throw Error('Ta przeglądarka nie obsługuje lokalnego zapisu IndexedDB.');
 db=await new Promise((resolve,reject)=>{const request=indexedDB.open('baltona-usterki-html-v1',1);request.onupgradeneeded=()=>{request.result.createObjectStore('state');request.result.createObjectStore('files',{keyPath:'id'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('Zamknij inne otwarte karty tej aplikacji i spróbuj ponownie.'));});
 db.onversionchange=()=>{db.close();toast('Zmieniono bazę danych w innej karcie. Odśwież aplikację.',true);};
 state=await requestValue(db.transaction('state').objectStore('state').get('main'));
 if(!state){const initial=Model.initial(window.BALTONA_LOCATIONS);await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');const store=tx.objectStore('state');const req=store.get('main');req.onsuccess=()=>{if(!req.result)store.put(initial,'main');};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});state=await requestValue(db.transaction('state').objectStore('state').get('main'));}
 try{currentId=localStorage.getItem('baltona-view-profile');}catch{}
 state=Model.migrate(state);currentId=user().id;
}
async function persist(next,files=[],replaceFiles=false){
 const revision=state.revision;
 await new Promise((resolve,reject)=>{const tx=db.transaction(['state','files'],'readwrite');const store=tx.objectStore('state');let failure;
 const req=store.get('main');req.onsuccess=()=>{if(req.result?.revision!==revision){failure=Error('Dane zmieniły się w innej karcie. Odśwież stronę przed kolejnym zapisem.');tx.abort();return;}next.revision=revision+1;Model.migrate(next);if(!replaceFiles){const now=new Date().toISOString(),before=Model.migrate(req.result);next.events.push(...Model.ticketEvents(before,next,currentId,now));next.notifications.push(...Model.notificationEvents(before,next,currentId,now));}store.put(next,'main');const fs=tx.objectStore('files');if(replaceFiles)fs.clear();for(const file of files)fs.put(file);};
 tx.oncomplete=resolve;tx.onerror=()=>reject(failure||tx.error||Error('Błąd lokalnego zapisu.'));tx.onabort=()=>reject(failure||tx.error||Error('Zapis przerwany. Sprawdź wolne miejsce w przeglądarce.'));
 });state=next;refreshNotificationsUI();updatesChannel?.postMessage({revision:next.revision});
}
async function mutate(change,files=[],replace=false){const next=structuredClone(state);change(next);await persist(next,files,replace);}
function savePreference(){try{localStorage.setItem('baltona-view-profile',currentId);}catch{}}
function statusPill(status){const kind=status==='Nowe'?'new':status==='Zamknięte'?'closed':status==='Odrzucone'?'rejected':'progress';return `<span class="pill ${kind}">${esc(status)}</span>`;}
function priorityPill(priority){return `<span class="pill ${priority==='Wysoki'?'high':priority==='Średni'?'medium':'low'}">${esc(priority)}</span>`;}
function shell(){
 const u=user(); const listLabel=canManage()?'Wszystkie zgłoszenia':user().role==='Kierownik lokalu'?'Zgłoszenia lokalu':'Moje zgłoszenia';const nav=[['home','home','Zgłoszenia'],['new','plus','Dodaj zgłoszenie'],['tickets','list',listLabel]];if(canManage())nav.push(['schedule','clock','Harmonogram'],['dashboard','chart','Dashboard']);if(isAdmin())nav.push(['admin','settings','Administracja']);
 if(!canManage()&&['dashboard','schedule'].includes(page))page='home';
 $('#navigation').style.setProperty('--nav-count',nav.length);
 $('#navigation').innerHTML=nav.map(([id,ic,label])=>`<button class="nav-button ${page===id?'active':''}" data-action="nav" data-page="${id}" aria-label="${label}" ${page===id?'aria-current="page"':''}>${icon(ic)}<span class="nav-desktop-label">${label}</span><span class="nav-mobile-label" aria-hidden="true">${({home:'Start',new:'Zgłoś',tickets:'Lista',schedule:'Terminy',dashboard:'Raporty',admin:'Ustawienia'})[id]}</span></button>`).join('');
 if($('#profile-select'))$('#profile-select').innerHTML=state.users.filter(x=>x.active).map(x=>option(x.id,x.role+' · '+x.name,u.id)).join('');
 $('#profile-name').textContent=u.name;$('#profile-role').textContent=u.role;
 $('#content').dataset.page=page;
 $('#content').innerHTML=page==='home'?homeView():page==='new'?newView():page==='tickets'?ticketsView():page==='schedule'?scheduleView():page==='dashboard'?dashboardView():adminView();
 if(page==='new')renderDraftFiles();refreshNotificationsUI();
}
function statsView(tickets,interactive=true){
 const m=Model.metrics(tickets);
 const cards=[['all','Wszystkie zgłoszenia',m.total,'list'],['new','Nowe',m.fresh,'plus'],['progress','W toku',m.progress,'clock'],['closed','Zamknięte',m.finished,'check'],['critical','Krytyczne',m.critical,'alert']];
 return `<div class="stats ${interactive?'':'static-stats'}" aria-label="${interactive?'Filtry zgłoszeń':'Podsumowanie zgłoszeń'}">${cards.map(([key,label,n,ic])=>{const content=`<span class="stat-top"><span class="stat-label">${label}</span>${icon(ic)}</span><strong>${n}</strong>`;const selected=key==='critical'?filters.quick==='critical':key==='progress'?filters.quick==='active':key==='all'?!filters.status&&!filters.quick:filters.status===({new:'Nowe',closed:'Zamknięte'}[key])&&!filters.quick;return interactive?`<button type="button" class="stat ${key==='critical'?'alert':''} ${selected?'selected':''}" aria-pressed="${selected}" data-action="stat-filter" data-filter="${key}" aria-label="Pokaż ${label.toLowerCase()}: ${n}">${content}<span class="stat-link">Pokaż zgłoszenia <span aria-hidden="true">→</span></span></button>`:`<div class="stat ${key==='critical'?'alert':''}">${content}</div>`}).join('')}</div>`;
}
function ticketTable(tickets,limit=0,showCount=true){if(!tickets.length)return empty('Brak zgłoszeń','Pierwsze zgłoszenie pojawi się tutaj po wysłaniu formularza.',btn('new','Zgłoś usterkę'));
 const managerTickets=page==='tickets'&&user().role==='Kierownik lokalu';const mode=page==='tickets'?(filters.sort||'urgent'):'urgent';const sorted=[...tickets].sort((a,b)=>{if(mode==='urgent'){const diff=priorityScore(b)-priorityScore(a);if(diff)return diff;}const byDate=b.createdAt.localeCompare(a.createdAt);return (mode==='oldest'?-byDate:byDate)||a.number.localeCompare(b.number);});const rows=limit?sorted.slice(0,limit):sorted;
 return `<div class="table-scroll"><table class="tickets-table"><thead><tr><th>Numer / data</th><th>${managerTickets?'Lokal':'Lokal / miasto'}</th><th>Rodzaj usterki</th><th>Priorytet</th><th>Status</th><th>Termin</th><th scope="col">Działania</th></tr></thead><tbody>${rows.map(t=>`<tr><td data-label="Zgłoszenie"><strong class="ticket-number">${esc(t.number)}</strong><span class="cell-sub">${date(t.createdAt)}</span></td><td data-label="Obiekt"><span class="cell-main">${esc(t.mpk)} · ${esc(t.locationName)}</span>${managerTickets?'':`<span class="cell-sub">${esc(ticketCity(t))}${t.location&&t.location!==ticketCity(t)?' · '+esc(t.location):''}</span>`}</td><td data-label="Usterka"><span class="cell-main">${esc(t.category)}</span></td><td data-label="Alert">${priorityPill(t.priority)}${t.blocksSales?'<span class="cell-sub danger-text">Blokuje sprzedaż</span>':''}</td><td data-label="Status">${statusPill(t.status)}</td><td data-label="Termin">${dueCell(t)}</td><td data-label="Działanie"><div class="ticket-actions"><button class="btn secondary small" data-action="detail" data-id="${esc(t.id)}" aria-label="Szczegóły ${esc(t.number)}">Otwórz</button>${canClose(t)&&!Model.closed(t)?`<button class="btn quick-close-btn small" type="button" data-action="quick-close" data-id="${esc(t.id)}" aria-label="Szybko zamknij ${esc(t.number)}">Zamknij</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>${!limit&&showCount?`<div class="page-count">Liczba wyników: ${rows.length}</div>`:''}`;
}
function attentionItems(tickets){
 const today=scheduleDateKey(new Date()),lastComments=new Map();
 for(const comment of state.comments){const previous=lastComments.get(comment.ticketId);if(!previous||comment.createdAt>previous.createdAt)lastComments.set(comment.ticketId,comment);}
 return tickets.filter(t=>!Model.closed(t)).map(ticket=>{
  const reasons=[];
  if(ticket.dueAt&&scheduleDateKey(ticket.dueAt)<today)reasons.push(['Po terminie','late']);
  if(ticket.status==='Nowe')reasons.push(['Nowe','']);
  if(!ticket.dueAt)reasons.push(['Bez terminu','']);
  const last=lastComments.get(ticket.id);
  if(last&&['Użytkownik','Kierownik lokalu'].includes(last.role)&&ticket.status!=='Nowe'&&ticket.status!=='Oczekuje na informację')reasons.push(['Odpowiedź lokalu','']);
  return {ticket,reasons};
 }).filter(item=>item.reasons.length).sort((a,b)=>Number(b.reasons.some(r=>r[1]==='late'))-Number(a.reasons.some(r=>r[1]==='late'))||priorityScore(b.ticket)-priorityScore(a.ticket)||b.ticket.updatedAt.localeCompare(a.ticket.updatedAt));
}
function homeAttention(tickets){
 const items=attentionItems(tickets);
 return `<section class="panel table-panel home-followup"><div class="block-heading"><h2>Wymagają działania</h2><button class="btn secondary small" type="button" data-action="attention-all">Pokaż wszystkie (${items.length})</button></div>${items.length?`<div class="attention-list">${items.slice(0,6).map(({ticket,reasons})=>`<article class="attention-item"><div><strong>${esc(ticket.number)} · ${esc(ticket.mpk)} · ${esc(ticket.locationName)}</strong><small>${esc(ticket.category)} · ${esc(ticketCity(ticket))}</small><div class="attention-tags">${reasons.map(([label,kind])=>`<span class="${kind}">${label}</span>`).join('')}</div></div><button class="btn secondary small" type="button" data-action="detail" data-id="${esc(ticket.id)}" aria-label="Otwórz ${esc(ticket.number)}">Otwórz</button></article>`).join('')}</div>`:'<div class="schedule-empty">Nie ma zgłoszeń wymagających pilnej reakcji.</div>'}</section>`;
}
function homeView(){
 const list=currentTickets(),m=Model.metrics(list),cutoff=Date.now()-24*60*60*1000;
 const recent=list.filter(t=>!Model.closed(t)&&Date.parse(t.createdAt)>=cutoff);
 const older=list.filter(t=>!Model.closed(t)&&Date.parse(t.createdAt)<cutoff);
 return `<div class="home-toolbar"><h1>Zgłoszenia</h1><div class="home-summary" aria-label="Podsumowanie zgłoszeń"><div><span>Otwarte</span><strong>${list.filter(t=>!Model.closed(t)).length}</strong></div><div><span>W toku</span><strong>${m.progress}</strong></div><div class="attention"><span>Zamknięte</span><strong>${m.finished}</strong></div></div>${btn('new','Dodaj zgłoszenie')}</div>`+
  (canManage()?homeAttention(list):'')+
  `<section class="panel table-panel recent-panel"><div class="block-heading"><h2>Zgłoszenia z ostatnich 24 h</h2><button class="btn secondary" type="button" data-action="nav" data-page="tickets">Wszystkie zgłoszenia <span aria-hidden="true">→</span></button></div>${recent.length?ticketTable(recent,0,false):empty('Brak nowych zgłoszeń','Nowe, otwarte zgłoszenia pojawią się tutaj. Pozostałe znajdziesz poniżej lub na liście wszystkich zgłoszeń.')}</section>`+
  (older.length?`<section class="panel table-panel recent-panel space-top"><div class="block-heading"><h2>Starsze otwarte zgłoszenia (${older.length})</h2><button class="btn secondary" type="button" data-action="nav" data-page="tickets">Pokaż wszystkie <span aria-hidden="true">→</span></button></div>${ticketTable(older,5,false)}</section>`:'');
}
function newView(){const places=availablePlaces(),cities=[...new Set(places.map(l=>l.city))].sort((a,b)=>a.localeCompare(b,'pl')),selectedCity=cities.length===1?cities[0]:'',cityPlaces=places.filter(l=>l.city===selectedCity),selectedMpk=cityPlaces.length===1?cityPlaces[0].mpk:'',previous=[...state.tickets].filter(t=>t.creatorId===user().id&&t.reporterPhone).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];return header('Zgłoś usterkę','Uzupełnij lokalizację, opis i dane kontaktowe.')+`<div class="form-layout simple-form"><form id="new-form" class="panel"><div class="section-title"><span class="num">01</span><div><h2>Lokalizacja usterki</h2></div></div><div class="form-grid"><div class="field"><label for="city">Miasto <span class="required">*</span></label><select id="city" name="city" required><option value="">Wybierz miasto</option>${cities.map(c=>option(c,c,selectedCity)).join('')}</select></div><div class="field"><label for="mpk">Lokal lub magazyn <span class="required">*</span></label><select id="mpk" name="mpk" required ${selectedCity?'':'disabled'}>${selectedCity?option('','Wybierz lokal / magazyn')+cityPlaces.map(l=>option(l.mpk,l.mpk+' · '+l.name+(l.type==='Magazyn'?' [Magazyn]':'')+(l.location&&l.location!==l.city?' · '+l.location:''),selectedMpk)).join(''):option('','Najpierw wybierz miasto')}</select></div></div><div class="section-title separated"><span class="num">02</span><div><h2>Szczegóły usterki</h2></div></div><div class="form-grid"><div class="field full"><label for="category">Rodzaj usterki <span class="required">*</span></label><select id="category" name="category" required><option value="">Wybierz rodzaj usterki</option>${state.settings.categories.map(c=>option(c)).join('')}</select></div><div class="field full"><label for="description">Opis usterki <span class="required">*</span></label><textarea id="description" name="description" minlength="10" maxlength="10000" required placeholder="Opisz objawy usterki i dokładne miejsce jej występowania." rows="5"></textarea></div><fieldset class="full" style="border:0;padding:0;margin:0"><legend class="field-label">Priorytet zgłoszenia <span class="required">*</span></legend><div class="priority-options">${Model.priorities.map((p,i)=>`<label class="priority-choice ${i===1?'medium':i===2?'high':''}"><input type="radio" name="priority" value="${p}" ${i===1?'checked':''}><i aria-hidden="true"></i>${p}</label>`).join('')}</div></fieldset><div class="full checkline"><input id="blocksSales" name="blocksSales" type="checkbox"><label for="blocksSales">Usterka blokuje sprzedaż</label></div>${canManage()?'<p class="priority-target" id="priority-target" aria-live="polite">Proponowany czas realizacji: 24 h od wysłania zgłoszenia.</p>':''}</div><div class="section-title separated"><span class="num">03</span><div><h2>Dane kontaktowe i załączniki</h2></div></div><div class="form-grid"><div class="field"><label for="reporter">Imię i nazwisko <span class="required">*</span></label><input id="reporter" name="reporter" required maxlength="150" autocomplete="name" value="${esc(user().name||previous?.reporter||'')}" placeholder="Imię i nazwisko"></div><div class="field"><label for="reporter-phone">Telefon kontaktowy <span class="required">*</span></label><input id="reporter-phone" name="reporterPhone" type="tel" inputmode="tel" autocomplete="tel" required maxlength="30" value="${esc(user().phone||previous?.reporterPhone||'')}" placeholder="+48 123 456 789"></div></div><div class="dropzone" id="dropzone">${icon('clip')}<strong>Dodaj co najmniej jeden załącznik <span class="required">*</span></strong><p>JPG, PNG, PDF · do ${state.settings.maxFiles} plików · maks. ${state.settings.maxMB} MB każdy</p><input id="attachments" type="file" multiple accept=".jpg,.jpeg,.png,.pdf" aria-label="Dodaj wymagany załącznik: zdjęcie lub PDF" aria-required="true" aria-describedby="attachment-error"></div><p id="attachment-error" class="attachment-error" role="alert" hidden>Dodaj co najmniej jeden załącznik.</p><div id="draft-files" aria-live="polite"></div><div class="form-bottom"><span>Pola oznaczone * są wymagane.</span><button class="btn" type="submit">Wyślij zgłoszenie ${icon('arrow')}</button></div></form></div>`;}
function ticketCity(t){return state.locations.find(l=>l.mpk===t.mpk)?.city||t.city||'Inne';}
function filteredTickets({ignoreCity=false,ignoreStatus=false}={}){const visible=currentTickets(),attentionIds=filters.quick==='attention'&&!ignoreStatus?new Set(attentionItems(visible).map(item=>item.ticket.id)):null;return visible.filter(t=>(ignoreStatus||!filters.status||(filters.status==='Zamknięte'?Model.closed(t):t.status===filters.status))&&(ignoreStatus||filters.quick!=='critical'||Model.critical(t))&&(ignoreStatus||filters.quick!=='active'||t.status!=='Nowe'&&!Model.closed(t))&&(!attentionIds||attentionIds.has(t.id))&&(ignoreCity||!filters.city||ticketCity(t)===filters.city)&&(!filters.priority||t.priority===filters.priority)&&(!filters.q||[t.number,t.previousNumber,t.mpk,t.locationName,t.description,t.category,t.reporter].join(' ').toLocaleLowerCase('pl').includes(filters.q.toLocaleLowerCase('pl')))&&(!filters.from||t.createdAt>=new Date(filters.from+'T00:00').toISOString())&&(!filters.to||t.createdAt<=new Date(filters.to+'T23:59:59.999').toISOString()));}
function filterForm(){const advanced=!!filters.priority||filters.sort!=='urgent',active=!!(filters.q||filters.status||filters.city||filters.priority||filters.quick||filters.sort!=='urgent');return `${filters.quick?`<div class="active-filter">${filters.quick==='critical'?'Pokazujesz zgłoszenia krytyczne':filters.quick==='attention'?'Pokazujesz zgłoszenia wymagające działania':'Pokazujesz zgłoszenia w toku'} <button type="button" data-action="clear-quick">Usuń filtr ×</button></div>`:''}<form id="filter-form" class="filters simple-filters"><div class="field search-field"><label for="filter-q">Szukaj zgłoszenia</label><input id="filter-q" name="q" value="${esc(filters.q)}" placeholder="Numer, lokal lub opis…"></div><button class="btn" type="submit">Szukaj</button>${active?'<button class="btn secondary" type="button" data-action="clear-filters">Wyczyść</button>':''}<details class="more-filters" ${advanced?'open':''}><summary>Więcej filtrów</summary><div class="more-filters-grid"><div class="field"><label for="filter-priority">Priorytet</label><select id="filter-priority" name="priority">${option('','Wszystkie priorytety',filters.priority)}${Model.priorities.map(p=>option(p,p,filters.priority)).join('')}</select></div><div class="field"><label for="filter-sort">Sortuj</label><select id="filter-sort" name="sort">${option('urgent','Według priorytetu',filters.sort||'urgent')}${option('newest','Najnowsze',filters.sort)}${option('oldest','Najstarsze',filters.sort)}</select></div></div></details></form>`;}

function cityFilters(tickets){const groups=new Map();for(const t of tickets)groups.set(ticketCity(t),(groups.get(ticketCity(t))||0)+1);const sorted=[...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0],'pl'));return `<div class="city-filters" aria-label="Filtruj według miasta"><button type="button" class="city-chip ${!filters.city?'active':''}" data-action="city-filter" data-city="" aria-pressed="${!filters.city}">Wszystkie miasta <span>${tickets.length}</span></button>${sorted.map(([city,count])=>`<button type="button" class="city-chip ${filters.city===city?'active':''}" data-action="city-filter" data-city="${esc(city)}" aria-pressed="${filters.city===city}">${esc(city)} <span>${count}</span></button>`).join('')}</div>`;}
function cityGroups(tickets){const grouped=new Map();for(const t of tickets){const city=ticketCity(t);if(!grouped.has(city))grouped.set(city,[]);grouped.get(city).push(t);}return [...grouped.entries()].sort((a,b)=>filters.sort==='urgent'?(Math.max(...b[1].map(priorityScore))-Math.max(...a[1].map(priorityScore))||a[0].localeCompare(b[0],'pl')):a[0].localeCompare(b[0],'pl')).map(([city,items])=>`<section class="city-group"><div class="city-group-heading"><div><span class="city-group-kicker">Miasto</span><h2>${esc(city)}</h2></div><span class="city-group-count">${items.length} ${items.length===1?'zgłoszenie':'zgłoszeń'}</span></div><div class="panel table-panel">${ticketTable(items,0,false)}</div></section>`).join('');}
function ticketMonth(value){const day=new Date(value),key=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit'}).format(day),label=new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Warsaw',year:'numeric',month:'long'}).format(day);return {key,label:label.charAt(0).toLocaleUpperCase('pl')+label.slice(1)};}
function monthGroups(tickets){const grouped=new Map();for(const ticket of tickets){const month=ticketMonth(ticket.createdAt);if(!grouped.has(month.key))grouped.set(month.key,{label:month.label,items:[]});grouped.get(month.key).items.push(ticket);}const manager=user().role==='Kierownik lokalu';return [...grouped.entries()].sort((a,b)=>filters.sort==='oldest'?a[0].localeCompare(b[0]):b[0].localeCompare(a[0])).map(([,group])=>`<section class="month-group"><div class="month-group-heading"><h2>${esc(group.label)}</h2><span>${group.items.length} ${group.items.length===1?'zgłoszenie':'zgłoszeń'}</span></div>${manager?`<div class="panel table-panel">${ticketTable(group.items,0,false)}</div>`:cityGroups(group.items)}</section>`).join('');}
function ticketsView(){const tickets=filteredTickets(),manager=user().role==='Kierownik lokalu',cityBase=manager?[]:filteredTickets({ignoreCity:true});return header(canManage()?'Wszystkie zgłoszenia':manager?'Zgłoszenia lokalu':'Moje zgłoszenia','',btn('new','Zgłoś usterkę'))+statsView(currentTickets())+filterForm()+(manager?'':cityFilters(cityBase))+(tickets.length?monthGroups(tickets)+`<div class="page-count city-total">Liczba wyników: ${tickets.length}</div>`:`<section class="panel">${empty('Nie znaleziono zgłoszeń',currentTickets().length?'Zmień filtry lub wyczyść wyszukiwanie.':'Dodaj pierwsze zgłoszenie, aby sprawdzić cały obieg naprawy.',btn('new','Zgłoś usterkę'))}</section>`);}
function bars(tickets,key){const groups=new Map();for(const t of tickets){const label=key==='location'?t.mpk+' · '+t.locationName:key==='city'?ticketCity(t):t[key];groups.set(label,(groups.get(label)||0)+1);}const sorted=[...groups.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pl'));const max=sorted[0]?.[1]||1;return sorted.length?sorted.map(([label,n])=>`<div class="bar-row"><span class="bar-label">${esc(label)}</span><span class="bar-track" aria-hidden="true"><span class="bar-fill" style="display:block;width:${n/max*100}%"></span></span><strong>${n}</strong></div>`).join(''):'<p class="report-copy">Brak danych do wyświetlenia.</p>';}
function scheduleDateKey(value){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
function scheduleRow(ticket,unplanned=false){return `<div class="schedule-row"><div><strong>${esc(ticket.number)}</strong><small>${date(ticket.createdAt)}</small></div><div class="schedule-location"><strong>${esc(ticket.mpk)} · ${esc(ticket.locationName)}</strong><small>${esc(ticketCity(ticket))}</small></div><div class="schedule-category"><strong>${esc(ticket.category)}</strong>${unplanned?`<small>Sugerowany termin: ${date(suggestedDeadline(ticket))}</small>`:''}</div><div class="schedule-state">${priorityPill(ticket.priority)} ${statusPill(ticket.status)}</div><button class="btn secondary small" type="button" data-action="detail" data-id="${esc(ticket.id)}">${unplanned?'Ustaw termin':'Otwórz'}</button></div>`;}
function scheduleDays(tickets,today){
 const groups=new Map();
 for(const ticket of tickets){const key=scheduleDateKey(ticket.dueAt);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(ticket);}
 return [...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([key,items])=>{
  items.sort((a,b)=>priorityScore(b)-priorityScore(a)||a.number.localeCompare(b.number,'pl'));
  const label=new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Warsaw',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(items[0].dueAt));
  return `<section class="panel schedule-day ${key<today?'is-late':''}"><div class="schedule-day-heading"><h3>${esc(label)}${key===today?' · Dzisiaj':''}${key<today?' · Po terminie':''}</h3><small>${items.length} ${items.length===1?'zgłoszenie':'zgłoszeń'}</small></div>${items.map(ticket=>scheduleRow(ticket)).join('')}</section>`;
 }).join('');
}
function scheduleCalendar(planned,today,overdueCount){
 const [year,month]=scheduleMonth.split('-').map(Number);
 const monthName=new Intl.DateTimeFormat('pl-PL',{month:'long',year:'numeric',timeZone:'Europe/Warsaw'}).format(new Date(Date.UTC(year,month-1,15,12)));
 const firstWeekday=(new Date(Date.UTC(year,month-1,1)).getUTCDay()+6)%7;
 const dayCount=new Date(Date.UTC(year,month,0)).getUTCDate();
 const counts=new Map();
 for(const ticket of planned){const key=scheduleDateKey(ticket.dueAt);counts.set(key,(counts.get(key)||0)+1);}
 const cells=Array.from({length:firstWeekday},()=>'<span aria-hidden="true"></span>');
 for(let day=1;day<=dayCount;day++){
  const key=`${scheduleMonth}-${String(day).padStart(2,'0')}`,count=counts.get(key)||0;
  cells.push(`<button type="button" class="${key===today?'today ':''}${key===scheduleSelectedDay?'selected ':''}${key<today&&count?'overdue':''}" data-action="schedule-day" data-day="${key}" aria-pressed="${key===scheduleSelectedDay}" aria-label="${day} ${esc(monthName)}: ${count} ${count===1?'zgłoszenie':'zgłoszeń'}"><span>${day}</span>${count?`<strong>${count}</strong>`:''}</button>`);
 }
 const selected=planned.filter(ticket=>scheduleDateKey(ticket.dueAt)===scheduleSelectedDay).sort((a,b)=>priorityScore(b)-priorityScore(a)||a.number.localeCompare(b.number,'pl'));
 const selectedLabel=new Intl.DateTimeFormat('pl-PL',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Warsaw'}).format(new Date(scheduleSelectedDay+'T12:00:00Z'));
 return `<div class="schedule-calendar-layout"><section class="panel schedule-calendar" aria-label="Kalendarz terminów"><div class="schedule-calendar-toolbar"><button type="button" data-action="schedule-prev" aria-label="Poprzedni miesiąc">‹</button><h2>${esc(monthName)}</h2><button type="button" data-action="schedule-next" aria-label="Następny miesiąc">›</button></div><div class="schedule-weekdays" aria-hidden="true"><span>Pn</span><span>Wt</span><span>Śr</span><span>Cz</span><span>Pt</span><span>Sb</span><span>Nd</span></div><div class="schedule-calendar-grid">${cells.join('')}</div></section><section class="panel schedule-calendar-results" aria-live="polite"><div class="schedule-day-heading"><h3>${esc(selectedLabel)}${scheduleSelectedDay===today?' · Dzisiaj':''}</h3><small>${selected.length} ${selected.length===1?'zgłoszenie':'zgłoszeń'}</small></div>${selected.length?selected.map(ticket=>scheduleRow(ticket)).join(''):'<div class="schedule-empty">Na ten dzień nie zaplanowano zgłoszeń.</div>'}</section></div>${overdueCount?`<p class="schedule-calendar-note">Po terminie: ${overdueCount}. Przełącz na listę, aby zobaczyć wszystkie zaległe terminy.</p>`:''}`;
}
function scheduleView(){
 if(!canManage())return empty('Widok niedostępny','Harmonogram jest dostępny dla koordynatora i administratora.');
 const open=currentTickets().filter(ticket=>!Model.closed(ticket));
 const today=scheduleDateKey(new Date());
 const planned=open.filter(ticket=>ticket.dueAt&&Number.isFinite(Date.parse(ticket.dueAt)));
 const overdue=planned.filter(ticket=>scheduleDateKey(ticket.dueAt)<today);
 const dueToday=planned.filter(ticket=>scheduleDateKey(ticket.dueAt)===today);
 const upcoming=planned.filter(ticket=>scheduleDateKey(ticket.dueAt)>=today);
 const unplanned=open.filter(ticket=>!ticket.dueAt||!Number.isFinite(Date.parse(ticket.dueAt))).sort((a,b)=>priorityScore(b)-priorityScore(a)||a.createdAt.localeCompare(b.createdAt));
 const unplannedSection=`<section class="schedule-section"><h2>Wymagają ustalenia terminu</h2><p>Otwórz zgłoszenie, aby ustawić planowany dzień realizacji.</p>${unplanned.length?`<div class="panel schedule-day">${unplanned.map(ticket=>scheduleRow(ticket,true)).join('')}</div>`:'<div class="panel schedule-empty">Wszystkie otwarte zgłoszenia mają planowany termin.</div>'}</section>`;
 const summary=[['overdue','Po terminie',overdue.length],['today','Na dziś',dueToday.length],['planned','Z terminem',planned.length],['unplanned','Bez terminu',unplanned.length]];
 const filteredPlanned=scheduleFilter==='overdue'?overdue:scheduleFilter==='today'?dueToday:scheduleFilter==='unplanned'?[]:planned;
 const overdueSection=`<section class="schedule-section"><h2>Po terminie</h2>${overdue.length?scheduleDays(overdue,today):'<div class="panel schedule-empty">Brak zgłoszeń po terminie.</div>'}</section>`;
 const upcomingSection=`<section class="schedule-section"><h2>Nadchodzące terminy</h2>${upcoming.length?scheduleDays(upcoming,today):'<div class="panel schedule-empty">Brak zaplanowanych terminów.</div>'}</section>`;
 const todaySection=`<section class="schedule-section"><h2>Na dziś</h2>${dueToday.length?scheduleDays(dueToday,today):'<div class="panel schedule-empty">Na dziś nie ma zaplanowanych zgłoszeń.</div>'}</section>`;
 const listSections=scheduleFilter==='overdue'?overdueSection:scheduleFilter==='today'?todaySection:scheduleFilter==='unplanned'?unplannedSection:overdueSection+upcomingSection+(scheduleFilter==='all'?unplannedSection:'');
 return header('Harmonogram','Planowane terminy otwartych zgłoszeń. Zmiana terminu w zgłoszeniu od razu aktualizuje ten widok.')+
  `<div class="schedule-summary" aria-label="Filtry harmonogramu">${summary.map(([key,label,count])=>`<button type="button" class="panel ${key==='overdue'?'is-late':''} ${scheduleFilter===key?'active':''}" data-action="schedule-filter" data-filter="${key}" aria-pressed="${scheduleFilter===key}" aria-label="${label}: ${count}. ${scheduleFilter===key?'Wyczyść filtr':'Pokaż zgłoszenia'}"><span>${label}</span><strong>${count}</strong></button>`).join('')}</div>`+
  `<div class="schedule-view-switch" role="group" aria-label="Widok harmonogramu"><button type="button" class="${scheduleMode==='list'?'active':''}" data-action="schedule-mode" data-mode="list" aria-pressed="${scheduleMode==='list'}">Lista</button><button type="button" class="${scheduleMode==='calendar'?'active':''}" data-action="schedule-mode" data-mode="calendar" aria-pressed="${scheduleMode==='calendar'}">Kalendarz</button></div>`+
  (scheduleMode==='calendar'?(scheduleFilter==='unplanned'?'<div class="panel schedule-empty space-top">Zgłoszenia bez terminu nie mają daty w kalendarzu. Ustaw termin w wybranym zgłoszeniu.</div>'+unplannedSection:scheduleCalendar(filteredPlanned,today,scheduleFilter==='all'?overdue.length:0)+(scheduleFilter==='all'?unplannedSection:'')):listSections);
}
function dashboardView(){const tickets=currentTickets();const m=Model.metrics(tickets,Date.now(),state.settings.responseHours);return header('Dashboard','')+statsView(tickets,false)+`<div class="metric-strip"><section class="panel"><h3>Średni czas realizacji</h3><strong>${m.meanHours===null?'—':m.meanHours.toLocaleString('pl-PL',{maximumFractionDigits:1})+' h'}</strong><small>${m.completed} zamkniętych · bez odrzuconych</small></section><section class="panel"><h3>Wymagają reakcji</h3><strong>${m.overdue} <span class="muted" style="font-size:13px">po terminie</span></strong><small>${m.waiting} bez reakcji przez ${state.settings.responseHours} h</small></section></div><div class="chart-grid"><section class="panel"><div class="block-heading"><h2>Usterki wg miasta</h2></div>${bars(tickets,'city')}</section><section class="panel"><div class="block-heading"><h2>Usterki wg rodzaju</h2></div>${bars(tickets,'category')}</section><section class="panel full"><div class="block-heading"><h2>Usterki wg lokalu / magazynu</h2></div>${bars(tickets,'location')}</section></div>`;}
function adminView(){if(!isAdmin())return empty('Widok niedostępny','Wybierz profil administratora w przełączniku testowym.');
 const tabs=[['users','Użytkownicy i role'],['locations','Lokale i magazyny'],['reports','Raporty i kopia danych'],['settings','Konfiguracja']];
 return header('Administracja','')+`<div class="admin-tabs">${tabs.map(([id,label])=>`<button class="tab-button ${adminTab===id?'active':''}" data-action="admin-tab" data-tab="${id}">${label}</button>`).join('')}</div>`+(adminTab==='users'?usersView():adminTab==='locations'?locationsView():adminTab==='reports'?reportsView():settingsView());
}
function usersView(){const edit=state.users.find(u=>u.id===editingUser);return `<div class="warning">Profile na tej liście służą do testowania widoków. Nie tworzą kont logowania. Usunięcie profilu zachowuje historię zgłoszeń.</div><div class="admin-split"><section class="panel table-panel"><div class="table-scroll"><table><thead><tr><th>Użytkownik</th><th>Rola</th><th>MPK</th><th>Status</th><th></th></tr></thead><tbody>${state.users.filter(u=>!u.deletedAt).map(u=>`<tr><td><span class="cell-main">${esc(u.name)}</span><span class="cell-sub">${esc(u.email)}</span>${u.phone?`<span class="cell-sub">Tel. ${esc(u.phone)}</span>`:''}</td><td>${esc(u.role)}</td><td>${esc((u.mpks||[]).join(', ')||'—')}</td><td><span class="pill ${u.active?'closed':'rejected'}">${u.active?'Aktywny':'Nieaktywny'}</span></td><td><div class="user-actions"><button class="btn secondary small" data-action="edit-user" data-id="${esc(u.id)}">Edytuj</button><button class="btn danger small" data-action="delete-user" data-id="${esc(u.id)}" ${u.id===currentId||authUser?.email?.toLowerCase()===u.email.toLowerCase()?'disabled title="Nie można usunąć bieżącego profilu ani konta zalogowanego"':''}>Usuń</button></div></td></tr>`).join('')}</tbody></table></div></section><form id="user-form" class="panel admin-form"><h3>${edit?'Edytuj profil':'Dodaj profil testowy'}</h3><input type="hidden" name="id" value="${esc(edit?.id||'')}"><div class="field"><label for="u-name">Imię i nazwisko / nazwa</label><input id="u-name" name="name" required maxlength="150" value="${esc(edit?.name||'')}"></div><div class="field"><label for="u-email">E-mail</label><input id="u-email" type="email" name="email" required maxlength="254" value="${esc(edit?.email||'')}"></div><div class="field"><label for="u-phone">Telefon kontaktowy (opcjonalnie)</label><input id="u-phone" type="tel" inputmode="tel" autocomplete="tel" name="phone" maxlength="30" value="${esc(edit?.phone||'')}" placeholder="+48 123 456 789"></div><div class="field"><label for="u-role">Rola</label><select id="u-role" name="role">${Model.roles.map(r=>option(r,r,edit?.role||'Użytkownik')).join('')}</select></div><div class="field"><label for="u-mpks">Przypisane MPK</label><input id="u-mpks" name="mpks" value="${esc((edit?.mpks||[]).join(', '))}" placeholder="np. 178, 179"><p class="hint">Dla kierownika wymagane. Oddziel numery przecinkami.</p></div><label class="checkline"><input type="checkbox" name="active" ${edit?.active!==false?'checked':''}> Profil aktywny</label><button class="btn" type="submit" data-action="save-user">${edit?'Zapisz zmiany':'Dodaj użytkownika'}</button>${edit?'<button type="button" class="btn secondary" data-action="cancel-user">Anuluj edycję</button>':''}</form></div>${removedUsersView()}`;}
function removedUsersView(){const removed=state.users.filter(u=>u.deletedAt);return removed.length?`<section class="panel space-top"><h3>Usunięte profile testowe (${removed.length})</h3><p class="report-copy">Pozostają w historii zgłoszeń. Możesz je przywrócić do przełącznika.</p><div class="removed-users">${removed.map(u=>`<div><span><strong>${esc(u.name)}</strong><small>${esc(u.email)} · ${esc(u.role)}</small></span><button class="btn secondary small" data-action="restore-user" data-id="${esc(u.id)}">Przywróć</button></div>`).join('')}</div></section>`:'';}
function locationsView(){const edit=state.locations.find(l=>l.mpk===editingLocation);return `<div class="admin-split"><section class="panel table-panel"><div class="block-heading"><h2>${state.locations.length} obiekty · ${state.locations.filter(l=>l.active).length} aktywnych</h2></div><div class="table-scroll"><table><thead><tr><th>MPK / nazwa</th><th>Miasto / lokalizacja</th><th>Typ</th><th>Status</th><th></th></tr></thead><tbody>${state.locations.map(l=>`<tr><td><span class="cell-main">${esc(l.mpk)} · ${esc(l.name)}</span></td><td>${esc(l.city)}<span class="cell-sub">${esc(l.location||l.city)}</span></td><td>${esc(l.type)}</td><td><span class="pill ${l.active?'closed':'rejected'}">${l.active?'Aktywny':'Nieaktywny'}</span></td><td><button class="btn secondary small" data-action="edit-location" data-id="${esc(l.mpk)}">Edytuj</button></td></tr>`).join('')}</tbody></table></div></section><form id="location-form" class="panel admin-form"><h3>${edit?'Edytuj obiekt':'Dodaj obiekt'}</h3><input type="hidden" name="original" value="${esc(edit?.mpk||'')}"><div class="field"><label for="l-mpk">Numer MPK</label><input id="l-mpk" name="mpk" required maxlength="40" value="${esc(edit?.mpk||'')}" ${edit?'readonly':''}></div><div class="field"><label for="l-name">Nazwa</label><input id="l-name" name="name" required maxlength="150" value="${esc(edit?.name||'')}"></div><div class="field"><label for="l-city">Miasto</label><input id="l-city" name="city" required maxlength="100" value="${esc(edit?.city||'')}"></div><div class="field"><label for="l-location">Lokalizacja / terminal (opcjonalnie)</label><input id="l-location" name="location" maxlength="150" value="${esc(edit?.location||'')}"></div><div class="field"><label for="l-type">Typ</label><select id="l-type" name="type">${['Lokal','Magazyn'].map(t=>option(t,t,edit?.type||'Lokal')).join('')}</select></div><label class="checkline"><input type="checkbox" name="active" ${edit?.active!==false?'checked':''}> Obiekt aktywny</label><button class="btn" type="submit">${edit?'Zapisz zmiany':'Dodaj obiekt'}</button>${edit?'<button type="button" class="btn secondary" data-action="cancel-location">Anuluj edycję</button>':''}<p class="hint">Dezaktywacja ukrywa obiekt w nowym formularzu, lecz zachowuje historię zgłoszeń.</p></form></div>`;}
function reportsView(){return `<section class="panel"><h2>Eksport zgłoszeń</h2><form id="export-form" class="filters space-top"><div class="field"><label for="export-from">Od</label><input id="export-from" name="from" type="date"></div><div class="field"><label for="export-to">Do</label><input id="export-to" name="to" type="date"></div><button class="btn" type="submit">${icon('download')}Pobierz CSV</button></form></section><section class="panel space-top"><h2>Kopia danych</h2><p class="report-copy">Zawiera zgłoszenia i załączniki. Pobierz ją przed zmianą przeglądarki lub komputera.</p><div class="backup-actions">${btn('backup','Pobierz kopię','download')}<label class="btn secondary import-label" for="restore-file">Wczytaj kopię</label><input type="file" id="restore-file" accept=".json,application/json"></div></section><div class="warning space-top">Dane są zapisane na tym urządzeniu i nie synchronizują się między komputerami. Plik kopii nie jest szyfrowany.</div>`;}
function settingsView(){return `<div class="admin-settings"><form id="settings-form" class="panel admin-form"><h2>Ustawienia aplikacji</h2><div class="form-grid"><div class="field"><label for="s-hours">Próg braku reakcji (godziny)</label><input id="s-hours" name="responseHours" type="number" min="1" max="720" required value="${state.settings.responseHours}"></div><div class="field"><label for="s-count">Maks. załączników przy zgłaszaniu (1–5)</label><input id="s-count" name="maxFiles" type="number" min="1" max="5" required value="${state.settings.maxFiles}"></div><div class="field"><label for="s-size">Maks. rozmiar pliku (1–10 MB)</label><input id="s-size" name="maxMB" type="number" min="1" max="10" required value="${state.settings.maxMB}"></div><div class="field full"><label for="s-categories">Rodzaje usterek — jeden w wierszu</label><textarea id="s-categories" name="categories" required rows="10">${esc(state.settings.categories.join('\n'))}</textarea><p class="hint">Zmiana listy nie zmienia kategorii w istniejących zgłoszeniach.</p></div></div><button class="btn" type="submit">Zapisz konfigurację</button></form></div>`;}
function syncClosingFields(){
 const status=$('#m-status')?.value;if(!status)return;
 const ending=status==='Zamknięte'||status==='Odrzucone',rejected=status==='Odrzucone';
 $('#closing-fields').hidden=!ending;
 const field=$('#m-closing');field.disabled=!ending;field.required=ending;
 $('#closing-label').textContent=rejected?'Powód odrzucenia *':'Komentarz zamknięcia *';
 field.placeholder=rejected?'Dlaczego zgłoszenie jest odrzucane?':'Jak rozwiązano problem?';
 $('#closing-hint').textContent=rejected?'Podaj krótko powód odrzucenia.':'Krótko opisz wykonane prace.';
 const submit=$('#manage-submit');submit.textContent=ending?(rejected?'Potwierdź odrzucenie':'Potwierdź zamknięcie'):'Zapisz zmiany';
 submit.classList.toggle('danger',rejected);
}
function inputDate(iso){if(!iso)return '';const d=new Date(iso);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);}
function duePlanHint(t){const target=suggestedDeadline(t);return Date.parse(target)<Date.now()?`Sugerowany termin minął: ${date(target)}. Ustal realny dzień zakończenia.`:`Sugerowany termin: ${date(target)} (${targetHours(t.priority,t.blocksSales)} h od zgłoszenia).`;}
function updateDueSuggestion(){const ticket=state.tickets.find(t=>t.id===selectedTicket),priority=$('#m-priority')?.value,label=$('#due-suggestion-text'),button=$('#use-suggested-date');if(!ticket||!priority||!label)return;const draft={...ticket,priority};label.textContent=duePlanHint(draft);if(button)button.hidden=Date.parse(suggestedDeadline(draft))<Date.now();}
function activityPanel(t){const events=(state.events||[]).filter(e=>e.ticketId===t.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));return `<section class="panel space-top activity-panel"><h3>Historia zmian</h3>${events.map(e=>`<div class="activity-item"><span class="activity-date">${date(e.createdAt)}</span><div><strong>${esc(e.actorName)}</strong><p>${esc(e.text)}</p></div></div>`).join('')||'<p class="report-copy">Brak zapisanych zmian.</p>'}</section>`;}
function progressPanel(t){
 const finished=Model.closed(t),inWork=!!t.firstResponseAt||['W realizacji','Oczekuje na naprawę','Zamknięte','Odrzucone'].includes(t.status);
 const milestone=(kind,label,info,complete)=>`<li class="progress-step ${complete?'complete':'pending'}"><span class="progress-step-mark" aria-hidden="true">${kind}</span><span><strong>${label}</strong><small>${info}</small></span></li>`;
 return `<section class="panel detail-status-panel"><div class="progress-head"><span class="info-mark">${icon(finished?'check':'clock')}</span><div><h3>Postęp naprawy</h3></div></div><ol class="progress-steps" aria-label="Etapy zgłoszenia">${milestone('1','Usterka zgłoszona',date(t.createdAt),true)}${milestone('2','Obsługa usterki',inWork?(t.firstResponseAt?date(t.firstResponseAt):'Rozpoczęto obsługę'):'Do podjęcia przez koordynatora',inWork)}${milestone('3',t.status==='Odrzucone'?'Zgłoszenie odrzucone':t.status==='Zamknięte'?'Zgłoszenie zamknięte':'Zamknięcie zgłoszenia',finished?date(t.closedAt):'Po zakończeniu prac',finished)}</ol><dl class="progress-meta">${canManage()?'<div><dt>Termin sugerowany</dt><dd>'+date(suggestedDeadline(t))+' · '+targetHours(t.priority,t.blocksSales)+' h</dd></div>':''}<div><dt>Termin planowany</dt><dd class="${Model.overdue(t)?'danger-text':''}">${t.dueAt?dateOnly(t.dueAt):'Nie ustalono'}</dd></div><div><dt>Ostatnia aktualizacja</dt><dd>${date(t.updatedAt)}</dd></div></dl>${canClose(t)&&!finished?`<button class="btn secondary manager-close" type="button" data-action="quick-close" data-id="${esc(t.id)}">${canManage()?'Zamknij zgłoszenie':'Zamknij z załącznikiem'}</button>`:''}</section>`;
}
function commentReplyOption(ticket){return canManage()&&!Model.closed(ticket)?'<label class="comment-status-choice"><input type="checkbox" name="needsReply"> Oczekuję odpowiedzi od lokalu</label>':'';}
function detailView(t){const comments=state.comments.filter(c=>c.ticketId===t.id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));return `<div class="dialog-head"><div><p>${esc(t.city)} · ${esc(t.mpk)} · ${esc(t.locationName)}</p><h2 id="dialog-title">${esc(t.number)}</h2>${statusPill(t.status)} ${priorityPill(t.priority)}${t.blocksSales?' <span class="pill high">Blokuje sprzedaż</span>':''}</div><button class="close-dialog" data-action="close-dialog" aria-label="Zamknij szczegóły">✕</button></div><div class="dialog-body"><div class="detail-grid ${Model.closed(t)?'closed-layout':''}"><div><section class="panel"><h3>${esc(t.category)}</h3><p class="detail-description">${esc(t.description)}</p><dl class="detail-meta"><div><dt>Zgłaszający</dt><dd>${esc(t.reporter)}</dd></div><div><dt>Telefon kontaktowy</dt><dd>${t.reporterPhone?`<a href="tel:${esc(t.reporterPhone.replace(/[^+\d]/g,''))}">${esc(t.reporterPhone)}</a>`:'Nie podano'}</dd></div><div><dt>Data zgłoszenia</dt><dd>${date(t.createdAt)}</dd></div>${canManage()?`<div><dt>E-mail profilu</dt><dd>${esc(t.reporterEmail)}</dd></div>`:''}${canManage()?'<div><dt>Termin sugerowany</dt><dd>'+date(suggestedDeadline(t))+' · '+targetHours(t.priority,t.blocksSales)+' h</dd></div>':''}<div><dt>Termin planowany</dt><dd class="${Model.overdue(t)?'danger-text':''}">${t.dueAt?dateOnly(t.dueAt):'Nie ustalono'}</dd></div>${t.closedAt?`<div><dt>Data zakończenia</dt><dd>${date(t.closedAt)}</dd></div>`:''}</dl>${t.closingComment?`<div class="summary-box"><strong>${t.status==='Odrzucone'?'Powód odrzucenia':'Komentarz zamknięcia'}</strong><p class="detail-description">${esc(t.closingComment)}</p></div>`:''}<h3>Załączniki (${t.attachments.length})</h3>${t.attachments.length?t.attachments.map(f=>`<div class="file-row">${icon('clip')}<span class="file-name">${esc(f.name)}<br><small>${sizeFmt(f.size)}${f.purpose==='closure'?' · Załącznik zamknięcia':''}</small></span><button class="btn secondary small" data-action="download-file" data-id="${esc(f.id)}">Pobierz</button></div>`).join(''):'<p class="report-copy">Nie dodano załączników.</p>'}</section><section class="panel space-top"><h3>Komentarze (${comments.length})</h3>${comments.map(c=>`<article class="comment"><div class="comment-top"><strong>${esc(c.authorName)} · ${esc(c.role)}</strong><time>${date(c.createdAt)}</time></div><p>${esc(c.text)}</p></article>`).join('')||'<p class="report-copy">Brak komentarzy. Dodaj informacje o usterce lub postępie naprawy.</p>'}<form id="comment-form" class="comment-form"><label class="sr-only" for="comment-text">Treść komentarza</label><textarea id="comment-text" name="text" maxlength="5000" required placeholder="Napisz komentarz…"></textarea>${commentReplyOption(t)}<button class="btn comment-send" type="submit" aria-label="Wyślij komentarz" title="Wyślij komentarz"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg></button></form></section>${canManage()?activityPanel(t):''}</div><aside>${canManage()&&!Model.closed(t)?`<form id="manage-form" class="panel detail-control"><h3>Obsługa zgłoszenia</h3><div class="field"><label for="m-status">Status</label><select id="m-status" name="status">${Model.statuses.filter(s=>s!=='Zamknięte'&&(canClose()||s!=='Odrzucone')).map(s=>option(s,s==='Zamknięte'?'Zamknij zgłoszenie':s==='Odrzucone'?'Odrzuć zgłoszenie':s,t.status)).join('')}</select></div><div class="field"><label for="m-priority">Priorytet</label><select id="m-priority" name="priority">${Model.priorities.map(p=>option(p,p,t.priority)).join('')}</select></div><div class="field"><label for="m-due">Planowany dzień realizacji</label><input id="m-due" type="date" name="dueAt" value="${inputDate(t.dueAt)}"><div class="due-suggestion"><span id="due-suggestion-text">${duePlanHint(t)}</span><button id="use-suggested-date" type="button" class="btn secondary" data-action="use-suggested-date" ${Date.parse(suggestedDeadline(t))<Date.now()?'hidden':''}>Wstaw sugerowany dzień</button></div></div><div id="closing-fields" class="closing-fields" hidden><div class="field"><label id="closing-label" for="m-closing">Komentarz</label><textarea id="m-closing" name="closingComment" maxlength="5000" rows="3" disabled aria-describedby="closing-hint"></textarea><p class="hint" id="closing-hint"></p></div><p class="closing-warning">Po zatwierdzeniu dane obsługi zostaną zablokowane. Nadal będzie można dodawać komentarze.</p></div><button id="manage-submit" class="btn" type="submit">Zapisz zmiany</button>${canClose(t)?`<button type="button" class="btn secondary" data-action="quick-close" data-id="${esc(t.id)}">${canManage()?'Zamknij zgłoszenie':'Zamknij z załącznikiem'}</button>`:''}</form>`:progressPanel(t)}</aside></div></div>`;}
function openDetail(id){const t=currentTickets().find(t=>t.id===id);if(!t)throw Error('Zgłoszenie nie jest dostępne w tym profilu.');selectedTicket=id;detailDirty=false;const dialog=$('#detail-dialog');dialog.innerHTML=detailView(t);if(!dialog.open)dialog.showModal();}
async function openTicket(id){
 const ticket=currentTickets().find(t=>t.id===id);
 if(!ticket)throw Error('Zgłoszenie nie jest dostępne w tym profilu.');
 if(user().role==='Koordynator'&&ticket.status==='Nowe'){
   const now=new Date().toISOString();
   await mutate(next=>{const item=next.tickets.find(t=>t.id===id);if(item&&item.status==='Nowe'){item.status='W realizacji';item.firstResponseAt ||= now;item.updatedAt=now;}});
   shell();
 }
 openDetail(id);
}
function navigate(target){if(dirty&&!confirm('Masz niezapisany formularz. Opuścić go i odrzucić wpisane dane?'))return;if($('#detail-dialog').open)$('#detail-dialog').close();page=target;dirty=false;draftFiles=[];filters={q:'',status:'',city:'',priority:'',from:'',to:'',quick:'',sort:'urgent'};shell();window.scrollTo(0,0);}
function updateTargetHint(){const form=$('#new-form'),target=form?.querySelector('#priority-target');if(!target)return;const priority=form.querySelector('input[name="priority"]:checked')?.value||'Średni';const blocksSales=form.querySelector('#blocksSales')?.checked;target.textContent=`Proponowany czas realizacji: ${targetHours(priority,blocksSales)} h od wysłania zgłoszenia${blocksSales?' (usterka blokuje sprzedaż)':''}.`;}
function renderDraftFiles(){if(draftFiles.length){document.getElementById('attachment-error').hidden=true;document.getElementById('dropzone').classList.remove('invalid');}if(!$('#draft-files'))return;$('#draft-files').innerHTML=draftFiles.map((f,i)=>`<div class="file-row">${icon('clip')}<span class="file-name">${esc(f.name)} <small>${sizeFmt(f.size)}</small></span><button class="btn secondary small" type="button" data-action="remove-file" data-index="${i}" aria-label="Usuń ${esc(f.name)}">Usuń</button></div>`).join('');}
async function validateFile(file){if(!file.size||file.size>state.settings.maxMB*1024*1024)throw Error('Plik „'+file.name+'” jest pusty lub przekracza '+state.settings.maxMB+' MB.');const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer());const extension=file.name.split('.').pop().toLowerCase();const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;const png=[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b);const pdf=String.fromCharCode(...bytes.slice(0,5))==='%PDF-';if(!(['jpg','jpeg'].includes(extension)&&jpg||extension==='png'&&png||extension==='pdf'&&pdf))throw Error('Plik „'+file.name+'” nie jest poprawnym JPG, PNG lub PDF.');return jpg?'image/jpeg':png?'image/png':'application/pdf';}
async function addFiles(files){const combined=[...draftFiles];for(const file of files){if(combined.some(f=>f.name===file.name&&f.size===file.size&&f.lastModified===file.lastModified))continue;if(combined.length>=state.settings.maxFiles)throw Error('Możesz dodać najwyżej '+state.settings.maxFiles+' plików.');await validateFile(file);combined.push(file);}draftFiles=combined;dirty=true;renderDraftFiles();}
function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name.replace(/[\\/\x00-\x1f]/g,'_');document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
async function downloadFile(id){const ticket=currentTickets().find(t=>t.attachments.some(f=>f.id===id));if(!ticket)throw Error('Załącznik niedostępny w tym profilu.');const record=await requestValue(db.transaction('files').objectStore('files').get(id));if(!record)throw Error('Brakuje pliku w lokalnej bazie. Wczytaj pełną kopię danych.');download(new Blob([record.blob],{type:'application/octet-stream'}),record.name);}
async function submitNew(form){const values=Object.fromEntries(new FormData(form));const place=Model.validateTicket(values,state,user());if(!draftFiles.length){form.querySelector('#dropzone').classList.add('invalid');form.querySelector('#attachment-error').hidden=false;form.querySelector('#attachments').focus();throw Error('Dodaj co najmniej jeden załącznik do zgłoszenia.');}if(draftFiles.length>state.settings.maxFiles)throw Error('Za dużo załączników.');const now=new Date().toISOString(), id=uid(), creator=user();const files=[];for(const file of draftFiles){const type=await validateFile(file);files.push({id:uid(),ticketId:id,name:file.name,size:file.size,type,blob:new Blob([file],{type})});}let number;
 await mutate(next=>{next.counter++;number=Model.numberFor(next.counter);next.tickets.push({id,number,createdAt:now,updatedAt:now,creatorId:creator.id,reporter:values.reporter.trim().replace(/\s+/g,' '),reporterPhone:values.reporterPhone.trim(),reporterEmail:creator.email,city:place.city,mpk:place.mpk,locationName:place.name,location:place.location||place.city,category:values.category,priority:values.priority,blocksSales:values.blocksSales==='on',description:values.description.trim(),status:'Nowe',assigneeId:'',dueAt:null,costCents:null,closedAt:null,closingComment:'',firstResponseAt:null,attachments:files.map(({blob,...meta})=>meta)});},files);
 dirty=false;draftFiles=[];page='tickets';filters={q:'',status:'',city:'',priority:'',from:'',to:'',quick:'',sort:'urgent'};shell();toast('Zapisano '+number+' wraz z załącznikami w tej przeglądarce.');openDetail(id);
}
async function submitComment(form){
 const values=new FormData(form),text=String(values.get('text')||'').trim();
 if(!text||text.length>5000)throw Error('Komentarz musi mieć od 1 do 5000 znaków.');
 const ticket=currentTickets().find(t=>t.id===selectedTicket);if(!ticket)throw Error('Zgłoszenie niedostępne.');
 const u=user(),now=new Date().toISOString(),staff=canManage(),needsReply=staff&&values.get('needsReply')==='on'&&!Model.closed(ticket);
 await mutate(next=>{
  next.comments.push({id:uid(),ticketId:ticket.id,authorId:u.id,authorName:u.name,role:u.role,text,createdAt:now});
  const t=next.tickets.find(x=>x.id===ticket.id);
  if(!Model.closed(t)){
   if(needsReply)t.status='Oczekuje na informację';
   else if(t.status==='Oczekuje na informację'||staff&&t.status==='Nowe')t.status='W realizacji';
   if(staff&&!t.firstResponseAt)t.firstResponseAt=now;
  }
  t.updatedAt=now;
 });
 shell();openDetail(ticket.id);
 toast(Model.closed(ticket)?'Dodano komentarz.':needsReply?'Dodano komentarz. Zgłoszenie oczekuje na odpowiedź lokalu.':ticket.status==='Oczekuje na informację'?'Dodano odpowiedź. Zgłoszenie wróciło do realizacji.':'Dodano komentarz.');
}
function openQuickClose(id){
 const ticket=currentTickets().find(t=>t.id===id);
 if(!canClose(ticket))throw Error('Tylko koordynator, administrator lub kierownik przypisanego lokalu może zamknąć zgłoszenie.');
 if(!ticket||Model.closed(ticket))throw Error('To zgłoszenie nie jest już otwarte.');
 if($('#detail-dialog').open&&detailDirty&&!confirm('Zamknięcie odrzuci niezapisane zmiany. Kontynuować?'))return;
 quickCloseId=id;
 const dialog=$('#quick-close-dialog');
 const attachmentRequired=user().role==='Kierownik lokalu';
 dialog.innerHTML=`<form id="quick-close-form" class="quick-close-form"><div class="quick-close-head"><div><span class="eyebrow">SZYBKIE ZAMKNIĘCIE</span><h2 id="quick-close-title">${esc(ticket.number)}</h2><p>${esc(ticket.mpk)} · ${esc(ticket.locationName)}</p></div><button type="button" class="close-dialog" data-action="close-quick-close" aria-label="Anuluj zamknięcie">✕</button></div><div class="quick-close-body"><label for="quick-close-comment">Opis wykonanych prac <span class="required">*</span></label><textarea id="quick-close-comment" name="closingComment" required maxlength="5000" rows="4" placeholder="Podaj zakres wykonanych prac"></textarea><label for="quick-close-file" class="quick-close-file-label">Załącznik potwierdzający zamknięcie ${attachmentRequired?'<span class="required">*</span>':'(opcjonalnie)'}</label><input id="quick-close-file" name="closingFile" type="file" accept=".jpg,.jpeg,.png,.pdf" ${attachmentRequired?'required':''}><p class="hint">JPG, PNG lub PDF · maks. ${state.settings.maxMB} MB. ${attachmentRequired?'Opis i załącznik są wymagane.':'Opis jest wymagany, załącznik możesz dodać opcjonalnie.'}</p><p class="hint">Po zamknięciu nadal można dodawać komentarze.</p><div class="quick-close-actions"><button class="btn secondary" type="button" data-action="close-quick-close">Anuluj</button><button class="btn" type="submit">Zamknij zgłoszenie</button></div></div></form>`;
 dialog.showModal();dialog.querySelector('textarea').focus();
}
async function submitQuickClose(form){
 const id=quickCloseId,ticket=state.tickets.find(t=>t.id===id);
 if(!ticket||!currentTickets().some(t=>t.id===id))throw Error('Zgłoszenie nie jest dostępne.');
 if(!canClose(ticket))throw Error('Nie masz uprawnień do zamknięcia tego zgłoszenia.');
 const closingComment=String(new FormData(form).get('closingComment')||'').trim();
 const file=form.elements.closingFile.files[0];
 if(user().role==='Kierownik lokalu'&&!file)throw Error('Dodaj załącznik potwierdzający zamknięcie.');
 if(file&&ticket.attachments.length>=6)throw Error('Zgłoszenie ma już maksymalną liczbę załączników.');
 if(file&&file.name.length>255)throw Error('Nazwa załącznika jest zbyt długa.');
 const type=file?await validateFile(file):null;
 const attachment=file?{id:uid(),ticketId:id,name:file.name,size:file.size,type,purpose:'closure'}:null;
 const updated=Model.updateTicket(ticket,{status:'Zamknięte',priority:ticket.priority,dueAt:ticket.dueAt,closingComment,closureAttachment:attachment},user(),new Date().toISOString());
 updated.attachments=[...ticket.attachments,...(attachment?[attachment]:[])];
 await mutate(next=>{next.tickets[next.tickets.findIndex(t=>t.id===id)]=updated;},attachment?[{...attachment,blob:new Blob([file],{type})}]:[]);
 $('#quick-close-dialog').close();quickCloseId=null;detailDirty=false;shell();if($('#detail-dialog').open&&selectedTicket===id)$('#detail-dialog').innerHTML=detailView(state.tickets.find(t=>t.id===id));toast('Zamknięto zgłoszenie '+ticket.number+(attachment?' i zapisano załącznik.':'.'));
}
async function submitManage(form){const values=Object.fromEntries(new FormData(form)),ticket=state.tickets.find(t=>t.id===selectedTicket);if(!ticket)throw Error('Zgłoszenie nie jest dostępne.');if(values.dueAt&&values.dueAt<inputDate(new Date().toISOString())&&values.dueAt!==inputDate(ticket.dueAt))throw Error('Planowany termin nie może być wcześniejszy niż dzisiaj.');values.dueAt=values.dueAt?new Date(values.dueAt+'T23:59:59.999').toISOString():null;const updated=Model.updateTicket(ticket,values,user(),new Date().toISOString());await mutate(next=>{next.tickets[next.tickets.findIndex(t=>t.id===ticket.id)]=updated;});shell();openDetail(ticket.id);toast('Zapisano dane obsługi zgłoszenia.');}
async function deleteUserProfile(id){
 if(!isAdmin())throw Error('Tylko administrator może usuwać profile testowe.');
 const target=state.users.find(u=>u.id===id&&!u.deletedAt);
 if(!target)throw Error('Nie znaleziono profilu.');
 if(id===currentId)throw Error('Nie można usunąć aktualnie wybranego profilu.');
 if(authUser?.email?.toLowerCase()===target.email.toLowerCase())throw Error('Nie można usunąć konta aktualnie zalogowanego.');
 if(target.active&&target.role==='Administrator'&&!state.users.some(u=>u.id!==id&&u.active&&!u.deletedAt&&u.role==='Administrator'))throw Error('Musi pozostać aktywny administrator.');
 await mutate(next=>{const profile=next.users.find(u=>u.id===id);profile.active=false;profile.deletedAt=new Date().toISOString();});
 if(editingUser===id)editingUser=null;shell();toast('Usunięto profil testowy. Historia zgłoszeń została zachowana.');
}
async function restoreUserProfile(id){
 if(!isAdmin())throw Error('Tylko administrator może przywracać profile testowe.');
 const target=state.users.find(u=>u.id===id&&u.deletedAt);
 if(!target)throw Error('Nie znaleziono usuniętego profilu.');
 await mutate(next=>{const profile=next.users.find(u=>u.id===id);profile.active=true;delete profile.deletedAt;});
 shell();toast('Przywrócono profil testowy.');
}
async function saveUserForm(form){
 if(!form||!state)return;
 if(busy){fail(Error('Poczekaj na zakończenie poprzedniego zapisu.'),form);return;}
 const invalid=form.querySelector(':invalid');
 if(invalid){
  const label=form.querySelector(`label[for="${invalid.id}"]`)?.textContent?.trim()||'wymagane pole';
  fail(Error('Sprawdź pole: '+label+'.'),form);
  invalid.focus();
  return;
 }
 if(pendingRemote){fail(Error('Dostępne są nowsze dane. Użyj przycisku „Wczytaj nowsze dane” przed zapisem.'),form);return;}
 const button=form.querySelector('[data-action="save-user"]');
 const originalLabel=button?.textContent;
 busy=true;
 if(button){button.disabled=true;button.textContent='Zapisywanie…';}
 form.querySelector('.form-error')?.remove();
 try{await submitUser(form);dirty=false;}
 catch(error){fail(error,form);}
 finally{busy=false;if(button){button.disabled=false;button.textContent=originalLabel;}}
}
async function submitUser(form){
 if(!isAdmin())throw Error('Wybierz profil administratora.');
 const values=Object.fromEntries(new FormData(form));
 const mpks=[...new Set(String(values.mpks||'').toUpperCase().split(/[,;\s]+/).filter(Boolean))];
 if(mpks.some(mpk=>!state.locations.some(l=>l.mpk===mpk)))throw Error('Sprawdź przypisane MPK — jeden z numerów nie istnieje.');
 const previous=values.id?state.users.find(u=>u.id===values.id):null;
 if(values.id&&!previous)throw Error('Nie znaleziono edytowanego profilu. Odśwież listę użytkowników.');
 const proposed={...previous,id:values.id||uid(),name:values.name.trim(),email:values.email.trim().toLowerCase(),phone:String(values.phone||'').trim(),role:values.role,mpks,active:values.active==='on'};
 Model.validateUserChange(state.users,proposed);
 await mutate(next=>{const index=next.users.findIndex(u=>u.id===proposed.id);if(index>=0)next.users[index]=proposed;else next.users.push(proposed);});
 currentId=user().id;
 savePreference();
 editingUser=proposed.id;
 if(!isAdmin())page='home';
 shell();
 if(page==='admin')$('#user-form')?.insertAdjacentHTML('afterbegin','<p class="notice" role="status">Zmiany profilu zostały zapisane. Konto logowania w Supabase pozostaje bez zmian.</p>');
 toast('Zapisano zmiany profilu.');
}
async function submitLocation(form){if(!isAdmin())throw Error('Wybierz profil administratora.');const v=Object.fromEntries(new FormData(form));const mpk=v.mpk.trim().toUpperCase();if(!mpk||!v.name.trim()||!v.city.trim())throw Error('Uzupełnij MPK, nazwę i miasto.');if(!['Lokal','Magazyn'].includes(v.type))throw Error('Nieprawidłowy typ obiektu.');if(!v.original&&state.locations.some(l=>l.mpk.toUpperCase()===mpk))throw Error('Obiekt z tym MPK już istnieje.');if(v.original&&mpk!==v.original)throw Error('Nie zmieniaj numeru MPK istniejącego obiektu.');await mutate(next=>{const i=next.locations.findIndex(l=>l.mpk===mpk);const record={...(i>=0?next.locations[i]:{}),mpk,name:v.name.trim(),city:v.city.trim().toUpperCase(),location:v.location.trim().toUpperCase()||v.city.trim().toUpperCase(),type:v.type,active:v.active==='on'};if(i>=0)next.locations[i]=record;else next.locations.push(record);});editingLocation=null;shell();toast('Zapisano obiekt. Historia zgłoszeń pozostała bez zmian.');}
async function submitSettings(form){if(!isAdmin())throw Error('Wybierz profil administratora.');const v=Object.fromEntries(new FormData(form));const categories=[...new Set(v.categories.split('\n').map(x=>x.trim()).filter(Boolean))];const responseHours=Number(v.responseHours),maxFiles=Number(v.maxFiles),maxMB=Number(v.maxMB);if(!categories.length||categories.length>40||categories.some(c=>c.length>100))throw Error('Podaj od 1 do 40 kategorii, każda do 100 znaków.');if(!Number.isInteger(responseHours)||responseHours<1||responseHours>720||!Number.isInteger(maxFiles)||maxFiles<1||maxFiles>5||!Number.isInteger(maxMB)||maxMB<1||maxMB>10)throw Error('Sprawdź dopuszczalne zakresy ustawień.');await mutate(next=>{next.settings={categories,responseHours,maxFiles,maxMB};});shell();toast('Zapisano ustawienia.');}
function exportCsv(form){if(!isAdmin())throw Error('Wybierz profil administratora.');const v=Object.fromEntries(new FormData(form));if(v.from&&v.to&&v.from>v.to)throw Error('Data początkowa nie może być późniejsza niż końcowa.');const tickets=state.tickets.filter(t=>(!v.from||t.createdAt>=new Date(v.from+'T00:00').toISOString())&&(!v.to||t.createdAt<=new Date(v.to+'T23:59:59.999').toISOString()));const rows=[['Numer zgłoszenia','Poprzedni numer','Data zgłoszenia','Miasto','MPK','Nazwa','Zgłaszający','Telefon kontaktowy','E-mail','Rodzaj','Priorytet','Blokuje sprzedaż','Opis','Status','Czas sugerowany (h)','Termin sugerowany','Termin planowany','Data zamknięcia','Komentarz zamknięcia','Pierwsza reakcja','Załączniki']];for(const t of tickets)rows.push([t.number,t.previousNumber||'',date(t.createdAt),t.city,t.mpk,t.locationName,t.reporter,t.reporterPhone||'',t.reporterEmail,t.category,t.priority,t.blocksSales?'Tak':'Nie',t.description,t.status,targetHours(t.priority,t.blocksSales),date(suggestedDeadline(t)),t.dueAt?dateOnly(t.dueAt):'',t.closedAt?date(t.closedAt):'',t.closingComment,t.firstResponseAt?date(t.firstResponseAt):'',t.attachments.map(f=>f.name).join(' | ')]);download(new Blob(['\uFEFF'+rows.map(r=>r.map(Model.csvCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}),'Serwis-Lokali-zgloszenia-'+new Date().toISOString().slice(0,10)+'.csv');toast('Przygotowano raport: '+tickets.length+' zgłoszeń.');}
async function backup(){if(!isAdmin())throw Error('Wybierz profil administratora.');toast('Przygotowuję kopię danych i załączników…');const snapshot=await new Promise((resolve,reject)=>{const tx=db.transaction(['state','files']);const a=tx.objectStore('state').get('main'),b=tx.objectStore('files').getAll();tx.oncomplete=()=>resolve({state:a.result,files:b.result});tx.onerror=()=>reject(tx.error);});const files=[];for(const f of snapshot.files){const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(f.blob);});const {blob,...meta}=f;files.push({...meta,base64});}const data={format:'baltona-usterki-backup',version:1,exportedAt:new Date().toISOString(),state:snapshot.state,files};download(new Blob([JSON.stringify(data)],{type:'application/json'}),'Serwis-Lokali-kopia-'+new Date().toISOString().slice(0,10)+'.json');toast('Przygotowano pełną kopię. Zachowaj pobrany plik w bezpiecznym miejscu.');}
async function restore(file){if(!isAdmin())throw Error('Wybierz profil administratora.');if(!file)return;if(file.size>250*1024*1024&&!confirm('To duża kopia danych. Jej wczytanie może wymagać dużo pamięci przeglądarki. Kontynuować?'))return;const data=JSON.parse(await file.text());const next=Model.validateBackup(data);const files=[];for(const f of data.files){const raw=atob(f.base64);if(raw.length!==f.size)throw Error('Niezgodny rozmiar załącznika w kopii.');const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));const blob=new Blob([bytes],{type:f.type});const b=new Uint8Array(await blob.slice(0,8).arrayBuffer());const valid=f.type==='image/jpeg'?b[0]===255&&b[1]===216&&b[2]===255:f.type==='image/png'?[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v):String.fromCharCode(...b.slice(0,5))==='%PDF-';if(!valid)throw Error('Nieprawidłowa zawartość załącznika w kopii.');const {base64,...meta}=f;files.push({...meta,blob});}if(!confirm('Wczytać '+next.tickets.length+' zgłoszeń i '+files.length+' załączników? Zastąpi to CAŁĄ bieżącą lokalną bazę, w tym profile i obiekty. Najpierw pobierz kopię obecnych danych.'))return;await persist(structuredClone(next),files,true);currentId=state.users.find(u=>u.active&&u.role==='Administrator').id;savePreference();selectedTicket=null;editingUser=null;editingLocation=null;dirty=false;page='admin';adminTab='reports';pendingRemote=null;lastSeenProfile=null;shell();announceProfile();toast('Wczytano i zapisano pełną kopię danych.');}
// Powiadomienia są częścią tej samej transakcji co zgłoszenie/komentarz.
function notificationsContext(data=pendingRemote||state){return Model.notificationsFor(data,data.users.find(u=>u.id===currentId&&u.active));}
function mountToast(node){
 const modal=['quick-close-dialog','notifications-dialog','detail-dialog'].map(id=>document.getElementById(id)).find(dialog=>dialog?.open);
 if(!modal){$('#toasts').append(node);return;}
 let layer=modal.querySelector('.dialog-toast-layer');
 if(!layer){
   layer=document.createElement('div');
   layer.className='dialog-toast-layer';
   const header=modal.querySelector('.dialog-head');
   layer.style.setProperty('--dialog-header-height',(header?.getBoundingClientRect().height||64)+'px');
   if(header)header.insertAdjacentElement('afterend',layer);
   else modal.prepend(layer);
 }
 layer.append(node);
}
function incomingToast(title,body,notificationId=''){
 const node=document.createElement('div');node.className='toast incoming-toast';node.setAttribute('role','status');
 const copy=document.createElement('div'),strong=document.createElement('strong'),p=document.createElement('p');strong.textContent=title;p.textContent=body;copy.append(strong,p);
 const action=document.createElement('button');action.className='btn small secondary';action.type='button';action.dataset.action=notificationId?'open-notification':'notifications';if(notificationId)action.dataset.id=notificationId;action.textContent='Pokaż';action.setAttribute('aria-label',notificationId?'Pokaż zgłoszenie z powiadomienia':'Pokaż powiadomienia');
 const close=document.createElement('button');close.className='toast-dismiss';close.type='button';close.setAttribute('aria-label','Ukryj komunikat');close.textContent='×';close.onclick=()=>node.remove();node.append(copy,action,close);mountToast(node);setTimeout(()=>node.remove(),12000);
}
function announceProfile(){
 const all=notificationsContext();lastSeenProfile=currentId;seenNotificationIds=new Set(all.map(n=>n.id));const unread=all.filter(n=>!n.readAt);
 if(unread.length)incomingToast('Powiadomienia: '+unread.length+' nieprzeczytanych','Nowe komentarze i zmiany znajdziesz pod dzwonkiem.');
}
function noticeFresh(data){
 const all=notificationsContext(data);
 if(lastSeenProfile!==currentId){lastSeenProfile=currentId;seenNotificationIds=new Set(all.map(n=>n.id));return;}
 const fresh=all.filter(n=>!n.readAt&&!seenNotificationIds.has(n.id));for(const n of all)seenNotificationIds.add(n.id);
 if(fresh.length===1)incomingToast(fresh[0].title,fresh[0].body,fresh[0].id);
 else if(fresh.length>1)incomingToast('Nowe powiadomienia: '+fresh.length,'Otwórz dzwonek, aby zobaczyć komentarze i zmiany w zgłoszeniach.');
}
function refreshNotificationsUI(){
 if(!state)return;const all=notificationsContext(),count=all.filter(n=>!n.readAt).length;const bell=$('#notification-bell'),badge=$('#notification-count');
 if(bell){bell.setAttribute('aria-label','Powiadomienia: '+count+' nieprzeczytanych');bell.classList.toggle('has-unread',count>0);}
 if(badge){badge.textContent=count>99?'99+':String(count);badge.hidden=count===0;}
 const syncNotice=$('#sync-notice');if(syncNotice)syncNotice.hidden=!pendingRemote;
 if($('#notifications-dialog')?.open){$('#notifications-dialog').innerHTML=notificationsView();window.refreshPushButton?.();}
}
function notificationsView(){
 const all=notificationsContext(),unread=all.filter(n=>!n.readAt),shown=onlyUnreadNotifications?unread:all;
 return `<div class="dialog-head notification-header"><div><h2 id="notifications-title">Powiadomienia</h2><p>${unread.length} nieprzeczytanych · ${esc((pendingRemote||state).users.find(u=>u.id===currentId)?.name||'Profil')}</p></div><button class="close-dialog" data-action="close-notifications" aria-label="Zamknij powiadomienia">✕</button></div><div class="notification-toolbar"><div class="notification-filters" aria-label="Filtr powiadomień"><button type="button" class="${!onlyUnreadNotifications?'active':''}" data-action="notification-filter" data-filter="all" aria-pressed="${!onlyUnreadNotifications}">Wszystkie</button><button type="button" class="${onlyUnreadNotifications?'active':''}" data-action="notification-filter" data-filter="unread" aria-pressed="${onlyUnreadNotifications}">Nieprzeczytane (${unread.length})</button></div><button class="btn link small" data-action="read-all-notifications" ${unread.length?'':'disabled'}>Oznacz wszystkie jako przeczytane</button></div><div class="push-settings"><div><strong>Powiadomienia na tym urządzeniu</strong><small id="push-status">Sprawdzanie dostępności…</small></div><button id="push-toggle" class="btn secondary small" type="button" disabled>Włącz</button></div><div class="notification-list">${shown.length?shown.map(n=>`<article class="notification-item ${n.readAt?'':'unread'}"><button class="notification-open" data-action="open-notification" data-id="${esc(n.id)}"><span class="notification-symbol">${icon(n.type==='comment'?'message':n.type==='new'?'plus':'list')}</span><span class="notification-copy"><strong>${esc(n.title)}</strong><span>${esc(n.body)}</span><time datetime="${esc(n.createdAt)}">${date(n.createdAt)}${n.readAt?' · Przeczytane':' · Nowe'}</time></span>${n.readAt?'':'<i class="unread-dot" aria-label="Nieprzeczytane"></i>'}</button>${n.readAt?'':`<button class="notification-read" data-action="read-notification" data-id="${esc(n.id)}">Oznacz jako przeczytane</button>`}</article>`).join(''):empty(onlyUnreadNotifications?'Wszystko przeczytane':'Nie masz jeszcze powiadomień',onlyUnreadNotifications?'Nowe zdarzenia pojawią się tutaj automatycznie.':'Pojawią się tutaj nowe zgłoszenia, komentarze i zmiany dotyczące tego profilu.')}</div><div class="notification-footer">Kliknij komunikat, aby otworzyć zgłoszenie. Powiadomienia działają w tej lokalnej bazie — nie między komputerami.</div>`;
}
function openNotifications(){const dialog=$('#notifications-dialog');dialog.innerHTML=notificationsView();if(!dialog.open)dialog.showModal();window.refreshPushButton?.();}
function ingestRemote(latest,announce=true){
 latest=Model.migrate(latest);if(latest.revision<state.revision)return;
 if((dirty||detailDirty)&&Model.businessChanged(state,latest)){
   const first=!pendingRemote;pendingRemote=latest;refreshNotificationsUI();if(first)toast('W innej karcie zmieniono dane. Twój formularz pozostaje bez zmian; odśwież dane przed zapisem.',true);if(announce)noticeFresh(latest);return;
 }
 const changed=Model.businessChanged(state,latest),oldProfile=currentId;state=latest;pendingRemote=null;
 currentId=user().id;
 if(!dirty&&!detailDirty&&changed){const ticketId=selectedTicket;const detailOpen=$('#detail-dialog').open;if(page==='admin'&&!isAdmin())page='home';shell();if(detailOpen){if(currentTickets().some(t=>t.id===ticketId))openDetail(ticketId);else $('#detail-dialog').close();}}
 if(oldProfile!==currentId){savePreference();announceProfile();}
 refreshNotificationsUI();
 if(announce)noticeFresh(latest);
}
async function syncFromDatabase(){
 if(!db||!state||busy||syncing)return;syncing=true;
 try{const latest=await requestValue(db.transaction('state').objectStore('state').get('main'));if(!busy&&latest&&latest.revision>state.revision)ingestRemote(latest);}
 catch(error){if(!syncErrorShown){syncErrorShown=true;toast('Nie udało się odświeżyć danych z drugiej karty. Odśwież stronę, jeśli problem się powtarza.',true);}}
 finally{syncing=false;}
}
function startLiveSync(){
 try{if('BroadcastChannel' in window){updatesChannel=new BroadcastChannel('baltona-usterki-updates-v1');updatesChannel.onmessage=()=>syncFromDatabase();}}catch{}
 setInterval(syncFromDatabase,2500);window.addEventListener('focus',syncFromDatabase);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncFromDatabase();});
}
async function readNotifications(ids=null){
 const recipient=currentId,selected=ids?new Set(ids):null;let latest,changed=false;
 await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite'),store=tx.objectStore('state'),req=store.get('main');
 req.onsuccess=()=>{latest=Model.migrate(req.result);const allowed=new Set(Model.notificationsFor(latest,latest.users.find(u=>u.id===recipient)).map(n=>n.id));const now=new Date().toISOString();for(const n of latest.notifications){if(allowed.has(n.id)&&!n.readAt&&(!selected||selected.has(n.id))){n.readAt=now;changed=true;}}if(changed){latest.revision++;store.put(latest,'main');}};
 tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Nie zapisano stanu powiadomień.'));});
 ingestRemote(latest);if(changed)updatesChannel?.postMessage({revision:latest.revision});
}
async function openNotification(id){
 const notification=notificationsContext().find(n=>n.id===id);if(!notification)throw Error('To powiadomienie nie jest dostępne w tym profilu.');
 if((dirty||detailDirty)&&!confirm('Otworzenie zgłoszenia odrzuci niezapisane zmiany formularza. Kontynuować?'))return;
 dirty=false;detailDirty=false;draftFiles=[];await readNotifications([id]);if(pendingRemote)ingestRemote(pendingRemote,false);
 $('#notifications-dialog').close();await openTicket(notification.ticketId);
}
function applyPending(){
 if(!pendingRemote)return;if((dirty||detailDirty)&&!confirm('Wczytać nowsze dane i odrzucić niezapisane zmiany?'))return;
 dirty=false;detailDirty=false;draftFiles=[];const latest=pendingRemote;ingestRemote(latest,false);shell();
}

async function perform(action){if(busy)return;busy=true;try{await action();}catch(error){fail(error);}finally{busy=false;}}
document.addEventListener('click',async event=>{const el=event.target.closest('[data-action]');if(!el||!state)return;const action=el.dataset.action;try{
 if(busy){toast('Poczekaj na zakończenie bieżącej operacji.');return;}
 if(action==='notifications'){openNotifications();el.closest('.incoming-toast')?.remove();}
 else if(action==='logout')await perform(logout);
 else if(action==='close-notifications')$('#notifications-dialog').close();
 else if(action==='notification-filter'){onlyUnreadNotifications=el.dataset.filter==='unread';refreshNotificationsUI();}
 else if(action==='read-all-notifications')await perform(()=>readNotifications());
 else if(action==='read-notification')await perform(()=>readNotifications([el.dataset.id]));
 else if(action==='open-notification'){await perform(()=>openNotification(el.dataset.id));el.closest('.incoming-toast')?.remove();}
 else if(action==='apply-pending')applyPending();
 else if(action==='nav')navigate(el.dataset.page);
 else if(action==='attention-all'){if(!canManage())return;page='tickets';filters={q:'',status:'',city:'',priority:'',from:'',to:'',quick:'attention',sort:'urgent'};shell();window.scrollTo(0,0);}
 else if(action==='schedule-filter'){if(!canManage())return;const selected=el.dataset.filter;if(!['overdue','today','planned','unplanned'].includes(selected))return;scheduleFilter=scheduleFilter===selected?'all':selected;scheduleMode='list';shell();}
 else if(action==='schedule-mode'){if(!canManage())return;scheduleMode=el.dataset.mode==='calendar'?'calendar':'list';if(scheduleMode==='calendar'&&scheduleFilter==='today'){scheduleSelectedDay=scheduleDateKey(new Date());scheduleMonth=scheduleSelectedDay.slice(0,7);}else if(scheduleMode==='calendar'&&scheduleFilter==='overdue'){const today=scheduleDateKey(new Date()),dates=currentTickets().filter(ticket=>!Model.closed(ticket)&&ticket.dueAt&&Number.isFinite(Date.parse(ticket.dueAt))).map(ticket=>scheduleDateKey(ticket.dueAt)).filter(key=>key<today).sort();if(dates.length){scheduleSelectedDay=dates[dates.length-1];scheduleMonth=scheduleSelectedDay.slice(0,7);}}shell();}
 else if(action==='schedule-day'){if(!canManage())return;scheduleSelectedDay=el.dataset.day;shell();}
 else if(action==='schedule-prev'||action==='schedule-next'){if(!canManage())return;const [year,month]=scheduleMonth.split('-').map(Number);const next=new Date(Date.UTC(year,month-1+(action==='schedule-prev'?-1:1),1));scheduleMonth=next.toISOString().slice(0,7);scheduleSelectedDay=scheduleMonth+'-01';shell();}
 else if(action==='stat-filter'){
   const selected=el.dataset.filter;
   filters={q:'',status:selected==='new'?'Nowe':selected==='closed'?'Zamknięte':'',city:'',priority:'',from:'',to:'',quick:selected==='critical'?'critical':selected==='progress'?'active':'',sort:'urgent'};
   page='tickets';shell();window.scrollTo(0,0);
 }
 else if(action==='city-filter'){filters.city=el.dataset.city;shell();}
 else if(action==='clear-quick'){filters.quick='';shell();}
 else if(action==='new')navigate('new');
 else if(action==='detail')await perform(()=>openTicket(el.dataset.id));
 else if(action==='use-suggested-date'){const ticket=state.tickets.find(t=>t.id===selectedTicket),field=$('#m-due');if(!canManage()||!ticket||!field)return;const target=suggestedDeadline({...ticket,priority:$('#m-priority').value});if(Date.parse(target)<Date.now()){updateDueSuggestion();return;}field.value=inputDate(target);detailDirty=true;field.focus();}
 else if(action==='quick-close')openQuickClose(el.dataset.id);
 else if(action==='close-quick-close')$('#quick-close-dialog').close();
 else if(action==='close-dialog'){if(!detailDirty||confirm('Odrzucić niezapisane zmiany w zgłoszeniu?')){detailDirty=false;$('#detail-dialog').close();}}
 else if(action==='remove-file'){draftFiles.splice(Number(el.dataset.index),1);dirty=true;renderDraftFiles();}
 else if(action==='download-file')await perform(()=>downloadFile(el.dataset.id));
 else if(action==='clear-filters'){filters={q:'',status:'',city:'',priority:'',from:'',to:'',quick:'',sort:'urgent'};shell();}
 else if(action==='admin-tab'){if(dirty&&!confirm('Odrzucić niezapisane zmiany formularza?'))return;dirty=false;adminTab=el.dataset.tab;editingUser=null;editingLocation=null;shell();}
 else if(action==='save-user'){event.preventDefault();await saveUserForm($('#user-form'));}
 else if(action==='delete-user')await perform(()=>deleteUserProfile(el.dataset.id));
 else if(action==='restore-user')await perform(()=>restoreUserProfile(el.dataset.id));
 else if(action==='edit-user'){if(dirty&&!confirm('Odrzucić niezapisane zmiany formularza?'))return;dirty=false;editingUser=el.dataset.id;shell();$('#u-name').focus();}
 else if(action==='cancel-user'){dirty=false;editingUser=null;shell();}
 else if(action==='edit-location'){if(dirty&&!confirm('Odrzucić niezapisane zmiany formularza?'))return;dirty=false;editingLocation=el.dataset.id;shell();$('#l-name').focus();}
 else if(action==='cancel-location'){dirty=false;editingLocation=null;shell();}
 else if(action==='backup')await perform(backup);
 else if(action==='backup-page'){if(!isAdmin()){toast('Kopie danych znajdziesz w Administracji — wybierz profil administratora.');return;}navigate('admin');adminTab='reports';shell();}
 }catch(error){fail(error);}});
document.addEventListener('submit',async event=>{event.preventDefault();const form=event.target;if(form.id==='user-form'){await saveUserForm(form);return;}if(!state||busy)return;if(!form.reportValidity())return;if(pendingRemote&&form.id!=='filter-form'&&form.id!=='export-form'){fail(Error('Dostępne są nowsze dane. Użyj przycisku „Wczytaj nowsze dane” przed zapisem.'),form);return;}busy=true;const buttons=[...form.querySelectorAll('button[type=submit]')];buttons.forEach(b=>b.disabled=true);form.querySelector('.form-error')?.remove();try{
 if(form.id==='login-form')await submitLogin(form);
 else if(form.id==='new-form')await submitNew(form);
 else if(form.id==='comment-form')await submitComment(form);
 else if(form.id==='manage-form')await submitManage(form);
 else if(form.id==='quick-close-form')await submitQuickClose(form);
 else if(form.id==='location-form'){await submitLocation(form);dirty=false;}
 else if(form.id==='settings-form'){await submitSettings(form);dirty=false;}
 else if(form.id==='export-form')exportCsv(form);
 else if(form.id==='filter-form'){const v=Object.fromEntries(new FormData(form));if(v.from&&v.to&&v.from>v.to)throw Error('Data początkowa nie może być późniejsza niż końcowa.');filters={...filters,q:v.q.trim(),priority:v.priority||'',sort:v.sort||'urgent'};shell();}
 }catch(error){fail(error,form);}finally{busy=false;buttons.forEach(b=>b.disabled=false);}});
document.addEventListener('invalid',event=>{
 const form=event.target.closest?.('form');if(!form)return;
 if(form.id==='new-form'){
  const field=event.target,label=form.querySelector(`label[for="${field.id}"]`)?.textContent?.replace('*','').trim()||'to pole';
  const message=field.validity.valueMissing?'Uzupełnij pole: '+label+'.':field.validity.tooShort?'Wpisz co najmniej '+field.minLength+' znaków.':'Sprawdź pole: '+label+'.';
  showNewFormFieldError(field,message);return;
 }
 if(form.id!=='user-form'||form.querySelector('.form-error'))return;
 const label=form.querySelector(`label[for="${event.target.id}"]`)?.textContent?.trim()||'wymagane pole';
 const message=document.createElement('p');message.className='form-error';message.setAttribute('role','alert');message.textContent='Sprawdź pole: '+label+'.';form.prepend(message);
},true);
document.addEventListener('change',async event=>{const el=event.target;if(!state)return;
 if(el.closest('#new-form')&&el.id!=='attachments')clearNewFormFieldError(el);
 if(el.name==='priority'||el.id==='blocksSales')updateTargetHint();
 if(el.id==='profile-select'){if(busy){el.value=currentId;return;}if((dirty||detailDirty)&&!confirm('Zmiana profilu odrzuci niezapisany formularz. Kontynuować?')){el.value=currentId;return;}currentId=el.value;savePreference();dirty=false;detailDirty=false;lastSeenProfile=null;draftFiles=[];editingUser=null;editingLocation=null;if($('#detail-dialog').open)$('#detail-dialog').close();if(page==='admin'&&!isAdmin())page='home';filters={q:'',status:'',city:'',priority:'',from:'',to:'',quick:'',sort:'urgent'};if(pendingRemote){state=pendingRemote;pendingRemote=null;currentId=user().id;}shell();window.onPushProfileChanged?.();toast('Widok testowy: '+user().role+'. To nie jest logowanie.');announceProfile();}
 if(el.id==='m-status'){detailDirty=true;syncClosingFields();}
 if(el.id==='m-priority'){detailDirty=true;updateDueSuggestion();}
 if(el.id==='city'){const choices=availablePlaces().filter(l=>l.city===el.value);$('#mpk').disabled=!el.value;$('#mpk').innerHTML=option('','Wybierz lokal / magazyn')+choices.map(l=>option(l.mpk,l.mpk+' · '+l.name+(l.type==='Magazyn'?' [Magazyn]':'')+(l.location&&l.location!==l.city?' · '+l.location:''),choices.length===1?choices[0].mpk:'')).join('');}
 if(el.id==='attachments'){await perform(()=>addFiles(el.files));el.value='';}
 if(el.id==='restore-file'){await perform(()=>restore(el.files[0]));el.value='';}
});
document.addEventListener('input',event=>{if(event.target.closest('#new-form,#user-form,#location-form,#settings-form'))dirty=true;if(event.target.closest('#new-form'))clearNewFormFieldError(event.target);if(event.target.closest('#manage-form,#comment-form'))detailDirty=true;});
document.addEventListener('dragover',event=>{const zone=event.target.closest('#dropzone');if(zone){event.preventDefault();zone.classList.add('drag');}});
document.addEventListener('dragleave',event=>{event.target.closest('#dropzone')?.classList.remove('drag');});
document.addEventListener('drop',async event=>{const zone=event.target.closest('#dropzone');if(zone){event.preventDefault();zone.classList.remove('drag');await perform(()=>addFiles(event.dataTransfer.files));}});
window.addEventListener('beforeunload',event=>{if(dirty||detailDirty||busy){event.preventDefault();event.returnValue='';}});
for(const dialog of ['detail-dialog','quick-close-dialog','notifications-dialog'].map(id=>document.getElementById(id))){
 dialog.addEventListener('click',event=>{
  if(event.target!==dialog||!dialog.open||busy)return;
  const rect=dialog.getBoundingClientRect();
  if(event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom)return;
  if(dialog.id==='detail-dialog'){
   if(detailDirty&&!confirm('Odrzucić niezapisane zmiany w zgłoszeniu?'))return;
   detailDirty=false;
  }
  dialog.close();
 });
}
$('#detail-dialog').addEventListener('close',()=>{selectedTicket=null;detailDirty=false;});
$('#quick-close-dialog').addEventListener('close',()=>{quickCloseId=null;});
$('#detail-dialog').addEventListener('cancel',event=>{if(busy||(detailDirty&&!confirm('Odrzucić niezapisane zmiany w zgłoszeniu?')))event.preventDefault();else detailDirty=false;});
