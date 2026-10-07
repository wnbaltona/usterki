'use strict';

function shell(restorePosition = false) {
  const u = user();
  if (!u) {
    showNoAccess();
    return;
  }
  const listLabel = canManage() ? 'Wszystkie zgłoszenia' : user().role === 'Kierownik lokalu' ? 'Zgłoszenia lokalu' : 'Moje zgłoszenia';
  const nav = [['home', 'home', 'Zgłoszenia'], ['new', 'plus', 'Dodaj zgłoszenie'], ['tickets', 'list', listLabel]];
  if (canManage()) nav.push(['schedule', 'clock', 'Harmonogram']);
  if (isAdmin()) nav.push(['dashboard', 'chart', 'Dashboard'], ['admin', 'settings', 'Administracja']);
  if (page === 'schedule' && !canManage() || ['dashboard', 'admin'].includes(page) && !isAdmin()) page = 'home';
  $('#navigation').style.setProperty('--nav-count', nav.length);
  $('#navigation').innerHTML = nav.map(([id, ic, label]) => `<button class="nav-button ${page === id ? 'active' : ''}" data-action="nav" data-page="${id}" aria-label="${label}" ${page === id ? 'aria-current="page"' : ''}>${icon(ic)}<span class="nav-desktop-label">${label}</span><span class="nav-mobile-label" aria-hidden="true">${{
    home: 'Start',
    new: 'Zgłoś',
    tickets: 'Lista',
    schedule: 'Terminy',
    dashboard: 'Raporty',
    admin: 'Ustawienia'
  }[id]}</span></button>`).join('');
  if ($('#profile-select')) {
    const select = $('#profile-select'),
      real = signedInProfile();
    select.disabled = !canPreviewProfiles();
    select.innerHTML = (canPreviewProfiles() ? [real, ...testProfiles()] : [u]).map(x => option(x.id, x.id === real?.id ? 'Moje konto · ' + x.name : x.role + ' · ' + x.name, u.id)).join('');
    const label = document.querySelector('label[for="profile-select"]');
    if (label) {
      label.textContent = 'Widok konta';
      label.hidden = !canPreviewProfiles();
    }
    select.hidden = !canPreviewProfiles();
    const accountButton = $('#admin-account-button');
    if (accountButton) accountButton.hidden = false;
    const summary = $('#account-summary');
    if (summary) {
      summary.hidden = canPreviewProfiles();
      summary.textContent = 'Twoje konto: ' + u.name;
    }
  }
  $('#profile-name').textContent = u.name;
  $('#profile-role').textContent = u.role;
  $('#content').dataset.page = page;
  $('#content').innerHTML = page === 'home' ? homeView() : page === 'new' ? newView() : page === 'tickets' ? ticketsView() : page === 'schedule' ? scheduleView() : page === 'dashboard' ? dashboardView() : adminView();
  if (previewProfileId) $('#content').insertAdjacentHTML('afterbegin', '<div class="warning" role="status">Podgląd konta testowego — ' + esc(u.role) + '. Zapis zmian jest wyłączony. Aby wrócić, wybierz „Moje konto” w przełączniku widoku.</div>');
  if (page === 'new') renderDraftFiles();
  refreshNotificationsUI();
  if (restorePosition) restoreTicketList();
}
function statsView(tickets, interactive = true) {
  const m = Model.metrics(tickets);
  const cards = [['all', 'Wszystkie zgłoszenia', m.total, 'list'], ['new', 'Nowe', m.fresh, 'plus'], ['progress', 'W toku', m.progress, 'clock'], ['closed', 'Zamknięte', m.finished, 'check'], ['critical', 'Krytyczne', m.critical, 'alert']];
  return `<div class="stats ${interactive ? '' : 'static-stats'}" aria-label="${interactive ? 'Filtry zgłoszeń' : 'Podsumowanie zgłoszeń'}">${cards.map(([key, label, n, ic]) => {
    const content = `<span class="stat-top"><span class="stat-label">${label}</span>${icon(ic)}</span><strong>${n}</strong>`;
    const selected = page === 'tickets' && (key === 'critical' ? filters.quick === 'critical' : key === 'progress' ? filters.quick === 'active' : key === 'all' ? !filters.status && !filters.quick : filters.status === {
      new: 'Nowe',
      closed: 'Zamknięte'
    }[key] && !filters.quick);
    return interactive ? `<button type="button" class="stat ${key === 'critical' ? 'alert' : ''} ${selected ? 'selected' : ''}" aria-pressed="${selected}" data-action="stat-filter" data-filter="${key}" aria-label="Pokaż ${label.toLowerCase()}: ${n}">${content}</button>` : `<div class="stat ${key === 'critical' ? 'alert' : ''}">${content}</div>`;
  }).join('')}</div>`;
}
function ticketTable(tickets, limit = 0, showCount = true) {
  if (!tickets.length) return empty('Brak zgłoszeń', 'Pierwsze zgłoszenie pojawi się tutaj po wysłaniu formularza.', btn('new', 'Zgłoś usterkę'));
  const managerTickets = page === 'tickets' && user().role === 'Kierownik lokalu';
  const mode = page === 'tickets' ? filters.sort || 'urgent' : 'urgent';
  const sorted = [...tickets].sort((a, b) => {
    if (mode === 'urgent') {
      const diff = priorityScore(b) - priorityScore(a);
      if (diff) return diff;
    }
    const byDate = b.createdAt.localeCompare(a.createdAt);
    return (mode === 'oldest' ? -byDate : byDate) || a.number.localeCompare(b.number);
  });
  const rows = limit ? sorted.slice(0, limit) : sorted;
  return `<div class="table-scroll"><table class="tickets-table"><thead><tr><th scope="col">Numer / data</th><th scope="col">${managerTickets ? 'Lokal' : 'Lokal / miasto'}</th><th scope="col">Rodzaj usterki</th><th scope="col">Priorytet</th><th scope="col">Status</th><th scope="col">Termin</th><th scope="col">Działania</th></tr></thead><tbody>${rows.map(t => `<tr><td data-label="Zgłoszenie"><strong class="ticket-number">${esc(t.number)}</strong><span class="cell-sub">${date(t.createdAt)}</span></td><td data-label="Obiekt"><span class="cell-main" title="${esc(t.mpk)} · ${esc(t.locationName)}">${esc(t.mpk)} · ${esc(t.locationName)}</span>${managerTickets ? '' : `<span class="cell-sub">${esc(ticketCity(t))}${t.location && t.location !== ticketCity(t) ? ' · ' + esc(t.location) : ''}</span>`}</td><td data-label="Usterka"><span class="cell-main" title="${esc(t.category)}">${esc(t.category)}</span></td><td data-label="Alert">${priorityPill(t.priority)}${t.blocksSales ? '<span class="cell-sub danger-text">Blokuje sprzedaż</span>' : ''}</td><td data-label="Status">${statusPill(t.status)}</td><td data-label="Termin">${dueCell(t)}</td><td data-label="Działanie"><div class="ticket-actions"><button class="btn secondary small" data-action="detail" data-id="${esc(t.id)}" aria-label="Szczegóły ${esc(t.number)}">Otwórz</button>${canClose(t) && !Model.closed(t) ? `<button class="btn quick-close-btn small" type="button" data-action="quick-close" data-id="${esc(t.id)}" aria-label="Szybko zamknij ${esc(t.number)}">Zamknij</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>${!limit && showCount ? `<div class="page-count">Liczba wyników: ${rows.length}</div>` : ''}`;
}
