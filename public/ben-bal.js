window.BenBal = (() => {
  'use strict';

  const { formation, backgrounds, cardValues, cardFace } = window.BenBalCard;
  const $ = name => document.getElementById('benBal' + name);
  const dialog = $('');
  const slotInfo = new Map(formation.flatMap(row => row.slots.map((slot, index) => [
    slot, { role: row.role, label: row.label === 'GK' ? 'GK' : row.label + ' ' + (index + 1) }
  ])));
  const thresholds = { overall: $('Overall'), attack: $('Attack'), dribble: $('Dribble'), defence: $('Defence') };
  let cards = [];
  let byId = new Map();
  let lineup = {};
  let selected = null;
  let saving = false;
  let request;
  let matchSetup;
  let league;
  let leagueRequest;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function renderTeam() {
    const pitch = $('Pitch');
    const focusedSlot = pitch.contains(document.activeElement) ? document.activeElement.dataset.slot : null;
    pitch.replaceChildren();
    for (const row of formation) {
      const line = element('div', 'ben-bal-line');
      for (const slot of row.slots) {
        const button = element('button', 'ben-bal-slot');
        button.type = 'button';
        button.dataset.slot = slot;
        button.disabled = saving;
        button.setAttribute('aria-pressed', String(selected === slot));
        const label = slotInfo.get(slot).label;
        const card = byId.get(lineup[slot]);
        const penalty = card ? cardValues(card, row.role)?.penalty : 0;
        button.setAttribute('aria-label', label + ' · ' + (card?.name ?? 'Empty slot') +
          (penalty ? ' · Out of position, minus 10 to all six stats' : ''));
        if (card) {
          const visual = element('span', 'ben-bal-slot-visual');
          visual.setAttribute('aria-hidden', 'true');
          visual.append(cardFace(card, row.role));
          button.append(visual);
          if (penalty) {
            const badge = element('span', 'ben-bal-slot-penalty', '−10');
            badge.title = 'Out of position';
            badge.setAttribute('aria-hidden', 'true');
            button.append(badge);
          }
        } else {
          const empty = element('span', 'ben-bal-slot-empty');
          empty.setAttribute('aria-hidden', 'true');
          empty.append(element('span', 'ben-bal-slot-label', label), element('span', 'ben-bal-slot-add', '+'));
          button.append(empty);
        }
        button.onclick = () => {
          selected = slot;
          renderTeam();
          renderCollection();
        };
        line.append(button);
      }
      pitch.append(line);
    }
    if (focusedSlot) pitch.querySelector('[data-slot="' + focusedSlot + '"]').focus({ preventScroll: true });
    const card = byId.get(lineup[selected]);
    const slot = slotInfo.get(selected);
    $('Count').textContent = Object.keys(lineup).length + ' / 11 assigned';
    $('Selection').textContent = slot ? slot.label + ' selected' : 'Select a slot on the pitch.';
    $('Preview').replaceChildren(...(card ? [cardFace(card, slot.role)] : []));
    $('Remove').disabled = saving || !card;
    $('Save').disabled = saving;
    $('Play').disabled = saving || Boolean(matchSetup);
  }

  function metric(card, key) {
    return key === 'overall' ? card.overall : card.stats?.[card.benBal?.[key]?.primary];
  }

  function renderCollection(focusId) {
    const tier = $('Tier').value;
    const position = $('Position').value;
    const sort = $('Sort').value;
    const minima = Object.entries(thresholds).filter(([, input]) => input.value !== '');
    const visible = cards.filter(card =>
      (!tier || card.tier === tier) &&
      (!position || (card.benBal?.naturalPosition ?? 'unavailable') === position) &&
      minima.every(([key, input]) => {
        const value = metric(card, key);
        return Number.isFinite(value) && value >= input.valueAsNumber;
      })
    ).sort((a, b) =>
      (sort === 'name' ? 0 : (metric(b, sort) ?? -Infinity) - (metric(a, sort) ?? -Infinity)) ||
      a.name.localeCompare(b.name)
    );
    $('Results').textContent = visible.length + ' / ' + cards.length + ' cards';
    const assigned = new Map(Object.entries(lineup).map(([slot, id]) => [id, slot]));
    const otherSpecial = Object.entries(lineup).some(([key, id]) => key !== selected && byId.get(id)?.special);
    const list = $('Cards');
    list.replaceChildren();
    let refocus;
    for (const card of visible) {
      const slot = assigned.get(card.id);
      const exclusion = card.eligibility || (card.special && otherSpecial ? 'Only one Special card may be assigned.' : '');
      const entry = element('article', 'ben-bal-entry');
      entry.append(cardFace(card));
      const button = element('button', 'btn', slot ? 'Assigned to ' + slotInfo.get(slot).label : 'Assign card');
      button.type = 'button';
      button.disabled = saving || !selected || !!slot || !card.benBal || Boolean(exclusion);
      button.setAttribute('aria-label', button.textContent + ' · ' + card.name);
      button.onclick = () => {
        lineup[selected] = card.id;
        renderTeam();
        renderCollection(card.id);
      };
      if (card.id === focusId) refocus = entry;
      entry.append(button);
      if (exclusion) entry.append(element('p', 'ben-bal-ineligible', exclusion));
      list.append(entry);
    }
    if (refocus) {
      refocus.tabIndex = -1;
      refocus.focus({ preventScroll: true });
    }
    if (!visible.length) list.append(element('p', '', cards.length ? 'No cards match these filters.' : 'Your Marketplace card collection is empty.'));
  }

  async function teamRequest(options, endpoint = 'team') {
    const response = await fetch(API_URL + '/ben-bal/' + endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': currentUserId,
        Authorization: 'Bearer ' + (localStorage.getItem('sessionToken') || '')
      }
    });
    const result = await response.json().catch(error => {
      if (endpoint === 'matches' && !options?.signal?.aborted) {
        throw Error('Could not load the robot catalogue. Try again in a moment.');
      }
      throw error;
    });
    if (!response.ok) throw Error(result.error || 'Could not load your Ben-Bal team.');
    return result;
  }

  async function load() {
    if (!league) return showLeagues();
    $('BuilderTitle').textContent = league + ' League Team';
    request?.abort();
    const { signal } = request = new AbortController();
    $('Content').hidden = true;
    $('Reload').hidden = true;
    $('Status').textContent = 'Loading your team and card collection…';
    $('PlayStatus').textContent = '';
    try {
      const result = await teamRequest({ signal }, 'team?league=' + encodeURIComponent(league));
      const collection = [];
      for (let start = 0; start < result.owned.length; start += 12) {
        const batch = result.owned.slice(start, start + 12);
        collection.push(...await Promise.all(batch.map(async owned =>
          ({ ...owned, ...((owned.card ?? await window.CardData.getCardData(owned.id, { signal, mode: 'ben-bal' })) ??
            { name: CardDisplayNames.name(owned.id, owned.name) }) })
        )));
      }
      if (signal.aborted) return;
      $('EligibleTiers').textContent = 'Eligible tiers: ' + (result.tiers ?? [league]).join(', ') + '.';
      $('SpecialRule').textContent = result.range
        ? `One Special card allowed with Overall ${result.range.min} to ${result.range.max}.`
        : 'Special cards are unavailable until an Overall range is configured.';
      cards = collection;
      byId = new Map(cards.map(card => [card.id, card]));
      lineup = Object.fromEntries(Object.entries(result.lineup).filter(([, id]) => byId.get(id)?.benBal));
      selected = null;
      const unavailable = Object.keys(result.lineup).length - Object.keys(lineup).length;
      $('Status').textContent = [
        result.removed ? `Cleared ${result.removed} saved ${result.removed === 1 ? 'slot' : 'slots'} for cards outside your inventory.` : '',
        unavailable === 1 ? 'One saved card has unavailable stats.' : '',
        unavailable > 1 ? `${unavailable} saved cards have unavailable stats.` : ''
      ].filter(Boolean).join(' ');
      renderTeam();
      renderCollection();
      $('Content').hidden = false;
    } catch (error) {
      if (signal.aborted) return;
      $('Status').textContent = error.message;
      $('Reload').hidden = false;
    }
  }

  async function showLeagues() {
    league = null;
    request?.abort();
    matchSetup?.abort();
    leagueRequest?.abort();
    const { signal } = leagueRequest = new AbortController();
    const list = $('Leagues');
    list.hidden = false;
    list.replaceChildren();
    $('Content').hidden = $('ChooseLeague').hidden = $('Reload').hidden = true;
    $('Status').textContent = 'Loading leagues…';
    try {
      const { leagues } = await teamRequest({ signal }, 'leagues');
      if (signal.aborted) return;
      $('Status').textContent = '';
      for (const { name, count, pack } of leagues) {
        const tile = element('article', 'ben-bal-league');
        tile.dataset.league = name.toLowerCase();
        const badge = element('span', 'ben-bal-league-badge', '⚽');
        badge.setAttribute('aria-hidden', 'true');
        const dots = element('span', 'ben-bal-league-dots', '●'.repeat(count) + '○'.repeat(3 - count));
        dots.setAttribute('aria-hidden', 'true');
        const enter = element('button', 'btn', 'Enter League');
        enter.type = 'button';
        enter.setAttribute('aria-label', 'Enter ' + name + ' League');
        enter.onclick = () => {
          league = name;
          list.hidden = true;
          $('ChooseLeague').hidden = false;
          $('Tier').value = '';
          load();
        };
        tile.append(badge, element('h2', '', name + ' League'), dots,
          element('p', '', count + ' / 3 Packs Earned Today'),
          element('p', '', pack?.name || 'Daily pack reward not configured yet.'), enter);
        list.append(tile);
      }
    } catch (error) {
      if (signal.aborted) return;
      $('Status').textContent = error.message;
      $('Reload').hidden = false;
    }
  }
  $('ChooseLeague').onclick = showLeagues;
  for (const tier of Object.keys(backgrounds)) $('Tier').add(new Option(tier, tier));
  $('Filters').addEventListener('input', () => renderCollection());
  $('Remove').onclick = () => {
    delete lineup[selected];
    renderTeam();
    renderCollection();
  };
  $('Reload').onclick = load;
  $('Play').onclick = async () => {
    if (matchSetup || saving) return;
    const currentLineup = { ...lineup };
    const matchLeague = league;
    try {
      window.BenBalMatchEngine.prepareTeam(currentLineup, byId);
    } catch (error) {
      $('PlayStatus').textContent = error.message;
      return;
    }
    const controller = matchSetup = new AbortController();
    $('Play').disabled = true;
    $('PlayStatus').textContent = 'Validating your team and loading robot cards…';
    const start = signal => teamRequest({
      method: 'POST', body: JSON.stringify({ lineup: currentLineup, league: matchLeague }), signal
    }, 'matches');
    const submit = async (matchId, move) => {
      try {
        return await teamRequest({ method: 'POST', body: JSON.stringify(move), signal: AbortSignal.timeout(15000) },
          'matches/' + matchId + '/round');
      } catch (error) {
        if (error.name === 'TimeoutError' || error instanceof TypeError) {
          throw Error('Could not confirm this round. Retry the same move.');
        }
        throw error;
      }
    };
    try {
      const setup = await start(controller.signal);
      if (!dialog.open || controller.signal.aborted) return;
      window.BenBalMatch.open(setup, { start, submit, showLeagues });
      $('PlayStatus').textContent = '';
    } catch (error) {
      if (!controller.signal.aborted) $('PlayStatus').textContent = error.message;
    } finally {
      if (matchSetup === controller) {
        matchSetup = null;
        $('Play').disabled = saving;
      }
    }
  };
  $('Save').onclick = async () => {
    saving = true;
    $('Close').disabled = $('ChooseLeague').disabled = true;
    $('Reload').hidden = true;
    renderTeam();
    renderCollection();
    $('Status').textContent = 'Saving team…';
    try {
      await teamRequest({ method: 'PUT', body: JSON.stringify({ lineup }) }, 'team?league=' + encodeURIComponent(league));
      $('Status').textContent = 'Team saved.';
    } catch (error) {
      $('Status').textContent = error.message;
      $('Reload').hidden = false;
    } finally {
      saving = false;
      $('Close').disabled = $('ChooseLeague').disabled = false;
      renderTeam();
      renderCollection();
    }
  };
  dialog.addEventListener('cancel', event => {
    if (saving) event.preventDefault();
  });
  dialog.addEventListener('close', () => {
    if (!dialog.open) {
      request?.abort();
      leagueRequest?.abort();
      matchSetup?.abort();
    }
  });
  return {
    open() {
      if (dialog.open) return;
      dialog.showModal();
      showLeagues();
    }
  };
})();
