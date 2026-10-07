'use strict';

// Popover korzysta z warstwy przeglądarki ponad dialogami, a nie tylko z-index.
function placeToastLayer() {
  const layer = document.getElementById('toasts');
  if (!layer || !layer.children.length) return;
  const modals = Array.from(document.querySelectorAll('dialog[open]'));
  const modal = modals.reverse().find(d => {
    try {
      return d.matches(':modal');
    } catch {
      return true;
    }
  });
  const parent = modal || document.body;
  if (layer.parentElement !== parent) parent.append(layer);
  if (typeof layer.showPopover === 'function') {
    layer.setAttribute('popover', 'manual');
    try {
      if (layer.matches(':popover-open')) layer.hidePopover();
      layer.showPopover();
    } catch {}
  }
}
function mountToastAboveDialogs(node) {
  let layer = document.getElementById('toasts');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'toasts';
    layer.className = 'toast-container';
    layer.setAttribute('aria-live', 'polite');
    document.body.append(layer);
  }
  layer.append(node);
  placeToastLayer();
}
// Zmiana aktualnie otwartego okna nie chowa już widocznego komunikatu.
let toastLayerPending = false;
new MutationObserver(records => {
  if (!records.some(r => r.type === 'attributes' && r.target.tagName === 'DIALOG') || toastLayerPending) return;
  toastLayerPending = true;
  queueMicrotask(() => {
    toastLayerPending = false;
    placeToastLayer();
  });
}).observe(document.body, {
  subtree: true,
  attributes: true,
  attributeFilter: ['open']
});
