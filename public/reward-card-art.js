/* Shared presentation for every reward accepted by the pack editor. */
(function(root){
 const gems={bronze:['Ruby','#cf504d'],'rare-bronze':['Garnet','#a44465'],silver:['Moonstone','#8cbcb9'],'rare-silver':['Opal','#b9aed0'],gold:['Citrine','#e5b34f'],'rare-gold':['Emerald','#53ad83'],platinum:['Sapphire','#658ac1'],lightning:['Amethyst','#a178c0'],ultra:['Diamond','#a9d9e5']};
 // Visible alpha bounds, padded below so fine fur and wing tips stay inside the frame.
 const creatureBounds={rill:[190,90,486,580],brugar:[184,163,638,630],'brugar-species':[223,172,586,526],'defender-rill':[179,58,506,550],'defender-talren':[139,139,520,574],'fenra-species':[187,58,538,519],veyrin:[177,160,664,538],'krynn-species':[179,173,668,543],'northern-talren':[123,139,517,573],'rill-species':[183,58,511,546],fenra:[198,89,559,533],talren:[174,140,528,579],tharos:[184,158,643,538],krynn:[170,162,679,533],dragon:[120,87,512,395],fox:[93,52,472,417],snail:[40,49,493,420]};
 function creatureFrame(animal){const bounds=creatureBounds[animal?.id];if(!bounds)return null;const imageWidth=animal.companion?512:768,imageHeight=animal.companion?420:630,x=Math.max(0,bounds[0]-10),y=Math.max(0,bounds[1]-10);return {x,y,width:Math.min(imageWidth,bounds[2]+10)-x,height:Math.min(imageHeight,bounds[3]+10)-y,imageWidth,imageHeight};}
 const svg=body=>`<svg viewBox="0 0 240 240" aria-hidden="true">${body}</svg>`;
 const gem=(color,x=120,y=113,size=1)=>`<g transform="translate(${x} ${y}) scale(${size})"><path d="m-46-33 26-25h40l26 25L0 48Z" fill="${color}" stroke="#fff2c5" stroke-width="3"/><path d="m-46-33 46 81-20-106m66 25-46 81 20-106M-46-33h92L0-14Z" fill="#ffffff27" stroke="#fff5e380" stroke-width="2"/><path d="m-20-58 20 44 20-44" fill="#ffffff44"/></g>`;
 const coin=(x,y,s=1)=>`<g transform="translate(${x} ${y}) scale(${s})"><ellipse cy="7" rx="32" ry="14" fill="#88602e"/><ellipse rx="32" ry="14" fill="#e5be63" stroke="#fff0b3" stroke-width="2"/><ellipse rx="24" ry="9" fill="#c29442"/><path d="M-4 6V-6H8M-4 0h9" fill="none" stroke="#ffdf8d" stroke-width="3"/></g>`;
 function describe(reward){
  const animal=root.StableAnimals?.animals.find(a=>a.id===(reward.kind==='rubyItem'?reward.id?.replace(/^pet:/,''):reward.id));
  const gemInfo=gems[reward.id];
  const names={footy:'Footy',boost:reward.id==='leap'?'Time Leap':'Time Skip',animal:animal?.name,gem:gemInfo?.[0],card:reward.id?.replace(/\.[^.]+$/,'').replace(/[_-]/g,' ')};
  const name=reward.label?.replace(/^\d+(?:\.\d+)?\s+/,'')||names[reward.kind]||reward.id||'Reward';
  const group={gem:'CRYSTALS',footy:'ISLAND CURRENCY',boost:'TIME BOOST',animal:'CREATURE',rubyItem:'ISLAND ITEM',amulet:'AMULET',pack:'COLLECTION PACK',card:'COLLECTION CARD'}[reward.kind]||'ISLAND REWARD';
  let image=reward.kind==='card'?reward.imageUrl||'images/'+encodeURIComponent(reward.id):animal&&(reward.kind==='animal'||reward.kind==='rubyItem')?animal.poster:null;
  let body;
  if(reward.kind==='gem')body=gem(gemInfo?.[1]||'#93c9c1',61,166,.65)+gem(gemInfo?.[1]||'#93c9c1',171,162,.72)+gem(gemInfo?.[1]||'#93c9c1',119,112,1.3);
  else if(reward.kind==='footy')body=coin(80,179,1.25)+coin(153,178,1.3)+coin(113,158,1.5)+coin(155,139,1.1)+coin(89,134,1.2)+coin(120,111,1.25);
  else if(reward.kind==='boost')body=`<path d="M77 49h86v16H77Zm0 133h86v16H77Z" fill="#a77d41" stroke="#f4d496" stroke-width="3"/><path d="M86 65q0 36 24 57-24 22-24 60h68q0-38-24-60 24-21 24-57Z" fill="#98c8bd55" stroke="#769d91" stroke-width="4"/><path d="m94 81 27 29 24-29m-51 90 27-29 24 29" fill="${reward.id==='leap'?'#ad80c7':'#e4ba64'}"/><path d="M120 117v31" stroke="#e7c882" stroke-width="3"/><path d="m169 82 18 19-18 19m15-38 18 19-18 19" fill="none" stroke="#c6a45c" stroke-width="6" stroke-linejoin="round"/>`;
  else if(reward.kind==='amulet')body=`<path d="M71 32q49 117 98 0" fill="none" stroke="#b38a4c" stroke-width="8"/><circle cx="120" cy="139" r="54" fill="#c39b57" stroke="#ffe1a1" stroke-width="5"/><circle cx="120" cy="139" r="43" fill="#386758"/>${gem('#a9688e',120,139,.65)}<path d="m76 139-9-5m106 5-9-5M120 91v-8m0 110v-8" stroke="#fff1b9" stroke-width="3"/>`;
  else if(reward.kind==='pack')body=`<path d="m57 45 119-12 10 160-119 13Z" fill="#426855" stroke="#d8b577" stroke-width="5"/><path d="m68 58 96-9 9 131-96 11Z" fill="#244b43" stroke="#bc995f" stroke-width="2"/><path d="m105 39 23-2 11 163-23 3Z" fill="#c39d58"/>${gem('#bd778d',121,116,.65)}<path d="m62 49 108-10m-95 157 103-11" stroke="#f5d69a" stroke-width="4"/>`;
  else if(reward.kind==='rubyItem'&&/^(hat|shirt|trousers|shoes|outfit|clothing|wardrobe)[:_-]/.test(reward.id||''))body='<path d="m80 58 27-12q13 20 26 0l27 12 38 38-27 27-19-16v88H88v-88l-19 16-27-27Z" fill="#678c80" stroke="#e1c38c" stroke-width="4"/><path d="m108 47 12 40 13-40m-13 41v105" fill="none" stroke="#d6b673" stroke-width="3"/>';
  else body=`<path d="M91 38h58v23H91Zm12 23-24 46q-21 76 41 92 62-16 41-92l-24-46" fill="#568c8366" stroke="#d6b574" stroke-width="4"/><path d="M82 128q38-17 76 0 10 48-38 62-48-14-38-62" fill="#a7779f"/>${gem('#c999bf',120,124,.55)}<path d="m99 78-8 27m0 8-3 14" fill="none" stroke="#fff8dc" stroke-width="4" stroke-linecap="round"/>`;
  let itemArt;
  if(reward.kind==='rubyItem'&&reward.id?.startsWith('relic:'))itemArt=root.HallArt?.decor(reward.id);
  const garment=reward.kind==='rubyItem'?root.Wardrobe?.catalog.find(item=>item.id===reward.id):null;
  if(garment&&root.HallArt?.avatar)itemArt=root.HallArt.avatar({[garment.slot]:garment.value});
  const creature=reward.kind==='animal'||reward.kind==='rubyItem'&&reward.id?.startsWith('pet:');const rarity=['common','rare','epic','legendary','unique'].includes(reward.rarity)?reward.rarity:'unassigned';
  return {name,group,image,art:itemArt||svg(body),amount:reward.amount||1,creature,rarity,imageFrame:creature?creatureFrame(animal):null};
 }
 function normalize(result){if(result.rewards)return result.rewards;const rewards=[{kind:'card',id:result.cardId||'New card',imageUrl:result.imageUrl,amount:1}];if(result.packBonus)rewards.push({kind:'footy',amount:result.packBonus,label:result.packBonus+' Footy'});if(result.rubyBonus)rewards.push({kind:'gem',id:'bronze',amount:result.rubyBonus,label:result.rubyBonus+' Ruby'});return rewards;}
 function samples(catalog){
  const groups=[['gem','Gem currencies'],['footy','Footy'],['boost','Time boosts'],['animal','Animals'],['rubyItem','Shop items'],['amulet','Amulets'],['card','Collection cards'],['pack','Collection packs']];
  return groups.map(([kind,title])=>{const entries=kind==='footy'?[{id:'',name:'Footy'}]:catalog[kind]||[];
   const rewards=[...new Map(entries.map(entry=>[entry.id,entry])).values()].map(entry=>{const name=kind==='card'?entry.name.replace(/\.[^.]+$/,'').replace(/[_-]/g,' '):entry.name;return {kind,id:entry.id,amount:1,label:'1 '+name,...(entry.rarity?{rarity:entry.rarity}:{})};});
   rewards.sort((a,b)=>a.label.slice(2).localeCompare(b.label.slice(2),'en',{sensitivity:'base',numeric:true})||a.id.localeCompare(b.id));return {kind,title,rewards};
  }).filter(group=>group.rewards.length);
 }
 const api={describe,normalize,samples};if(typeof module!=='undefined')module.exports=api;else root.RewardCardArt=api;
})(typeof window==='undefined'?globalThis:window);
