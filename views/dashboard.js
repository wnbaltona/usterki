'use strict';

function bars(tickets, key) {
  const groups = new Map();
  for (const t of tickets) {
    const label = key === 'location' ? t.mpk + ' · ' + t.locationName : key === 'city' ? ticketCity(t) : t[key];
    groups.set(label, (groups.get(label) || 0) + 1);
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pl'));
  if (!sorted.length) return '<p class="report-copy chart-empty">Brak zgłoszeń w wybranym okresie.</p>';
  const max = sorted[0][1];
  const row = ([label, n]) => `<div class="bar-row"><span class="bar-label">${esc(label)}</span><span class="bar-track" aria-hidden="true"><span class="bar-fill" style="display:block;width:${n / max * 100}%"></span></span><strong>${n}</strong></div>`;
  return sorted.slice(0, 7).map(row).join('') + (sorted.length > 7 ? `<details class="chart-more"><summary>Pozostałe pozycje (${sorted.length - 7})</summary>${sorted.slice(7).map(row).join('')}</details>` : '');
}
function dashboardStartDate() {
  if (dashboardRange === 'all') return '';
  const start = new Date();
  start.setDate(start.getDate() - (Number(dashboardRange) - 1));
  return scheduleDateKey(start);
}
function dashboardView() {
  if (!isAdmin()) return '';
  const all = currentTickets(),
    from = dashboardStartDate();
  const tickets = from ? all.filter(t => t.createdAt >= new Date(from + 'T00:00').toISOString()) : all;
  const m = Model.metrics(tickets, Date.now(), state.settings.responseHours);
  const ranges = [['30', '30 dni'], ['90', '90 dni'], ['all', 'Cały okres']];
  const charts = tickets.length ? `<div class="chart-grid"><section class="panel"><div class="block-heading"><h3>Miasta</h3></div>${bars(tickets, 'city')}</section><section class="panel"><div class="block-heading"><h3>Lokale i magazyny</h3></div>${bars(tickets, 'location')}</section></div>` : `<div class="panel dashboard-empty">${icon('chart')}<p>Brak zgłoszeń w tym okresie</p></div>`;
  return `<div class="heading dashboard-heading"><div><h1>Dashboard</h1><p>${from ? 'Od ' + dateOnly(from + 'T12:00:00') : 'Cały okres'}</p></div><div class="dashboard-range" role="group" aria-label="Okres podsumowania">${ranges.map(([key, label]) => `<button type="button" class="${dashboardRange === key ? 'active' : ''}" data-action="dashboard-range" data-range="${key}" aria-pressed="${dashboardRange === key}">${label}</button>`).join('')}</div></div>` + `<section class="dashboard-section dashboard-overview" aria-label="Podsumowanie zgłoszeń">${statsView(tickets)}<div class="dashboard-insight"><div title="Średni czas od utworzenia do zamknięcia zgłoszenia, bez zgłoszeń odrzuconych"><span>Średni czas realizacji</span><strong>${m.meanHours === null ? '—' : m.meanHours.toLocaleString('pl-PL', {
    maximumFractionDigits: 1
  }) + ' h'}</strong></div><button type="button" data-action="dashboard-waiting" aria-label="Pokaż ${m.waiting} zgłoszeń bez pierwszej reakcji, ponad ${state.settings.responseHours} godzin"><span>Bez pierwszej reakcji <small>ponad ${state.settings.responseHours} h</small></span><strong>${m.waiting}</strong><span class="dashboard-metric-arrow" aria-hidden="true">→</span></button></div></section>` + `<section class="dashboard-section"><div class="dashboard-section-head"><h2>Rozkład zgłoszeń</h2></div>${charts}</section>`;
}
