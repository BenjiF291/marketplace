importScripts('practice-engine.js');
self.onmessage = event => { const {board, hand, opponentHand} = event.data; self.postMessage(PracticeEngine.chooseMove(board, hand, opponentHand)); };
