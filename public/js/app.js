(function () {
  'use strict';

  const U = window.OS_UTIL;
  const cfg = window.OS_CONFIG;
  const API = window.OS_API;
  const Store = window.OS_STORE;
  const W = window.OS_WIDGETS;
  const $ = (id) => document.getElementById(id);

  const APP = {};
  let modalEl = null;
  let busy = false;

  /* ---------------- views ---------------- */
  function showOb(which) {
    $('onboarding').classList.remove('hidden');
    $('app').classList.add('hidden');
    $('shareView').classList.add('hidden');
    $('obCreate').classList.toggle('hidden', which !== 'create');
    $('obRestore').classList.toggle('hidden', which !== 'restore');
    $('obCodeCard').classList.toggle('hidden', which !== 'code');
    if (which === 'restore') setTimeout(() => $('obCode').focus(), 50);
    if (which === 'create') setTimeout(() => $('obName').focus(), 50);
  }

  function enterApp() {
    if (!Store.state) return;
    $('onboarding').classList.add('hidden');
    $('shareView').classList.add('hidden');
    $('app').classList.remove('hidden');
    applyState();
    renderAll();
    setSaveState('saved');
  }

  function toast(message, kind) {
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = message;
    $('toastRoot').appendChild(el);
    setTimeout(() => {
      if (U.reduceMotion()) { el.remove(); return; }
      el.classList.add('out');
      setTimeout(() => el.remove(), 200);
    }, 3000);
  }

  function setBusy(value) {
    busy = value;
    document.querySelectorAll('#createForm button, #restoreForm button').forEach(b => { b.disabled = value; });
  }

  function setSaveState(status, message) {
    const el = $('saveState');
    if (!el) return;
    el.className = 'save-state' + (status === 'saving' ? ' saving' : status === 'offline' ? ' error' : '');
    el.textContent = status === 'saving' ? 'Salvataggio…' : status === 'offline' ? 'Offline · salvato localmente' : 'Tutto salvato';
    if (message) el.title = message;
  }

  /* ---------------- account ---------------- */
  async function createAccount(name) {
    setBusy(true);
    let profile = null, code = '';
    try {
      for (let i = 0; i < 8; i++) {
        code = U.randomCode(6);
        try {
          profile = await API.createProfile(code, name, Store.defaultState(name));
          break;
        } catch (err) {
          if (/duplic|unique|already exists|conflitt/i.test(err.message)) continue;
          throw err;
        }
      }
      if (!profile) throw new Error('Impossibile generare un codice univoco, riprova.');
      Store.code = code;
      Store.state = Store.normalize(profile.data);
      Store.state.name = name;
      Store.writeSession(code, name);
      Store.writeCache();
      $('obCodeValue').textContent = code;
      showOb('code');
    } finally {
      setBusy(false);
    }
  }

  async function restore(code, silent) {
    const clean = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(clean)) throw new Error('Il codice deve contenere 6 lettere o numeri.');
    const profile = await API.getProfile(clean);
    if (!profile || !profile.code) throw new Error('Codice non trovato. Controlla e riprova.');
    Store.code = clean;
    Store.state = Store.normalize(profile.data);
    if (profile.name) Store.state.name = profile.name;
    Store.writeSession(clean, Store.state.name);
    Store.writeCache();
    if (!silent) enterApp();
    return profile;
  }

  function logout() {
    Store.clearSession();
    Store.state = null;
    Store.code = null;
    closeModal();
    applyWallpaper();
    showOb('create');
    toast('Disconnesso da questo dispositivo');
  }

  async function deleteAccount() {
    if (!Store.code) return;
    if (!confirm('Eliminare definitivamente il profilo e tutti i suoi dati? Questa operazione non è reversibile.')) return;
    try {
      await API.deleteProfile(Store.code);
      logout();
      toast('Profilo eliminato', 'ok');
    } catch (err) { toast(err.message, 'err'); }
  }

  /* ---------------- rendering ---------------- */
  function applySidebar() {
    const collapsed = !!(Store.state && Store.state.sidebarCollapsed);
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    const btn = $('sidebarToggle');
    if (btn) {
      const label = collapsed ? 'Espandi barra laterale' : 'Comprimi barra laterale';
      btn.title = label;
      btn.setAttribute('aria-label', label);
      $('sidebarToggleIcon').className = 'fa-solid ' + (collapsed ? 'fa-angles-right' : 'fa-angles-left');
    }
  }

  function applyState() {
    const s = Store.state;
    if (!s) return;
    document.body.dataset.theme = s.theme === 'dark' ? 'dark' : 'light';
    document.body.dataset.density = s.density || 'comfortable';
    const accent = s.accent || '#2563eb';
    document.body.style.setProperty('--accent', accent);
    document.body.style.setProperty('--accent-dark', shade(accent, -22));
    document.body.style.setProperty('--accent-soft', hexToRgba(accent, .12));

    const initials = U.initials(s.name);
    ['topAvatar', 'menuAvatar', 'sideAvatar'].forEach(id => { $(id).textContent = initials; });
    $('menuName').textContent = s.name || 'Utente';
    $('menuCode').textContent = Store.code || '——————';
    $('sideName').textContent = s.name || 'Utente';
    $('sideCode').innerHTML = U.esc(Store.code || '——————') + ' <i class="fa-solid fa-copy" aria-hidden="true"></i>';
    $('themeIcon').className = 'fa-solid ' + (s.theme === 'dark' ? 'fa-sun' : 'fa-moon');
    applyWallpaper();
    applySidebar();
  }

  function shade(hex, amount) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    if (!m) return hex;
    return '#' + [1, 2, 3].map(i => U.clamp(parseInt(m[i], 16) + amount, 0, 255).toString(16).padStart(2, '0')).join('');
  }
  function hexToRgba(hex, a) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    if (!m) return 'rgba(37,99,235,' + a + ')';
    return 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + a + ')';
  }

  /* ---------------- sfondo ---------------- */
  function localWallpaperKey() {
    return cfg.LOCAL_WALLPAPER_KEY + (Store.code ? ':' + Store.code : '');
  }
  function readLocalWallpaper() {
    try { return localStorage.getItem(localWallpaperKey()) || ''; } catch (_) { return ''; }
  }
  function writeLocalWallpaper(dataUrl) {
    try { localStorage.setItem(localWallpaperKey(), dataUrl); return true; } catch (_) { return false; }
  }
  function removeLocalWallpaper() {
    try { localStorage.removeItem(localWallpaperKey()); } catch (_) { /* ignore */ }
  }
  function cssUrl(value) {
    return "url('" + U.esc(value) + "')";
  }
  function wallpaperSource() {
    const s = Store.state;
    if (!s) return '';
    if (s.wallpaperType === 'preset') {
      const preset = Store.WALLPAPER_PRESETS.find(p => p.id === s.wallpaperValue);
      return preset ? preset.url : '';
    }
    if (s.wallpaperType === 'url') return /^https?:\/\//i.test(s.wallpaperValue) ? s.wallpaperValue : '';
    if (s.wallpaperType === 'local') return readLocalWallpaper();
    return '';
  }
  function applyWallpaper() {
    const src = wallpaperSource();
    if (src) {
      document.body.style.setProperty('--wallpaper-image', 'url(' + JSON.stringify(src) + ')');
      document.body.dataset.wallpaper = 'image';
    } else {
      document.body.style.removeProperty('--wallpaper-image');
      document.body.dataset.wallpaper = 'color';
    }
  }
  async function compressImage(file) {
    const original = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('read'));
      reader.readAsDataURL(file);
    });
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('decode'));
      image.src = original;
    });
    const max = 1920;
    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;
    if (width > max || height > max) {
      const scale = Math.min(max / width, max / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.82);
  }
  function wallpaperPanel(s) {
    const type = s.wallpaperType || 'color';
    if (type === 'color') {
      return '<p class="hint" style="margin-top:0">Sfondo monocromatico attivo. Scegli una foto per personalizzarlo.</p>';
    }
    if (type === 'local') {
      const data = readLocalWallpaper();
      return '<p class="hint" style="margin-top:0">La foto resta solo in questo browser: non viene caricata su Supabase né sincronizzata.</p>' +
        '<div class="wp-local-actions"><button class="btn btn-ghost btn-sm" id="wpPick"><i class="fa-solid fa-upload" aria-hidden="true"></i> Scegli immagine</button>' +
        (data ? '<button class="btn btn-ghost btn-sm" id="wpRemove"><i class="fa-solid fa-trash" aria-hidden="true"></i> Rimuovi immagine locale</button>' : '') + '</div>' +
        '<input type="file" id="wpFile" accept="image/*" hidden />' +
        (data ? '<div class="wp-preview" style="background-image:' + cssUrl(data) + '"></div>' : '<p class="hint">Nessuna immagine caricata su questo dispositivo.</p>');
    }
    const thumbs = Store.WALLPAPER_PRESETS.map(p =>
      '<button class="wp-thumb' + (type === 'preset' && s.wallpaperValue === p.id ? ' active' : '') + '" data-wp-preset="' + U.esc(p.id) + '" style="background-image:' + cssUrl(p.url) + '" title="' + U.esc(p.label) + '"><span>' + U.esc(p.label) + '</span></button>'
    ).join('');
    return '<div class="wallpaper-grid">' + thumbs + '</div>' +
      '<div class="form-row" style="margin-top:10px"><label>Oppure incolla un URL di immagine</label>' +
      '<div class="share-box"><input id="wpUrl" type="url" placeholder="https://…/foto.jpg" value="' + U.esc(type === 'url' ? s.wallpaperValue : '') + '" /><button class="btn btn-ghost btn-sm" id="wpApplyUrl">Applica</button></div>' +
      '<p class="hint">Usa foto royalty free, di pubblico dominio o personali.</p></div>';
  }
  function wireWallpaper(host, s) {
    host.querySelectorAll('[data-wp-preset]').forEach(btn => btn.addEventListener('click', () => {
      const preset = Store.WALLPAPER_PRESETS.find(p => p.id === btn.dataset.wpPreset);
      if (!preset) return;
      s.wallpaperType = 'preset';
      s.wallpaperValue = preset.id;
      Store.markDirty(); applyWallpaper(); renderTab('appearance');
    }));
    const applyUrl = host.querySelector('#wpApplyUrl');
    if (applyUrl) applyUrl.addEventListener('click', () => {
      const value = (host.querySelector('#wpUrl').value || '').trim();
      const candidate = /^https?:\/\//i.test(value) ? value : 'https://' + value;
      let parsed;
      try { parsed = new URL(candidate); } catch (_) { toast('Inserisci un URL valido', 'err'); return; }
      if (!['http:', 'https:'].includes(parsed.protocol)) { toast('Usa un indirizzo http o https', 'err'); return; }
      s.wallpaperType = 'url';
      s.wallpaperValue = parsed.toString();
      Store.markDirty(); applyWallpaper(); renderTab('appearance'); toast('Sfondo applicato', 'ok');
    });
    const pick = host.querySelector('#wpPick');
    const file = host.querySelector('#wpFile');
    if (pick && file) pick.addEventListener('click', () => file.click());
    if (file) file.addEventListener('change', async () => {
      const chosen = file.files && file.files[0];
      if (!chosen) return;
      if (!chosen.type.startsWith('image/')) { toast('Scegli un file immagine', 'err'); return; }
      try {
        const dataUrl = await compressImage(chosen);
        if (!writeLocalWallpaper(dataUrl)) { toast('Spazio locale insufficiente', 'err'); return; }
        s.wallpaperType = 'local';
        s.wallpaperValue = '';
        Store.markDirty(); applyWallpaper(); renderTab('appearance');
        toast('Immagine salvata in questo browser', 'ok');
      } catch (_) { toast('Impossibile leggere l’immagine', 'err'); }
    });
    const remove = host.querySelector('#wpRemove');
    if (remove) remove.addEventListener('click', () => {
      removeLocalWallpaper();
      s.wallpaperType = 'color';
      s.wallpaperValue = '';
      Store.markDirty(); applyWallpaper(); renderTab('appearance');
      toast('Immagine locale rimossa');
    });
  }

  function renderAll(animate) {
    renderPages();
    renderPage(animate);
  }

  function renderPages() {
    const list = $('pagesList');
    list.innerHTML = Store.state.pages.map(p =>
      '<div class="page-item' + (p.id === Store.state.activePageId ? ' active' : '') + '" data-page-id="' + U.esc(p.id) + '" role="button" tabindex="0" title="' + U.esc(p.name) + '">' +
      '<span class="pg-icon">' + U.iconHtml(p.icon, 'fa-file') + '</span>' +
      '<span class="pg-name">' + U.esc(p.name) + '</span>' +
      '<button class="pg-rename" data-rename-page="' + U.esc(p.id) + '" data-no-drag title="Rinomina pagina" aria-label="Rinomina pagina"><i class="fa-solid fa-pen" aria-hidden="true"></i></button>' +
      '<button class="pg-del" data-del-page="' + U.esc(p.id) + '" data-no-drag title="Elimina pagina" aria-label="Elimina pagina"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div>'
    ).join('');
  }

  function renderPage(animate) {
    const page = Store.activePage();
    if (!page) return;
    $('pageTitle').value = page.name;
    $('layoutLabel').textContent = (page.columns === 6 ? '6' : '12') + ' col';
    const grid = $('widgetGrid');
    grid.className = 'widget-grid' + (page.columns === 6 ? ' cols-6' : '') + (animate === false ? '' : ' animate-in');
    grid.innerHTML = page.widgets.map((w, i) => widgetCard(w, i)).join('') +
      '<button class="add-widget-tile" id="addWidgetTile" style="--i:' + page.widgets.length + '"><span class="plus"><i class="fa-solid fa-plus" aria-hidden="true"></i></span><span>Aggiungi widget</span></button>';

    grid.querySelectorAll('.widget').forEach(card => {
      const w = page.widgets.find(x => x.id === card.dataset.widgetId);
      if (w) W.bindBody(card.querySelector('.widget-body'), w, false);
    });
    $('addWidgetTile').addEventListener('click', openWidgetPicker);
  }

  function widgetCard(w, index) {
    const meta = W.TYPES.find(t => t.type === w.type) || { icon: 'fa-puzzle-piece' };
    const menu =
      '<div class="widget-menu hidden" data-menu-for="' + U.esc(w.id) + '">' +
      '<button data-waction="edit"><i class="fa-solid fa-pen" aria-hidden="true"></i> Impostazioni widget</button>' +
      '<div class="menu-label">Dimensione</div>' +
      ['sm:Piccolo', 'md:Medio', 'lg:Grande', 'xl:Intero'].map(x => {
        const [size, label] = x.split(':');
        return '<button data-waction="size" data-size="' + size + '">' + (w.size === size ? '<i class="fa-solid fa-check" aria-hidden="true"></i> ' : '') + label + '</button>';
      }).join('') +
      '<div class="menu-sep"></div>' +
      '<button data-waction="duplicate"><i class="fa-solid fa-copy" aria-hidden="true"></i> Duplica</button>' +
      '<button data-waction="remove"><i class="fa-solid fa-trash" aria-hidden="true"></i> Rimuovi</button></div>';

    return '<section class="widget size-' + U.esc(w.size || 'md') + '" data-widget-id="' + U.esc(w.id) + '" style="--i:' + (index || 0) + '">' +
      '<div class="widget-head">' +
      '<span class="widget-drag" data-drag-widget="' + U.esc(w.id) + '" title="Tieni premuto e trascina per riordinare"><i class="fa-solid fa-grip-vertical" aria-hidden="true"></i></span>' +
      '<span class="widget-icon">' + W.icon(meta.icon) + '</span>' +
      '<span class="widget-title">' + U.esc(w.title) + '</span>' +
      '<button class="widget-menu-btn" data-wk-menu="' + U.esc(w.id) + '" title="Opzioni"><i class="fa-solid fa-ellipsis" aria-hidden="true"></i></button>' +
      menu + '</div>' +
      '<div class="widget-body' + (Store.state.density === 'compact' ? ' compact' : '') + '">' + W.renderBody(w, false) + '</div></section>';
  }

  function rerenderWidget(id) {
    const found = Store.findWidget(id);
    if (!found || $('app').classList.contains('hidden')) return;
    const card = document.querySelector('.widget[data-widget-id="' + CSS.escape(id) + '"]');
    if (!card) return;
    card.className = 'widget size-' + (found.widget.size || 'md');
    card.querySelector('.widget-body').innerHTML = W.renderBody(found.widget, false);
    W.bindBody(card.querySelector('.widget-body'), found.widget, false);
  }

  APP.dirty = function () { Store.markDirty(); };
  APP.rerenderWidget = rerenderWidget;

  /* ---------------- modals ---------------- */
  function openModal(html, wide) {
    closeModal();
    $('modalRoot').innerHTML = '';
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = '<div class="modal' + (wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' + html + '</div>';
    $('modalRoot').appendChild(backdrop);
    modalEl = backdrop.querySelector('.modal');
    backdrop.addEventListener('pointerdown', (e) => { if (e.target === backdrop) closeModal(true); });
    modalEl.querySelectorAll('[data-modal-close]').forEach(b => b.addEventListener('click', () => closeModal(true)));
    wireSheetSwipe(backdrop, modalEl);
    return modalEl;
  }
  function closeModal(animated) {
    const root = $('modalRoot');
    const el = modalEl;
    modalEl = null;
    if (!el || !el.parentNode) { root.innerHTML = ''; return; }
    if (animated && !U.reduceMotion()) {
      el.parentNode.classList.add('closing');
      setTimeout(() => { if (el.parentNode === root) el.parentNode.remove(); }, 180);
    } else el.parentNode.remove();
  }
  function wireSheetSwipe(backdrop, modal) {
    if (!window.matchMedia || !window.matchMedia('(pointer: coarse)').matches) return;
    const head = modal.querySelector('.modal-head');
    if (!head) return;
    let start = null;
    head.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      start = { id: e.pointerId, x: e.clientX, y: e.clientY, dy: 0 };
    });
    head.addEventListener('pointermove', (e) => {
      if (!start || e.pointerId !== start.id) return;
      start.dy = e.clientY - start.y;
      if (start.dy > 6 && Math.abs(e.clientX - start.x) < start.dy) {
        e.preventDefault();
        modal.style.transform = 'translateY(' + start.dy + 'px)';
      }
    }, { passive: false });
    const end = () => {
      if (!start) return;
      const drop = start.dy;
      start = null;
      modal.style.transform = '';
      if (drop > 80) closeModal(true);
    };
    head.addEventListener('pointerup', end);
    head.addEventListener('pointercancel', end);
  }
  function modalHead(title) {
    return '<div class="modal-head"><h2>' + U.esc(title) + '</h2><button class="modal-close" data-modal-close aria-label="Chiudi"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div>';
  }

  function openWidgetPicker() {
    const page = Store.activePage();
    const m = openModal(modalHead('Aggiungi un widget') +
      '<div class="modal-body"><p class="hint" style="margin-top:0">Scegli un widget da aggiungere a “' + U.esc(page.name) + '”.</p>' +
      '<div class="widget-picker">' + W.TYPES.map(t =>
        '<button class="widget-pick" data-pick="' + t.type + '"><span class="pic">' + W.icon(t.icon) + '</span><strong>' + U.esc(t.label) + '</strong><small>' + U.esc(t.desc) + '</small></button>'
      ).join('') + '</div></div>', true);
    m.querySelectorAll('[data-pick]').forEach(btn => btn.addEventListener('click', () => {
      page.widgets.push(W.make(btn.dataset.pick));
      closeModal(); Store.markDirty(); renderPage();
      toast('Widget aggiunto', 'ok');
    }));
  }

  function openWidgetEditor(id) {
    const found = Store.findWidget(id);
    if (!found) return;
    const w = found.widget, c = w.config;
    let extra = '';
    if (w.type === 'links') {
      const rows = (c.links || []).map((l, i) => linkRow(l, i)).join('');
      extra = '<div class="form-row"><label>Collegamenti</label><div class="link-rows" id="linkRows" style="grid-template-columns:1fr 1.3fr 38px 34px">' +
        rows + '</div><button class="link-btn" type="button" id="addLinkRow" style="margin-top:8px"><i class="fa-solid fa-plus" aria-hidden="true"></i> Aggiungi riga</button></div>';
    } else if (w.type === 'weather') {
      extra = '<div class="form-row"><label>Città</label><input type="text" id="wCity" value="' + U.esc(c.city || 'Roma') + '" /></div>';
    } else if (w.type === 'feed') {
      extra = '<div class="form-row"><label>URL del feed RSS</label><input type="url" id="wFeed" value="' + U.esc(c.url || '') + '" placeholder="https://sito.it/feed.xml" /></div>';
    } else if (w.type === 'timer') {
      extra = '<div class="form-row"><label>Minuti</label><input type="number" id="wMinutes" min="1" max="180" value="' + (Number(c.minutes) || 25) + '" /></div>';
    }
    const m = openModal(modalHead('Impostazioni widget') +
      '<div class="modal-body"><div class="form-row"><label>Titolo</label><input type="text" id="wTitle" value="' + U.esc(w.title) + '" maxlength="40" /></div>' + extra + '</div>' +
      '<div class="modal-foot"><button class="btn btn-ghost" data-modal-close>Annulla</button><button class="btn btn-primary" id="saveWidget">Salva</button></div>');

    if (w.type === 'links') {
      const wireRow = (row) => row.querySelector('[data-row-del]').addEventListener('click', () => row.remove());
      m.querySelectorAll('.link-row').forEach(wireRow);
      $('addLinkRow').addEventListener('click', () => {
        const row = document.createElement('div');
        row.innerHTML = linkRow({ title: '', url: '', color: '#2563eb' }, 0);
        const el = row.firstElementChild;
        $('linkRows').appendChild(el); wireRow(el);
      });
    }
    $('saveWidget').addEventListener('click', () => {
      w.title = ($('wTitle').value || 'Widget').trim();
      if (w.type === 'links') {
        w.config.links = Array.from($('linkRows').querySelectorAll('.link-row')).map(row => ({
          id: row.dataset.id || U.uid('l'),
          title: (row.querySelector('.l-title').value || 'Sito').trim(),
          url: (row.querySelector('.l-url').value || '').trim(),
          color: row.querySelector('.l-color').value
        })).filter(l => l.url);
      }
      if (w.type === 'weather') w.config.city = ($('wCity').value || 'Roma').trim();
      if (w.type === 'feed') w.config.url = ($('wFeed').value || '').trim();
      if (w.type === 'timer') { w.config.minutes = U.clamp(Number($('wMinutes').value) || 25, 1, 180); }
      closeModal(); Store.markDirty(); rerenderWidget(id);
      toast('Widget aggiornato', 'ok');
    });
  }

  function linkRow(l, i) {
    return '<div class="link-row" data-id="' + U.esc(l.id || '') + '">' +
      '<input class="l-title" type="text" value="' + U.esc(l.title || '') + '" placeholder="Titolo" />' +
      '<input class="l-url" type="text" value="' + U.esc(l.url || '') + '" placeholder="https://…" />' +
      '<input class="l-color" type="color" value="' + U.esc(l.color || '#2563eb') + '" />' +
      '<button type="button" data-row-del title="Elimina"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div>';
  }

  async function suggestTitle(rawUrl) {
    const safe = U.safeUrl(rawUrl);
    if (safe === '#') return '';
    try {
      const res = await fetch(cfg.METADATA_ENDPOINT + encodeURIComponent(safe), { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.title) return String(data.title).slice(0, 40);
      }
    } catch (_) { /* si usa il fallback dal dominio */ }
    return U.domainLabel(safe).slice(0, 40);
  }

  APP.openLinkEditor = function (widgetId, index) {
    const found = Store.findWidget(widgetId);
    if (!found) return;
    const links = found.widget.config.links;
    const existing = index == null ? null : links[index];
    const m = openModal(modalHead(existing ? 'Modifica collegamento' : 'Nuovo collegamento') +
      '<div class="modal-body">' +
      '<div class="form-row"><label>Titolo</label><input id="lkTitle" type="text" maxlength="40" value="' + U.esc(existing ? existing.title : '') + '" placeholder="Es. YouTube" /></div>' +
      '<div class="form-row"><label>Indirizzo</label><input id="lkUrl" type="text" value="' + U.esc(existing ? existing.url : '') + '" placeholder="https://…" /></div>' +
      '<div class="form-row"><label>Colore</label><input id="lkColor" type="color" value="' + U.esc(existing ? existing.color : '#2563eb') + '" style="width:70px;height:38px;padding:2px;border-radius:8px" /></div>' +
      '</div><div class="modal-foot">' +
      (existing ? '<button class="btn btn-danger" id="lkDelete" style="margin-right:auto">Elimina</button>' : '') +
      '<button class="btn btn-ghost" data-modal-close>Annulla</button><button class="btn btn-primary" id="lkSave">Salva</button></div>');
    const urlInput = $('lkUrl');
    const titleInput = $('lkTitle');
    let titleEdited = false;
    let suggestTimer = null;
    titleInput.addEventListener('input', () => { titleEdited = true; });
    urlInput.addEventListener('input', () => {
      clearTimeout(suggestTimer);
      suggestTimer = setTimeout(async () => {
        if (titleEdited && titleInput.value.trim()) return;
        const suggestion = await suggestTitle(urlInput.value);
        if (titleEdited && titleInput.value.trim()) return;
        if (suggestion) titleInput.value = suggestion;
      }, 450);
    });
    $('lkSave').addEventListener('click', () => {
      const title = ($('lkTitle').value || '').trim();
      const url = ($('lkUrl').value || '').trim();
      if (!title || !url) { toast('Titolo e indirizzo sono obbligatori', 'err'); return; }
      const data = { title, url, color: $('lkColor').value };
      if (existing) links[index] = Object.assign({ id: U.uid('l') }, existing, data);
      else links.push(Object.assign({ id: U.uid('l') }, data));
      closeModal(); Store.markDirty(); rerenderWidget(widgetId);
    });
    const del = $('lkDelete');
    if (del) del.addEventListener('click', () => { links.splice(index, 1); closeModal(); Store.markDirty(); rerenderWidget(widgetId); });
  };

  function openSettings(tab) {
    const s = Store.state;
    const m = openModal(modalHead('Impostazioni') +
      '<div class="modal-body"><div class="tabs">' +
      [['general', 'Generale'], ['appearance', 'Aspetto'], ['data', 'Dati e account']].map(([id, label]) =>
        '<button class="tab' + (tab === id ? ' active' : '') + '" data-tab="' + id + '">' + label + '</button>').join('') +
      '</div><div id="tabContent"></div></div>', true);
    renderTab(tab);
    m.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
      m.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('active', x === b));
      renderTab(b.dataset.tab);
    }));
  }

  function renderTab(tab) {
    const s = Store.state;
    const host = $('tabContent');
    if (tab === 'general') {
      host.innerHTML =
        '<div class="form-row"><label>Nome</label><input id="setName" type="text" maxlength="60" value="' + U.esc(s.name) + '" /></div>' +
        '<div class="form-row"><label>Titolo della pagina principale</label><input id="setTitle" type="text" maxlength="40" value="' + U.esc(s.title || '') + '" /></div>' +
        '<label class="check-row"><input type="checkbox" id="set24"' + (s.clock24h !== false ? ' checked' : '') + ' /> Formato orologio 24 ore</label>' +
        '<label class="check-row"><input type="checkbox" id="setSec"' + (s.showSeconds ? ' checked' : '') + ' /> Mostra i secondi</label>' +
        '<div class="modal-foot" style="padding:16px 0 0"><button class="btn btn-primary" id="setSaveGeneral">Salva modifiche</button></div>';
      $('setSaveGeneral').addEventListener('click', () => {
        s.name = ($('setName').value || 'Utente').trim();
        s.title = $('setTitle').value.trim();
        s.clock24h = $('set24').checked;
        s.showSeconds = $('setSec').checked;
        closeModal(); Store.markDirty(); applyState(); renderAll();
        toast('Impostazioni salvate', 'ok');
      });
    } else if (tab === 'appearance') {
      const isPhoto = s.wallpaperType === 'preset' || s.wallpaperType === 'url';
      host.innerHTML =
        '<div class="form-row"><label>Tema</label><div class="segmented" id="segTheme">' +
        [['light', 'fa-sun', 'Chiaro'], ['dark', 'fa-moon', 'Scuro']].map(([v, ic, l]) =>
          '<button data-value="' + v + '" class="' + (s.theme === v ? 'active' : '') + '"><i class="fa-solid ' + ic + '" aria-hidden="true"></i> ' + l + '</button>').join('') +
        '</div></div>' +
        '<div class="form-row"><label>Colore principale</label><div class="swatches" id="accentSwatches">' +
        Store.ACCENTS.map(a => '<button class="swatch' + (s.accent === a ? ' active' : '') + '" data-accent="' + a + '" style="background:' + a + '" aria-label="' + a + '"></button>').join('') +
        '</div></div>' +
        '<div class="form-row"><label>Sfondo</label><div class="segmented" id="segWallpaper">' +
        [['color', 'fa-palette', 'Monocromatico'], ['photo', 'fa-image', 'Foto online'], ['local', 'fa-upload', 'Dal dispositivo']].map(([v, ic, l]) => {
          const active = v === 'photo' ? isPhoto : s.wallpaperType === v;
          return '<button data-wp-type="' + v + '" class="' + (active ? 'active' : '') + '"><i class="fa-solid ' + ic + '" aria-hidden="true"></i> ' + l + '</button>';
        }).join('') +
        '</div><div id="wallpaperPanel" style="margin-top:10px">' + wallpaperPanel(s) + '</div></div>' +
        '<div class="form-row"><label>Densità widget</label><div class="segmented" id="segDensity">' +
        ['comfortable:Comoda', 'compact:Compatta'].map(x => { const [v, l] = x.split(':'); return '<button data-value="' + v + '" class="' + ((s.density || 'comfortable') === v ? 'active' : '') + '">' + l + '</button>'; }).join('') +
        '</div></div>';
      host.querySelectorAll('#segTheme button, #segDensity button, #segWallpaper button').forEach(b => b.addEventListener('click', () => {
        const parent = b.parentElement;
        if (parent.id === 'segWallpaper') {
          const type = b.dataset.wpType;
          if (type === 'photo') {
            s.wallpaperType = 'preset';
            if (!Store.WALLPAPER_PRESETS.some(p => p.id === s.wallpaperValue)) s.wallpaperValue = Store.WALLPAPER_PRESETS[0].id;
          } else if (type === 'local') {
            s.wallpaperType = 'local';
            s.wallpaperValue = '';
          } else {
            s.wallpaperType = 'color';
            s.wallpaperValue = '';
          }
          Store.markDirty(); applyWallpaper(); renderTab('appearance');
          return;
        }
        parent.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
        if (parent.id === 'segTheme') { s.theme = b.dataset.value; themeTransition(); } else s.density = b.dataset.value;
        Store.markDirty(); applyState(); renderPage();
      }));
      host.querySelectorAll('[data-accent]').forEach(b => b.addEventListener('click', () => {
        s.accent = b.dataset.accent;
        host.querySelectorAll('[data-accent]').forEach(x => x.classList.toggle('active', x === b));
        Store.markDirty(); applyState();
      }));
      wireWallpaper(host, s);
    } else {
      host.innerHTML =
        '<div class="form-row"><label>Codice personale (6 caratteri)</label><div class="share-box"><input id="dataCode" value="' + U.esc(Store.code) + '" readonly /><button class="btn btn-ghost btn-sm" id="dataCopy">Copia</button></div>' +
        '<p class="hint">Salva questo codice: inserendolo su un altro dispositivo ritroverai tutti i tuoi dati.</p></div>' +
        '<div class="form-row"><label>Backup</label><div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn btn-ghost btn-sm" id="dataExport"><i class="fa-solid fa-download" aria-hidden="true"></i> Esporta JSON</button>' +
        '<button class="btn btn-ghost btn-sm" id="dataImport"><i class="fa-solid fa-upload" aria-hidden="true"></i> Importa JSON</button></div></div>' +
        '<div class="form-row"><label>Account</label><div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn btn-ghost btn-sm" id="dataLogout">Esci</button>' +
        '<button class="btn btn-danger btn-sm" id="dataDelete">Elimina profilo</button></div></div>';
      $('dataCopy').addEventListener('click', () => copyText(Store.code));
      $('dataExport').addEventListener('click', exportData);
      $('dataImport').addEventListener('click', importData);
      $('dataLogout').addEventListener('click', logout);
      $('dataDelete').addEventListener('click', deleteAccount);
    }
  }

  function openBackup() {
    const m = openModal(modalHead('Importa / Esporta') +
      '<div class="modal-body"><p class="hint" style="margin-top:0">Esporta una copia completa della tua pagina oppure importa un file JSON creato in precedenza.</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">' +
      '<button class="btn btn-primary btn-sm" id="bkExport"><i class="fa-solid fa-download" aria-hidden="true"></i> Esporta JSON</button>' +
      '<button class="btn btn-ghost btn-sm" id="bkImport"><i class="fa-solid fa-upload" aria-hidden="true"></i> Importa JSON</button></div>' +
      '<input type="file" id="bkFile" accept="application/json,.json" hidden /></div>');
    $('bkExport').addEventListener('click', exportData);
    $('bkImport').addEventListener('click', () => $('bkFile').click());
    $('bkFile').addEventListener('change', (e) => { if (e.target.files[0]) importFile(e.target.files[0]); });
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({ app: 'OpenStart', version: 1, data: Store.state }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'openstart-' + Store.code + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Backup esportato', 'ok');
  }
  function importData() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/json,.json';
    input.addEventListener('change', () => { if (input.files[0]) importFile(input.files[0]); });
    input.click();
  }
  async function importFile(file) {
    try {
      const parsed = JSON.parse(await file.text());
      const raw = parsed.data || parsed;
      if (!raw.pages || !Array.isArray(raw.pages)) throw new Error('File non valido');
      if (!confirm('Sostituire tutti i dati attuali con quelli del file importato?')) return;
      Store.state = Store.normalize(raw);
      closeModal(); Store.markDirty(); applyState(); renderAll();
      toast('Dati importati', 'ok');
    } catch (err) { toast('Importazione fallita: ' + err.message, 'err'); }
  }

  function openShare() {
    const page = Store.activePage();
    const existing = page.shareSlug;
    const m = openModal(modalHead('Condividi “' + page.name + '”') +
      '<div class="modal-body"><p class="hint" style="margin-top:0">Crea un link pubblico in sola lettura per mostrare questa pagina ad altri.</p>' +
      '<div id="shareBody">' + (existing ? shareBox(existing) : '<button class="btn btn-primary" id="createShare">Crea link di condivisione</button>') + '</div>' +
      '</div>', false);
    const box = (slug) => { $('shareBody').innerHTML = shareBox(slug); wireShareBox(slug, page); };
    const create = $('createShare');
    if (create) create.addEventListener('click', async () => {
      create.disabled = true;
      const slug = U.randomCode(8);
      try {
        await API.createShare(Store.code, slug, page.id, page.name, page);
        page.shareSlug = slug;
        Store.markDirty();
        box(slug);
        toast('Link creato', 'ok');
      } catch (err) { toast(err.message, 'err'); create.disabled = false; }
    });
    if (existing) wireShareBox(existing, page);
  }
  function shareBox(slug) {
    const url = location.origin + location.pathname + '?share=' + slug;
    return '<div class="share-box"><input id="shareUrl" value="' + U.esc(url) + '" readonly /><button class="btn btn-ghost btn-sm" id="shareCopy">Copia</button></div>' +
      '<div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn-ghost btn-sm" id="shareUpdate">Aggiorna contenuto</button>' +
      '<button class="btn btn-danger btn-sm" id="shareRemove">Rimuovi link</button></div>';
  }
  function wireShareBox(slug, page) {
    $('shareCopy').addEventListener('click', () => copyText($('shareUrl').value));
    $('shareUpdate').addEventListener('click', async () => {
      try { await API.updateShare(Store.code, slug, page.id, page.name, page); toast('Pagina aggiornata', 'ok'); }
      catch (err) { toast(err.message, 'err'); }
    });
    $('shareRemove').addEventListener('click', async () => {
      if (!confirm('Rimuovere il link di condivisione?')) return;
      try {
        await API.deleteShare(Store.code, slug);
        delete page.shareSlug; Store.markDirty(); closeModal(); toast('Link rimosso', 'ok');
      } catch (err) { toast(err.message, 'err'); }
    });
  }

  function openHelp() {
    openModal(modalHead('Come funziona OpenStart') +
      '<div class="modal-body"><p style="font-size:13px;line-height:1.7;margin-top:0">' +
      '<i class="fa-solid fa-file" aria-hidden="true"></i> <strong>Pagine</strong>: usa la barra laterale per creare, rinominare (doppio clic) ed eliminare pagine.<br>' +
      '<i class="fa-solid fa-puzzle-piece" aria-hidden="true"></i> <strong>Widget</strong>: aggiungili con il pulsante Widget, trascinali dalla maniglia (tieni premuto su smartphone) per riordinarli e usa il menu Opzioni per dimensioni, duplicazione e rimozione.<br>' +
      '<i class="fa-solid fa-bookmark" aria-hidden="true"></i> <strong>Collegamenti</strong>: clicca il pulsante Aggiungi; modificali con il clic destro o con la matita, trascinali per riordinarli (pressione prolungata al tatto).<br>' +
      '<i class="fa-solid fa-mobile-screen" aria-hidden="true"></i> <strong>Su smartphone</strong>: apri la barra laterale scorrendo dal bordo sinistro, chiudila con uno swipe o toccando fuori; trascina i modali verso il basso per chiuderli.<br>' +
      '<i class="fa-solid fa-key" aria-hidden="true"></i> <strong>Codice</strong>: lo trovi nella sidebar e in Impostazioni, scheda Dati. Ti serve per accedere da un altro dispositivo.<br>' +
      '<i class="fa-solid fa-rotate" aria-hidden="true"></i> <strong>Sincronizzazione</strong>: le modifiche vengono salvate automaticamente su Supabase; se sei offline restano nel browser e vengono inviate alla riconnessione.' +
      '</p></div>');
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast('Copiato negli appunti', 'ok')).catch(() => fallbackCopy(text));
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Copiato negli appunti', 'ok'); } catch (_) { toast('Impossibile copiare', 'err'); }
    ta.remove();
  }

  /* ---------------- shared page ---------------- */
  async function showShare(slug) {
    $('onboarding').classList.add('hidden');
    $('app').classList.add('hidden');
    $('shareView').classList.remove('hidden');
    $('shareTitle').textContent = 'Caricamento…';
    $('shareGrid').className = 'widget-grid animate-in';
    $('shareGrid').innerHTML = '';
    try {
      const row = await API.getShare(slug);
      if (!row || !row.slug) throw new Error('Link non trovato o rimosso');
      const data = row.data || {};
      $('shareTitle').textContent = row.title || data.name || 'Pagina condivisa';
      const widgets = Array.isArray(data.widgets) ? data.widgets : [];
      $('shareGrid').innerHTML = widgets.map((w, i) => {
        const meta = W.TYPES.find(t => t.type === w.type) || { icon: 'fa-puzzle-piece' };
        return '<section class="widget size-' + U.esc(w.size || 'md') + '" style="--i:' + i + '">' +
          '<div class="widget-head"><span class="widget-icon">' + W.icon(meta.icon) + '</span><span class="widget-title">' + U.esc(w.title) + '</span></div>' +
          '<div class="widget-body">' + W.renderBody(w, true) + '</div></section>';
      }).join('') || '<p class="hint">Questa pagina non contiene widget.</p>';
      $('shareGrid').querySelectorAll('.widget').forEach((card, i) => W.bindBody(card.querySelector('.widget-body'), widgets[i], true));
    } catch (err) {
      $('shareTitle').textContent = 'Pagina non disponibile';
      $('shareGrid').innerHTML = '<p class="hint">' + U.esc(err.message) + '</p>';
    }
  }

  /* ---------------- events ---------------- */
  function setSidebar(open) {
    const isOpen = !!open;
    $('sidebar').classList.toggle('open', isOpen);
    document.body.classList.toggle('sidebar-open', isOpen);
    if (isOpen) U.vibrate(8);
  }
  function themeTransition() {
    if (U.reduceMotion()) return;
    document.body.classList.add('theme-switching');
    clearTimeout(themeTransition._timer);
    themeTransition._timer = setTimeout(() => document.body.classList.remove('theme-switching'), 380);
  }

  function bindGlobal() {
    document.querySelectorAll('[data-ob]').forEach(b => b.addEventListener('click', () => showOb(b.dataset.ob)));

    $('createForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = ($('obName').value || '').trim();
      if (name.length < 2) { $('obNameError').hidden = false; return; }
      $('obNameError').hidden = true;
      try { await createAccount(name); }
      catch (err) { toast(err.message, 'err'); }
    });
    $('restoreForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      $('obCodeError').hidden = true;
      try { await restore($('obCode').value); }
      catch (err) { $('obCodeError').textContent = err.message; $('obCodeError').hidden = false; }
    });
    $('obCopyCode').addEventListener('click', () => copyText($('obCodeValue').textContent));
    $('obEnter').addEventListener('click', enterApp);

    document.addEventListener('os:savestate', (e) => setSaveState(e.detail.status, e.detail.message));

    $('menuToggle').addEventListener('click', () => setSidebar(!$('sidebar').classList.contains('open')));
    $('sidebarBackdrop').addEventListener('click', () => setSidebar(false));
    $('sidebarToggle').addEventListener('click', () => {
      Store.state.sidebarCollapsed = !Store.state.sidebarCollapsed;
      Store.markDirty();
      applySidebar();
    });
    $('addPageBtn').addEventListener('click', addPage);
    $('pagesList').addEventListener('click', (e) => {
      const rename = e.target.closest('[data-rename-page]');
      if (rename) {
        e.stopPropagation();
        const page = Store.state.pages.find(p => p.id === rename.dataset.renamePage);
        if (page) openPageNameModal(page);
        return;
      }
      const del = e.target.closest('[data-del-page]');
      if (del) {
        e.stopPropagation();
        if (Store.state.pages.length <= 1) { toast('Deve restare almeno una pagina', 'err'); return; }
        if (!confirm('Eliminare questa pagina e i suoi widget?')) return;
        Store.state.pages = Store.state.pages.filter(p => p.id !== del.dataset.delPage);
        if (Store.state.activePageId === del.dataset.delPage) Store.state.activePageId = Store.state.pages[0].id;
        Store.markDirty(); renderAll(); return;
      }
      const item = e.target.closest('[data-page-id]');
      if (item) {
        Store.state.activePageId = item.dataset.pageId;
        Store.markDirty(); renderAll();
        setSidebar(false);
      }
    });
    $('pagesList').addEventListener('dblclick', (e) => {
      if (e.target.closest('button')) return;
      const item = e.target.closest('[data-page-id]');
      if (!item) return;
      const page = Store.state.pages.find(p => p.id === item.dataset.pageId);
      if (page) openPageNameModal(page);
    });
    $('pagesList').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const item = e.target.closest('[data-page-id]');
      if (!item || e.target !== item) return;
      e.preventDefault();
      Store.state.activePageId = item.dataset.pageId;
      Store.markDirty(); renderAll(); setSidebar(false);
    });

    $('pageTitle').addEventListener('change', () => {
      const page = Store.activePage();
      page.name = ($('pageTitle').value || 'Pagina').trim().slice(0, 40);
      Store.markDirty(); renderPages();
    });
    $('pageTitle').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });

    $('layoutBtn').addEventListener('click', () => {
      const page = Store.activePage();
      page.columns = page.columns === 6 ? 12 : 6;
      Store.markDirty(); renderPage();
    });
    $('addWidgetBtn').addEventListener('click', openWidgetPicker);
    $('addWidgetTop').addEventListener('click', openWidgetPicker);
    $('sharePageBtn').addEventListener('click', openShare);

    $('widgetGrid').addEventListener('click', (e) => {
      const menuBtn = e.target.closest('[data-wk-menu]');
      if (menuBtn) {
        const menu = document.querySelector('[data-menu-for="' + CSS.escape(menuBtn.dataset.wkMenu) + '"]');
        document.querySelectorAll('.widget-menu').forEach(m => { if (m !== menu) m.classList.add('hidden'); });
        menu.classList.toggle('hidden');
        return;
      }
      const action = e.target.closest('[data-waction]');
      if (action) {
        const id = action.closest('[data-menu-for]').dataset.menuFor;
        const found = Store.findWidget(id);
        if (!found) return;
        if (action.dataset.waction === 'edit') openWidgetEditor(id);
        if (action.dataset.waction === 'size') { found.widget.size = action.dataset.size; Store.markDirty(); renderPage(); }
        if (action.dataset.waction === 'duplicate') {
          const copy = JSON.parse(JSON.stringify(found.widget));
          copy.id = U.uid('w');
          found.page.widgets.push(copy);
          Store.markDirty(); renderPage(); toast('Widget duplicato', 'ok');
        }
        if (action.dataset.waction === 'remove') {
          found.page.widgets = found.page.widgets.filter(w => w.id !== id);
          Store.markDirty(); renderPage(); toast('Widget rimosso');
        }
        return;
      }
      if (!e.target.closest('.widget-menu')) document.querySelectorAll('.widget-menu').forEach(m => m.classList.add('hidden'));
    });

    // Riordino universale: mouse, penna e dito (pressione prolungata). Niente drag HTML5.
    if (window.OS_SORTABLE) {
      window.OS_SORTABLE.create($('pagesList'), {
        item: '.page-item',
        delay: 160,
        onReorder(from, to) {
          if (from === to) return;
          const pages = Store.state.pages;
          const [moved] = pages.splice(from, 1);
          pages.splice(to, 0, moved);
          Store.markDirty(); renderPages();
        }
      });
      window.OS_SORTABLE.create($('widgetGrid'), {
        item: '.widget',
        handle: '.widget-drag',
        delay: 200,
        onReorder(from, to) {
          if (from === to) return;
          const page = Store.activePage();
          const [moved] = page.widgets.splice(from, 1);
          page.widgets.splice(to, 0, moved);
          Store.markDirty(); renderPage(false);
        }
      });
    }

    $('themeToggle').addEventListener('click', () => {
      themeTransition();
      Store.state.theme = Store.state.theme === 'dark' ? 'light' : 'dark';
      U.vibrate(8);
      Store.markDirty(); applyState();
    });
    $('userBtn').addEventListener('click', (e) => { e.stopPropagation(); $('userMenu').classList.toggle('hidden'); });
    $('sideCode').addEventListener('click', () => copyText(Store.code));
    $('brandHome').addEventListener('click', (e) => { e.preventDefault(); if (Store.state.pages[0]) { Store.state.activePageId = Store.state.pages[0].id; Store.markDirty(); renderAll(); } });

    $('userMenu').addEventListener('click', (e) => {
      const item = e.target.closest('[data-user]');
      if (!item) return;
      $('userMenu').classList.add('hidden');
      if (item.dataset.user === 'settings') openSettings('general');
      if (item.dataset.user === 'backup') openBackup();
      if (item.dataset.user === 'share') openShare();
      if (item.dataset.user === 'logout') logout();
    });
    document.querySelectorAll('[data-side]').forEach(b => b.addEventListener('click', () => {
      setSidebar(false);
      if (b.dataset.side === 'settings') openSettings('general');
      if (b.dataset.side === 'backup') openBackup();
      if (b.dataset.side === 'help') openHelp();
    }));
    $('shareCreateBtn').addEventListener('click', () => { location.href = location.pathname; });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.user-wrap')) $('userMenu').classList.add('hidden');
      if (!e.target.closest('.widget-menu') && !e.target.closest('[data-wk-menu]')) document.querySelectorAll('.widget-menu').forEach(m => m.classList.add('hidden'));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal(true);
        setSidebar(false);
        document.querySelectorAll('.widget-menu, .user-menu').forEach(m => m.classList.add('hidden'));
      }
    });

    // Ripple leggero sui pulsanti, con rimozione automatica a fine animazione.
    document.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const btn = e.target.closest('.btn, .pill-btn, .icon-btn, .mini-add, .link-add, .segmented button, .tab, .timer-controls button, .swatch');
      if (!btn || btn.disabled) return;
      const r = btn.getBoundingClientRect();
      const span = document.createElement('span');
      span.className = 'ripple';
      span.style.left = (e.clientX - r.left) + 'px';
      span.style.top = (e.clientY - r.top) + 'px';
      btn.appendChild(span);
      span.addEventListener('animationend', () => span.remove(), { once: true });
    }, { passive: true });

    // Switch laterale: apri dal bordo sinistro, chiudi con uno swipe sulla sidebar.
    let edge = null;
    document.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || e.target.closest('.modal-backdrop')) return;
      const sidebar = $('sidebar');
      const isOpen = sidebar.classList.contains('open');
      const fromEdge = !isOpen && e.clientX <= 24;
      const fromSidebar = isOpen && !!e.target.closest('.sidebar') && !e.target.closest('.page-item') && !e.target.closest('button');
      if (!fromEdge && !fromSidebar) return;
      edge = { id: e.pointerId, x: e.clientX, y: e.clientY, mode: fromEdge ? 'open' : 'close', moved: false };
    });
    document.addEventListener('pointermove', (e) => {
      if (!edge || e.pointerId !== edge.id) return;
      const dx = e.clientX - edge.x;
      const dy = e.clientY - edge.y;
      if (Math.abs(dy) > Math.abs(dx)) { edge = null; return; }
      if (Math.abs(dx) > 8) edge.moved = true;
      if (!edge.moved) return;
      e.preventDefault();
      const progress = edge.mode === 'open' ? U.clamp(dx / 246, 0, 1) : 1 - U.clamp(-dx / 246, 0, 1);
      $('sidebar').style.transform = 'translateX(' + ((progress - 1) * 100) + '%)';
      $('sidebarBackdrop').style.opacity = String(progress * .9);
    }, { passive: false });
    const endSwipe = (e) => {
      if (!edge || e.pointerId !== edge.id) return;
      const dx = e.clientX - edge.x;
      const mode = edge.mode;
      const moved = edge.moved;
      edge = null;
      $('sidebar').style.transform = '';
      $('sidebarBackdrop').style.opacity = '';
      if (!moved) return;
      if (mode === 'open' && dx > 60) setSidebar(true);
      if (mode === 'close' && dx < -60) setSidebar(false);
    };
    document.addEventListener('pointerup', endSwipe);
    document.addEventListener('pointercancel', endSwipe);
  }

  function addPage() { openPageNameModal(null); }

  function openPageNameModal(page) {
    const creating = !page;
    openModal(modalHead(creating ? 'Nuova pagina' : 'Rinomina pagina') +
      '<div class="modal-body"><div class="form-row"><label>Nome della pagina</label>' +
      '<input id="pgName" type="text" maxlength="40" value="' + U.esc(creating ? '' : page.name) + '" placeholder="Es. Lavoro" autocomplete="off" /></div></div>' +
      '<div class="modal-foot"><button class="btn btn-ghost" data-modal-close>Annulla</button>' +
      '<button class="btn btn-primary" id="pgSave">' + (creating ? 'Crea' : 'Salva') + '</button></div>');
    const input = $('pgName');
    setTimeout(() => { input.focus(); input.select(); }, 60);
    const save = () => {
      const name = (input.value || '').trim().slice(0, 40);
      if (name.length < 2) { toast('Inserisci un nome di almeno 2 caratteri', 'err'); return; }
      if (creating) {
        const icons = ['fa-file', 'fa-star', 'fa-music', 'fa-gamepad', 'fa-book', 'fa-cart-shopping', 'fa-person-running', 'fa-lightbulb'];
        const fresh = { id: U.uid('p'), name: name, icon: icons[Store.state.pages.length % icons.length], columns: 12, widgets: [] };
        Store.state.pages.push(fresh);
        Store.state.activePageId = fresh.id;
      } else page.name = name;
      closeModal();
      Store.markDirty(); renderAll();
      U.vibrate(12);
      toast(creating ? 'Pagina creata' : 'Pagina rinominata', 'ok');
    };
    $('pgSave').addEventListener('click', save);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
  }

  /* ---------------- boot ---------------- */
  function boot() {
    bindGlobal();
    const slug = new URLSearchParams(location.search).get('share');
    if (slug) { showShare(slug); return; }
    const session = Store.readSession();
    if (session && session.code) {
      restore(session.code, true).then(() => enterApp()).catch(() => {
        const cache = Store.readCache();
        if (cache && cache.code === session.code && cache.state) {
          Store.code = session.code;
          Store.state = Store.normalize(cache.state);
          enterApp();
          setSaveState('offline', 'Sincronizzazione non disponibile');
          toast('Dati caricati dal browser: riproverò a sincronizzare', 'err');
          setInterval(() => { if (Store.code) Store.flush(); }, 30000);
        } else {
          Store.clearSession();
          showOb('create');
          toast('Codice non più valido, crea una nuova pagina', 'err');
        }
      });
    } else {
      showOb('create');
    }
  }

  Object.assign(APP, { openWidgetPicker, openLinkEditor: APP.openLinkEditor, openPageNameModal, boot });
  window.OS_APP = APP;
  boot();
})();
