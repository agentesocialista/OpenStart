(function () {
  'use strict';

  const U = window.OS_UTIL;
  const cfg = window.OS_CONFIG;

  const TYPES = [
    { type: 'links', label: 'Collegamenti', icon: 'fa-bookmark', desc: 'Griglia di siti e scorciatoie', title: 'Collegamenti', size: 'md' },
    { type: 'clock', label: 'Orologio', icon: 'fa-clock', desc: 'Ora e data aggiornate', title: 'Orologio', size: 'sm' },
    { type: 'notes', label: 'Note', icon: 'fa-note-sticky', desc: 'Un blocco di testo personale', title: 'Note', size: 'md' },
    { type: 'todo', label: 'Da fare', icon: 'fa-list-check', desc: 'Lista attività con progresso', title: 'Da fare', size: 'md' },
    { type: 'weather', label: 'Meteo', icon: 'fa-cloud-sun', desc: 'Previsioni per la tua città', title: 'Meteo', size: 'md' },
    { type: 'feed', label: 'Feed RSS', icon: 'fa-newspaper', desc: 'Ultime notizie da un feed', title: 'Notizie', size: 'lg' },
    { type: 'calendar', label: 'Calendario', icon: 'fa-calendar-days', desc: 'Mini calendario mensile', title: 'Calendario', size: 'md' },
    { type: 'quote', label: 'Citazione', icon: 'fa-comment-dots', desc: 'Una frase ogni giorno', title: 'Citazione del giorno', size: 'sm' },
    { type: 'timer', label: 'Timer', icon: 'fa-stopwatch', desc: 'Conto alla rovescia / pomodoro', title: 'Timer', size: 'sm' }
  ];

  const QUOTES = [
    ['Il successo è la somma di piccoli sforzi ripetuti ogni giorno.', 'Robert Collier'],
    ['La semplicità è il massimo della sofisticazione.', 'Leonardo da Vinci'],
    ['Non aspettare il momento perfetto: prendi quello che hai e fallo diventare perfetto.', 'Anonimo'],
    ['Ogni giorno è una nuova opportunità per fare qualcosa di grande.', 'Anonimo'],
    ['La disciplina è il ponte tra gli obiettivi e i risultati.', 'Jim Rohn'],
    ['Fai della tua passione il tuo lavoro e non lavorerai mai più.', 'Confucio']
  ];

  const WEATHER_CODES = {
    0: ['fa-sun', 'sereno'], 1: ['fa-cloud-sun', 'principalmente sereno'], 2: ['fa-cloud-sun', 'parzialmente nuvoloso'],
    3: ['fa-cloud', 'nuvoloso'], 45: ['fa-smog', 'nebbia'], 48: ['fa-smog', 'nebbia'],
    51: ['fa-cloud-rain', 'pioviggine'], 53: ['fa-cloud-rain', 'pioviggine'], 55: ['fa-cloud-showers-heavy', 'pioviggine'],
    61: ['fa-cloud-rain', 'pioggia'], 63: ['fa-cloud-rain', 'pioggia'], 65: ['fa-cloud-showers-heavy', 'pioggia forte'],
    71: ['fa-snowflake', 'neve'], 73: ['fa-snowflake', 'neve'], 75: ['fa-snowflake', 'neve forte'],
    80: ['fa-cloud-showers-heavy', 'rovesci'], 81: ['fa-cloud-showers-heavy', 'rovesci'], 82: ['fa-cloud-bolt', 'rovesci forti'],
    95: ['fa-bolt', 'temporale'], 96: ['fa-bolt', 'temporale'], 99: ['fa-bolt', 'temporale']
  };

  const timers = Object.create(null);
  const calendars = Object.create(null);

  function defaults(type) {
    switch (type) {
      case 'links': return { links: [] };
      case 'notes': return { text: '' };
      case 'todo': return { items: [] };
      case 'weather': return { city: 'Roma' };
      case 'feed': return { url: '', items: [] };
      case 'timer': return { minutes: 25 };
      default: return {};
    }
  }
  function make(type) {
    const t = TYPES.find(x => x.type === type) || TYPES[0];
    return { id: U.uid('w'), type: t.type, title: t.title, size: t.size, config: defaults(t.type) };
  }

  function icon(name, extra) {
    return '<i class="fa-solid ' + U.esc(name || 'fa-puzzle-piece') + (extra ? ' ' + U.esc(extra) : '') + '" aria-hidden="true"></i>';
  }

  function empty(name, text) {
    return '<div class="empty-widget"><span class="big">' + icon(name) + '</span><span>' + U.esc(text) + '</span></div>';
  }

  function favicon(url) {
    const src = U.favicon(url);
    return src ? '<img class="link-favicon" src="' + U.esc(src) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '';
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
  }

  function renderBody(widget, readonly) {
    const c = widget.config || {};
    switch (widget.type) {
      case 'clock':
        return '<div class="clock-widget"><div class="clock-time" data-clock>' + U.formatClock(new Date(), window.OS_STORE.state || {}) + '</div>' +
          '<div class="clock-date">' + U.esc(U.formatDate(new Date())) + '</div></div>';

      case 'links': {
        const links = Array.isArray(c.links) ? c.links : [];
        if (!links.length && readonly) return empty('fa-bookmark', 'Nessun collegamento');
        return '<div class="link-grid">' + links.map((l, i) =>
          '<a class="link-tile" href="' + U.esc(U.safeExternal(l.url)) + '" target="_blank" rel="noopener noreferrer" data-link-index="' + i + '"' + (readonly ? ' tabindex="-1"' : ' draggable="true"') + '>' +
          '<span class="link-icon" style="--tile:' + U.esc(l.color || U.colorFrom(l.url)) + '">' + favicon(l.url) + '<span class="link-initial">' + U.esc((l.title || '?').trim().charAt(0)) + '</span></span>' +
          '<span class="link-title">' + U.esc(l.title) + '</span></a>'
        ).join('') + (readonly ? '' : '<button class="link-add" data-wk="add-link" title="Aggiungi collegamento">' + icon('fa-plus') + '</button>') + '</div>';
      }

      case 'notes':
        return '<textarea class="notes-area" data-wk="notes" placeholder="Scrivi qui le tue note…"' + (readonly ? ' readonly' : '') + '>' + U.esc(c.text || '') + '</textarea>';

      case 'todo': {
        const items = Array.isArray(c.items) ? c.items : [];
        const done = items.filter(x => x.done).length;
        const pct = items.length ? Math.round(done / items.length * 100) : 0;
        return (readonly ? '' : '<form class="todo-add" data-wk="todo-form"><input type="text" name="task" placeholder="Nuova attività…" maxlength="120" required /><button type="submit" title="Aggiungi attività">' + icon('fa-plus') + '</button></form>') +
          (items.length ? '<ul class="todo-list">' + items.map((it, i) =>
            '<li class="todo-item' + (it.done ? ' done' : '') + '">' +
            '<input type="checkbox" data-wk="todo-toggle" data-index="' + i + '"' + (it.done ? ' checked' : '') + (readonly ? ' disabled' : '') + ' />' +
            '<span>' + U.esc(it.text) + '</span>' +
            (readonly ? '' : '<button class="todo-del" data-wk="todo-del" data-index="' + i + '" title="Elimina">' + icon('fa-xmark') + '</button>') + '</li>').join('') + '</ul>' : empty('fa-list-check', 'Nessuna attività')) +
          (items.length ? '<div class="todo-progress"><i style="width:' + pct + '%"></i></div>' : '');
      }

      case 'weather':
        return '<div data-weather-root><div class="weather-main"><div class="weather-icon">' + icon('fa-hourglass') + '</div><div><div class="weather-desc">Caricamento meteo…</div><div class="weather-place">' + U.esc(c.city || 'Roma') + '</div></div></div></div>' +
          (readonly ? '' : '<form class="inline-form" data-wk="weather-form" style="margin-top:12px"><input type="text" name="city" value="' + U.esc(c.city || 'Roma') + '" placeholder="Città" required /><button class="btn btn-ghost btn-sm" type="submit">Aggiorna</button></form>');

      case 'feed':
        return '<div data-feed-root>' + (c.url ? '<div class="hint">Caricamento feed…</div>' : empty('fa-newspaper', 'Imposta un URL RSS nelle impostazioni del widget')) + '</div>' +
          (readonly ? '' : '<form class="inline-form" data-wk="feed-form" style="margin-top:10px"><input type="url" name="url" value="' + U.esc(c.url || '') + '" placeholder="https://…/feed.xml" required /><button class="btn btn-ghost btn-sm" type="submit">Carica</button></form>');

      case 'calendar':
        return renderCalendar(widget.id);

      case 'quote': {
        const q = QUOTES[new Date().getDate() % QUOTES.length];
        return '<div class="quote-text">"' + U.esc(q[0]) + '"<span class="quote-author">— ' + U.esc(q[1]) + '</span></div>';
      }

      case 'timer': {
        const st = timers[widget.id] || (timers[widget.id] = { remaining: (Number(c.minutes) || 25) * 60, running: false, end: 0 });
        return '<div class="timer-display" data-timer="' + U.esc(widget.id) + '">' + fmtTime(st.remaining) + '</div>' +
          (readonly ? '' : '<div class="timer-controls"><button class="main" data-wk="timer-toggle">' + (st.running ? 'Pausa' : 'Avvia') + '</button><button data-wk="timer-reset">Reset</button></div>');
      }

      default:
        return empty('fa-puzzle-piece', 'Widget sconosciuto');
    }
  }

  function renderCalendar(id) {
    const offset = calendars[id] || 0;
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const title = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(d);
    const first = (d.getDay() + 6) % 7;
    const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    let cells = '';
    for (let i = 0; i < first; i++) cells += '<span class="day void">·</span>';
    for (let i = 1; i <= days; i++) {
      const isToday = offset === 0 && i === now.getDate();
      cells += '<span class="day' + (isToday ? ' today' : '') + '">' + i + '</span>';
    }
    return '<div class="calendar-head">' +
      '<button class="calendar-nav" data-wk="cal-prev" aria-label="Mese precedente">' + icon('fa-chevron-left') + '</button>' +
      '<strong>' + U.esc(title) + '</strong>' +
      '<button class="calendar-nav" data-wk="cal-next" aria-label="Mese successivo">' + icon('fa-chevron-right') + '</button></div>' +
      '<div class="calendar-grid">' + ['L', 'M', 'M', 'G', 'V', 'S', 'D'].map(x => '<span class="dow">' + x + '</span>').join('') + cells + '</div>';
  }

  function dirty() {
    if (window.OS_APP) window.OS_APP.dirty();
  }
  function rerenderWidget(id) {
    if (window.OS_APP) window.OS_APP.rerenderWidget(id);
  }

  function bindBody(root, widget, readonly) {
    if (!root) return;
    const c = widget.config;
    const q = (sel) => root.querySelector(sel);

    if (readonly) {
      if (widget.type === 'weather') loadWeather(q('[data-weather-root]'), c.city);
      if (widget.type === 'feed' && c.url) loadFeed(q('[data-feed-root]'), c);
      return;
    }

    const notes = q('[data-wk="notes"]');
    if (notes) notes.addEventListener('input', () => { c.text = notes.value; dirty(); });

    const addLink = q('[data-wk="add-link"]');
    if (addLink) addLink.addEventListener('click', () => window.OS_APP.openLinkEditor(widget.id, null));

    root.querySelectorAll('.link-favicon').forEach(img => img.addEventListener('error', () => img.remove()));
    root.querySelectorAll('.link-tile').forEach(tile => {
      tile.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        window.OS_APP.openLinkEditor(widget.id, Number(tile.dataset.linkIndex));
      });
      tile.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', 'link:' + widget.id + ':' + tile.dataset.linkIndex);
        e.dataTransfer.effectAllowed = 'move';
      });
      tile.addEventListener('dragover', (e) => { e.preventDefault(); });
      tile.addEventListener('drop', (e) => {
        e.preventDefault();
        const data = e.dataTransfer.getData('text/plain') || '';
        const m = data.match(/^link:(.+):(\d+)$/);
        if (!m || m[1] !== widget.id) return;
        const from = Number(m[2]), to = Number(tile.dataset.linkIndex);
        if (from === to) return;
        const [item] = c.links.splice(from, 1);
        c.links.splice(to, 0, item);
        dirty(); rerenderWidget(widget.id);
      });
    });

    const todoForm = q('[data-wk="todo-form"]');
    if (todoForm) todoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = todoForm.elements.task;
      const text = (input.value || '').trim();
      if (!text) return;
      c.items.push({ id: U.uid('t'), text, done: false });
      input.value = '';
      dirty(); rerenderWidget(widget.id);
    });
    root.querySelectorAll('[data-wk="todo-toggle"]').forEach(cb => cb.addEventListener('change', () => {
      c.items[Number(cb.dataset.index)].done = cb.checked;
      dirty(); rerenderWidget(widget.id);
    }));
    root.querySelectorAll('[data-wk="todo-del"]').forEach(btn => btn.addEventListener('click', () => {
      c.items.splice(Number(btn.dataset.index), 1);
      dirty(); rerenderWidget(widget.id);
    }));

    const weatherForm = q('[data-wk="weather-form"]');
    if (weatherForm) weatherForm.addEventListener('submit', (e) => {
      e.preventDefault();
      c.city = (weatherForm.elements.city.value || '').trim() || 'Roma';
      dirty(); rerenderWidget(widget.id);
    });
    if (widget.type === 'weather') loadWeather(q('[data-weather-root]'), c.city);

    const feedForm = q('[data-wk="feed-form"]');
    if (feedForm) feedForm.addEventListener('submit', (e) => {
      e.preventDefault();
      c.url = (feedForm.elements.url.value || '').trim();
      c.items = [];
      dirty(); rerenderWidget(widget.id);
    });
    if (widget.type === 'feed' && c.url) loadFeed(q('[data-feed-root]'), c);

    const calPrev = q('[data-wk="cal-prev"]'), calNext = q('[data-wk="cal-next"]');
    if (calPrev) calPrev.addEventListener('click', () => { calendars[widget.id] = (calendars[widget.id] || 0) - 1; rerenderWidget(widget.id); });
    if (calNext) calNext.addEventListener('click', () => { calendars[widget.id] = (calendars[widget.id] || 0) + 1; rerenderWidget(widget.id); });

    const tToggle = q('[data-wk="timer-toggle"]'), tReset = q('[data-wk="timer-reset"]');
    if (tToggle) tToggle.addEventListener('click', () => {
      const st = timers[widget.id];
      if (st.running) { st.remaining = Math.max(0, st.end - Date.now() / 1000); st.running = false; }
      else { st.end = Date.now() / 1000 + st.remaining; st.running = true; }
      rerenderWidget(widget.id);
    });
    if (tReset) tReset.addEventListener('click', () => {
      const st = timers[widget.id];
      st.remaining = (Number(c.minutes) || 25) * 60; st.running = false; st.end = 0;
      rerenderWidget(widget.id);
    });
  }

  async function loadWeather(root, city) {
    if (!root) return;
    try {
      const geoRes = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(city || 'Roma') + '&count=1&language=it&format=json');
      const geo = await geoRes.json();
      const place = geo.results && geo.results[0];
      if (!place) throw new Error('Città non trovata');
      const api = 'https://api.open-meteo.com/v1/forecast?latitude=' + place.latitude + '&longitude=' + place.longitude +
        '&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto';
      const res = await fetch(api);
      const data = await res.json();
      const code = data.current.weather_code;
      const info = WEATHER_CODES[code] || ['fa-temperature-high', 'n/d'];
      root.innerHTML = '<div class="weather-main"><div class="weather-icon">' + icon(info[0]) + '</div><div>' +
        '<div class="weather-temp">' + Math.round(data.current.temperature_2m) + '°</div>' +
        '<div class="weather-desc">' + U.esc(info[1]) + '</div>' +
        '<div class="weather-place">' + U.esc(place.name) + (place.country ? ', ' + U.esc(place.country) : '') + '</div></div></div>' +
        '<div class="weather-extra"><span>Min ' + Math.round(data.daily.temperature_2m_min[0]) + '°</span><span>Max ' + Math.round(data.daily.temperature_2m_max[0]) + '°</span></div>';
    } catch (err) {
      root.innerHTML = '<div class="weather-main"><div class="weather-icon">' + icon('fa-triangle-exclamation') + '</div><div><div class="weather-desc">Meteo non disponibile</div>' +
        '<div class="weather-place">' + U.esc(err.message) + '</div></div></div>';
    }
  }

  async function loadFeed(root, config) {
    if (!root) return;
    try {
      const url = cfg.RSS_PROXY + encodeURIComponent(config.url);
      const res = await fetch(url);
      if (!res.ok) throw new Error('Feed non raggiungibile');
      const data = await res.json();
      const items = (data.items || []).slice(0, 6);
      config.items = items;
      if (!items.length) { root.innerHTML = empty('fa-newspaper', 'Nessun articolo trovato'); return; }
      root.innerHTML = '<ul class="feed-list">' + items.map(it =>
        '<li><a href="' + U.esc(U.safeExternal(it.link)) + '" target="_blank" rel="noopener noreferrer">' + U.esc(it.title) + '</a>' +
        (it.pubDate ? '<small>' + U.esc(it.pubDate) + '</small>' : '') + '</li>').join('') + '</ul>';
    } catch (err) {
      root.innerHTML = empty('fa-triangle-exclamation', 'Impossibile caricare il feed: ' + err.message);
    }
  }

  function tick() {
    const state = window.OS_STORE.state || {};
    document.querySelectorAll('[data-clock]').forEach(el => { el.textContent = U.formatClock(new Date(), state); });
    document.querySelectorAll('[data-timer]').forEach(el => {
      const st = timers[el.dataset.timer];
      if (!st) return;
      if (st.running) {
        st.remaining = Math.max(0, st.end - Date.now() / 1000);
        if (st.remaining <= 0) st.running = false;
      }
      el.textContent = fmtTime(st.remaining);
    });
  }
  setInterval(tick, 250);

  window.OS_WIDGETS = { TYPES, make, defaults, renderBody, bindBody, tick, icon };
})();
