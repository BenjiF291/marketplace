(function () {
  window.bindCardAreaSelection = function (grid, getVisible, selected, onChange, signal) {
    const box = document.createElement('div');
    box.className = 'card-area-selection';
    box.setAttribute('aria-hidden', 'true');
    const events = { signal };
    let drag;
    let frame = 0;
    let suppressClick = false;

    function viewport() {
      const rect = grid.getBoundingClientRect();
      return { x: rect.left + grid.clientLeft, y: rect.top + grid.clientTop,
        width: grid.clientWidth, height: grid.clientHeight };
    }

    function point(x, y, view) {
      return {
        x: grid.scrollLeft + Math.min(view.width, Math.max(0, x - view.x)),
        y: grid.scrollTop + Math.min(view.height, Math.max(0, y - view.y))
      };
    }

    function apply(matches) {
      let changed = false;
      for (const card of drag.cards) {
        const { checkbox } = card;
        const checked = matches(card);
        if (checked === checkbox.checked) continue;
        checkbox.checked = checked;
        if (checked) selected.add(checkbox.value);
        else selected.delete(checkbox.value);
        changed = true;
      }
      if (changed) onChange();
    }

    function paint(view) {
      if (drag.measure) {
        for (const card of drag.cards) {
          const rect = card.label.getBoundingClientRect();
          card.left = rect.left - view.x + grid.scrollLeft;
          card.top = rect.top - view.y + grid.scrollTop;
          card.right = card.left + rect.width;
          card.bottom = card.top + rect.height;
        }
        drag.measure = false;
      }
      const end = point(drag.x, drag.y, view);
      const left = Math.min(drag.origin.x, end.x);
      const top = Math.min(drag.origin.y, end.y);
      const right = Math.max(drag.origin.x, end.x);
      const bottom = Math.max(drag.origin.y, end.y);
      box.style.left = left + 'px';
      box.style.top = top + 'px';
      box.style.width = (right - left) + 'px';
      box.style.height = (bottom - top) + 'px';
      apply(card => (drag.additive && drag.before.has(card.checkbox.value)) ||
        (card.left < right && card.right > left && card.top < bottom && card.bottom > top));
    }

    function schedule() {
      if (drag?.origin && !frame) frame = requestAnimationFrame(tick);
    }

    function tick() {
      frame = 0;
      const view = viewport();
      const edge = Math.min(48, view.height / 4);
      const y = drag.y - view.y;
      const delta = y < edge ? y - edge : Math.max(0, y - view.height + edge);
      const before = grid.scrollTop;
      const nearGrid = drag.x >= view.x && drag.x <= view.x + view.width && y >= -16 && y <= view.height + 16;
      if (nearGrid && edge && delta) {
        grid.scrollTop += Math.sign(delta) * Math.max(1, Math.round(22 * Math.min(1, Math.abs(delta) / edge)));
      }
      paint(view);
      if (grid.scrollTop !== before) schedule();
    }

    function finish(restore = false) {
      if (!drag) return;
      cancelAnimationFrame(frame);
      frame = 0;
      if (drag.origin) {
        if (restore) apply(card => drag.before.has(card.checkbox.value));
        else paint(viewport());
        suppressClick = true;
        box.remove();
      }
      const { id } = drag;
      drag = null;
      if (grid.hasPointerCapture(id)) grid.releasePointerCapture(id);
    }

    window.addEventListener('pointerdown', () => { suppressClick = false; }, { capture: true, signal });
    grid.addEventListener('pointerdown', event => {
      if (drag || event.pointerType !== 'mouse' || event.button !== 0 || grid.inert) return;
      const view = viewport();
      const x = event.clientX - view.x;
      const y = event.clientY - view.y;
      if (x < 0 || x >= view.width || y < 0 || y >= view.height || !getVisible().length) return;
      drag = {
        id: event.pointerId, downX: event.clientX, downY: event.clientY,
        start: point(event.clientX, event.clientY, view), additive: event.ctrlKey || event.shiftKey
      };
    }, events);
    window.addEventListener('pointermove', event => {
      if (event.pointerId !== drag?.id) return;
      if (!(event.buttons & 1)) return finish(true);
      drag.x = event.clientX;
      drag.y = event.clientY;
      if (!drag.origin) {
        if (Math.hypot(drag.x - drag.downX, drag.y - drag.downY) < 5) return;
        drag.origin = drag.start;
        drag.before = new Set(selected);
        drag.cards = getVisible().filter(({ checkbox }) => !checkbox.disabled)
          .map(({ label, checkbox }) => ({ label, checkbox }));
        drag.measure = true;
        grid.append(box);
        grid.setPointerCapture(drag.id);
      }
      schedule();
    }, events);
    window.addEventListener('pointerup', event => {
      if (event.pointerId !== drag?.id || event.button !== 0) return;
      drag.x = event.clientX;
      drag.y = event.clientY;
      finish();
    }, events);
    grid.addEventListener('lostpointercapture', event => {
      if (event.target === grid && event.pointerId === drag?.id) finish(true);
    }, events);
    window.addEventListener('pointercancel', event => {
      if (event.pointerId === drag?.id) finish(true);
    }, events);
    window.addEventListener('blur', () => finish(true), events);
    window.addEventListener('click', event => {
      if (!suppressClick || !event.detail || !grid.contains(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, { capture: true, signal });
    grid.addEventListener('scroll', schedule, events);
    const observer = new ResizeObserver(() => {
      if (!drag?.origin) return;
      drag.measure = true;
      schedule();
    });
    observer.observe(grid);
    signal.addEventListener('abort', () => {
      finish(true);
      observer.disconnect();
    }, { once: true });
    return () => finish(true);
  };
})();
