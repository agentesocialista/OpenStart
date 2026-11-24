(function () {
  'use strict';

  const cfg = window.OS_CONFIG;
  const U = window.OS_UTIL;
  const API = window.OS_API;

  const WALLPAPER_PRESETS = [
    { id: 'landscape', label: 'Paesaggio', url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1920&q=80' },
    { id: 'forest', label: 'Foresta', url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1920&q=80' },
    { id: 'lake', label: 'Lago', url: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1920&q=80' },
    { id: 'mountain', label: 'Montagna', url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1920&q=80' }
  ];

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
      density: 'comfortable',
      sidebarCollapsed: false,
      wallpaperType: 'color',
      wallpaperValue: '',
      clock24h: true,
      showSeconds: false,
      activePageId: 'home',
      pages: [
        {
          id: 'home', name: 'Home', icon: 'fa-house', columns: 12,
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
              config: { text: 'Benvenuto su OpenStart!\n\nTrascina i widget per riordinarli, usa il pulsante Aggiungi widget per inserirne altri e ritrova il codice nelle impostazioni per portare questa pagina su un altro dispositivo.' }
            },
            { id: U.uid('w'), type: 'todo', title: 'Da fare', size: 'md', config: { items: [] } }
          ]
        },
        {
          id: 'work', name: 'Lavoro', icon: 'fa-briefcase', columns: 12,
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
      const page = Object.assign({ id: U.uid('p'), name: 'Pagina', icon: 'fa-file', columns: 12, widgets: [] }, p);
      page.widgets = Array.isArray(page.widgets) ? page.widgets.map(normalizeWidget) : [];
      return page;
    }) : base.pages;
    if (!s.pages.some(p => p.id === s.activePageId)) s.activePageId = s.pages[0].id;
    if (!s.wallpaperType && typeof s.wallpaper === 'string') {
      if (/^https?:\/\//i.test(s.wallpaper)) { s.wallpaperType = 'url'; s.wallpaperValue = s.wallpaper; }
      else if (!/^data:image\//i.test(s.wallpaper)) s.wallpaperType = 'color';
    }
    delete s.wallpaper;
    if (!['color', 'preset', 'url', 'local'].includes(s.wallpaperType)) s.wallpaperType = 'color';
    s.wallpaperValue = typeof s.wallpaperValue === 'string' ? s.wallpaperValue : '';
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
    WALLPAPER_PRESETS,
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
      // Scritture locali raggruppate: digitare nelle note non serializza ad ogni tasto.
      clearTimeout(this._cacheTimer);
      this._cacheTimer = setTimeout(() => this.writeCache(), 160);
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
