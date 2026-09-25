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
  return { statuses, priorities, roles, closed, numberFor, visible, critical, overdue, waiting, metrics, validateTicket, updateTicket, validateUserChange, csvCell, initial, migrate, notificationsFor, notificationEvents, ticketEvents, businessChanged };
})();
