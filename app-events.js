'use strict';
// Zdarzenia formularzy, przycisków i okien dialogowych.
async function perform(action) {
  if (busy) return;
  busy = true;
  try {
    await action();
  } catch (error) {
    fail(error);
  } finally {
    busy = false;
  }
}

document.addEventListener('click', async event => {
 const el = event.target.closest('[data-action]');
 if (!el || !state) return;
 const action = el.dataset.action;
 try {
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
 else if(action==='dashboard-range'){if(!canManage())return;const range=el.dataset.range;if(!['30','90','all'].includes(range))return;dashboardRange=range;shell();}
 else if(action==='dashboard-waiting'){if(!canManage())return;filters={q:'',status:'',city:'',priority:'',from:dashboardStartDate(),to:'',quick:'waiting',sort:'urgent'};page='tickets';shell();window.scrollTo(0,0);}
 else if(action==='dashboard-schedule'){if(!canManage())return;const selected=el.dataset.filter;if(!['overdue','today','unplanned'].includes(selected))return;scheduleFilter=selected;scheduleMode='list';page='schedule';shell();window.scrollTo(0,0);}
 else if(action==='schedule-filter'){if(!canManage())return;const selected=el.dataset.filter;if(!['overdue','today','planned','unplanned'].includes(selected))return;scheduleFilter=scheduleFilter===selected?'all':selected;scheduleMode='list';shell();}
 else if(action==='schedule-mode'){if(!canManage())return;scheduleMode=el.dataset.mode==='calendar'?'calendar':'list';if(scheduleMode==='calendar'&&scheduleFilter==='today'){scheduleSelectedDay=scheduleDateKey(new Date());scheduleMonth=scheduleSelectedDay.slice(0,7);}else if(scheduleMode==='calendar'&&scheduleFilter==='overdue'){const today=scheduleDateKey(new Date()),dates=currentTickets().filter(ticket=>!Model.closed(ticket)&&ticket.dueAt&&Number.isFinite(Date.parse(ticket.dueAt))).map(ticket=>scheduleDateKey(ticket.dueAt)).filter(key=>key<today).sort();if(dates.length){scheduleSelectedDay=dates[dates.length-1];scheduleMonth=scheduleSelectedDay.slice(0,7);}}shell();}
 else if(action==='schedule-day'){if(!canManage())return;scheduleSelectedDay=el.dataset.day;shell();}
 else if(action==='schedule-prev'||action==='schedule-next'){if(!canManage())return;const [year,month]=scheduleMonth.split('-').map(Number);const next=new Date(Date.UTC(year,month-1+(action==='schedule-prev'?-1:1),1));scheduleMonth=next.toISOString().slice(0,7);scheduleSelectedDay=scheduleMonth+'-01';shell();}
 else if(action==='stat-filter'){
   const selected=el.dataset.filter;
   filters={q:'',status:selected==='new'?'Nowe':selected==='closed'?'Zamknięte':'',city:'',priority:'',from:page==='dashboard'?dashboardStartDate():'',to:'',quick:selected==='critical'?'critical':selected==='progress'?'active':'',sort:'urgent'};
   page='tickets';shell();window.scrollTo(0,0);
 }
 else if(action==='city-filter'){filters.city=el.dataset.city;shell();}
 else if(action==='clear-quick'){filters.quick='';shell();}
 else if(action==='clear-date'){filters.from='';filters.to='';shell();}
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
 } catch (error) {
   fail(error);
 }
});

document.addEventListener('submit', async event => {
 event.preventDefault();
 const form = event.target;
 if (form.id === 'user-form') {
   await saveUserForm(form);
   return;
 }
 if (!state || busy || !form.reportValidity()) return;
 if (pendingRemote && form.id !== 'filter-form' && form.id !== 'export-form') {
   fail(Error('Dostępne są nowsze dane. Użyj przycisku „Wczytaj nowsze dane” przed zapisem.'), form);
   return;
 }
 busy = true;
 const buttons = [...form.querySelectorAll('button[type=submit]')];
 buttons.forEach(button => { button.disabled = true; });
 form.querySelector('.form-error')?.remove();
 try {
 if(form.id==='login-form')await submitLogin(form);
 else if(form.id==='new-form')await submitNew(form);
 else if(form.id==='comment-form')await submitComment(form);
 else if(form.id==='manage-form')await submitManage(form);
 else if(form.id==='quick-close-form')await submitQuickClose(form);
 else if(form.id==='location-form'){await submitLocation(form);dirty=false;}
 else if(form.id==='settings-form'){await submitSettings(form);dirty=false;}
 else if(form.id==='export-form')exportCsv(form);
 else if(form.id==='filter-form'){const v=Object.fromEntries(new FormData(form));if(v.from&&v.to&&v.from>v.to)throw Error('Data początkowa nie może być późniejsza niż końcowa.');filters={...filters,q:v.q.trim(),priority:v.priority||'',sort:v.sort||'urgent'};shell();}
 } catch (error) {
   fail(error, form);
 } finally {
   busy = false;
   buttons.forEach(button => { button.disabled = false; });
 }
});
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
 if(el.id==='profile-select'){if(busy){el.value=currentId;return;}if((dirty||detailDirty)&&!confirm('Zmiana profilu odrzuci niezapisany formularz. Kontynuować?')){el.value=currentId;return;}currentId=el.value;savePreference();dirty=false;detailDirty=false;lastSeenProfile=null;draftFiles=[];editingUser=null;editingLocation=null;if($('#detail-dialog').open)$('#detail-dialog').close();if(page==='admin'&&!isAdmin())page='home';filters={q:'',status:'',city:'',priority:'',from:'',to:'',quick:'',sort:'urgent'};if(pendingRemote){state=pendingRemote;pendingRemote=null;currentId=user().id;}shell();toast('Widok testowy: '+user().role+'. To nie jest logowanie.');announceProfile();}
 if(el.id==='m-status'){detailDirty=true;syncClosingFields();}
 if(el.id==='m-priority'){detailDirty=true;updateDueSuggestion();}
 if(el.id==='city'){const choices=availablePlaces().filter(l=>l.city===el.value);$('#mpk').disabled=!el.value;$('#mpk').innerHTML=option('','Wybierz lokal / magazyn')+choices.map(l=>option(l.mpk,l.mpk+' · '+l.name+(l.type==='Magazyn'?' [Magazyn]':'')+(l.location&&l.location!==l.city?' · '+l.location:''),choices.length===1?choices[0].mpk:'')).join('');}
 if(el.id==='attachments'){await perform(()=>addFiles(el.files));el.value='';}
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
