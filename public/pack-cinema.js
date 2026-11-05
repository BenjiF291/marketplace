/* Shop previews and real openings share exactly the same effects and card flow. */
(()=>{
 window.playSpecialPackOpening=(result,theme,flow)=>{
  if(!window.RewardOpening)return false;
  const preview=!!result.preview,name=preview?(window.PackEffects?.themes[theme]?.name||'Pack effect preview'):(result.packName||'Pack');
  const sample={rewards:[{kind:'gem',id:'bronze',amount:15},{kind:'gem',id:'ultra',amount:3},{kind:'animal',id:'dragon',amount:1}]};
  window.RewardOpening.play({theme,name,preview,appearance:result.appearance||{base:result.packColor,accent:result.packColor},result:preview?sample:flow?null:result,open:flow?.open,choose:flow?.choose,onClose:flow?.onClose,autoStart:preview||flow?.autoStart});return true;
 };
})();
