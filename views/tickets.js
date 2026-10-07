'use strict';

function ticketCity(t) {
  return state.locations.find(l => l.mpk === t.mpk)?.city || t.city || 'Inne';
}
function filteredTickets({
  ignoreCity = false,
  ignoreStatus = false
} = {}) {
  const visible = currentTickets(),
    attentionIds = filters.quick === 'attention' && !ignoreStatus ? new Set(attentionItems(visible).map(item => item.ticket.id)) : null;
  return visible.filter(t => (ignoreStatus || !filters.status || (filters.status === 'Zamknięte' ? Model.closed(t) : t.status === filters.status)) && (ignoreStatus || filters.quick !== 'critical' || Model.critical(t)) && (ignoreStatus || filters.quick !== 'active' || t.status !== 'Nowe' && !Model.closed(t)) && (ignoreStatus || filters.quick !== 'waiting' || Model.waiting(t, state.settings.responseHours)) && (!attentionIds || attentionIds.has(t.id)) && (ignoreCity || !filters.city || ticketCity(t) === filters.city) && (!filters.priority || t.priority === filters.priority) && (!filters.q || [t.number, t.previousNumber, t.mpk, t.locationName, t.description, t.category, t.reporter].join(' ').toLocaleLowerCase('pl').includes(filters.q.toLocaleLowerCase('pl'))) && (!filters.from || t.createdAt >= new Date(filters.from + 'T00:00').toISOString()) && (!filters.to || t.createdAt <= new Date(filters.to + 'T23:59:59.999').toISOString()));
}
function activeFilterChips() {
  const quick = {
    critical: 'Krytyczne',
    attention: 'Wymagają działania',
    waiting: 'Bez pierwszej reakcji',
    active: 'W toku'
  };
  const sorts = {
    newest: 'Najnowsze',
    oldest: 'Najstarsze'
  };
  const entries = [['q', filters.q ? 'Szukaj: ' + filters.q : ''], ['status', filters.status], ['city', filters.city], ['priority', filters.priority ? 'Priorytet: ' + filters.priority : ''], ['quick', quick[filters.quick]], ['from', filters.from ? 'Od: ' + dateOnly(filters.from + 'T12:00:00') : ''], ['to', filters.to ? 'Do: ' + dateOnly(filters.to + 'T12:00:00') : ''], ['sort', sorts[filters.sort]]].filter(([, label]) => label);
  return entries.length ? `<div class="filter-chips" aria-label="Aktywne filtry">${entries.map(([key, label]) => `<button type="button" class="filter-chip" data-action="remove-filter" data-filter="${key}" aria-label="Usuń filtr: ${esc(label)}"><span>${esc(label)}</span><span aria-hidden="true">×</span></button>`).join('')}</div>` : '';
}
function filterForm() {
  const advanced = !!filters.priority || filters.sort !== 'urgent',
    active = !!(filters.q || filters.status || filters.city || filters.priority || filters.quick || filters.from || filters.to || filters.sort !== 'urgent');
  return activeFilterChips() + `<form id="filter-form" class="filters simple-filters"><div class="field search-field"><label for="filter-q">Szukaj zgłoszenia</label><input id="filter-q" name="q" value="${esc(filters.q)}" placeholder="Numer, lokal lub opis…"></div><button class="btn" type="submit">Szukaj</button>${active ? '<button class="btn secondary" type="button" data-action="clear-filters">Wyczyść</button>' : ''}<details class="more-filters" ${advanced ? 'open' : ''}><summary><span>Więcej filtrów</span><svg class="filter-toggle-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6l4 4 4-4"/></svg></summary><div class="more-filters-grid"><div class="field"><label for="filter-priority">Priorytet</label><select id="filter-priority" name="priority">${option('', 'Wszystkie priorytety', filters.priority)}${Model.priorities.map(p => option(p, p, filters.priority)).join('')}</select></div><div class="field"><label for="filter-sort">Sortuj</label><select id="filter-sort" name="sort">${option('urgent', 'Według priorytetu', filters.sort || 'urgent')}${option('newest', 'Najnowsze', filters.sort)}${option('oldest', 'Najstarsze', filters.sort)}</select></div></div></details></form>`;
}
function cityFilters(tickets) {
  const groups = new Map();
  for (const t of tickets) groups.set(ticketCity(t), (groups.get(ticketCity(t)) || 0) + 1);
  const sorted = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pl'));
  return `<div class="city-filters" aria-label="Filtruj według miasta"><button type="button" class="city-chip ${!filters.city ? 'active' : ''}" data-action="city-filter" data-city="" aria-pressed="${!filters.city}">Wszystkie miasta <span>${tickets.length}</span></button>${sorted.map(([city, count]) => `<button type="button" class="city-chip ${filters.city === city ? 'active' : ''}" data-action="city-filter" data-city="${esc(city)}" aria-pressed="${filters.city === city}">${esc(city)} <span>${count}</span></button>`).join('')}</div>`;
}
function cityGroups(tickets) {
  const grouped = new Map();
  for (const t of tickets) {
    const city = ticketCity(t);
    if (!grouped.has(city)) grouped.set(city, []);
    grouped.get(city).push(t);
  }
  return [...grouped.entries()].sort((a, b) => filters.sort === 'urgent' ? Math.max(...b[1].map(priorityScore)) - Math.max(...a[1].map(priorityScore)) || a[0].localeCompare(b[0], 'pl') : a[0].localeCompare(b[0], 'pl')).map(([city, items]) => `<section class="city-group"><div class="city-group-heading"><div><span class="city-group-kicker">Miasto</span><h2>${esc(city)}</h2></div><span class="city-group-count">${items.length} ${items.length === 1 ? 'zgłoszenie' : 'zgłoszeń'}</span></div><div class="panel table-panel">${ticketTable(items, 0, false)}</div></section>`).join('');
}
function ticketMonth(value) {
  const day = new Date(value),
    key = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Warsaw',
      year: 'numeric',
      month: '2-digit'
    }).format(day),
    label = new Intl.DateTimeFormat('pl-PL', {
      timeZone: 'Europe/Warsaw',
      year: 'numeric',
      month: 'long'
    }).format(day);
  return {
    key,
    label: label.charAt(0).toLocaleUpperCase('pl') + label.slice(1)
  };
}
function monthGroups(tickets) {
  const grouped = new Map();
  for (const ticket of tickets) {
    const month = ticketMonth(ticket.createdAt);
    if (!grouped.has(month.key)) grouped.set(month.key, {
      label: month.label,
      items: []
    });
    grouped.get(month.key).items.push(ticket);
  }
  const manager = user().role === 'Kierownik lokalu';
  return [...grouped.entries()].sort((a, b) => filters.sort === 'oldest' ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0])).map(([, group]) => `<section class="month-group"><div class="month-group-heading"><h2>${esc(group.label)}</h2><span>${group.items.length} ${group.items.length === 1 ? 'zgłoszenie' : 'zgłoszeń'}</span></div>${manager ? `<div class="panel table-panel">${ticketTable(group.items, 0, false)}</div>` : cityGroups(group.items)}</section>`).join('');
}
function ticketsView() {
  const tickets = filteredTickets(),
    manager = user().role === 'Kierownik lokalu',
    cityBase = manager ? [] : filteredTickets({
      ignoreCity: true
    });
  return header(canManage() ? 'Wszystkie zgłoszenia' : manager ? 'Zgłoszenia lokalu' : 'Moje zgłoszenia', '', btn('new', 'Zgłoś usterkę')) + statsView(currentTickets()) + filterForm() + (manager ? '' : cityFilters(cityBase)) + (tickets.length ? monthGroups(tickets) + `<div class="page-count city-total">Liczba wyników: ${tickets.length}</div>` : `<section class="panel">${empty('Nie znaleziono zgłoszeń', currentTickets().length ? 'Zmień filtry lub wyczyść wyszukiwanie.' : 'Dodaj pierwsze zgłoszenie, aby sprawdzić cały obieg naprawy.', btn('new', 'Zgłoś usterkę'))}</section>`);
}
