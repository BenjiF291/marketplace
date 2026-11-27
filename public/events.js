(() => {
  const el = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const button = (text, action) => {
    const node = el('button', text, 'event-button');
    node.type = 'button';
    node.onclick = action;
    return node;
  };
  const dialog = el('dialog', '', 'event-manager');
  document.body.append(dialog);
  let catalog, timer, boundary, serverOffset = 0;
  const date = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Amsterdam' });
  const parts = new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Amsterdam' });
  function localInput(value) { return value ? parts.format(value).replace(' ', 'T') : ''; }
  function amsterdam(value) {
    if (!value) return null;
    const neutral = Date.parse(value + ':00Z');
    const candidates = [1, 2].map(offset => neutral - offset * 3600000).filter(instant => localInput(instant) === value);
    if (!candidates.length) throw Error('Choose a valid Amsterdam time. Times skipped by daylight saving are unavailable.');
    return Math.min(...candidates);
  }
  async function request(path, body) {
    const response = await fetch(API_URL + path, { headers: resourceHeaders(),
      ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(result.error ?? 'Event service unavailable.');
    if (result.now) serverOffset = result.now - Date.now();
    return result;
  }
  function view(title, back) {
    clearTimeout(boundary);
    const header = el('header'), heading = el('h2', title), body = el('div', '', 'event-body');
    heading.id = 'event-dialog-title';
    dialog.setAttribute('aria-labelledby', heading.id);
    const actions = el('div', '', 'event-actions');
    if (back) actions.append(button('Back', back));
    actions.append(button('Close', () => dialog.close()));
    header.append(heading, actions);
    dialog.replaceChildren(header, body);
    if (!dialog.open) dialog.showModal();
    return body;
  }
  function control(label, input) {
    const wrapper = el('label', label, 'event-field');
    input.setAttribute('aria-label', label);
    wrapper.append(input);
    return wrapper;
  }
  function input(type, value, set) {
    const node = el('input');
    node.type = type;
    node.value = value ?? '';
    node.oninput = () => set(type === 'number' ? Number(node.value) : node.value);
    return node;
  }
  function select(options, value, set) {
    const node = el('select');
    for (const option of options) node.add(new Option(option.label ?? option, option.value ?? option));
    node.value = value ?? '';
    node.onchange = () => set(node.value);
    return node;
  }
  const opt = (value, label) => ({ value, label });
  const choices = (rows, first) => [opt('', first), ...rows.map(row => opt(row.id, row.name))];
  const objectiveLabel = objective => catalog?.objectives[objective.type]?.[0] ?? objective.label ?? objective.type;
  const descriptions = rewards => rewards.map(r => (r.label || r.id || r.kind) + ' ×' + r.amount).join(', ');
  const earned = summary => Object.values(summary ?? {}).map(r => r.label + ' ×' + r.amount).join(', ');
  function summary(event) {
    const node = el('ul', '', 'event-objectives');
    for (const [index, objective] of event.objectives.entries()) {
      const item = el('li');
      const count = event.player?.progress[index] ?? 0;
      const rules = Object.entries(objective.filters).map(([field, value]) =>
        objective.filterLabels?.[field] ?? (field === 'pack' ? (catalog?.packs.find(p => p.id === value)?.name ?? value) : value));
      item.append(el('strong', objectiveLabel(objective) + (rules.length ? ' · ' + rules.join(' · ') : '')));
      for (const row of objective.thresholds) {
        const repeat = objective.mode === 'repeat', complete = count >= row.target;
        const reward = descriptions(row.rewards) || 'Reward pending configuration';
        item.append(el('p', (repeat ? 'Every ' : 'At ') + row.target + ' · ' + reward +
          (event.player && !repeat && complete ? ' · Completed' : '')));
      }
      if ('player' in event) {
        const target = objective.thresholds[0].target;
        item.append(el('small', 'Total progress ' + count +
          (objective.mode === 'repeat' ? ' · Next reward ' + (count % target) + ' / ' + target : '')));
      }
      node.append(item);
    }
    return node;
  }
  function card(event) {
    const node = el('article', '', 'event-card');
    node.dataset.theme = event.theme;
    node.append(el('span', event.icon, 'event-icon'), el('h3', event.name),
      el('small', event.category + ' · ' + event.status), el('p', event.description), summary(event));
    if (event.start) node.append(el('small', date.format(event.start) + ' – ' + date.format(event.end) + ' Amsterdam'));
    if (event.status === 'active') {
      const remaining = el('p', '', 'event-remaining');
      remaining.dataset.end = event.end;
      node.append(remaining);
    }
    if (event.stats) node.append(el('p', (event.stats.players || 0) + ' participants · ' + (event.stats.rewarded || 0) + ' rewarded completions'));
    if ('player' in event) {
      node.append(el('p', 'Rewards earned ' + (earned(event.player?.earned) || 'None yet')));
      const limits = event.limits;
      const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(Date.now() + serverOffset);
      for (const [key, used] of [['player', event.player?.rewarded ?? 0], ['daily', event.player?.daily?.[day] ?? 0]]) {
        if (limits[key] !== null) node.append(el('small', (key === 'daily' ? 'Today' : 'Your allowance') + ' · ' +
          Math.max(0, limits[key] - used) + ' rewards remaining'));
      }
      if (limits.global !== null) node.append(el('small', 'Global · ' + (event.remainingGlobal ?? limits.global) + ' rewards remaining'));
    }
    return node;
  }
  function countdown() {
    for (const node of dialog.querySelectorAll('[data-end]')) {
      const minutes = Math.ceil((Number(node.dataset.end) - Date.now() - serverOffset) / 60000);
      node.textContent = minutes <= 0 ? 'Event ended' : 'Time remaining · ' + Math.floor(minutes / 60) + 'h ' + minutes % 60 + 'm';
    }
  }
  function groups(body, rows, definitions, decorate) {
    for (const [title, allowed] of definitions) {
      const section = el('section', '', 'event-group');
      section.append(el('h3', title));
      const grid = el('div', '', 'event-grid');
      rows.filter(row => allowed.includes(row.status)).forEach(row => {
        const tile = card(row);
        decorate?.(tile, row);
        grid.append(tile);
      });
      section.append(grid.childElementCount ? grid : el('p', 'No events.'));
      body.append(section);
    }
    countdown();
  }
  async function admin() {
    const body = view('Event Manager');
    const message = el('p', 'Loading events…');
    message.setAttribute('role', 'status');
    body.append(button('+ Create Event', () => wizard()), message);
    try {
      const result = await request('/admin/events');
      message.textContent = '';
      const operation = async (id, operation) => {
        if (['end', 'delete', 'cancel', 'archive'].includes(operation) && !confirm('Confirm this event change?')) return;
        try { await request('/admin/events', { id, operation }); await admin(); }
        catch (error) { message.textContent = error.message; }
      };
      const category = select([opt('', 'All categories'), 'Ben-Bal', 'Collection', 'Marketplace', 'Upgrades', 'General'], '', renderGroups);
      const dashboard = el('div');
      body.append(control('Event category', category), dashboard);
      renderGroups();
      function renderGroups() {
      dashboard.replaceChildren();
      groups(dashboard, result.events.filter(event => !category.value || category.value === event.category), [['Active Events', ['active']], ['Upcoming Events', ['upcoming']],
        ['Draft Events', ['draft']], ['Past Events', ['past', 'cancelled']]], (tile, event) => {
        if (event.archived) tile.append(el('p', 'Archived'));
        const controls = el('div', '', 'event-actions');
        controls.append(button('Duplicate', () => operation(event.id, 'duplicate')));
        if (['draft', 'upcoming', 'active'].includes(event.status)) controls.append(button('Edit', () => wizard(event)));
        if (event.status !== 'draft') controls.append(button('View results', () => results(event.id)));
        if (event.status === 'upcoming') controls.append(button('Activate early', () => wizard(event, 4)), button('Cancel', () => operation(event.id, 'cancel')));
        if (event.status === 'active') controls.append(button('End early', () => operation(event.id, 'end')));
        if (event.status === 'draft') controls.append(button('Schedule or activate', () => wizard(event, 4)), button('Delete', () => operation(event.id, 'delete')));
        if (['past', 'cancelled'].includes(event.status) && !event.archived) controls.append(button('Archive', () => operation(event.id, 'archive')));
        tile.append(controls);
      });
      }
    } catch (error) { message.textContent = error.message; }
  }
  async function results(id, tab = 'participants', after) {
    const body = view('Event results', admin);
    body.append(button('Participants', () => results(id)), button('Reward history', () => results(id, 'rewards')));
    try {
      const data = await request('/admin/events/' + id + '/results?tab=' + tab + (after ? '&after=' + after : ''));
      body.append(card(data.event), el('p', (data.stats.actions ?? 0) + ' qualifying actions · ' +
        (data.stats.completions ?? 0) + ' completions · ' + (data.stats.rewarded ?? 0) + ' rewarded'),
        el('p', earned(data.stats.earned)));
      const list = el('ul', '', 'event-results');
      for (const row of data.rows) list.append(el('li', row.name + ' · ' + (tab === 'rewards'
        ? date.format(row.at) + ' · ' + (descriptions(row.rewards ?? []) || 'Progress only')
        : 'Progress ' + Object.values(row.progress).join(' / ') + ' · ' + row.rewarded + ' rewarded · ' + (earned(row.earned) || 'None'))));
      body.append(list);
      if (data.next) body.append(button('Next results', () => results(id, tab, data.next)));
    } catch (error) { body.append(el('p', error.message)); }
  }
  const blank = () => ({ name: '', description: '', icon: '⚽', theme: 'Royal Gold', category: 'General', schedule: {},
    objectives: [], limits: { player: null, global: null, daily: null } });
  function objective(type = 'WIN_BEN_BAL_MATCH') {
    return { type, mode: 'once', filters: {}, thresholds: [{ target: 1, rewards: [] }] };
  }
  async function wizard(existing, startPage = 0) {
    const body = view(existing ? 'Edit event' : 'Create event', admin);
    const message = el('p', 'Loading reward choices…', 'event-message');
    message.setAttribute('role', 'status');
    body.append(message);
    try { catalog ??= await request('/admin/events/catalogue'); }
    catch (error) { message.textContent = error.message; return; }
    if (!body.isConnected || !dialog.open) return;
    const model = existing ? structuredClone(existing) : blank();
    const active = existing?.status === 'active';
    let page = active ? 0 : startPage;
    let scheduled = Boolean(model.schedule.start);
    let start = localInput(model.schedule.start), end = localInput(model.schedule.end);
    let duration = (model.schedule.duration ?? 86400000) / 3600000, unit = 3600000;
    let useEnd = Boolean(end);
    const steps = ['Event details', 'Schedule', 'Objectives', 'Rewards', 'Review & activate'];
    const fields = el('div', '', 'event-wizard');
    body.prepend(fields);
    async function save(operation) {
      try {
        const schedule = operation === 'presentation' ? {} : {
          start: scheduled ? amsterdam(start) : null, end: useEnd ? amsterdam(end) : null, duration: duration * unit
        };
        const objectives = model.objectives.map(o => ({ ...o, ...o.thresholds[0], milestones: o.thresholds }));
        await request('/admin/events', { ...model, schedule, objectives, operation });
        await admin();
      } catch (error) { message.textContent = error.message; }
    }
    function render() {
      fields.replaceChildren(el('h3', active ? 'Presentation' : 'Step ' + (page + 1) + ' of 5 · ' + steps[page]));
      message.textContent = '';
      const add = (label, field) => fields.append(control(label, field));
      if (page === 0) {
        if (!existing) fields.append(button('Use Ben-Bal Bonanza template', () => {
          Object.assign(model, blank(), { name: 'Ben-Bal Bonanza', description: 'Win Ben-Bal matches to earn bonus packs!', category: 'Ben-Bal' });
          const first = objective();
          first.mode = 'repeat';
          first.thresholds[0].rewards.push({ kind: 'pack', id: '', amount: 1 });
          model.objectives.push(first);
          scheduled = false;
          useEnd = false;
          duration = 24;
          unit = 3600000;
          render();
        }));
        add('Event name', input('text', model.name, value => model.name = value));
        const desc = el('textarea');
        desc.value = model.description;
        desc.oninput = () => model.description = desc.value;
        add('Description', desc);
        for (const [key, values] of [['icon', catalog.icons], ['theme', catalog.themes], ['category', catalog.categories]]) {
          if (active && key === 'category') continue;
          add(key[0].toUpperCase() + key.slice(1), select(values, model[key], value => model[key] = value));
        }
      }
      if (page === 1) {
        fields.append(el('p', 'Times use Europe/Amsterdam. Repeated times during the autumn clock change use their first occurrence.'));
        add('Start mode', select([opt('now', 'Start immediately'), opt('scheduled', 'Scheduled start')], scheduled ? 'scheduled' : 'now', value => { scheduled = value === 'scheduled'; render(); }));
        if (scheduled) add('Start date and time', input('datetime-local', start, value => start = value));
        add('End mode', select([opt('duration', 'End after a duration'), opt('end', 'Scheduled end')], useEnd ? 'end' : 'duration', value => { useEnd = value === 'end'; render(); }));
        if (useEnd) add('End date and time', input('datetime-local', end, value => end = value));
        else {
          add('Duration', input('number', duration, value => duration = value));
          add('Unit', select([opt(60000, 'Minutes'), opt(3600000, 'Hours'), opt(86400000, 'Days'), opt(604800000, 'Weeks')],
            String(unit), value => unit = Number(value)));
        }
      }
      if (page === 2) {
        model.objectives.forEach((o, index) => {
          const block = el('section', '', 'event-form-block');
          block.append(control('Objective', select(Object.entries(catalog.objectives).map(([id, spec]) => opt(id, spec[0])),
            o.type, value => { o.type = value; o.filters = {}; render(); })),
            control('Completion mode', select([opt('once', 'One-time'), opt('repeat', 'Repeatable'), opt('milestone', 'Milestone')],
              o.mode, value => { o.mode = value; render(); })));
          for (const key of catalog.objectives[o.type][1]) {
            const options = key === 'pack' ? choices([...catalog.packs, { id: 'daily', name: 'Free daily pack' }], 'Any pack')
              : [opt('', 'Any'), ...(key === 'level' ? ['epic', 'legendary'] : catalog.tiers)];
            block.append(control(key[0].toUpperCase() + key.slice(1), select(options, o.filters[key] ?? '', value => o.filters[key] = value)));
          }
          const rows = o.mode === 'milestone' ? o.thresholds : o.thresholds.slice(0, 1);
          rows.forEach((row, i) => {
            block.append(control(o.mode === 'milestone' ? 'Milestone ' + (i + 1) : 'Target',
              input('number', row.target, value => row.target = value)));
            if (i > 0) block.append(button('Remove milestone', () => { o.thresholds.splice(i, 1); render(); }));
          });
          if (o.mode === 'milestone' && rows.length < 12) block.append(button('Add milestone', () => {
            o.thresholds.push({ target: Math.max(...o.thresholds.map(row => row.target)) + 1, rewards: [] }); render();
          }));
          block.append(button('Remove objective', () => { model.objectives.splice(index, 1); render(); }));
          fields.append(block);
        });
        if (model.objectives.length < 6) fields.append(button('Add objective', () => { model.objectives.push(objective()); render(); }));
      }
      if (page === 3) {
        const types = [opt('pack', 'Pack'), opt('footy', 'Footy'), opt('upgradeShard', 'Upgrade Shard'),
          opt('upgradeCore', 'Upgrader Core'), opt('upgradeToken', 'Upgrader Token'), opt('cardXpPotion', 'XP Potion'),
          opt('card', 'Specific card'), opt('randomCardByTier', 'Random card by tier')];
        model.objectives.forEach(o => (o.mode === 'milestone' ? o.thresholds : o.thresholds.slice(0, 1)).forEach(row => {
          const block = el('section', '', 'event-form-block');
          block.append(el('h4', objectiveLabel(o) + ' · ' + row.target));
          row.rewards.forEach((reward, index) => {
            const line = el('div', '', 'event-form-block');
            line.append(control('Reward type', select(types, reward.kind, value => { reward.kind = value; reward.id = ''; render(); })));
            const sources = reward.kind === 'pack' ? catalog.packs : reward.kind === 'card' ? catalog.cards
              : reward.kind === 'randomCardByTier' ? catalog.random : catalog.materials.filter(r => r.kind === reward.kind);
            if (reward.kind !== 'footy') {
              line.append(control('Reward', select(choices(sources, 'Choose reward'), reward.id, value => { reward.id = value; render(); })));
              const selected = sources.find(item => item.id === reward.id);
              const art = selected?.imageUrl || (reward.id && window.UpgraderCatalog?.artwork(reward.id));
              if (art) { const image = el('img', '', 'event-reward-preview'); image.src = art; image.alt = selected?.name ?? ''; line.append(image); }
            }
            const quantity = input('number', reward.amount, value => reward.amount = value);
            quantity.step = reward.kind === 'footy' ? '0.01' : '1';
            line.append(control('Quantity', quantity), button('Remove reward', () => { row.rewards.splice(index, 1); render(); }));
            block.append(line);
          });
          if (row.rewards.length < 8) block.append(button('Add reward', () => { row.rewards.push({ kind: 'pack', id: '', amount: 1 }); render(); }));
          fields.append(block);
        }));
        for (const [key, label] of [['player', 'Rewards per player'], ['global', 'Global rewards'], ['daily', 'Daily rewards per player']]) {
          const field = input('number', model.limits[key], value => model.limits[key] = value || null);
          field.placeholder = 'Unlimited';
          add(label, field);
        }
      }
      if (page === 4) {
        fields.append(card({ ...model, name: model.name || 'Untitled event', status: 'Review',
          objectives: model.objectives.map(o => ({ ...o, thresholds: (o.mode === 'milestone' ? o.thresholds : o.thresholds.slice(0, 1)).map(row => ({
            ...row, rewards: row.rewards.map(r => ({ ...r, label: [...catalog.packs, ...catalog.cards, ...catalog.random, ...catalog.materials]
              .find(item => item.id === r.id)?.name ?? (r.kind === 'footy' ? 'Footy' : undefined) }))
          })) })) }));
        fields.append(el('p', (scheduled ? 'Scheduled start ' + (start || 'required') : 'Starts on activation') + ' · ' +
          (useEnd ? 'Ends ' + (end || 'date required') : 'Duration ' + duration + ' ' +
            ({ 60000: 'minutes', 3600000: 'hours', 86400000: 'days', 604800000: 'weeks' })[unit])));
        fields.append(el('p', Object.entries(model.limits).map(([key, value]) => key + ' ' + (value ?? 'unlimited')).join(' · ')));
        if (scheduled) fields.append(button('Schedule event', () => save('schedule')));
        fields.append(button(existing?.status === 'upcoming' ? 'Activate early' : 'Activate now', () => save('activate')));
      }
      const nav = el('div', '', 'event-actions');
      if (active) nav.append(button('Save presentation', () => save('presentation')));
      else {
        if (page > 0) nav.append(button('Previous step', () => { page--; render(); }));
        if (existing?.status !== 'upcoming') nav.append(button('Save draft', () => save('draft')));
        if (page < 4) nav.append(button('Next step', () => { page++; render(); }));
      }
      fields.append(nav);
    }
    render();
  }
  async function player(receipt) {
    const body = view('Events');
    body.append(button('Refresh', player));
    if (receipt) body.append(el('p', receipt.eventName + ' · ' + descriptions(receipt.rewards), 'event-receipt'));
    try {
      const data = await request('/events');
      groups(body, data.events, [['Active Events', ['active']], ['Upcoming Events', ['upcoming']], ['Recently Completed', ['past']]]);
      const next = Math.min(...data.events.map(event => event.status === 'active' ? event.end
        : event.status === 'upcoming' ? event.start : Infinity));
      if (Number.isFinite(next)) boundary = setTimeout(() => {
        if (body.isConnected && dialog.open) void player(receipt);
      }, Math.max(250, Math.min(next - data.now + 100, 2147483647)));
    } catch (error) { body.append(el('p', error.message)); }
  }
  const toast = el('aside', '', 'event-toast');
  toast.setAttribute('role', 'status');
  toast.hidden = true;
  document.body.append(toast);
  let checking = false;
  async function notifications() {
    if (checking || !currentUserId || document.hidden || !toast.hidden) return;
    checking = true;
    try {
      const { receipts } = await request('/events/receipts');
      if (!receipts.length) return;
      const host = [...document.querySelectorAll('dialog[open]')].at(-1) ?? document.body;
      host.append(toast);
      const receipt = receipts[0];
      const ack = async open => {
        try { await request('/events/receipts/' + receipt.id, {}); }
        catch { return; }
        toast.hidden = true;
        if (open) await player(receipt);
        void notifications();
      };
      toast.replaceChildren(el('strong', 'Event reward!'), el('p', receipt.eventName),
        el('p', descriptions(receipt.rewards)), button('View reward', () => ack(true)), button('Continue', () => ack(false)));
      toast.hidden = false;
      window.loadInventory?.();
      window.updateBalance?.();
      window.UpgraderWorkshop?.refresh();
    } catch { /* Receipts stay available on the server. */ }
    finally { checking = false; }
  }
  for (const event of ['focus', 'island-ready', 'game-progress-changed']) window.addEventListener(event, () => {
    clearTimeout(timer);
    timer = setTimeout(notifications, event === 'game-progress-changed' ? 13000 : 500);
  });
  document.addEventListener('close', event => {
    if (event.target.contains?.(toast)) document.body.append(toast);
  }, true);
  setInterval(() => { if (dialog.open) countdown(); }, 10000);
  setInterval(notifications, 60000);
  window.FishyEvents = { admin, player };
})();
