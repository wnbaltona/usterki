'use strict';

// Operacje na zgłoszeniach, profilach, plikach i powiadomieniach.
function navigate(target) {
  if (target === 'dashboard' && !isAdmin()) return;
  if ((dirty || detailDirty) && !confirm('Masz niezapisany formularz. Opuścić go i odrzucić wpisane dane?')) return;
  rememberTicketList();
  if ($('#detail-dialog').open) $('#detail-dialog').close();
  page = target;
  dirty = false;
  detailDirty = false;
  draftFiles = [];
  shell(target === 'tickets');
  if (target !== 'tickets') window.scrollTo(0, 0);
}
function updateTargetHint() {
  const form = $('#new-form'),
    target = form?.querySelector('#priority-target');
  if (!target) return;
  const priority = form.querySelector('input[name="priority"]:checked')?.value || 'Średni';
  const blocksSales = form.querySelector('#blocksSales')?.checked;
  target.textContent = `Proponowany czas realizacji: ${targetHours(priority, blocksSales)} h od wysłania zgłoszenia${blocksSales ? ' (usterka blokuje sprzedaż)' : ''}.`;
}
function renderDraftFiles() {
  if (!$('#draft-files')) return;
  if (draftFiles.length) {
    const error = document.getElementById('attachment-error');
    if (error) error.hidden = true;
    document.getElementById('dropzone')?.classList.remove('invalid');
  }
  $('#draft-files').innerHTML = draftFiles.map((f, i) => `<div class="file-row">${icon('clip')}<span class="file-name">${esc(f.name)} <small>${sizeFmt(f.size)}</small></span><button class="btn secondary small" type="button" data-action="remove-file" data-index="${i}" aria-label="Usuń ${esc(f.name)}">Usuń</button></div>`).join('');
}
function renderCommentDraftFiles() {
  const list = $('#comment-draft-files');
  if (!list) return;
  list.innerHTML = commentDraftFiles.map((f, i) => `<div class="file-row">${icon('clip')}<span class="file-name">${esc(f.name)} <small>${sizeFmt(f.size)}</small></span><button class="btn secondary small" type="button" data-action="remove-comment-file" data-index="${i}" aria-label="Usuń ${esc(f.name)}">Usuń</button></div>`).join('');
}
async function validateFile(file) {
  if (!file.size || file.size > state.settings.maxMB * 1024 * 1024) throw Error('Plik „' + file.name + '” jest pusty lub przekracza ' + state.settings.maxMB + ' MB.');
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const extension = file.name.split('.').pop().toLowerCase();
  const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b);
  const pdf = String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
  if (!(['jpg', 'jpeg'].includes(extension) && jpg || extension === 'png' && png || extension === 'pdf' && pdf)) throw Error('Plik „' + file.name + '” nie jest poprawnym JPG, PNG lub PDF.');
  return jpg ? 'image/jpeg' : png ? 'image/png' : 'application/pdf';
}
async function addFiles(files) {
  const combined = [...draftFiles];
  for (const file of files) {
    if (combined.some(f => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) continue;
    if (combined.length >= state.settings.maxFiles) throw Error('Możesz dodać najwyżej ' + state.settings.maxFiles + ' plików.');
    await validateFile(file);
    combined.push(file);
  }
  draftFiles = combined;
  dirty = true;
  renderDraftFiles();
}
async function addCommentFiles(files) {
  const combined = [...commentDraftFiles];
  for (const file of files) {
    if (combined.some(f => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) continue;
    if (combined.length >= state.settings.maxFiles) throw Error('Do jednego komentarza możesz dodać najwyżej ' + state.settings.maxFiles + ' plików.');
    if (file.name.length > 255) throw Error('Nazwa załącznika jest zbyt długa.');
    await validateFile(file);
    combined.push(file);
  }
  commentDraftFiles = combined;
  detailDirty = true;
  renderCommentDraftFiles();
}
function canRemoveAttachment(ticket, file) {
  return file.purpose === 'comment' && (canManage() || file.authorId === user().id);
}
async function removeAttachment(id) {
  const ticket = currentTickets().find(t => t.attachments.some(f => f.id === id));
  if (!ticket) throw Error('Załącznik niedostępny.');
  const file = ticket.attachments.find(f => f.id === id);
  if (!canRemoveAttachment(ticket, file)) throw Error('Nie możesz usunąć tego załącznika.');
  if (detailDirty && !confirm('Masz niezapisane zmiany w zgłoszeniu. Odrzucić je i usunąć załącznik?')) return;
  if (!confirm('Usunąć załącznik „' + file.name + '”? Tej operacji nie można cofnąć.')) return;
  await mutate(next => {
    const target = next.tickets.find(t => t.id === ticket.id);
    target.attachments = target.attachments.filter(f => f.id !== id);
    target.updatedAt = new Date().toISOString();
    for (const comment of next.comments.filter(c => c.ticketId === ticket.id && c.attachmentIds?.includes(id))) comment.attachmentIds = comment.attachmentIds.filter(fileId => fileId !== id);
  });
  let cleanupFailed = false;
  try {
    const {
      error
    } = await authClient.storage.from(DEMO_BUCKET).remove([id]);
    cleanupFailed = !!error;
  } catch {
    cleanupFailed = true;
  }
  commentDraftFiles = [];
  shell(true);
  if ($('#detail-dialog').open && selectedTicket === ticket.id) openDetail(ticket.id);
  toast(cleanupFailed ? 'Usunięto załącznik ze zgłoszenia, ale nie udało się usunąć pliku z magazynu. Powiadom IT.' : 'Usunięto załącznik.', cleanupFailed);
}
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name.replace(/[\\/\x00-\x1f]/g, '_');
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
async function submitNew(form) {
  const values = Object.fromEntries(new FormData(form));
  const place = Model.validateTicket(values, state, user());
  if (!draftFiles.length) {
    form.querySelector('#dropzone').classList.add('invalid');
    form.querySelector('#attachment-error').hidden = false;
    form.querySelector('#attachments').focus();
    throw Error('Dodaj co najmniej jeden załącznik do zgłoszenia.');
  }
  if (draftFiles.length > state.settings.maxFiles) throw Error('Za dużo załączników.');
  const now = new Date().toISOString(),
    id = uid(),
    creator = user();
  const files = [];
  for (const file of draftFiles) {
    const type = await validateFile(file);
    files.push({
      id: uid(),
      ticketId: id,
      authorId: creator.id,
      name: file.name,
      size: file.size,
      type,
      blob: new Blob([file], {
        type
      })
    });
  }
  let number;
  await mutate(next => {
    next.counter++;
    number = Model.numberFor(next.counter);
    next.tickets.push({
      id,
      number,
      createdAt: now,
      updatedAt: now,
      creatorId: creator.id,
      reporter: values.reporter.trim().replace(/\s+/g, ' '),
      reporterPhone: values.reporterPhone.trim(),
      reporterEmail: creator.email,
      city: place.city,
      mpk: place.mpk,
      locationName: place.name,
      location: place.location || place.city,
      category: values.category,
      priority: values.priority,
      blocksSales: values.blocksSales === 'on',
      description: values.description.trim(),
      status: 'Nowe',
      assigneeId: '',
      dueAt: null,
      costCents: null,
      closedAt: null,
      closingComment: '',
      firstResponseAt: null,
      attachments: files.map(({
        blob,
        ...meta
      }) => meta)
    });
  }, files);
  dirty = false;
  draftFiles = [];
  page = 'tickets';
  filters = {
    q: '',
    status: '',
    city: '',
    priority: '',
    from: '',
    to: '',
    quick: '',
    sort: 'urgent'
  };
  shell();
  toast('Zapisano ' + number + ' wraz z załącznikami w tej przeglądarce.');
  openDetail(id);
}
async function submitComment(form) {
  const values = new FormData(form),
    text = String(values.get('text') || '').trim();
  if (!text && !commentDraftFiles.length || text.length > 5000) throw Error('Wpisz komentarz lub dodaj załącznik (maks. 5000 znaków).');
  const ticket = currentTickets().find(t => t.id === selectedTicket);
  if (!ticket) throw Error('Zgłoszenie niedostępne.');
  const u = user(),
    now = new Date().toISOString(),
    staff = canManage(),
    needsReply = staff && values.get('needsReply') === 'on' && !Model.closed(ticket);
  const commentId = uid(),
    files = [];
  for (const file of commentDraftFiles) {
    const type = await validateFile(file);
    files.push({
      id: uid(),
      ticketId: ticket.id,
      commentId,
      authorId: u.id,
      purpose: 'comment',
      name: file.name,
      size: file.size,
      type,
      blob: new Blob([file], {
        type
      })
    });
  }
  await mutate(next => {
    next.comments.push({
      id: commentId,
      ticketId: ticket.id,
      authorId: u.id,
      authorName: u.name,
      role: u.role,
      text,
      attachmentIds: files.map(f => f.id),
      createdAt: now
    });
    const t = next.tickets.find(x => x.id === ticket.id);
    t.attachments.push(...files.map(({
      blob,
      ...meta
    }) => meta));
    if (!Model.closed(t)) {
      if (needsReply) t.status = 'Oczekuje na informację';else if (t.status === 'Oczekuje na informację' || staff && t.status === 'Nowe') t.status = 'W realizacji';
      if (staff && !t.firstResponseAt) t.firstResponseAt = now;
    }
    t.updatedAt = now;
  }, files);
  commentDraftFiles = [];
  detailDirty = false;
  shell(true);
  openDetail(ticket.id);
  toast(Model.closed(ticket) ? 'Dodano komentarz.' : needsReply ? 'Dodano komentarz. Zgłoszenie oczekuje na odpowiedź lokalu.' : ticket.status === 'Oczekuje na informację' ? 'Dodano odpowiedź. Zgłoszenie wróciło do realizacji.' : 'Dodano komentarz.');
}
function canEditComment(comment) {
  return comment.authorId === user().id;
}
function startEditComment(id) {
  const comment = state.comments.find(c => c.id === id && c.ticketId === selectedTicket);
  if (!comment || !canEditComment(comment)) throw Error('Możesz edytować tylko własny komentarz.');
  if (detailDirty && !confirm('Odrzucić niezapisane zmiany i edytować komentarz?')) return;
  commentDraftFiles = [];
  editingCommentId = id;
  openDetail(selectedTicket);
  $('#comment-edit-text')?.focus();
}
function cancelEditComment() {
  editingCommentId = null;
  openDetail(selectedTicket);
}
async function saveEditedComment(form) {
  const id = form.dataset.id,
    ticket = currentTickets().find(t => t.id === selectedTicket),
    comment = state.comments.find(c => c.id === id && c.ticketId === ticket?.id);
  if (!comment || !canEditComment(comment)) throw Error('Możesz edytować tylko własny komentarz.');
  if (editingCommentId !== id) throw Error('Ten komentarz nie jest teraz edytowany.');
  const text = String(new FormData(form).get('text') || '').trim();
  if (!text && !(comment.attachmentIds || []).length || text.length > 5000) throw Error('Wpisz komentarz lub pozostaw co najmniej jeden załącznik (maks. 5000 znaków).');
  if (text === comment.text) {
    cancelEditComment();
    return;
  }
  const now = new Date().toISOString(),
    actor = user();
  await mutate(next => {
    const edited = next.comments.find(c => c.id === id);
    edited.text = text;
    edited.editedAt = now;
    next.tickets.find(t => t.id === ticket.id).updatedAt = now;
    for (const notice of next.notifications.filter(n => n.eventId === 'comment-' + id)) notice.body = actor.name + ': ' + (text ? text.slice(0, 200) + (text.length > 200 ? '…' : '') : 'Dodano załącznik');
    next.events.push({
      id: uid(),
      ticketId: ticket.id,
      actorId: actor.id,
      actorName: actor.name,
      type: 'comment-edited',
      text: 'Edytowano komentarz',
      createdAt: now
    });
  });
  editingCommentId = null;
  detailDirty = false;
  shell(true);
  openDetail(ticket.id);
  toast('Zapisano zmiany komentarza.');
}
async function deleteComment(id) {
  const ticket = currentTickets().find(t => t.id === selectedTicket),
    comment = state.comments.find(c => c.id === id && c.ticketId === ticket?.id);
  if (!comment || !canEditComment(comment)) throw Error('Możesz usunąć tylko własny komentarz.');
  if (detailDirty && !confirm('Odrzucić niezapisane zmiany i usunąć komentarz?')) return;
  if (!confirm('Usunąć komentarz wraz z jego załącznikami? Tej operacji nie można cofnąć.')) return;
  const fileIds = (comment.attachmentIds || []).filter(fileId => ticket.attachments.some(f => f.id === fileId && f.purpose === 'comment' && f.commentId === id));
  const now = new Date().toISOString(),
    actor = user();
  await mutate(next => {
    next.comments = next.comments.filter(c => c.id !== id);
    const target = next.tickets.find(t => t.id === ticket.id);
    target.attachments = target.attachments.filter(f => !fileIds.includes(f.id));
    target.updatedAt = now;
    next.notifications = next.notifications.filter(n => n.eventId !== 'comment-' + id);
    next.events.push({
      id: uid(),
      ticketId: ticket.id,
      actorId: actor.id,
      actorName: actor.name,
      type: 'comment-deleted',
      text: 'Usunięto komentarz',
      createdAt: now
    });
  });
  let cleanupFailed = false;
  if (fileIds.length) try {
    const {
      error
    } = await authClient.storage.from(DEMO_BUCKET).remove(fileIds);
    cleanupFailed = !!error;
  } catch {
    cleanupFailed = true;
  }
  editingCommentId = null;
  commentDraftFiles = [];
  detailDirty = false;
  shell(true);
  openDetail(ticket.id);
  toast(cleanupFailed ? 'Usunięto komentarz, ale nie udało się skasować jego plików z magazynu. Powiadom IT.' : 'Usunięto komentarz.', cleanupFailed);
}
function openQuickClose(id) {
  const ticket = currentTickets().find(t => t.id === id);
  if (!canClose(ticket)) throw Error('Tylko koordynator, administrator lub kierownik przypisanego lokalu może zamknąć zgłoszenie.');
  if (!ticket || Model.closed(ticket)) throw Error('To zgłoszenie nie jest już otwarte.');
  if ($('#detail-dialog').open && detailDirty && !confirm('Zamknięcie odrzuci niezapisane zmiany. Kontynuować?')) return;
  quickCloseId = id;
  const dialog = $('#quick-close-dialog');
  const attachmentRequired = user().role === 'Kierownik lokalu';
  dialog.innerHTML = `<form id="quick-close-form" class="quick-close-form"><div class="quick-close-head"><div><span class="eyebrow">SZYBKIE ZAMKNIĘCIE</span><h2 id="quick-close-title">${esc(ticket.number)}</h2><p>${esc(ticket.mpk)} · ${esc(ticket.locationName)}</p></div><button type="button" class="close-dialog" data-action="close-quick-close" aria-label="Anuluj zamknięcie">✕</button></div><div class="quick-close-body"><label for="quick-close-comment">Opis wykonanych prac <span class="required">*</span></label><textarea id="quick-close-comment" name="closingComment" required maxlength="5000" rows="4" placeholder="Podaj zakres wykonanych prac"></textarea><label for="quick-close-file" class="quick-close-file-label">Załącznik potwierdzający zamknięcie ${attachmentRequired ? '<span class="required">*</span>' : '(opcjonalnie)'}</label><input id="quick-close-file" name="closingFile" type="file" accept=".jpg,.jpeg,.png,.pdf" ${attachmentRequired ? 'required' : ''}><p class="hint">JPG, PNG lub PDF · maks. ${state.settings.maxMB} MB. ${attachmentRequired ? 'Opis i załącznik są wymagane.' : 'Opis jest wymagany, załącznik możesz dodać opcjonalnie.'}</p><p class="hint">Po zamknięciu nadal można dodawać komentarze.</p><div class="quick-close-actions"><button class="btn secondary" type="button" data-action="close-quick-close">Anuluj</button><button class="btn" type="submit">Zamknij zgłoszenie</button></div></div></form>`;
  dialog.showModal();
  dialog.querySelector('textarea').focus();
}
async function submitQuickClose(form) {
  const id = quickCloseId,
    ticket = state.tickets.find(t => t.id === id);
  if (!ticket || !currentTickets().some(t => t.id === id)) throw Error('Zgłoszenie nie jest dostępne.');
  if (!canClose(ticket)) throw Error('Nie masz uprawnień do zamknięcia tego zgłoszenia.');
  const closingComment = String(new FormData(form).get('closingComment') || '').trim();
  const file = form.elements.closingFile.files[0];
  if (user().role === 'Kierownik lokalu' && !file) throw Error('Dodaj załącznik potwierdzający zamknięcie.');
  if (file && ticket.attachments.length >= 6) throw Error('Zgłoszenie ma już maksymalną liczbę załączników.');
  if (file && file.name.length > 255) throw Error('Nazwa załącznika jest zbyt długa.');
  const type = file ? await validateFile(file) : null;
  const attachment = file ? {
    id: uid(),
    ticketId: id,
    authorId: user().id,
    name: file.name,
    size: file.size,
    type,
    purpose: 'closure'
  } : null;
  const updated = Model.updateTicket(ticket, {
    status: 'Zamknięte',
    priority: ticket.priority,
    dueAt: ticket.dueAt,
    closingComment,
    closureAttachment: attachment
  }, user(), new Date().toISOString());
  updated.attachments = [...ticket.attachments, ...(attachment ? [attachment] : [])];
  await mutate(next => {
    next.tickets[next.tickets.findIndex(t => t.id === id)] = updated;
  }, attachment ? [{
    ...attachment,
    blob: new Blob([file], {
      type
    })
  }] : []);
  $('#quick-close-dialog').close();
  quickCloseId = null;
  detailDirty = false;
  shell();
  if ($('#detail-dialog').open && selectedTicket === id) $('#detail-dialog').innerHTML = detailView(state.tickets.find(t => t.id === id));
  toast('Zamknięto zgłoszenie ' + ticket.number + (attachment ? ' i zapisano załącznik.' : '.'));
}
async function submitManage(form) {
  const values = Object.fromEntries(new FormData(form)),
    ticket = state.tickets.find(t => t.id === selectedTicket);
  if (!ticket) throw Error('Zgłoszenie nie jest dostępne.');
  if (values.dueAt && values.dueAt < inputDate(new Date().toISOString()) && values.dueAt !== inputDate(ticket.dueAt)) throw Error('Planowany termin nie może być wcześniejszy niż dzisiaj.');
  values.dueAt = values.dueAt ? new Date(values.dueAt + 'T23:59:59.999').toISOString() : null;
  const updated = Model.updateTicket(ticket, values, user(), new Date().toISOString());
  await mutate(next => {
    next.tickets[next.tickets.findIndex(t => t.id === ticket.id)] = updated;
  });
  shell(true);
  openDetail(ticket.id);
  toast('Zapisano dane obsługi zgłoszenia.');
}
async function deleteUserProfile(id) {
  if (!isAdmin()) throw Error('Tylko administrator może usuwać profile.');
  const target = state.users.find(u => u.id === id && !u.deletedAt);
  if (!target) throw Error('Nie znaleziono profilu.');
  if (id === currentId) throw Error('Nie można usunąć aktualnie wybranego profilu.');
  if (authUser?.email?.toLowerCase() === target.email.toLowerCase()) throw Error('Nie można usunąć konta aktualnie zalogowanego.');
  if (target.active && target.role === 'Administrator' && !state.users.some(u => u.id !== id && u.active && !u.deletedAt && u.role === 'Administrator')) throw Error('Musi pozostać aktywny administrator.');
  await mutate(next => {
    const profile = next.users.find(u => u.id === id);
    profile.active = false;
    profile.deletedAt = new Date().toISOString();
  });
  if (editingUser === id) editingUser = null;
  shell();
  toast('Usunięto profil. Historia zgłoszeń została zachowana.');
}
async function restoreUserProfile(id) {
  if (!isAdmin()) throw Error('Tylko administrator może przywracać profile.');
  const target = state.users.find(u => u.id === id && u.deletedAt);
  if (!target) throw Error('Nie znaleziono usuniętego profilu.');
  await mutate(next => {
    const profile = next.users.find(u => u.id === id);
    profile.active = true;
    delete profile.deletedAt;
  });
  shell();
  toast('Przywrócono profil.');
}
async function purgeUserProfile(id) {
  if (!isAdmin()) throw Error('Tylko administrator może trwale usuwać profile.');
  const target = state.users.find(u => u.id === id && u.deletedAt);
  if (!target) throw Error('Można trwale usunąć wyłącznie profil z listy usuniętych.');
  if (target.authUserId === authUser?.id || id === currentId) throw Error('Nie można usunąć własnego profilu.');
  if (!confirm('Usunąć na stałe profil „' + target.name + '”? Nie będzie można go przywrócić. Zgłoszenia i komentarze pozostaną w historii. Konto logowania w Supabase pozostanie.')) return;
  await mutate(next => {
    next.users = next.users.filter(u => u.id !== id);
    next.notifications = next.notifications.filter(n => n.recipientId !== id);
  });
  if (editingUser === id) editingUser = null;
  shell();
  toast('Profil został trwale usunięty.');
}
async function saveUserForm(form) {
  if (!form || !state) return;
  if (busy) {
    fail(Error('Poczekaj na zakończenie poprzedniego zapisu.'), form);
    return;
  }
  const invalid = form.querySelector(':invalid');
  if (invalid) {
    const label = form.querySelector(`label[for="${invalid.id}"]`)?.textContent?.trim() || 'wymagane pole';
    fail(Error('Sprawdź pole: ' + label + '.'), form);
    invalid.focus();
    return;
  }
  if (pendingRemote) {
    fail(Error('Dostępne są nowsze dane. Użyj przycisku „Wczytaj nowsze dane” przed zapisem.'), form);
    return;
  }
  const button = form.querySelector('[data-action="save-user"]');
  const originalLabel = button?.textContent;
  busy = true;
  if (button) {
    button.disabled = true;
    button.textContent = 'Zapisywanie…';
  }
  form.querySelector('.form-error')?.remove();
  try {
    await submitUser(form);
    dirty = false;
  } catch (error) {
    fail(error, form);
  } finally {
    busy = false;
    if (button) {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }
}
async function submitUser(form) {
  if (!isAdmin()) throw Error('Wybierz profil administratora.');
  const values = Object.fromEntries(new FormData(form));
  const mpks = [...new Set(String(values.mpks || '').toUpperCase().split(/[,;\s]+/).filter(Boolean))];
  if (mpks.some(mpk => !state.locations.some(l => l.mpk === mpk))) throw Error('Sprawdź przypisane MPK — jeden z numerów nie istnieje.');
  let previous = values.id ? state.users.find(u => u.id === values.id) || pendingAccount(values.id) : null;
  const account = authAccounts.find(a => a.email?.toLowerCase() === values.email.trim().toLowerCase());
  if (!account) throw Error('Najpierw utwórz konto z tym e-mailem w Supabase i odśwież listę kont.');
  const saved = values.id ? state.users.find(u => u.id === values.id) : null;
  if (!saved) {
    previous = state.users.find(u => u.authUserId === account.id) || state.users.find(u => u.email?.trim().toLowerCase() === account.email.trim().toLowerCase()) || previous;
  }
  if (values.id && !previous) throw Error('Nie znaleziono edytowanego profilu. Odśwież listę użytkowników.');
  const proposed = {
    ...previous,
    authUserId: account.id,
    id: previous?.id || values.id || uid(),
    name: values.name.trim(),
    email: values.email.trim().toLowerCase(),
    phone: String(values.phone || '').trim(),
    role: values.role,
    mpks,
    active: values.active === 'on'
  };
  delete proposed.deletedAt;
  Model.validateUserChange(state.users, proposed);
  await mutate(next => {
    const index = next.users.findIndex(u => u.id === proposed.id);
    if (index >= 0) next.users[index] = proposed;else next.users.push(proposed);
  });
  currentId = user()?.id;
  savePreference();
  editingUser = proposed.id;
  if (!user()) {
    showNoAccess();
    return;
  }
  if (!isAdmin()) page = 'home';
  shell();
  if (page === 'admin') $('#user-form')?.insertAdjacentHTML('afterbegin', '<p class="notice" role="status">Zmiany profilu zostały zapisane. Konto logowania w Supabase pozostaje bez zmian.</p>');
  toast('Zapisano zmiany profilu.');
}
async function submitLocation(form) {
  if (!isAdmin()) throw Error('Wybierz profil administratora.');
  const v = Object.fromEntries(new FormData(form));
  const mpk = v.mpk.trim().toUpperCase();
  if (!mpk || !v.name.trim() || !v.city.trim()) throw Error('Uzupełnij MPK, nazwę i miasto.');
  if (!['Lokal', 'Magazyn'].includes(v.type)) throw Error('Nieprawidłowy typ obiektu.');
  if (v.type === 'Lokal' && !['tr', 'gastro'].includes(v.segment)) throw Error('Wybierz grupę lokalu.');
  if (!v.original && state.locations.some(l => l.mpk.toUpperCase() === mpk)) throw Error('Obiekt z tym MPK już istnieje.');
  if (v.original && mpk !== v.original) throw Error('Nie zmieniaj numeru MPK istniejącego obiektu.');
  await mutate(next => {
    const i = next.locations.findIndex(l => l.mpk === mpk);
    const record = {
      ...(i >= 0 ? next.locations[i] : {}),
      mpk,
      name: v.name.trim(),
      city: v.city.trim().toUpperCase(),
      location: v.location.trim().toUpperCase() || v.city.trim().toUpperCase(),
      type: v.type,
      segment: v.type === 'Magazyn' ? 'magazyn' : v.segment,
      active: v.active === 'on'
    };
    if (i >= 0) next.locations[i] = record;else next.locations.push(record);
  });
  editingLocation = null;
  shell();
  toast('Zapisano obiekt. Historia zgłoszeń pozostała bez zmian.');
}
async function submitSettings(form) {
  if (!isAdmin()) throw Error('Wybierz profil administratora.');
  const v = Object.fromEntries(new FormData(form));
  const categories = [...new Set(v.categories.split('\n').map(x => x.trim()).filter(Boolean))];
  const responseHours = Number(v.responseHours),
    maxFiles = Number(v.maxFiles),
    maxMB = Number(v.maxMB);
  if (!categories.length || categories.length > 40 || categories.some(c => c.length > 100)) throw Error('Podaj od 1 do 40 kategorii, każda do 100 znaków.');
  if (!Number.isInteger(responseHours) || responseHours < 1 || responseHours > 720 || !Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 5 || !Number.isInteger(maxMB) || maxMB < 1 || maxMB > 10) throw Error('Sprawdź dopuszczalne zakresy ustawień.');
  await mutate(next => {
    next.settings = {
      categories,
      responseHours,
      maxFiles,
      maxMB
    };
  });
  shell();
  toast('Zapisano ustawienia.');
}
function exportCsv(form) {
  if (!isAdmin()) throw Error('Wybierz profil administratora.');
  const v = Object.fromEntries(new FormData(form));
  if (v.from && v.to && v.from > v.to) throw Error('Data początkowa nie może być późniejsza niż końcowa.');
  const tickets = state.tickets.filter(t => (!v.from || t.createdAt >= new Date(v.from + 'T00:00').toISOString()) && (!v.to || t.createdAt <= new Date(v.to + 'T23:59:59.999').toISOString()));
  const rows = [['Numer zgłoszenia', 'Poprzedni numer', 'Data zgłoszenia', 'Miasto', 'MPK', 'Nazwa', 'Zgłaszający', 'Telefon kontaktowy', 'E-mail', 'Rodzaj', 'Priorytet', 'Blokuje sprzedaż', 'Opis', 'Status', 'Czas sugerowany (h)', 'Termin sugerowany', 'Termin planowany', 'Data zamknięcia', 'Komentarz zamknięcia', 'Pierwsza reakcja', 'Załączniki']];
  for (const t of tickets) rows.push([t.number, t.previousNumber || '', date(t.createdAt), t.city, t.mpk, t.locationName, t.reporter, t.reporterPhone || '', t.reporterEmail, t.category, t.priority, t.blocksSales ? 'Tak' : 'Nie', t.description, t.status, targetHours(t.priority, t.blocksSales), date(suggestedDeadline(t)), t.dueAt ? dateOnly(t.dueAt) : '', t.closedAt ? date(t.closedAt) : '', t.closingComment, t.firstResponseAt ? date(t.firstResponseAt) : '', t.attachments.map(f => f.name).join(' | ')]);
  download(new Blob(['\uFEFF' + rows.map(r => r.map(Model.csvCell).join(';')).join('\r\n')], {
    type: 'text/csv;charset=utf-8'
  }), 'Serwis-Lokali-zgloszenia-' + new Date().toISOString().slice(0, 10) + '.csv');
  toast('Przygotowano raport: ' + tickets.length + ' zgłoszeń.');
}
// Powiadomienia są częścią tej samej transakcji co zgłoszenie/komentarz.
function notificationsContext(data = pendingRemote || state) {
  return Model.notificationsFor(data, data.users.find(u => u.id === currentId && u.active));
}
function mountToast(node) {
  mountToastAboveDialogs(node);
}
function incomingToast(title, body, notificationId = '') {
  const node = document.createElement('div');
  node.className = 'toast incoming-toast';
  node.setAttribute('role', 'status');
  const copy = document.createElement('div'),
    strong = document.createElement('strong'),
    p = document.createElement('p');
  strong.textContent = title;
  p.textContent = body;
  copy.append(strong, p);
  const action = document.createElement('button');
  action.className = 'btn small secondary';
  action.type = 'button';
  action.dataset.action = notificationId ? 'open-notification' : 'notifications';
  if (notificationId) action.dataset.id = notificationId;
  action.textContent = 'Pokaż';
  action.setAttribute('aria-label', notificationId ? 'Pokaż zgłoszenie z powiadomienia' : 'Pokaż powiadomienia');
  const close = document.createElement('button');
  close.className = 'toast-dismiss';
  close.type = 'button';
  close.setAttribute('aria-label', 'Ukryj komunikat');
  close.textContent = '×';
  close.onclick = () => node.remove();
  node.append(copy, action, close);
  mountToast(node);
  setTimeout(() => node.remove(), 12000);
}
function announceProfile() {
  const all = notificationsContext();
  lastSeenProfile = currentId;
  seenNotificationIds = new Set(all.map(n => n.id));
  const unread = all.filter(n => !n.readAt);
  if (unread.length) incomingToast('Powiadomienia: ' + unread.length + ' nieprzeczytanych', 'Nowe komentarze i zmiany znajdziesz pod dzwonkiem.');
}
function noticeFresh(data) {
  const all = notificationsContext(data);
  if (lastSeenProfile !== currentId) {
    lastSeenProfile = currentId;
    seenNotificationIds = new Set(all.map(n => n.id));
    return;
  }
  const fresh = all.filter(n => !n.readAt && !seenNotificationIds.has(n.id));
  for (const n of all) seenNotificationIds.add(n.id);
  if (fresh.length === 1) incomingToast(fresh[0].title, fresh[0].body, fresh[0].id);else if (fresh.length > 1) incomingToast('Nowe powiadomienia: ' + fresh.length, 'Otwórz dzwonek, aby zobaczyć komentarze i zmiany w zgłoszeniach.');
}
function refreshNotificationsUI() {
  if (!state) return;
  const all = notificationsContext(),
    count = all.filter(n => !n.readAt).length;
  const bell = $('#notification-bell'),
    badge = $('#notification-count');
  if (bell) {
    bell.setAttribute('aria-label', 'Powiadomienia: ' + count + ' nieprzeczytanych');
    bell.classList.toggle('has-unread', count > 0);
  }
  if (badge) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.hidden = count === 0;
  }
  const syncNotice = $('#sync-notice');
  if (syncNotice) syncNotice.hidden = !pendingRemote;
  if ($('#notifications-dialog')?.open) $('#notifications-dialog').innerHTML = notificationsView();
}
function notificationsView() {
  const all = notificationsContext(),
    unread = all.filter(n => !n.readAt),
    shown = onlyUnreadNotifications ? unread : all;
  return `<div class="dialog-head notification-header"><div><h2 id="notifications-title">Powiadomienia</h2><p>${unread.length} nieprzeczytanych · ${esc((pendingRemote || state).users.find(u => u.id === currentId)?.name || 'Profil')}</p></div><button class="close-dialog" data-action="close-notifications" aria-label="Zamknij powiadomienia">✕</button></div><div class="notification-toolbar"><div class="notification-filters" aria-label="Filtr powiadomień"><button type="button" class="${!onlyUnreadNotifications ? 'active' : ''}" data-action="notification-filter" data-filter="all" aria-pressed="${!onlyUnreadNotifications}">Wszystkie</button><button type="button" class="${onlyUnreadNotifications ? 'active' : ''}" data-action="notification-filter" data-filter="unread" aria-pressed="${onlyUnreadNotifications}">Nieprzeczytane (${unread.length})</button></div><button class="btn link small" data-action="read-all-notifications" ${unread.length ? '' : 'disabled'}>Oznacz wszystkie jako przeczytane</button></div><div class="notification-list">${shown.length ? shown.map(n => `<article class="notification-item ${n.readAt ? '' : 'unread'}"><button class="notification-open" data-action="open-notification" data-id="${esc(n.id)}"><span class="notification-symbol">${icon(n.type === 'comment' ? 'message' : n.type === 'new' ? 'plus' : 'list')}</span><span class="notification-copy"><strong>${esc(n.title)}</strong><span>${esc(n.body)}</span><time datetime="${esc(n.createdAt)}">${date(n.createdAt)}${n.readAt ? ' · Przeczytane' : ' · Nowe'}</time></span>${n.readAt ? '' : '<i class="unread-dot" aria-label="Nieprzeczytane"></i>'}</button>${n.readAt ? '' : `<button class="notification-read" data-action="read-notification" data-id="${esc(n.id)}">Oznacz jako przeczytane</button>`}</article>`).join('') : empty(onlyUnreadNotifications ? 'Wszystko przeczytane' : 'Nie masz jeszcze powiadomień', onlyUnreadNotifications ? 'Nowe zdarzenia pojawią się tutaj automatycznie.' : 'Pojawią się tutaj nowe zgłoszenia, komentarze i zmiany dotyczące tego profilu.')}</div><div class="notification-footer">Kliknij komunikat, aby otworzyć zgłoszenie. Powiadomienia są wspólne dla zalogowanych urządzeń.</div>`;
}
function openNotifications() {
  const dialog = $('#notifications-dialog');
  dialog.innerHTML = notificationsView();
  if (!dialog.open) dialog.showModal();
}
function ingestRemote(latest, announce = true) {
  latest = Model.migrate(latest);
  if (latest.revision < state.revision) return;
  const oldAccess = user(),
    newAccess = latest.users.find(u => u.authUserId === authUser?.id && u.active && !u.deletedAt);
  if (JSON.stringify(oldAccess) !== JSON.stringify(newAccess)) {
    dirty = false;
    detailDirty = false;
  }
  if ((dirty || detailDirty) && Model.businessChanged(state, latest)) {
    const first = !pendingRemote;
    pendingRemote = latest;
    refreshNotificationsUI();
    if (first) toast('W innej karcie zmieniono dane. Twój formularz pozostaje bez zmian; odśwież dane przed zapisem.', true);
    if (announce) noticeFresh(latest);
    return;
  }
  const changed = Model.businessChanged(state, latest),
    oldProfile = currentId;
  state = latest;
  pendingRemote = null;
  currentId = user()?.id;
  if (!user()) {
    showNoAccess();
    return;
  }
  if (!dirty && !detailDirty && changed) {
    const ticketId = selectedTicket;
    const detailOpen = $('#detail-dialog').open;
    if (['admin', 'dashboard'].includes(page) && !isAdmin()) page = 'home';
    shell();
    if (detailOpen) {
      if (currentTickets().some(t => t.id === ticketId)) openDetail(ticketId);else $('#detail-dialog').close();
    }
  }
  if (oldProfile !== currentId) {
    savePreference();
    announceProfile();
  }
  refreshNotificationsUI();
  if (announce) noticeFresh(latest);
}
async function openNotification(id) {
  const notification = notificationsContext().find(n => n.id === id);
  if (!notification) throw Error('To powiadomienie nie jest dostępne w tym profilu.');
  if ((dirty || detailDirty) && !confirm('Otworzenie zgłoszenia odrzuci niezapisane zmiany formularza. Kontynuować?')) return;
  dirty = false;
  detailDirty = false;
  draftFiles = [];
  await readNotifications([id]);
  if (pendingRemote) ingestRemote(pendingRemote, false);
  $('#notifications-dialog').close();
  await openTicket(notification.ticketId);
}
function applyPending() {
  if (!pendingRemote) return;
  if ((dirty || detailDirty) && !confirm('Wczytać nowsze dane i odrzucić niezapisane zmiany?')) return;
  dirty = false;
  detailDirty = false;
  draftFiles = [];
  const latest = pendingRemote;
  ingestRemote(latest, false);
  shell();
}
const PDFJS_CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/';
let pdfPreviewDocument = null,
  pdfPreviewLoading = null,
  pdfPreviewRender = null,
  pdfPreviewPage = 1,
  previewGeneration = 0;
function closeAttachmentResources() {
  previewGeneration++;
  if (attachmentPreviewUrl) URL.revokeObjectURL(attachmentPreviewUrl);
  attachmentPreviewUrl = null;
  if (pdfPreviewRender) {
    pdfPreviewRender.cancel();
    pdfPreviewRender = null;
  }
  const loading = pdfPreviewLoading,
    doc = pdfPreviewDocument;
  pdfPreviewLoading = null;
  pdfPreviewDocument = null;
  if (loading) loading.destroy().catch(() => {});else if (doc) doc.destroy().catch(() => {});
}
async function renderPdfPage() {
  const doc = pdfPreviewDocument,
    dialog = $('#attachment-preview-dialog');
  if (!doc || !dialog.open) return;
  const pageNumber = pdfPreviewPage,
    page = await doc.getPage(pageNumber);
  if (doc !== pdfPreviewDocument || !dialog.open) return;
  const canvas = dialog.querySelector('canvas'),
    body = dialog.querySelector('.preview-body');
  const natural = page.getViewport({
    scale: 1
  });
  const available = Math.max(100, body.clientWidth - 24),
    scale = Math.min(2, available / natural.width);
  const ratio = Math.min(window.devicePixelRatio || 1, 2),
    viewport = page.getViewport({
      scale: scale * ratio
    });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  canvas.style.width = Math.ceil(viewport.width / ratio) + 'px';
  canvas.style.height = 'auto';
  canvas.setAttribute('aria-label', 'Strona ' + pageNumber + ' z ' + doc.numPages);
  pdfPreviewRender = page.render({
    canvas,
    viewport
  });
  try {
    await pdfPreviewRender.promise;
  } catch (error) {
    if (error.name !== 'RenderingCancelledException') throw error;
    return;
  }
  if (doc !== pdfPreviewDocument || !dialog.open) return;
  pdfPreviewRender = null;
  dialog.querySelector('.pdf-loading').hidden = true;
  dialog.querySelector('.pdf-page-number').textContent = pageNumber + ' / ' + doc.numPages;
  dialog.querySelector('[data-action="pdf-prev"]').disabled = pageNumber === 1;
  dialog.querySelector('[data-action="pdf-next"]').disabled = pageNumber === doc.numPages;
  body.scrollTop = 0;
}
async function previewFile(id) {
  const {
    record,
    blob
  } = await attachmentBlob(id);
  const type = record.type || blob.type;
  if (!['image/jpeg', 'image/png', 'application/pdf'].includes(type)) throw Error('Podgląd jest dostępny dla JPG, PNG i PDF.');
  closeAttachmentResources();
  const generation = previewGeneration;
  const dialog = $('#attachment-preview-dialog'),
    pdf = type === 'application/pdf';
  if (!pdf) attachmentPreviewUrl = URL.createObjectURL(new Blob([blob], {
    type
  }));
  dialog.innerHTML = `<div class="preview-head"><h2 id="attachment-preview-title">${esc(record.name)}</h2><button class="close-dialog" type="button" data-action="close-preview" aria-label="Zamknij podgląd">✕</button></div><div class="preview-body">${pdf ? '<p class="pdf-loading" role="status">Wczytywanie dokumentu…</p><canvas role="img" aria-label="Podgląd dokumentu PDF"></canvas>' : `<img src="${attachmentPreviewUrl}" alt="${esc(record.name)}">`}</div>${pdf ? '<div class="pdf-pages"><button class="btn secondary small" type="button" data-action="pdf-prev" disabled aria-label="Poprzednia strona PDF">←</button><span class="pdf-page-number" aria-live="polite"></span><button class="btn secondary small" type="button" data-action="pdf-next" disabled aria-label="Następna strona PDF">→</button></div>' : ''}<div class="preview-footer"><button class="btn secondary" type="button" data-action="download-file" data-id="${esc(id)}">Pobierz</button><button class="btn" type="button" data-action="close-preview">Zamknij podgląd</button></div>`;
  if (!dialog.open) dialog.showModal();
  if (pdf) {
    try {
      const pdfjs = await import(PDFJS_CDN + 'build/pdf.min.mjs');
      if (generation !== previewGeneration || !dialog.open) return;
      pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_CDN + 'build/pdf.worker.min.mjs';
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (generation !== previewGeneration || !dialog.open) return;
      pdfPreviewLoading = pdfjs.getDocument({
        data: bytes,
        isEvalSupported: false,
        cMapUrl: PDFJS_CDN + 'cmaps/',
        cMapPacked: true,
        standardFontDataUrl: PDFJS_CDN + 'standard_fonts/',
        wasmUrl: PDFJS_CDN + 'wasm/'
      });
      const doc = await pdfPreviewLoading.promise;
      if (generation !== previewGeneration || !dialog.open) {
        await doc.destroy();
        return;
      }
      pdfPreviewDocument = doc;
      pdfPreviewLoading = null;
      pdfPreviewPage = 1;
      await renderPdfPage();
    } catch (error) {
      if (generation !== previewGeneration || !dialog.open) return;
      console.error('PDF preview:', error);
      dialog.querySelector('.preview-body').innerHTML = '<p class="form-error" role="alert">Nie udało się wczytać podglądu PDF. Sprawdź połączenie z internetem lub pobierz plik.</p>';
      dialog.querySelector('.pdf-pages').hidden = true;
    }
  }
}
