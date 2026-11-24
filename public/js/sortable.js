/* Riordino tramite Pointer Events: funziona con mouse, penna e dito (long-press). */
(function () {
  'use strict';

  const U = window.OS_UTIL;

  function create(host, opts) {
    if (!host || host.dataset.sortableReady === '1') return null;
    host.dataset.sortableReady = '1';

    const itemSel = opts.item;
    const handleSel = opts.handle || null;
    const noDragSel = opts.noDrag || '[data-no-drag], input, textarea, select';
    const delay = opts.delay == null ? 200 : opts.delay;
    let st = null;
    let suppressUntil = 0;

    // Un trascinamento non deve mai trasformarsi in un tap (o in un link aperto).
    host.addEventListener('click', (e) => {
      if (Date.now() < suppressUntil) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    host.addEventListener('pointerdown', (e) => {
      if (st || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const item = e.target.closest(itemSel);
      if (!item || !host.contains(item)) return;
      if (e.target.closest(noDragSel)) return;
      if (handleSel && !e.target.closest(handleSel)) return;
      st = {
        id: e.pointerId,
        type: e.pointerType,
        item: item,
        startX: e.clientX,
        startY: e.clientY,
        from: Array.prototype.indexOf.call(host.querySelectorAll(itemSel), item),
        next: item.nextElementSibling,
        active: false,
        timer: 0,
        ghost: null,
        captured: false
      };
      // Al tatto serve una pressione prolungata: il trascinamento non deve rubare lo scroll.
      if (st.type !== 'mouse') st.timer = setTimeout(() => activate(e.clientX, e.clientY), delay);
    });

    host.addEventListener('pointermove', (e) => {
      if (!st || e.pointerId !== st.id) return;
      const dx = e.clientX - st.startX;
      const dy = e.clientY - st.startY;
      if (!st.active) {
        if (st.type !== 'mouse') {
          if (Math.abs(dx) > 10 || Math.abs(dy) > 10) cancel();
          return;
        }
        if (Math.hypot(dx, dy) < 5) return;
        activate(e.clientX, e.clientY);
      }
      e.preventDefault();
      moveGhost(e.clientX, e.clientY);
      updateOrder(e.clientX, e.clientY);
    }, { passive: false });

    // Dopo l'attivazione blocchiamo lo scroll del gesto in corso.
    host.addEventListener('touchmove', (e) => { if (st && st.active) e.preventDefault(); }, { passive: false });
    host.addEventListener('contextmenu', (e) => {
      if (st && st.active) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    host.addEventListener('pointerup', finish);
    host.addEventListener('pointercancel', (e) => {
      if (!st || e.pointerId !== st.id) return;
      if (st.active) restore();
      cancel();
    });
    document.addEventListener('pointerup', finish);
    document.addEventListener('pointercancel', (e) => {
      if (st && st.id === e.pointerId) { if (st.active) restore(); cancel(); }
    });

    function finish(e) {
      if (!st || e.pointerId !== st.id) return;
      const s = st;
      if (!s.active) { cancel(); return; }
      if (s.timer) clearTimeout(s.timer);
      const to = Array.prototype.indexOf.call(host.querySelectorAll(itemSel), s.item);
      const ghost = s.ghost;
      s.item.classList.remove('sort-source');
      host.classList.remove('sorting');
      st = null;
      releaseCapture(s);
      if (ghost) {
        const target = s.item.getBoundingClientRect();
        const end = 'translate3d(' + target.left + 'px,' + target.top + 'px,0) scale(1)';
        if (U.reduceMotion() || !ghost.animate) ghost.remove();
        else {
          const anim = ghost.animate([{ transform: ghost.style.transform }, { transform: end }],
            { duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' });
          anim.onfinish = () => ghost.remove();
          anim.oncancel = () => ghost.remove();
        }
      }
      suppressUntil = Date.now() + 320;
      U.vibrate(15);
      if (to >= 0 && to !== s.from && opts.onReorder) opts.onReorder(s.from, to, s.item);
    }

    function capture(s) {
      try { host.setPointerCapture(s.id); s.captured = true; } catch (_) { /* ignore */ }
    }
    function releaseCapture(s) {
      if (!s.captured) return;
      try { host.releasePointerCapture(s.id); } catch (_) { /* ignore */ }
    }
    function activate(x, y) {
      if (!st || st.active) return;
      const s = st, item = s.item, r = item.getBoundingClientRect();
      if (s.timer) clearTimeout(s.timer);
      s.active = true;
      s.offsetX = x - r.left;
      s.offsetY = y - r.top;
      capture(s);
      const ghost = item.cloneNode(true);
      ghost.removeAttribute('id');
      ghost.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      ghost.classList.remove('sort-source', 'drag-over', 'dragging');
      ghost.classList.add('sort-ghost');
      ghost.style.width = r.width + 'px';
      ghost.style.height = r.height + 'px';
      ghost.style.left = '0';
      ghost.style.top = '0';
      ghost.style.margin = '0';
      ghost.setAttribute('aria-hidden', 'true');
      ghost.style.transform = 'translate3d(' + (x - s.offsetX) + 'px,' + (y - s.offsetY) + 'px,0) scale(1.03)';
      document.body.appendChild(ghost);
      s.ghost = ghost;
      item.classList.add('sort-source');
      host.classList.add('sorting');
      U.vibrate(10);
    }
    function moveGhost(x, y) {
      if (!st || !st.ghost) return;
      st.ghost.style.transform = 'translate3d(' + (x - st.offsetX) + 'px,' + (y - st.offsetY) + 'px,0) scale(1.03)';
    }
    function rects() {
      return Array.prototype.map.call(host.querySelectorAll(itemSel), el => ({ el: el, r: el.getBoundingClientRect() }));
    }
    function flip(before) {
      if (U.reduceMotion()) return;
      before.forEach(entry => {
        const now = entry.el.getBoundingClientRect();
        const dx = entry.r.left - now.left;
        const dy = entry.r.top - now.top;
        if ((Math.abs(dx) < 1 && Math.abs(dy) < 1) || !entry.el.animate) return;
        entry.el.animate(
          [{ transform: 'translate3d(' + dx + 'px,' + dy + 'px,0)' }, { transform: 'translate3d(0,0,0)' }],
          { duration: 170, easing: 'cubic-bezier(.2,.8,.2,1)' }
        );
      });
    }
    function updateOrder(x, y) {
      if (!st) return;
      const s = st;
      const items = Array.prototype.filter.call(host.querySelectorAll(itemSel), el => el !== s.item);
      let best = null, distance = Infinity, after = false;
      items.forEach(el => {
        const r = el.getBoundingClientRect();
        const dx = Math.max(r.left - x, 0, x - r.right);
        const dy = Math.max(r.top - y, 0, y - r.bottom);
        const d = dx * dx + dy * dy;
        if (d < distance) {
          distance = d;
          best = el;
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          after = y > cy || (Math.abs(y - cy) <= r.height / 2 && x > cx);
        }
      });
      if (!best) return;
      const ref = after ? best.nextElementSibling : best;
      if (ref === s.item || (ref && !host.contains(ref))) return;
      const before = rects();
      host.insertBefore(s.item, ref);
      flip(before);
    }
    function restore() {
      if (!st) return;
      host.insertBefore(st.item, st.next && host.contains(st.next) ? st.next : null);
    }
    function cancel() {
      const s = st;
      if (!s) return;
      if (s.timer) clearTimeout(s.timer);
      if (s.active) {
        s.item.classList.remove('sort-source');
        host.classList.remove('sorting');
        if (s.ghost) s.ghost.remove();
        releaseCapture(s);
      }
      st = null;
      if (s.active) restore();
    }

    return { destroy() { cancel(); delete host.dataset.sortableReady; } };
  }

  window.OS_SORTABLE = { create };
})();
