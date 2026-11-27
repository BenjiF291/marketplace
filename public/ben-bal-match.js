window.BenBalMatch = (() => {
  'use strict';
  const { cardFace, formation } = window.BenBalCard;
  const { counters, roundCount } = window.BenBalMatchEngine;
  const $ = id => document.getElementById('benMatch' + id);
  const dialog = document.getElementById('benBalMatch');
  const overlay = $('Overlay');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const flipDuration = 1750;
  const approachDuration = 140;
  const actionLabels = { attack: 'Attack', dribble: 'Dribble', defence: 'Defend' };
  const stages = { primary: 'Primary', secondary: 'Secondary', total: 'Total effective power' };
  const titles = { player: 'Player wins the round', robot: 'Robot wins the round', draw: 'Confrontation drawn' };
  const outcomes = { player: 'VICTORY!', robot: 'DEFEAT', draw: 'DRAW' };
  let matchId, config, view, pending, retryMove, selected, timer;
  let busy = false;
  const inspection = $('Inspect');
  let handButtons = new Map();
  let gesture, suppressClick = false;

  function node(tag, name, text) {
    const element = document.createElement(tag);
    if (name) element.className = name;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function preventUnload(event) {
    event.preventDefault();
    event.returnValue = '';
  }

  function cardVisual(entry) {
    const frame = node('div', 'ben-match-face-frame');
    const visual = node('span', 'ben-bal-slot-visual');
    visual.append(cardFace(entry.card, entry.role));
    frame.append(visual);
    return frame;
  }

  function showCard(side, entry) {
    const stage = $(side + 'Card');
    stage.classList.remove('is-winner', 'is-total');
    stage.replaceChildren(cardVisual(entry));
  }

  function startFlip(entry) {
    const turn = node('div', 'ben-match-turn');
    turn.style.setProperty('--ben-match-flip', flipDuration + 'ms');
    turn.style.setProperty('--ben-match-approach', approachDuration + 'ms');
    const back = node('div', 'ben-match-turn-face ben-match-turn-back');
    back.setAttribute('aria-hidden', 'true');
    back.inert = true;
    back.append(cardVisual(entry));
    const front = node('div', 'ben-match-turn-face');
    front.append(mysteryCard(entry.card.overall));
    turn.append(front, back);
    $('RobotCard').replaceChildren(turn);
  }

  function mysteryCard(overall) {
    const mystery = node('div', 'ben-match-mystery');
    mystery.append(node('strong', '', overall));
    return mystery;
  }

  function updateScore() {
    $('PlayerScore').textContent = view.score.player;
    $('RobotScore').textContent = view.score.robot;
    const markers = { player: '✓', robot: '×', draw: '=', pending: '·' };
    const labels = { player: 'Player won', robot: 'Robot won', draw: 'Draw', pending: 'Unplayed' };
    $('Tracker').replaceChildren(...Array.from({ length: roundCount }, (_, i) => {
      const outcome = view.rounds[i] ?? 'pending';
      const circle = node('li', 'ben-match-marker ' + outcome, markers[outcome]);
      circle.setAttribute('aria-label', `Round ${i + 1}: ${labels[outcome]}`);
      if (i + 1 === view.round) circle.setAttribute('aria-current', 'step');
      return circle;
    }));
  }

  function selection() {
    for (const [id, button] of handButtons) button.setAttribute('aria-pressed', String(id === selected));
    const counter = view.hidden ? counters[view.hidden.action] : null;
    const entry = view.player.find(item => item.card.id === selected);
    for (const button of $('Actions').querySelectorAll('button')) {
      button.disabled = busy || !entry || Boolean(counter && button.dataset.action !== counter) ||
        Boolean(retryMove && button.dataset.action !== retryMove.button);
    }
    $('PitchDock').hidden = !entry && !view.hidden;
    $('Selection').hidden = !entry;
    if ($('PreviewCard').dataset.selection !== (entry?.card.id ?? '')) {
      $('PreviewCard').dataset.selection = entry?.card.id ?? '';
      $('PreviewCard').replaceChildren(...(entry ? [cardVisual(entry)] : []));
    }
  }

  function showPitch(side) {
    $('PitchTrack').classList.toggle('show-robot', side === 'robot');
    $('PlayerField').inert = side !== 'player';
    $('RobotField').inert = side !== 'robot';
    $('YourPitch').setAttribute('aria-pressed', String(side === 'player'));
    $('TheirPitch').setAttribute('aria-pressed', String(side === 'robot'));
  }

  function drawPitches() {
    const next = new Map();
    const inspecting = view.phase === 'complete';
    const picking = view.phase === 'player-initiation' || view.phase === 'player-response';
    function fill(field, entries, makeTile) {
      const fieldLines = document.querySelector('#benBal .ben-bal-field-lines').cloneNode(true);
      fieldLines.setAttribute('preserveAspectRatio', 'none');
      const bySlot = new Map(entries.map(entry => [entry.slot, entry]));
      field.replaceChildren(fieldLines, ...formation.map(({ slots }) => {
        const line = node('div', 'ben-match-field-row');
        line.append(...slots.map(slot => makeTile(bySlot.get(slot))));
        return line;
      }));
    }
    function inspectionTile(entry) {
      const tile = node('button', 'ben-match-pick');
      tile.type = 'button';
      tile.dataset.slot = entry.slot;
      tile.setAttribute('aria-label', 'Inspect ' + entry.card.name + '\u00b7 ' + entry.slot.toUpperCase());
      tile.append(cardVisual(entry), node('span', 'ben-match-slot', entry.slot.toUpperCase()));
      tile.onclick = () => {
        $('InspectName').textContent = entry.card.name;
        $('InspectCard').replaceChildren(cardVisual({ ...entry, role: null }));
        inspection.showModal();
      };
      return tile;
    }
    fill($('PlayerField'), view.player, entry => {
      if (inspecting) return inspectionTile(entry);
      const tile = node('button', 'ben-match-pick');
      tile.type = 'button';
      tile.dataset.slot = entry.slot;
      tile.disabled = entry.used || !picking || Boolean(retryMove && retryMove.move.cardId !== entry.card.id);
      tile.setAttribute('aria-label', entry.card.name + ' · ' + entry.slot.toUpperCase() + (entry.used ? ' · Used' : ''));
      tile.setAttribute('aria-pressed', String(entry.card.id === selected));
      if (entry.used) tile.classList.add('is-used');
      const art = cardVisual(entry);
      art.setAttribute('aria-hidden', 'true');
      tile.append(art, node('span', 'ben-match-slot', entry.used ? 'Used' : entry.slot.toUpperCase()));
      tile.onclick = event => {
        selected = entry.card.id;
        selection();
        if (event.detail === 0) $('Actions').querySelector('button:enabled')?.focus();
      };
      next.set(entry.card.id, tile);
      return tile;
    });
    fill($('RobotField'), view.robotPitch, ({ overall, revealed }) => {
      if (inspecting) return inspectionTile(revealed);
      const tile = node('div', 'ben-match-pick' + (revealed ? ' is-used' : ''));
      if (revealed) tile.append(cardVisual(revealed), node('span', 'ben-match-slot', 'Used'));
      else tile.append(mysteryCard(overall));
      return tile;
    });
    handButtons = next;
  }

  function fitRobotSignal() {
    const signal = $('RobotSignal');
    if (signal.hidden || $('PitchDock').hidden) return;
    const field = $('PlayerField');
    const defender = field.querySelector('[data-slot="def4"]');
    if (!defender) return;
    const fieldRect = field.getBoundingClientRect();
    const viewport = $('PitchViewport').getBoundingClientRect();
    const defenderRect = defender.getBoundingClientRect();
    const dock = $('PitchDock');
    const dockRect = dock.getBoundingClientRect();
    const padding = getComputedStyle(dock);
    // Use field-relative coordinates so switching pitches cannot affect the clearance.
    const right = viewport.left + defenderRect.right - fieldRect.left;
    const bottom = viewport.top + defenderRect.bottom - fieldRect.top;
    const beside = dockRect.right - parseFloat(padding.paddingRight) - right - 4;
    const below = (dockRect.bottom - parseFloat(padding.paddingBottom) - bottom - 4) * 5 / 7;
    signal.style.maxWidth = Math.max(0, beside, below) + 'px';
  }

  function drawRound() {
    retryMove = null;
    $('RoundError').hidden = true;
    selected = null;
    const signal = $('RobotSignal');
    signal.hidden = !view.hidden;
    signal.replaceChildren();
    if (view.hidden) {
      const { action, overall } = view.hidden;
      signal.dataset.action = action;
      signal.setAttribute('aria-label', `Robot mystery card, Overall ${overall}, ${actionLabels[action]}`);
      signal.append(mysteryCard(overall));
    } else {
      delete signal.dataset.action;
      signal.removeAttribute('aria-label');
    }
    showPitch('player');
    drawPitches();
    selection();
    fitRobotSignal();
    updateScore();
  }

  function highlight(stage, result) {
    for (const [side, actionKey] of [['Player', result.playerAction], ['Robot', result.robotAction]]) {
      const frame = $(side + 'Card');
      frame.querySelector('.is-compared')?.classList.remove('is-compared');
      frame.classList.toggle('is-total', stage === 'total');
      if (stage !== 'total') {
        frame.querySelector(`.ben-bal-stat[data-action="${actionKey}"] .ben-bal-${stage}`)?.classList.add('is-compared');
      }
    }
  }

  function comparisonRow(step) {
    const row = node('div', 'ben-match-comparison-row');
    row.append(node('span', '', stages[step.stage]),
      node('strong', 'ben-match-player-value', step.player),
      node('strong', 'ben-match-robot-value', step.robot));
    row.children[1].setAttribute('aria-label', `Player ${step.player}`);
    row.children[2].setAttribute('aria-label', `Robot ${step.robot}`);
    if (step.player === step.robot) row.append(node('small', '', 'Tied'));
    return row;
  }

  function reveal(animate) {
    clearTimeout(timer);
    if (!overlay.open || view?.phase !== 'result') return;
    const result = view.result;
    $('Arena').classList.remove('is-entering');
    $('Arena').classList.toggle('is-revealing', animate);
    showCard('Player', result.player);
    showCard('Robot', result.robot);
    drawPitches();
    $('Comparisons').replaceChildren();
    $('Skip').hidden = !animate;
    let index = 0;
    function step() {
      if (index < result.comparisons.length) {
        const current = result.comparisons[index++];
        highlight(current.stage, result);
        $('Comparisons').append(comparisonRow(current));
        if (animate) timer = setTimeout(step, 470);
        else step();
        return;
      }
      $('Arena').classList.remove('is-revealing');
      $('Skip').hidden = true;
      if (result.winner !== 'draw') $(result.winner === 'player' ? 'PlayerCard' : 'RobotCard').classList.add('is-winner');
      $('Result').textContent = titles[result.winner];
      $('Next').hidden = false;
      updateScore();
      if ($('Leave').hidden) $('Next').focus({ preventScroll: true });
    }
    if (animate) timer = setTimeout(step, 270);
    else step();
  }

  async function commit(action) {
    if (busy || overlay.open || !selected || !$('Leave').hidden ||
        !['player-initiation', 'player-response'].includes(view?.phase) ||
        (view.hidden && counters[view.hidden.action] !== action)) return;
    const id = matchId;
    const move = { round: view.round, cardId: selected, action: view.phase === 'player-initiation' ? action : null };
    retryMove = { move, button: action };
    busy = true;
    $('RoundError').hidden = true;
    for (const button of handButtons.values()) button.disabled = true;
    selection();
    try {
      const response = await config.submit(id, move);
      if (matchId !== id) return;
      pending = response;
      view = response.result;
    } catch (error) {
      if (matchId === id) {
        busy = false;
        drawPitches();
        selection();
        $('RoundError').textContent = error.message;
        $('RoundError').hidden = false;
      }
      return;
    }
    busy = false;
    const { result } = view;
    $('PitchDock').hidden = true;
    $('DuelTitle').textContent = `Confrontation ${view.round} / ${roundCount}`;
    $('PlayerAction').textContent = `Player · ${actionLabels[result.playerAction]}`;
    $('RobotAction').textContent = `Robot · ${actionLabels[result.robotAction]}`;
    $('Comparisons').replaceChildren();
    $('Result').textContent = '';
    $('Next').hidden = true;
    $('Skip').hidden = reduced.matches;
    for (const button of handButtons.values()) button.disabled = true;
    showCard('Player', result.player);
    if (!reduced.matches) {
      $('RobotCard').classList.remove('is-winner', 'is-total');
      $('Arena').classList.add('is-entering');
      startFlip(result.robot);
    } else {
      showCard('Robot', result.robot);
    }
    overlay.showModal();
    overlay.scrollTop = 0;
    if (reduced.matches) reveal(false);
    else {
      $('Skip').focus({ preventScroll: true });
      timer = setTimeout(() => reveal(true), approachDuration + flipDuration);
    }
  }

  function showResults() {
    $('Game').hidden = $('BackResults').hidden = true;
    $('Summary').hidden = false;
    dialog.scrollTop = 0;
    $('Outcome').focus({ preventScroll: true });
  }

  function finish(reward) {
    removeEventListener('beforeunload', preventUnload);
    $('Leave').hidden = $('PitchDock').hidden = true;
    $('Summary').dataset.outcome = view.winner;
    $('Outcome').textContent = outcomes[view.winner];
    $('FinalPlayer').textContent = view.score.player;
    $('FinalRobot').textContent = view.score.robot;
    $('Earned').hidden = !reward?.awarded;
    const league = reward?.league || $('League').dataset.league;
    $('PackName').textContent = reward?.pack ? reward.pack.name + ' earned!' : 'Daily Pack earned!';
    $('PackImage').hidden = !reward?.pack?.imageUrl;
    if (reward?.pack?.imageUrl) $('PackImage').src = API_URL + reward.pack.imageUrl;
    const count = reward?.count ?? 0;
    $('Packs').replaceChildren(...Array.from({ length: 3 }, (_, index) => {
      const earned = index < count;
      const marker = node('li', earned ? 'is-earned' : '', `Pack ${index + 1}`);
      marker.prepend(node('span', '', earned ? '\u2713' : '\u2726'));
      marker.setAttribute('aria-label', `Pack ${index + 1} ${earned ? 'earned' : 'unearned'}`);
      if (reward?.awarded && index === count - 1) marker.classList.add('is-new');
      return marker;
    }));
    $('Progress').textContent = !reward ? 'Daily reward status unavailable.' : count === 3
      ? 'All daily rewards collected!' : `${count} of 3 Daily Packs earned`;
    if (league && reward) {
      $('Progress').textContent = `${count} / 3 ${league} rewards earned today.` +
        (reward.pack ? (reward.awarded ? '' : ' Reward pack: ' + reward.pack.name + '.') :
          ' Daily pack reward not configured yet.');
    }
    $('ReplayError').hidden = true;
    showResults();
  }

  function begin(setup) {
    matchId = setup.id;
    view = setup.view;
    $('League').dataset.league = setup.league || '';
    $('League').textContent = setup.league ? setup.league + ' League' : '';
    $('League').hidden = !setup.league;
    $('ChooseLeague').hidden = !config.showLeagues;
    pending = null;
    busy = false;
    $('Game').hidden = false;
    $('Summary').hidden = $('Leave').hidden = $('BackResults').hidden = true;
    dialog.classList.remove('is-inspecting');
    addEventListener('beforeunload', preventUnload);
    drawRound();
    if (!dialog.open) dialog.showModal();
    else $('YourPitch').focus({ preventScroll: true });
    dialog.scrollTop = 0;
  }

  function exit() {
    if (busy) return;
    if (view.phase === 'complete') {
      if (!$('BackResults').hidden) $('BackResults').click();
      else dialog.close();
    }
    else {
      $('Leave').hidden = false;
      $('Game').inert = true;
      $('PitchDock').inert = true;
      $('Stay').focus();
    }
  }

  $('Actions').onclick = event => {
    const choice = event.target.closest('button[data-action]');
    if (choice && !choice.disabled) commit(choice.dataset.action);
  };
  $('YourPitch').onclick = () => showPitch('player');
  $('TheirPitch').onclick = () => showPitch('robot');
  const viewport = $('PitchViewport');
  new ResizeObserver(fitRobotSignal).observe(viewport);
  viewport.addEventListener('pointerdown', event => {
    suppressClick = false;
    gesture = event.pointerType === 'touch' && event.isPrimary
      ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
  });
  viewport.addEventListener('pointerup', event => {
    if (gesture?.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    gesture = null;
    if (Math.abs(dx) < 42 || Math.abs(dx) <= Math.abs(dy) * 1.4) return;
    suppressClick = true;
    showPitch(dx < 0 ? 'robot' : 'player');
  });
  viewport.addEventListener('pointercancel', () => { gesture = null; });
  viewport.addEventListener('click', event => {
    if (suppressClick && event.detail > 0) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  $('Skip').onclick = () => reveal(false);
  $('Next').onclick = () => {
    if (!overlay.open || $('Next').hidden) return;
    try {
      const { next, reward } = pending;
      pending = null;
      view = next;
      overlay.close();
      if (view.phase === 'complete') finish(reward);
      else {
        drawRound();
        dialog.scrollTop = 0;
        $('PlayerField').querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
      }
    } catch (error) {
      $('Result').textContent = error.message;
    }
  };
  $('Stay').onclick = () => {
    $('Leave').hidden = true;
    $('Game').inert = false;
    $('PitchDock').inert = false;
    $('YourPitch').focus({ preventScroll: true });
  };
  $('Discard').onclick = () => dialog.close();
  $('Replay').onclick = async () => {
    const id = matchId;
    $('Replay').disabled = $('ViewPitch').disabled = true;
    $('ReplayError').hidden = true;
    try {
      const setup = await config.start();
      if (dialog.open && matchId === id) begin(setup);
    } catch (error) {
      if (matchId === id) {
        $('ReplayError').textContent = error.message;
        $('ReplayError').hidden = false;
      }
    } finally { $('Replay').disabled = $('ViewPitch').disabled = false; }
  };
  $('ChooseLeague').onclick = () => {
    dialog.close();
    config.showLeagues?.();
  };
  $('ViewPitch').onclick = () => {
    $('Summary').hidden = true;
    $('Game').hidden = $('BackResults').hidden = false;
    dialog.classList.add('is-inspecting');
    showPitch('player');
    drawPitches();
    dialog.scrollTop = 0;
    $('YourPitch').focus();
  };
  $('BackResults').onclick = () => {
    dialog.classList.remove('is-inspecting');
    showResults();
  };
  $('InspectClose').onclick = () => inspection.close();
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    exit();
  });
  overlay.addEventListener('cancel', event => event.preventDefault());
  dialog.addEventListener('close', () => {
    clearTimeout(timer);
    if (overlay.open) overlay.close();
    removeEventListener('beforeunload', preventUnload);
    $('Game').inert = false;
    $('PitchDock').inert = false;
    if (inspection.open) inspection.close();
    matchId = config = view = pending = null;
    document.getElementById('benBalPlay').focus({ preventScroll: true });
  });

  return {
    open(setup, requests) {
      config = requests;
      begin(setup);
    }
  };
})();
