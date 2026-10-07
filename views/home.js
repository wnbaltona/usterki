'use strict';

function attentionItems(tickets) {
  const today = scheduleDateKey(new Date()),
    lastComments = new Map();
  for (const comment of state.comments) {
    const previous = lastComments.get(comment.ticketId);
    if (!previous || comment.createdAt > previous.createdAt) lastComments.set(comment.ticketId, comment);
  }
  return tickets.filter(t => !Model.closed(t)).map(ticket => {
    const reasons = [];
    if (ticket.dueAt && scheduleDateKey(ticket.dueAt) < today) reasons.push(['Po terminie', 'late']);
    if (ticket.status === 'Nowe') reasons.push(['Nowe', '']);
    if (!ticket.dueAt) reasons.push(['Bez terminu', '']);
    const last = lastComments.get(ticket.id);
    if (last && ['Użytkownik', 'Kierownik lokalu'].includes(last.role) && ticket.status !== 'Nowe' && ticket.status !== 'Oczekuje na informację') reasons.push(['Odpowiedź lokalu', '']);
    return {
      ticket,
      reasons
    };
  }).filter(item => item.reasons.length).sort((a, b) => Number(b.reasons.some(r => r[1] === 'late')) - Number(a.reasons.some(r => r[1] === 'late')) || priorityScore(b.ticket) - priorityScore(a.ticket) || b.ticket.updatedAt.localeCompare(a.ticket.updatedAt));
}
function homeAttention(tickets) {
  const items = attentionItems(tickets);
  return `<section class="panel table-panel home-followup"><div class="block-heading"><h2>Wymagają działania</h2><button class="btn secondary small" type="button" data-action="attention-all">Pokaż wszystkie (${items.length})</button></div>${items.length ? `<div class="attention-list">${items.slice(0, 6).map(({
    ticket,
    reasons
  }) => `<article class="attention-item"><div><strong>${esc(ticket.number)} · ${esc(ticket.mpk)} · ${esc(ticket.locationName)}</strong><small>${esc(ticket.category)} · ${esc(ticketCity(ticket))}</small><div class="attention-tags">${reasons.map(([label, kind]) => `<span class="${kind}">${label}</span>`).join('')}</div></div><button class="btn secondary small" type="button" data-action="detail" data-id="${esc(ticket.id)}" aria-label="Otwórz ${esc(ticket.number)}">Otwórz</button></article>`).join('')}</div>` : '<div class="schedule-empty">Nie ma zgłoszeń wymagających pilnej reakcji.</div>'}</section>`;
}
function homeView() {
  const list = currentTickets(),
    m = Model.metrics(list),
    cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recent = list.filter(t => !Model.closed(t) && Date.parse(t.createdAt) >= cutoff);
  const older = list.filter(t => !Model.closed(t) && Date.parse(t.createdAt) < cutoff);
  return `<div class="home-toolbar"><h1>Zgłoszenia</h1><div class="home-summary" aria-label="Podsumowanie zgłoszeń"><div><span>Otwarte</span><strong>${list.filter(t => !Model.closed(t)).length}</strong></div><div><span>W toku</span><strong>${m.progress}</strong></div><div class="attention"><span>Zamknięte</span><strong>${m.finished}</strong></div></div>${btn('new', 'Zgłoś usterkę')}</div>` + (canManage() ? homeAttention(list) : '') + `<section class="panel table-panel recent-panel"><div class="block-heading"><h2>Zgłoszenia z ostatnich 24 h</h2><button class="btn secondary" type="button" data-action="nav" data-page="tickets">Wszystkie zgłoszenia <span aria-hidden="true">→</span></button></div>${recent.length ? ticketTable(recent, 0, false) : empty('Brak nowych zgłoszeń', 'Pozostałe zgłoszenia znajdziesz na liście.')}</section>` + (older.length ? `<section class="panel table-panel recent-panel space-top"><div class="block-heading"><h2>Starsze otwarte zgłoszenia (${older.length})</h2><button class="btn secondary" type="button" data-action="nav" data-page="tickets">Pokaż wszystkie <span aria-hidden="true">→</span></button></div>${ticketTable(older, 5, false)}</section>` : '');
}
