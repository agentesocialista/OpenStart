(function () {
  'use strict';

  const cfg = window.OS_CONFIG;
  const U = window.OS_UTIL;
  const API = window.OS_API;

  const WALLPAPERS = {
    aurora: 'linear-gradient(135deg, #5b7cfa 0%, #8f6cd8 55%, #b06ab3 100%)',
    ocean: 'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)',
    sunset: 'linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%)',
    forest: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    slate: 'linear-gradient(135deg, #e8edf5 0%, #cfd9e8 100%)',
    midnight: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)'
  };

  const ENGINES = {
    google: { label: 'Google', initial: 'G', url: 'https://www.google.com/search?q=' },
    bing: { label: 'Bing', initial: 'B', url: 'https://www.bing.com/search?q=' },
    duckduckgo: { label: 'DuckDuckGo', initial: 'D', url: 'https://duckduckgo.com/?q=' },
    youtube: { label: 'YouTube', initial: 'Y', url: 'https://www.youtube.com/results?search_query=' }
  };

  const ACCENTS = ['#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#059669', '#0891b2', '#4f46e5'];

  function link(title, url, color) {
    return { id: U.uid('l'), title: title, url: url, color: color || U.colorFrom(url) };
  }

  function defaultState(name) {
    return {
      version: 1,
      name: name || 'Utente',
      title: 'La mia pagina',
      theme: 'light',
      accent: '#2563eb',
      wallpaper: 'aurora',
      density: 'comfortable',
      searchEngine: 'google',
      clock24h: true,
      showSeconds: false,
      activePageId: 'home',
      pages: [
        {
          id: 'home', name: 'Home', icon: '🏠', columns: 12,
          widgets: [
            { id: U.uid('w'), type: 'clock', title: 'Orologio', size: 'sm', config: {} },
            {
              id: U.uid('w'), type: 'links', title: 'Accessi rapidi', size: 'md',
              config: {
                links: [
                  link('Google', 'https://www.google.com', '#4285f4'),
                  link('YouTube', 'https://www.youtube.com', '#ef4444'),
                  link('Gmail', 'https://mail.google.com', '#ea4335'),
                  link('GitHub', 'https://github.com', '#334155'),
                  link('Netflix', 'https://www.netflix.com', '#e50914')
                ]
              }
            },
            {
              id: U.uid('w'), type: 'notes', title: 'Note', size: 'md',
              config: { text: 'Benvenuto su OpenStart!\n\nTrascina i widget per riordinarli, clicca su ＋ Widget per aggiungerne altri e usa il codice nelle impostazioni per portare questa pagina su un altro dispositivo.' }
            },
            { id: U.uid('w'), type: 'todo', title: 'Da fare', size: 'md', config: { items: [] } }
          ]
        },
        {
          id: 'work', name: 'Lavoro', icon: '💼', columns: 12,
          widgets: [
            {
              id: U.uid('w'), type: 'links', title: 'Strumenti', size: 'lg',
              config: {
                links: [
                  link('GitHub', 'https://github.com', '#334155'),
                  link('Figma', 'https://www.figma.com', '#a259ff'),
                  link('Notion', 'https://www.notion.so', '#111827'),
                  link('Drive', 'https://drive.google.com', '#16a34a')
                ]
              }
            },
            { id: U.uid('w'), type: 'calendar', title: 'Calendario', size: 'md', config: {} }
          ]
        }
      ]
    };
  }

  function normalize(raw) {
    const base = defaultState('Utente');
    const s = Object.assign({}, base, raw || {});
    s.version = 1;
    s.pages = Array.isArray(s.pages) && s.pages.length ? s.pages.map(p => {
      const page = Object.assign({ id: U.uid('p'), name: 'Pagina', icon: '📄', columns: 12, widgets: [] }, p);
      page.widgets = Array.isArray(page.widgets) ? page.widgets.map(normalizeWidget) : [];
      return page;
    }) : base.pages;
    if (!s.pages.some(p => p.id === s.activePageId)) s.activePageId = s.pages[0].id;
    s.name = s.name || 'Utente';
    return s;
  }

  function normalizeWidget(w) {
    const out = Object.assign({ id: U.uid('w'), type: 'links', title: 'Widget', size: 'md', config: {} }, w || {});
    out.config = out.config || {};
    if (out.type === 'links' && !Array.isArray(out.config.links)) out.config.links = [];
    if (out.type === 'todo' && !Array.isArray(out.config.items)) out.config.items = [];
    return out;
  }

  const Store = {
    state: null,
    code: null,
    WALLPAPERS,
    ENGINES,
    ACCENTS,

    readSession() {
      try { return JSON.parse(localStorage.getItem(cfg.SESSION_KEY) || 'null'); } catch (_) { return null; }
    },
    writeSession(code, name) {
      localStorage.setItem(cfg.SESSION_KEY, JSON.stringify({ code: code, name: name || '' }));
    },
    clearSession() { localStorage.removeItem(cfg.SESSION_KEY); },
    readCache() {
      try { return JSON.parse(localStorage.getItem(cfg.CACHE_KEY) || 'null'); } catch (_) { return null; }
    },
    writeCache() {
      try { localStorage.setItem(cfg.CACHE_KEY, JSON.stringify({ code: this.code, state: this.state })); } catch (_) { /* quota */ }
    },
    activePage() {
      if (!this.state) return null;
      return this.state.pages.find(p => p.id === this.state.activePageId) || this.state.pages[0];
    },
    findWidget(id) {
      for (const page of this.state.pages) {
        const w = page.widgets.find(x => x.id === id);
        if (w) return { page, widget: w };
      }
      return null;
    },

    markDirty() {
      if (!this.code || !this.state) return;
      this.writeCache();
      document.dispatchEvent(new CustomEvent('os:savestate', { detail: { status: 'saving' } }));
      clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => this.flush(), 800);
    },

    async flush() {
      if (!this.code || !this.state) return;
      const snapshot = JSON.parse(JSON.stringify(this.state));
      try {
        await API.updateProfile(this.code, snapshot, snapshot.name);
        this.writeCache();
        document.dispatchEvent(new CustomEvent('os:savestate', { detail: { status: 'saved' } }));
        return true;
      } catch (err) {
        document.dispatchEvent(new CustomEvent('os:savestate', { detail: { status: 'offline', message: err.message } }));
        return false;
      }
    },

    defaultState,
    normalize,
    normalizeWidget
  };

  window.addEventListener('online', () => { if (Store.code) Store.flush(); });
  window.addEventListener('beforeunload', () => { if (Store.code) Store.writeCache(); });

  window.OS_STORE = Store;
})();
