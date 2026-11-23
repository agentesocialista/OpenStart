(function () {
  'use strict';

  const U = {
    esc(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },
    uid(prefix) {
      return (prefix || 'id') + '_' + Math.random().toString(36).slice(2, 9);
    },
    randomCode(length, alphabet) {
      const chars = alphabet || 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const values = new Uint32Array(length);
      crypto.getRandomValues(values);
      return Array.from(values, v => chars[v % chars.length]).join('');
    },
    debounce(fn, ms) {
      let t;
      return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), ms);
      };
    },
    clamp(n, min, max) { return Math.min(max, Math.max(min, n)); },
    initials(name) {
      return String(name || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase() || '?';
    },
    colorFrom(text) {
      const palette = ['#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#059669', '#0891b2', '#4f46e5'];
      let h = 0;
      for (const c of String(text || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      return palette[h % palette.length];
    },
    safeUrl(url) {
      const value = String(url || '').trim();
      if (!value) return '#';
      if (/^(https?:|mailto:|tel:)/i.test(value)) return value;
      if (/^[\w.-]+\.[a-z]{2,}/i.test(value)) return 'https://' + value;
      return '#';
    },
    safeExternal(url) {
      const u = U.safeUrl(url);
      return u === '#' ? '#' : u;
    },
    todayKey() {
      const d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },
    formatClock(date, state) {
      const h24 = state.clock24h !== false;
      let h = date.getHours();
      const suffix = h24 ? '' : (h >= 12 ? ' PM' : ' AM');
      if (!h24) h = h % 12 || 12;
      const mm = String(date.getMinutes()).padStart(2, '0');
      const ss = String(date.getSeconds()).padStart(2, '0');
      return String(h).padStart(h24 ? 2 : 1, '0') + ':' + mm + (state.showSeconds ? ':' + ss : '') + suffix;
    },
    formatDate(date) {
      return new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
    }
  };

  window.OS_UTIL = U;
})();
