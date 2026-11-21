/* Page zoom: native WebView2 zoom when available, CSS fallback in a browser. */
(() => {
  'use strict';
  const KEY = 'movemate.zoom';
  const MIN = 80;
  const MAX = 200;
  const STEP = 10;
  const root = document.documentElement;
  let percent = readPercent();
  let usingNative = false;
  let requestId = 0;
  let toastTimer = 0;
  let wheelAt = 0;

  function clamp(value) {
    if (!Number.isFinite(value)) return 100;
    return Math.min(MAX, Math.max(MIN, Math.round(value / STEP) * STEP));
  }

  function readPercent() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw === null || raw === '') return 100;
      const stored = Number(raw);
      return Number.isFinite(stored) ? clamp(stored) : 100;
    } catch {
      return 100;
    }
  }

  function savePercent() {
    try {
      localStorage.setItem(KEY, String(percent));
    } catch {}
  }

  function nativeApi() {
    const api = window.pywebview && window.pywebview.api;
    return api && typeof api.set_zoom === 'function' ? api : null;
  }

  function updateUi() {
    const label = document.getElementById('zoom-level');
    if (label) label.textContent = percent + '%';
    const out = document.getElementById('zoom-out');
    const inc = document.getElementById('zoom-in');
    if (out) out.disabled = percent <= MIN;
    if (inc) inc.disabled = percent >= MAX;
  }

  function useCssZoom(enabled) {
    if (enabled) root.style.zoom = String(percent / 100);
    else root.style.removeProperty('zoom');
  }

  function announce() {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = '页面缩放 ' + percent + '%';
    toast.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.style.display = 'none';
    }, 1400);
  }

  function applyNative(api, id) {
    return api.set_zoom(percent).then(result => {
      if (id !== requestId) return;
      if (result && result.ok) {
        usingNative = true;
        useCssZoom(false);
        if (Number.isFinite(Number(result.percent))) {
          percent = clamp(Number(result.percent));
          updateUi();
        }
      } else {
        usingNative = false;
        useCssZoom(true);
      }
    }).catch(() => {
      if (id !== requestId) return;
      usingNative = false;
      useCssZoom(true);
    });
  }

  function apply({ persist = true, notify = true } = {}) {
    percent = clamp(percent);
    if (persist) savePercent();
    updateUi();
    const api = nativeApi();
    if (api) {
      applyNative(api, ++requestId);
    } else {
      usingNative = false;
      useCssZoom(true);
    }
    if (notify) announce();
  }

  function step(delta) {
    percent = clamp(percent + delta);
    apply();
  }

  function reset() {
    percent = 100;
    apply();
  }

  function isZoomShortcut(event) {
    return (event.ctrlKey || event.metaKey) && !event.altKey;
  }

  function onKeydown(event) {
    if (!isZoomShortcut(event)) return;
    const key = event.key;
    if (key === '+' || key === '=' || key === 'Add') {
      event.preventDefault();
      step(STEP);
    } else if (key === '-' || key === '_' || key === 'Subtract') {
      event.preventDefault();
      step(-STEP);
    } else if (key === '0') {
      event.preventDefault();
      reset();
    }
  }

  function onWheel(event) {
    if (!isZoomShortcut(event)) return;
    event.preventDefault();
    const now = performance.now();
    if (now - wheelAt < 60) return;
    wheelAt = now;
    step(event.deltaY < 0 ? STEP : -STEP);
  }

  function initNative() {
    const api = nativeApi();
    if (!api) {
      useCssZoom(true);
      return;
    }
    applyNative(api, ++requestId);
  }

  const zoomIn = document.getElementById('zoom-in');
  const zoomOut = document.getElementById('zoom-out');
  const zoomReset = document.getElementById('zoom-reset');
  if (zoomIn) zoomIn.addEventListener('click', () => step(STEP));
  if (zoomOut) zoomOut.addEventListener('click', () => step(-STEP));
  if (zoomReset) zoomReset.addEventListener('click', reset);

  window.addEventListener('keydown', onKeydown, { passive: false });
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('pywebviewready', initNative, { once: true });

  updateUi();
  if (nativeApi()) initNative();
  else useCssZoom(true);
  // pywebview normally injects the API before page scripts. This covers a late injection too.
  if (window.pywebview) window.setTimeout(() => {
    if (!usingNative && nativeApi()) initNative();
  }, 300);
})();
