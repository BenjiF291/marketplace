importScripts('practice-engine.js');
self.onmessage = event => { const {board, hand, opponentHand,difficulty,seed} = event.data; self.postMessage(PracticeEngine.chooseMove(board, hand, opponentHand,difficulty,PracticeEngine.seeded(seed))); };
