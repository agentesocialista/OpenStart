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
    favicon(url) {
      const safe = U.safeUrl(url);
      if (safe === '#') return '';
      try {
        const host = new URL(safe).hostname.toLowerCase().replace(/^www\./, '');
        if (!host) return '';
        return 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(host) + '&sz=64';
      } catch (_) { return ''; }
    },
    domainLabel(url) {
      const safe = U.safeUrl(url);
      if (safe === '#') return '';
      try {
        const host = new URL(safe).hostname.toLowerCase().replace(/^www\./, '');
        const known = {
          'youtube.com': 'YouTube', 'google.com': 'Google', 'gmail.com': 'Gmail',
          'github.com': 'GitHub', 'netflix.com': 'Netflix', 'figma.com': 'Figma',
          'notion.so': 'Notion', 'amazon.it': 'Amazon', 'wikipedia.org': 'Wikipedia'
        };
        if (known[host]) return known[host];
        for (const key of Object.keys(known)) {
          if (host.endsWith('.' + key)) return known[key];
        }
        const first = host.split('.')[0].replace(/[-_]+/g, ' ');
        return first.charAt(0).toUpperCase() + first.slice(1);
      } catch (_) { return ''; }
    },
    icon(value, fallback) {
      const legacy = {};
      legacy['\u{1F4C4}'] = 'fa-file';
      legacy['\u2B50'] = 'fa-star';
      legacy['\u{1F3B5}'] = 'fa-music';
      legacy['\u{1F3AE}'] = 'fa-gamepad';
      legacy['\u{1F4DA}'] = 'fa-book';
      legacy['\u{1F6D2}'] = 'fa-cart-shopping';
      legacy['\u{1F3C3}'] = 'fa-person-running';
      legacy['\u{1F4A1}'] = 'fa-lightbulb';
      legacy['\u{1F516}'] = 'fa-bookmark';
      legacy['\u{1F552}'] = 'fa-clock';
      legacy['\u{1F4DD}'] = 'fa-note-sticky';
      legacy['\u2705'] = 'fa-list-check';
      legacy['\u26C5'] = 'fa-cloud-sun';
      legacy['\u{1F4F0}'] = 'fa-newspaper';
      legacy['\u{1F5D3}\uFE0F'] = 'fa-calendar-days';
      legacy['\u{1F5D3}'] = 'fa-calendar-days';
      legacy['\u{1F4AC}'] = 'fa-comment-dots';
      legacy['\u23F1\uFE0F'] = 'fa-stopwatch';
      legacy['\u23F1'] = 'fa-stopwatch';
      legacy['\u{1F9E9}'] = 'fa-puzzle-piece';
      const v = String(value || '').trim();
      if (/^fa[bsr]?\s+fa-/.test(v)) return v;
      if (legacy[v]) return 'fa-solid ' + legacy[v];
      if (/^fa-/.test(v)) return 'fa-solid ' + v;
      return 'fa-solid ' + (fallback || 'fa-file');
    },
    iconHtml(value, fallback) {
      return '<i class="' + U.esc(U.icon(value, fallback)) + '" aria-hidden="true"></i>';
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
