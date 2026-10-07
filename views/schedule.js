'use strict';

function scheduleRow(ticket, unplanned = false) {
  return `<div class="schedule-row"><div><strong>${esc(ticket.number)}</strong><small>${date(ticket.createdAt)}</small></div><div class="schedule-location"><strong>${esc(ticket.mpk)} · ${esc(ticket.locationName)}</strong><small>${esc(ticketCity(ticket))}</small></div><div class="schedule-category"><strong>${esc(ticket.category)}</strong></div><div class="schedule-state">${priorityPill(ticket.priority)} ${statusPill(ticket.status)}</div><button class="btn secondary small" type="button" data-action="detail" data-id="${esc(ticket.id)}">${unplanned ? 'Ustaw termin' : 'Otwórz'}</button></div>`;
}
function scheduleDays(tickets, today) {
  const groups = new Map();
  for (const ticket of tickets) {
    const key = scheduleDateKey(ticket.dueAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(ticket);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, items]) => {
    items.sort((a, b) => priorityScore(b) - priorityScore(a) || a.number.localeCompare(b.number, 'pl'));
    const label = new Intl.DateTimeFormat('pl-PL', {
      timeZone: 'Europe/Warsaw',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date(items[0].dueAt));
    return `<section class="panel schedule-day ${key < today ? 'is-late' : ''}"><div class="schedule-day-heading"><h3>${esc(label)}${key === today ? ' · Dzisiaj' : ''}${key < today ? ' · Po terminie' : ''}</h3><small>${items.length} ${items.length === 1 ? 'zgłoszenie' : 'zgłoszeń'}</small></div>${items.map(ticket => scheduleRow(ticket)).join('')}</section>`;
  }).join('');
}
function scheduleCalendar(planned, today, overdueCount) {
  const [year, month] = scheduleMonth.split('-').map(Number);
  const monthName = new Intl.DateTimeFormat('pl-PL', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Warsaw'
  }).format(new Date(Date.UTC(year, month - 1, 15, 12)));
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const counts = new Map();
  for (const ticket of planned) {
    const key = scheduleDateKey(ticket.dueAt);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const cells = Array.from({
    length: firstWeekday
  }, () => '<span aria-hidden="true"></span>');
  for (let day = 1; day <= dayCount; day++) {
    const key = `${scheduleMonth}-${String(day).padStart(2, '0')}`,
      count = counts.get(key) || 0;
    cells.push(`<button type="button" class="${key === today ? 'today ' : ''}${key === scheduleSelectedDay ? 'selected ' : ''}${key < today && count ? 'overdue' : ''}" data-action="schedule-day" data-day="${key}" aria-pressed="${key === scheduleSelectedDay}" aria-label="${day} ${esc(monthName)}: ${count} ${count === 1 ? 'zgłoszenie' : 'zgłoszeń'}"><span>${day}</span>${count ? `<strong>${count}</strong>` : ''}</button>`);
  }
  const selected = planned.filter(ticket => scheduleDateKey(ticket.dueAt) === scheduleSelectedDay).sort((a, b) => priorityScore(b) - priorityScore(a) || a.number.localeCompare(b.number, 'pl'));
  const selectedLabel = new Intl.DateTimeFormat('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Warsaw'
  }).format(new Date(scheduleSelectedDay + 'T12:00:00Z'));
  return `<div class="schedule-calendar-layout"><section class="panel schedule-calendar" aria-label="Kalendarz terminów"><div class="schedule-calendar-toolbar"><button type="button" data-action="schedule-prev" aria-label="Poprzedni miesiąc">‹</button><h2>${esc(monthName)}</h2><button type="button" data-action="schedule-next" aria-label="Następny miesiąc">›</button></div><div class="schedule-weekdays" aria-hidden="true"><span>Pn</span><span>Wt</span><span>Śr</span><span>Cz</span><span>Pt</span><span>Sb</span><span>Nd</span></div><div class="schedule-calendar-grid">${cells.join('')}</div></section><section class="panel schedule-calendar-results" aria-live="polite"><div class="schedule-day-heading"><h3>${esc(selectedLabel)}${scheduleSelectedDay === today ? ' · Dzisiaj' : ''}</h3><small>${selected.length} ${selected.length === 1 ? 'zgłoszenie' : 'zgłoszeń'}</small></div>${selected.length ? selected.map(ticket => scheduleRow(ticket)).join('') : '<div class="schedule-empty">Na ten dzień nie zaplanowano zgłoszeń.</div>'}</section></div>${overdueCount ? `<p class="schedule-calendar-note">Po terminie: ${overdueCount}. Przełącz na listę, aby zobaczyć wszystkie zaległe terminy.</p>` : ''}`;
}
function scheduleView() {
  if (!canManage()) return empty('Widok niedostępny', 'Harmonogram jest dostępny dla koordynatora i administratora.');
  const open = currentTickets().filter(ticket => !Model.closed(ticket));
  const today = scheduleDateKey(new Date());
  const planned = open.filter(ticket => ticket.dueAt && Number.isFinite(Date.parse(ticket.dueAt)));
  const overdue = planned.filter(ticket => scheduleDateKey(ticket.dueAt) < today);
  const dueToday = planned.filter(ticket => scheduleDateKey(ticket.dueAt) === today);
  const upcoming = planned.filter(ticket => scheduleDateKey(ticket.dueAt) >= today);
  const unplanned = open.filter(ticket => !ticket.dueAt || !Number.isFinite(Date.parse(ticket.dueAt))).sort((a, b) => priorityScore(b) - priorityScore(a) || a.createdAt.localeCompare(b.createdAt));
  const unplannedSection = `<section class="schedule-section"><h2>Wymagają ustalenia terminu</h2><p>Otwórz zgłoszenie, aby ustawić planowany dzień realizacji.</p>${unplanned.length ? `<div class="panel schedule-day">${unplanned.map(ticket => scheduleRow(ticket, true)).join('')}</div>` : '<div class="panel schedule-empty">Wszystkie otwarte zgłoszenia mają planowany termin.</div>'}</section>`;
  const summary = [['overdue', 'Po terminie', overdue.length], ['today', 'Na dziś', dueToday.length], ['planned', 'Z terminem', planned.length], ['unplanned', 'Bez terminu', unplanned.length]];
  const filteredPlanned = scheduleFilter === 'overdue' ? overdue : scheduleFilter === 'today' ? dueToday : scheduleFilter === 'unplanned' ? [] : planned;
  const overdueSection = `<section class="schedule-section"><h2>Po terminie</h2>${overdue.length ? scheduleDays(overdue, today) : '<div class="panel schedule-empty">Brak zgłoszeń po terminie.</div>'}</section>`;
  const upcomingSection = `<section class="schedule-section"><h2>Nadchodzące terminy</h2>${upcoming.length ? scheduleDays(upcoming, today) : '<div class="panel schedule-empty">Brak zaplanowanych terminów.</div>'}</section>`;
  const todaySection = `<section class="schedule-section"><h2>Na dziś</h2>${dueToday.length ? scheduleDays(dueToday, today) : '<div class="panel schedule-empty">Na dziś nie ma zaplanowanych zgłoszeń.</div>'}</section>`;
  const listSections = scheduleFilter === 'overdue' ? overdueSection : scheduleFilter === 'today' ? todaySection : scheduleFilter === 'unplanned' ? unplannedSection : overdueSection + upcomingSection + (scheduleFilter === 'all' ? unplannedSection : '');
  return header('Harmonogram', 'Planowane terminy otwartych zgłoszeń. Zmiana terminu w zgłoszeniu od razu aktualizuje ten widok.') + `<div class="schedule-summary" aria-label="Filtry harmonogramu">${summary.map(([key, label, count]) => `<button type="button" class="panel ${key === 'overdue' ? 'is-late' : ''} ${scheduleFilter === key ? 'active' : ''}" data-action="schedule-filter" data-filter="${key}" aria-pressed="${scheduleFilter === key}" aria-label="${label}: ${count}. ${scheduleFilter === key ? 'Wyczyść filtr' : 'Pokaż zgłoszenia'}"><span>${label}</span><strong>${count}</strong></button>`).join('')}</div>` + `<div class="schedule-view-switch" role="group" aria-label="Widok harmonogramu"><button type="button" class="${scheduleMode === 'list' ? 'active' : ''}" data-action="schedule-mode" data-mode="list" aria-pressed="${scheduleMode === 'list'}">Lista</button><button type="button" class="${scheduleMode === 'calendar' ? 'active' : ''}" data-action="schedule-mode" data-mode="calendar" aria-pressed="${scheduleMode === 'calendar'}">Kalendarz</button></div>` + (scheduleMode === 'calendar' ? scheduleFilter === 'unplanned' ? '<div class="panel schedule-empty space-top">Zgłoszenia bez terminu nie mają daty w kalendarzu. Ustaw termin w wybranym zgłoszeniu.</div>' + unplannedSection : scheduleCalendar(filteredPlanned, today, scheduleFilter === 'all' ? overdue.length : 0) + (scheduleFilter === 'all' ? unplannedSection : '') : listSections);
}
