function deadline(match) {
  if (match.status !== 'board' || !match.turnPlayerId || !match.turnStartedAt) return null;
  const start = match.turnStartedAt.toDate ? match.turnStartedAt.toDate().getTime() : new Date(match.turnStartedAt).getTime();
  const time = Number(match.clocks?.[match.turnPlayerId]);
  return Number.isFinite(start) && Number.isFinite(time) ? start + Math.max(0, time) : null;
}
function timeoutResult(match, now = Date.now()) {
  const end = deadline(match);
  if (end === null || now < end) return null;
  return { status: 'finished', winnerId: match.participantIds.find(id => id !== match.turnPlayerId),
    endReason: 'timeout', timedOutPlayerId: match.turnPlayerId,
    clocks: { ...match.clocks, [match.turnPlayerId]: 0 }, turnPlayerId: null, turnStartedAt: null, updatedAt: new Date(now) };
}
function createTimeoutService(db, effects, round) {
  const timers = new Map();
  async function settle(tx, ref, match) {
    const result = timeoutResult(match);
    if (!result) return null;
    let prizePaid = match.prizePaid === true;
    if (!prizePaid && Number(match.prize) > 0) {
      const winnerRef = db.collection('users').doc(result.winnerId);
      const loserRef = db.collection('users').doc(result.timedOutPlayerId);
      const [winner, loser] = await tx.getAll(winnerRef, loserRef);
      if (winner.exists && loser.exists) {
        const prize = Math.min(Number(match.prize), Math.max(0, Number(loser.data().balance) || 0));
        const bonus = round(Math.min(50, prize * (effects(winner.data()).battle || 0) / 100));
        tx.update(winnerRef, { balance: round(Number(winner.data().balance || 0) + prize + bonus) });
        tx.update(loserRef, { balance: round(Number(loser.data().balance || 0) - prize) });
        result.paidPrize = prize;
        prizePaid = true;
      }
    }
    const finished = { ...match, ...result, prizePaid };
    tx.update(ref, { ...result, prizePaid });
    return finished;
  }
  async function expire(id) {
    const ref = db.collection('battleMatches').doc(id);
    const result = await db.runTransaction(async tx => {
      const doc = await tx.get(ref);
      if (!doc.exists) return null;
      return await settle(tx, ref, doc.data()) || doc.data();
    });
    if (result) schedule(id, result);
    return result;
  }
  function schedule(id, match) {
    const end = deadline(match);
    const previous = timers.get(id);
    if (previous?.end === end) return;
    if (previous) clearTimeout(previous.timer);
    timers.delete(id);
    if (end === null) return;
    const timer = setTimeout(() => {
      timers.delete(id);
      expire(id).catch(error => console.error('Battle timeout failed:', error));
    }, Math.min(2147483647, Math.max(1, end - Date.now())));
    timer.unref?.(); timers.set(id, { end, timer });
  }
  async function recover() {
    const snapshot = await db.collection('battleMatches').where('status', '==', 'board').get();
    snapshot.docs.forEach(doc => schedule(doc.id, doc.data()));
  }
  return { settle, expire, schedule, recover };
}
module.exports = { deadline, timeoutResult, createTimeoutService };
