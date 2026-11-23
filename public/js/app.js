(function () {
  'use strict';

  const U = window.OS_UTIL;
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
    setTimeout(() => el.remove(), 3200);
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
  function applyState() {
    const s = Store.state;
    if (!s) return;
    document.body.dataset.theme = s.theme === 'dark' ? 'dark' : 'light';
    document.body.dataset.density = s.density || 'comfortable';
    const wall = Store.WALLPAPERS[s.wallpaper] || Store.WALLPAPERS.aurora;
    document.body.style.setProperty('--wallpaper', wall);
    const accent = s.accent || '#2563eb';
    document.body.style.setProperty('--accent', accent);
    document.body.style.setProperty('--accent-dark', shade(accent, -22));
    document.body.style.setProperty('--accent-soft', hexToRgba(accent, .12));

    const initials = U.initials(s.name);
    ['topAvatar', 'menuAvatar', 'sideAvatar'].forEach(id => { $(id).textContent = initials; });
    $('menuName').textContent = s.name || 'Utente';
    $('menuCode').textContent = Store.code || '——————';
    $('sideName').textContent = s.name || 'Utente';
    $('sideCode').innerHTML = U.esc(Store.code || '——————') + ' <span aria-hidden="true">⧉</span>';
    const engine = Store.ENGINES[s.searchEngine] || Store.ENGINES.google;
    $('engineInitial').textContent = engine.initial;
    $('themeToggle').textContent = s.theme === 'dark' ? '☀️' : '☾';
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

  function renderAll() {
    renderPages();
    renderPage();
  }

  function renderPages() {
    const list = $('pagesList');
    list.innerHTML = Store.state.pages.map(p =>
      '<button class="page-item' + (p.id === Store.state.activePageId ? ' active' : '') + '" data-page-id="' + U.esc(p.id) + '" draggable="true">' +
      '<span class="pg-icon">' + U.esc(p.icon || '📄') + '</span>' +
      '<span class="pg-name">' + U.esc(p.name) + '</span>' +
      '<span class="pg-del" data-del-page="' + U.esc(p.id) + '" title="Elimina pagina">×</span></button>'
    ).join('');
  }

  function renderPage() {
    const page = Store.activePage();
    if (!page) return;
    $('pageTitle').value = page.name;
    $('layoutLabel').textContent = (page.columns === 6 ? '6' : '12') + ' col';
    const grid = $('widgetGrid');
    grid.className = 'widget-grid' + (page.columns === 6 ? ' cols-6' : '');
    grid.innerHTML = page.widgets.map(w => widgetCard(w)).join('') +
      '<button class="add-widget-tile" id="addWidgetTile"><span class="plus">＋</span><span>Aggiungi widget</span></button>';

    grid.querySelectorAll('.widget').forEach(card => {
      const w = page.widgets.find(x => x.id === card.dataset.widgetId);
      if (w) W.bindBody(card.querySelector('.widget-body'), w, false);
    });
    $('addWidgetTile').addEventListener('click', openWidgetPicker);
    $('pageSubtitle').textContent = page.widgets.length + ' widget · trascina la maniglia per riordinare · doppio clic su una pagina per rinominarla';
  }

  function widgetCard(w) {
    const meta = W.TYPES.find(t => t.type === w.type) || { icon: '🧩' };
    const menu =
      '<div class="widget-menu hidden" data-menu-for="' + U.esc(w.id) + '">' +
      '<button data-waction="edit">✏️ Impostazioni widget</button>' +
      '<div class="menu-label">Dimensione</div>' +
      ['sm:Piccolo', 'md:Medio', 'lg:Grande', 'xl:Intero'].map(x => {
        const [size, label] = x.split(':');
        return '<button data-waction="size" data-size="' + size + '">' + (w.size === size ? '✓ ' : '　') + label + '</button>';
      }).join('') +
      '<div class="menu-sep"></div>' +
      '<button data-waction="duplicate">⧉ Duplica</button>' +
      '<button data-waction="remove">🗑 Rimuovi</button></div>';

    return '<section class="widget size-' + U.esc(w.size || 'md') + '" data-widget-id="' + U.esc(w.id) + '">' +
      '<div class="widget-head">' +
      '<span class="widget-drag" draggable="true" data-drag-widget="' + U.esc(w.id) + '" title="Trascina per riordinare">⠿</span>' +
      '<span class="widget-icon">' + meta.icon + '</span>' +
      '<span class="widget-title">' + U.esc(w.title) + '</span>' +
      '<button class="widget-menu-btn" data-wk-menu="' + U.esc(w.id) + '" title="Opzioni">⋯</button>' +
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
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = '<div class="modal' + (wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' + html + '</div>';
    $('modalRoot').appendChild(backdrop);
    modalEl = backdrop.querySelector('.modal');
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) closeModal(); });
    modalEl.querySelectorAll('[data-modal-close]').forEach(b => b.addEventListener('click', closeModal));
    return modalEl;
  }
  function closeModal() { $('modalRoot').innerHTML = ''; modalEl = null; }
  function modalHead(title) {
    return '<div class="modal-head"><h2>' + U.esc(title) + '</h2><button class="modal-close" data-modal-close aria-label="Chiudi">×</button></div>';
  }

  function openWidgetPicker() {
    const page = Store.activePage();
    const m = openModal(modalHead('Aggiungi un widget') +
      '<div class="modal-body"><p class="hint" style="margin-top:0">Scegli un widget da aggiungere a “' + U.esc(page.name) + '”.</p>' +
      '<div class="widget-picker">' + W.TYPES.map(t =>
        '<button class="widget-pick" data-pick="' + t.type + '"><span class="pic">' + t.icon + '</span><strong>' + U.esc(t.label) + '</strong><small>' + U.esc(t.desc) + '</small></button>'
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
        rows + '</div><button class="link-btn" type="button" id="addLinkRow" style="margin-top:8px">＋ Aggiungi riga</button></div>';
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
      '<button type="button" data-row-del title="Elimina">×</button></div>';
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
        '<div class="form-row"><label>Motore di ricerca</label><select id="setEngine">' +
        Object.keys(Store.ENGINES).map(k => '<option value="' + k + '"' + (s.searchEngine === k ? ' selected' : '') + '>' + Store.ENGINES[k].label + '</option>').join('') +
        '</select></div>' +
        '<label class="check-row"><input type="checkbox" id="set24"' + (s.clock24h !== false ? ' checked' : '') + ' /> Formato orologio 24 ore</label>' +
        '<label class="check-row"><input type="checkbox" id="setSec"' + (s.showSeconds ? ' checked' : '') + ' /> Mostra i secondi</label>' +
        '<div class="modal-foot" style="padding:16px 0 0"><button class="btn btn-primary" id="setSaveGeneral">Salva modifiche</button></div>';
      $('setSaveGeneral').addEventListener('click', () => {
        s.name = ($('setName').value || 'Utente').trim();
        s.title = $('setTitle').value.trim();
        s.searchEngine = $('setEngine').value;
        s.clock24h = $('set24').checked;
        s.showSeconds = $('setSec').checked;
        closeModal(); Store.markDirty(); applyState(); renderAll();
        toast('Impostazioni salvate', 'ok');
      });
    } else if (tab === 'appearance') {
      host.innerHTML =
        '<div class="form-row"><label>Tema</label><div class="segmented" id="segTheme">' +
        ['light:☀️ Chiaro', 'dark:☾ Scuro'].map(x => { const [v, l] = x.split(':'); return '<button data-value="' + v + '" class="' + (s.theme === v ? 'active' : '') + '">' + l + '</button>'; }).join('') +
        '</div></div>' +
        '<div class="form-row"><label>Colore principale</label><div class="swatches" id="accentSwatches">' +
        Store.ACCENTS.map(a => '<button class="swatch' + (s.accent === a ? ' active' : '') + '" data-accent="' + a + '" style="background:' + a + '" aria-label="' + a + '"></button>').join('') +
        '</div></div>' +
        '<div class="form-row"><label>Sfondo</label><div class="wallpapers" id="wallpapers">' +
        Object.keys(Store.WALLPAPERS).map(k => '<button class="wallpaper' + (s.wallpaper === k ? ' active' : '') + '" data-wall="' + k + '" style="background:' + Store.WALLPAPERS[k] + '" title="' + k + '"></button>').join('') +
        '</div></div>' +
        '<div class="form-row"><label>Densità widget</label><div class="segmented" id="segDensity">' +
        ['comfortable:Comoda', 'compact:Compatta'].map(x => { const [v, l] = x.split(':'); return '<button data-value="' + v + '" class="' + ((s.density || 'comfortable') === v ? 'active' : '') + '">' + l + '</button>'; }).join('') +
        '</div></div>';
      host.querySelectorAll('#segTheme button, #segDensity button').forEach(b => b.addEventListener('click', () => {
        const parent = b.parentElement;
        parent.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
        if (parent.id === 'segTheme') s.theme = b.dataset.value; else s.density = b.dataset.value;
        Store.markDirty(); applyState(); renderPage();
      }));
      host.querySelectorAll('[data-accent]').forEach(b => b.addEventListener('click', () => {
        s.accent = b.dataset.accent;
        host.querySelectorAll('[data-accent]').forEach(x => x.classList.toggle('active', x === b));
        Store.markDirty(); applyState();
      }));
      host.querySelectorAll('[data-wall]').forEach(b => b.addEventListener('click', () => {
        s.wallpaper = b.dataset.wall;
        host.querySelectorAll('[data-wall]').forEach(x => x.classList.toggle('active', x === b));
        Store.markDirty(); applyState();
      }));
    } else {
      host.innerHTML =
        '<div class="form-row"><label>Codice personale (6 caratteri)</label><div class="share-box"><input id="dataCode" value="' + U.esc(Store.code) + '" readonly /><button class="btn btn-ghost btn-sm" id="dataCopy">Copia</button></div>' +
        '<p class="hint">Salva questo codice: inserendolo su un altro dispositivo ritroverai tutti i tuoi dati.</p></div>' +
        '<div class="form-row"><label>Backup</label><div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn btn-ghost btn-sm" id="dataExport">⬇ Esporta JSON</button>' +
        '<button class="btn btn-ghost btn-sm" id="dataImport">⬆ Importa JSON</button></div></div>' +
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
      '<button class="btn btn-primary btn-sm" id="bkExport">⬇ Esporta JSON</button>' +
      '<button class="btn btn-ghost btn-sm" id="bkImport">⬆ Importa JSON</button></div>' +
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
      '• <strong>Pagine</strong>: usa la barra laterale per creare, rinominare (doppio clic) ed eliminare pagine.<br>' +
      '• <strong>Widget</strong>: aggiungili con ＋ Widget, trascinali dalla maniglia ⠿ per riordinarli e usa ⋯ per dimensioni, duplicazione e rimozione.<br>' +
      '• <strong>Collegamenti</strong>: clicca ＋ per aggiungerli, clic destro per modificarli, trascinali per riordinarli.<br>' +
      '• <strong>Codice</strong>: lo trovi nella sidebar e in Impostazioni → Dati. Ti serve per accedere da un altro dispositivo.<br>' +
      '• <strong>Sincronizzazione</strong>: le modifiche vengono salvate automaticamente su Supabase; se sei offline restano nel browser e vengono inviate alla riconnessione.' +
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
    $('shareGrid').innerHTML = '';
    try {
      const row = await API.getShare(slug);
      if (!row || !row.slug) throw new Error('Link non trovato o rimosso');
      const data = row.data || {};
      $('shareTitle').textContent = row.title || data.name || 'Pagina condivisa';
      const widgets = Array.isArray(data.widgets) ? data.widgets : [];
      $('shareGrid').innerHTML = widgets.map(w => {
        const meta = W.TYPES.find(t => t.type === w.type) || { icon: '🧩' };
        return '<section class="widget size-' + U.esc(w.size || 'md') + '">' +
          '<div class="widget-head"><span class="widget-icon">' + meta.icon + '</span><span class="widget-title">' + U.esc(w.title) + '</span></div>' +
          '<div class="widget-body">' + W.renderBody(w, true) + '</div></section>';
      }).join('') || '<p class="hint">Questa pagina non contiene widget.</p>';
      $('shareGrid').querySelectorAll('.widget').forEach((card, i) => W.bindBody(card.querySelector('.widget-body'), widgets[i], true));
    } catch (err) {
      $('shareTitle').textContent = 'Pagina non disponibile';
      $('shareGrid').innerHTML = '<p class="hint">' + U.esc(err.message) + '</p>';
    }
  }

  /* ---------------- events ---------------- */
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

    $('menuToggle').addEventListener('click', () => $('sidebar').classList.toggle('open'));
    $('addPageBtn').addEventListener('click', addPage);
    $('pagesList').addEventListener('click', (e) => {
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
        $('sidebar').classList.remove('open');
      }
    });
    $('pagesList').addEventListener('dblclick', (e) => {
      const item = e.target.closest('[data-page-id]');
      if (!item) return;
      const page = Store.state.pages.find(p => p.id === item.dataset.pageId);
      const name = prompt('Nuovo nome della pagina', page.name);
      if (name && name.trim()) { page.name = name.trim().slice(0, 40); Store.markDirty(); renderAll(); }
    });
    let dragPageId = null;
    $('pagesList').addEventListener('dragstart', (e) => {
      const item = e.target.closest('[data-page-id]');
      if (!item) return;
      dragPageId = item.dataset.pageId;
      e.dataTransfer.effectAllowed = 'move';
    });
    $('pagesList').addEventListener('dragover', (e) => { if (e.target.closest('[data-page-id]')) e.preventDefault(); });
    $('pagesList').addEventListener('drop', (e) => {
      const target = e.target.closest('[data-page-id]');
      if (!target || !dragPageId) return;
      e.preventDefault();
      const from = Store.state.pages.findIndex(p => p.id === dragPageId);
      const to = Store.state.pages.findIndex(p => p.id === target.dataset.pageId);
      if (from < 0 || to < 0 || from === to) return;
      const [moved] = Store.state.pages.splice(from, 1);
      Store.state.pages.splice(to, 0, moved);
      dragPageId = null; Store.markDirty(); renderPages();
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

    let dragWidgetId = null;
    $('widgetGrid').addEventListener('dragstart', (e) => {
      const handle = e.target.closest('[data-drag-widget]');
      if (!handle) return;
      dragWidgetId = handle.dataset.dragWidget;
      const card = handle.closest('.widget');
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'widget:' + dragWidgetId);
    });
    $('widgetGrid').addEventListener('dragover', (e) => {
      const card = e.target.closest('.widget');
      if (!card || !dragWidgetId) return;
      e.preventDefault();
      document.querySelectorAll('.widget.drag-over').forEach(x => x.classList.remove('drag-over'));
      card.classList.add('drag-over');
    });
    $('widgetGrid').addEventListener('drop', (e) => {
      const card = e.target.closest('.widget');
      if (!card || !dragWidgetId) return;
      e.preventDefault();
      const page = Store.activePage();
      const from = page.widgets.findIndex(w => w.id === dragWidgetId);
      const to = page.widgets.findIndex(w => w.id === card.dataset.widgetId);
      if (from >= 0 && to >= 0 && from !== to) {
        const [moved] = page.widgets.splice(from, 1);
        page.widgets.splice(to, 0, moved);
        Store.markDirty();
      }
      dragWidgetId = null;
      renderPage();
    });
    $('widgetGrid').addEventListener('dragend', () => {
      dragWidgetId = null;
      document.querySelectorAll('.widget.dragging, .widget.drag-over').forEach(x => x.classList.remove('dragging', 'drag-over'));
    });

    $('engineBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = $('engineMenu');
      menu.innerHTML = Object.keys(Store.ENGINES).map(k =>
        '<button data-engine="' + k + '"><b>' + Store.ENGINES[k].initial + '</b>' + Store.ENGINES[k].label + '</button>').join('');
      menu.classList.toggle('hidden');
      menu.querySelectorAll('[data-engine]').forEach(b => b.addEventListener('click', () => {
        Store.state.searchEngine = b.dataset.engine;
        Store.markDirty(); applyState(); menu.classList.add('hidden');
      }));
    });
    $('searchForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = $('searchInput').value.trim();
      if (!q) return;
      const engine = Store.ENGINES[Store.state.searchEngine] || Store.ENGINES.google;
      window.open(engine.url + encodeURIComponent(q), '_blank', 'noopener');
    });

    $('themeToggle').addEventListener('click', () => {
      Store.state.theme = Store.state.theme === 'dark' ? 'light' : 'dark';
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
      $('sidebar').classList.remove('open');
      if (b.dataset.side === 'settings') openSettings('general');
      if (b.dataset.side === 'backup') openBackup();
      if (b.dataset.side === 'help') openHelp();
    }));
    $('shareCreateBtn').addEventListener('click', () => { location.href = location.pathname; });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.user-wrap')) $('userMenu').classList.add('hidden');
      if (!e.target.closest('.search-wrap')) $('engineMenu').classList.add('hidden');
      if (!e.target.closest('.widget-menu') && !e.target.closest('[data-wk-menu]')) document.querySelectorAll('.widget-menu').forEach(m => m.classList.add('hidden'));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeModal(); document.querySelectorAll('.widget-menu, .user-menu, .engine-menu').forEach(m => m.classList.add('hidden')); }
      if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) && !$('app').classList.contains('hidden')) {
        e.preventDefault(); $('searchInput').focus();
      }
    });
  }

  function addPage() {
    const name = prompt('Nome della nuova pagina', 'Nuova pagina');
    if (!name || !name.trim()) return;
    const icons = ['📄', '⭐', '🎵', '🎮', '📚', '🛒', '🏃', '💡'];
    const page = { id: U.uid('p'), name: name.trim().slice(0, 40), icon: icons[Store.state.pages.length % icons.length], columns: 12, widgets: [] };
    Store.state.pages.push(page);
    Store.state.activePageId = page.id;
    Store.markDirty(); renderAll();
    toast('Pagina creata', 'ok');
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

  Object.assign(APP, { openWidgetPicker, openLinkEditor: APP.openLinkEditor, boot });
  window.OS_APP = APP;
  boot();
})();
