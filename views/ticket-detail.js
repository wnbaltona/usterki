'use strict';

function syncClosingFields() {
  const status = $('#m-status')?.value;
  if (!status) return;
  const ending = status === 'Zamknięte' || status === 'Odrzucone',
    rejected = status === 'Odrzucone';
  $('#closing-fields').hidden = !ending;
  const field = $('#m-closing');
  field.disabled = !ending;
  field.required = ending;
  $('#closing-label').textContent = rejected ? 'Powód odrzucenia *' : 'Komentarz zamknięcia *';
  field.placeholder = rejected ? 'Dlaczego zgłoszenie jest odrzucane?' : 'Jak rozwiązano problem?';
  $('#closing-hint').textContent = rejected ? 'Podaj krótko powód odrzucenia.' : 'Krótko opisz wykonane prace.';
  const submit = $('#manage-submit');
  submit.textContent = ending ? rejected ? 'Potwierdź odrzucenie' : 'Potwierdź zamknięcie' : 'Zapisz zmiany';
  submit.classList.toggle('danger', rejected);
}
function inputDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function duePlanHint(t) {
  const target = suggestedDeadline(t);
  return Date.parse(target) < Date.now() ? `Sugerowany termin minął: ${date(target)} (${targetHours(t.priority, t.blocksSales)} h od zgłoszenia). Ustal realny dzień zakończenia.` : `Sugerowany termin: ${date(target)} (${targetHours(t.priority, t.blocksSales)} h od zgłoszenia).`;
}
function updateDueSuggestion() {
  const ticket = state.tickets.find(t => t.id === selectedTicket),
    priority = $('#m-priority')?.value,
    label = $('#due-suggestion-text'),
    button = $('#use-suggested-date');
  if (!ticket || !priority || !label) return;
  const draft = {
    ...ticket,
    priority
  };
  label.textContent = duePlanHint(draft);
  if (button) button.hidden = Date.parse(suggestedDeadline(draft)) < Date.now();
}
function activityPanel(t) {
  const events = (state.events || []).filter(e => e.ticketId === t.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return `<section class="panel space-top activity-panel"><h3>Historia zmian</h3>${events.map(e => `<div class="activity-item"><span class="activity-date">${date(e.createdAt)}</span><div><strong>${esc(e.actorName)}</strong><p>${esc(e.text)}</p></div></div>`).join('') || '<p class="report-copy">Brak zapisanych zmian.</p>'}</section>`;
}
function progressPanel(t) {
  const finished = Model.closed(t),
    inWork = !!t.firstResponseAt || ['W realizacji', 'Oczekuje na naprawę', 'Zamknięte', 'Odrzucone'].includes(t.status);
  const current = finished ? 3 : t.status === 'Nowe' ? 1 : 2;
  const milestone = (kind, label, info, complete) => `<li class="progress-step ${complete ? 'complete' : 'pending'} ${Number(kind) === current ? 'is-current' : ''}" ${Number(kind) === current ? 'aria-current="step"' : ''}><span class="progress-step-mark" aria-hidden="true">${kind}</span><span><strong>${label}${Number(kind) === current ? '<span class="current-step-label">Aktualny etap</span>' : ''}</strong><small>${info}</small></span></li>`;
  return `<section class="panel detail-status-panel"><div class="progress-head"><span class="info-mark">${icon(finished ? 'check' : 'clock')}</span><div><h3>Postęp naprawy</h3></div></div><ol class="progress-steps" aria-label="Etapy zgłoszenia">${milestone('1', 'Usterka zgłoszona', date(t.createdAt), true)}${milestone('2', 'Obsługa usterki', current === 2 ? esc(t.status) + (t.firstResponseAt ? ' · ' + date(t.firstResponseAt) : '') : inWork ? t.firstResponseAt ? date(t.firstResponseAt) : 'Rozpoczęto obsługę' : 'Do podjęcia przez koordynatora', inWork)}${milestone('3', t.status === 'Odrzucone' ? 'Zgłoszenie odrzucone' : t.status === 'Zamknięte' ? 'Zgłoszenie zamknięte' : 'Zamknięcie zgłoszenia', finished ? date(t.closedAt) : 'Po zakończeniu prac', finished)}</ol><dl class="progress-meta"><div class="planned-term"><dt>Termin planowany</dt><dd class="${Model.overdue(t) ? 'danger-text' : ''}">${t.dueAt ? dateOnly(t.dueAt) : 'Nie ustalono'}</dd></div><div><dt>Ostatnia aktualizacja</dt><dd>${date(t.updatedAt)}</dd></div></dl>${canClose(t) && !finished ? `<button class="btn secondary manager-close" type="button" data-action="quick-close" data-id="${esc(t.id)}">${canManage() ? 'Zamknij zgłoszenie' : 'Zamknij z załącznikiem'}</button>` : ''}</section>`;
}
function commentReplyOption(ticket) {
  return canManage() && !Model.closed(ticket) ? '<label class="comment-status-choice"><input type="checkbox" name="needsReply"> Oczekuję odpowiedzi od lokalu</label>' : '';
}
function detailAttachmentRow(t, f) {
  return `<div class="file-row">${icon('clip')}<span class="file-name">${esc(f.name)}<br><small>${sizeFmt(f.size)}${f.purpose === 'closure' ? ' · Załącznik zamknięcia' : ''}</small></span><div class="attachment-actions"><button class="btn secondary small" type="button" data-action="preview-file" data-id="${esc(f.id)}" aria-label="Podgląd: ${esc(f.name)}">Podgląd</button><button class="btn secondary small" type="button" data-action="download-file" data-id="${esc(f.id)}">Pobierz</button>${canRemoveAttachment(t, f) ? `<button class="btn secondary small attachment-remove" type="button" data-action="remove-attachment" data-id="${esc(f.id)}" aria-label="Usuń załącznik: ${esc(f.name)}">Usuń</button>` : ''}</div></div>`;
}
function detailView(t) {
  const ticketFiles = t.attachments.filter(f => f.purpose !== 'comment');
  const comments = state.comments.filter(c => c.ticketId === t.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return `<div class="dialog-head"><div><p>${esc(t.city)} · ${esc(t.mpk)} · ${esc(t.locationName)}</p><h2 id="dialog-title">${esc(t.number)}</h2>${statusPill(t.status)} ${priorityPill(t.priority)}${t.blocksSales ? ' <span class="pill high">Blokuje sprzedaż</span>' : ''}</div><button class="close-dialog" data-action="close-dialog" aria-label="Zamknij szczegóły">✕</button></div><div class="dialog-body"><div class="detail-grid ${Model.closed(t) ? 'closed-layout' : ''}"><div><section class="panel"><h3>${esc(t.category)}</h3><p class="detail-description">${esc(t.description)}</p><dl class="detail-meta"><div><dt>Zgłaszający</dt><dd>${esc(t.reporter)}</dd></div><div><dt>Telefon kontaktowy</dt><dd>${t.reporterPhone ? `<a href="tel:${esc(t.reporterPhone.replace(/[^+\d]/g, ''))}">${esc(t.reporterPhone)}</a>` : 'Nie podano'}</dd></div><div><dt>Data zgłoszenia</dt><dd>${date(t.createdAt)}</dd></div>${canManage() ? `<div><dt>E-mail profilu</dt><dd>${esc(t.reporterEmail)}</dd></div>` : ''}<div class="planned-term"><dt>Termin planowany</dt><dd class="${Model.overdue(t) ? 'danger-text' : ''}">${t.dueAt ? dateOnly(t.dueAt) : 'Nie ustalono'}</dd></div>${t.closedAt ? `<div><dt>Data zakończenia</dt><dd>${date(t.closedAt)}</dd></div>` : ''}</dl>${t.closingComment ? `<div class="summary-box"><strong>${t.status === 'Odrzucone' ? 'Powód odrzucenia' : 'Komentarz zamknięcia'}</strong><p class="detail-description">${esc(t.closingComment)}</p></div>` : ''}<h3>Załączniki zgłoszenia (${ticketFiles.length})</h3>${ticketFiles.length ? ticketFiles.map(f => detailAttachmentRow(t, f)).join('') : '<p class="report-copy">Nie dodano załączników.</p>'}</section><section class="panel space-top"><h3>Komentarze (${comments.length})</h3>${comments.map(c => `<article class="comment"><div class="comment-top"><strong>${esc(c.authorName)} · ${esc(c.role)}</strong><div class="comment-meta"><time>${date(c.createdAt)}</time>${c.editedAt ? `<span>Edytowano ${date(c.editedAt)}</span>` : ''}</div></div>${editingCommentId === c.id ? `<form id="comment-edit-form" class="comment-edit-form" data-id="${esc(c.id)}"><label for="comment-edit-text">Edytuj komentarz</label><textarea id="comment-edit-text" name="text" maxlength="5000">${esc(c.text)}</textarea><div class="comment-edit-actions"><button class="btn small" type="submit">Zapisz</button><button class="btn secondary small" type="button" data-action="cancel-comment-edit">Anuluj</button></div></form>` : c.text ? `<p>${esc(c.text)}</p>` : ''}${(c.attachmentIds || []).map(id => t.attachments.find(f => f.id === id)).filter(Boolean).map(f => detailAttachmentRow(t, f)).join('')}${canEditComment(c) && editingCommentId !== c.id ? `<div class="comment-actions"><button class="btn secondary small" type="button" data-action="edit-comment" data-id="${esc(c.id)}">Edytuj</button><button class="btn secondary small comment-delete" type="button" data-action="delete-comment" data-id="${esc(c.id)}">Usuń</button></div>` : ''}</article>`).join('') || '<p class="report-copy">Brak komentarzy</p>'}<form id="comment-form" class="comment-form" style="${editingCommentId ? 'display:none' : ''}"><label class="sr-only" for="comment-text">Treść komentarza</label><textarea id="comment-text" name="text" maxlength="5000" placeholder="Napisz komentarz…"></textarea><div class="comment-attach"><label for="comment-attachments" class="btn secondary small">${icon('clip')} Dodaj załącznik</label><input id="comment-attachments" type="file" accept=".jpg,.jpeg,.png,.pdf" multiple><span>JPG, PNG lub PDF · maks. ${state.settings.maxFiles} plików po ${state.settings.maxMB} MB</span><div id="comment-draft-files" aria-live="polite"></div></div>${commentReplyOption(t)}<button class="btn comment-send" type="submit" aria-label="Wyślij komentarz" title="Wyślij komentarz"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg></button></form></section></div><aside>${canManage() && !Model.closed(t) ? `<form id="manage-form" class="panel detail-control"><h3>Obsługa zgłoszenia</h3><div class="field"><label for="m-status">Status</label><select id="m-status" name="status">${Model.statuses.filter(s => s !== 'Zamknięte' && (canClose() || s !== 'Odrzucone')).map(s => option(s, s === 'Zamknięte' ? 'Zamknij zgłoszenie' : s === 'Odrzucone' ? 'Odrzuć zgłoszenie' : s, t.status)).join('')}</select></div><div class="field"><label for="m-priority">Priorytet</label><select id="m-priority" name="priority">${Model.priorities.map(p => option(p, p, t.priority)).join('')}</select></div><div class="field"><label for="m-due">Planowany dzień realizacji</label><input id="m-due" type="date" name="dueAt" value="${inputDate(t.dueAt)}"><div class="due-suggestion"><span id="due-suggestion-text">${duePlanHint(t)}</span><button id="use-suggested-date" type="button" class="btn secondary" data-action="use-suggested-date" ${Date.parse(suggestedDeadline(t)) < Date.now() ? 'hidden' : ''}>Wstaw sugerowany dzień</button></div></div><div id="closing-fields" class="closing-fields" hidden><div class="field"><label id="closing-label" for="m-closing">Komentarz</label><textarea id="m-closing" name="closingComment" maxlength="5000" rows="3" disabled aria-describedby="closing-hint"></textarea><p class="hint" id="closing-hint"></p></div><p class="closing-warning">Po zatwierdzeniu dane obsługi zostaną zablokowane. Nadal będzie można dodawać komentarze.</p></div><button id="manage-submit" class="btn" type="submit">Zapisz zmiany</button>${canClose(t) ? `<button type="button" class="btn secondary" data-action="quick-close" data-id="${esc(t.id)}">${canManage() ? 'Zamknij zgłoszenie' : 'Zamknij z załącznikiem'}</button>` : ''}</form>` : progressPanel(t)}${isAdmin() ? activityPanel(t) : ''}</aside></div></div>`;
}
function openDetail(id) {
  const t = currentTickets().find(t => t.id === id);
  if (!t) throw Error('Zgłoszenie nie jest dostępne w tym profilu.');
  if (selectedTicket !== id) {
    commentDraftFiles = [];
    editingCommentId = null;
  }
  selectedTicket = id;
  detailDirty = false;
  const dialog = $('#detail-dialog');
  dialog.innerHTML = detailView(t);
  renderCommentDraftFiles();
  if (!dialog.open) dialog.showModal();
}
async function openTicket(id) {
  rememberTicketList();
  const ticket = currentTickets().find(t => t.id === id);
  if (!ticket) throw Error('Zgłoszenie nie jest dostępne w tym profilu.');
  if (user().role === 'Koordynator' && ticket.status === 'Nowe') {
    const now = new Date().toISOString();
    await mutate(next => {
      const item = next.tickets.find(t => t.id === id);
      if (item && item.status === 'Nowe') {
        item.status = 'W realizacji';
        item.firstResponseAt ||= now;
        item.updatedAt = now;
      }
    });
    shell(true);
  }
  openDetail(id);
}
