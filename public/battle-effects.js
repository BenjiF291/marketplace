// Shared interaction and motion for online battles and Bob.
async function chooseBattleOptions(board,card) {
  const variants=PracticeEngine.placementOptions(board,card);
  if(variants.length===1)return variants[0];
  const dialog=document.createElement('dialog');dialog.className='battle-power-dialog';
  const title=document.createElement('h3');title.textContent='Choose your Mirror move';
  const select=document.createElement('select');select.className='input-field';select.setAttribute('aria-label','Mirror ability choice');
  variants.forEach((option,i)=>select.add(new Option([Number.isInteger(option.copyCell)?`Copy ${board[option.copyCell].name} (row ${Math.floor(option.copyCell/4)+1}, column ${option.copyCell%4+1})`:null,option.side?`Attack ${option.side}`:null].filter(Boolean).join(' · '),i)));
  const use=document.createElement('button');use.className='btn btn-primary';use.textContent='Use this choice';
  const cancel=document.createElement('button');cancel.className='btn';cancel.textContent='Cancel';
  dialog.append(title,select,use,cancel);document.body.append(dialog);
  return new Promise(resolve=>{let result=null;use.onclick=()=>{result=variants[Number(select.value)];dialog.close();};cancel.onclick=()=>dialog.close();dialog.onclose=()=>{dialog.remove();resolve(result);};dialog.showModal();});
}
const battleMotionState=new WeakMap();
function animateBattleBoard(element,cards,key) {
  const previous=battleMotionState.get(element);
  battleMotionState.set(element,{key,cards:structuredClone(cards)});
  if(!previous||previous.key!==key)return;
  cards.forEach((card,index)=>{
    const before=previous.cards[index],node=element.children[index];if(!node)return;
    const identity=c=>c&&(c.cardId||c.battleCardId||c.id||c.name)+':'+c.playedBy;
    let effect='',message='';
    if(card&&identity(card)!==identity(before)){effect='battle-placed';message=PracticeEngine.isSpecial(card)?'✦ Special placed':'';}
    else if(before&&!card){effect='battle-shattered';message='Card removed';}
    else if(card&&before&&card.ownerId!==before.ownerId){effect='battle-captured';message='Captured';}
    if(card&&before&&(['top','right','bottom','left'].some(side=>card[side]!==before[side])||card.copiedAbility!==before.copiedAbility||card.breakAfterOpponentOf!==before.breakAfterOpponentOf)){effect='battle-powered';message=card.breakAfterOpponentOf?'Breaks after next turn':'✦ Ability activated';}
    if(effect){node.classList.add(effect);if(message){const label=document.createElement('span');label.className='battle-effect-label';label.textContent=message;node.append(label);setTimeout(()=>label.remove(),1300);}}
  });
}

const mirrorCreationSelect=document.getElementById('battleMirrorPower');
if(mirrorCreationSelect)Object.entries(PracticeEngine.MIRROR_POWERS).forEach(([key,power],index)=>mirrorCreationSelect.add(new Option(`${index+1}. ${power.name}`,key)));
