const test=require('node:test');const assert=require('node:assert/strict');
const vm=require('node:vm');const fs=require('node:fs');
const engine=require('./public/practice-engine');const skill=require('./brawl-skill');
function harness(){
  const elements=new Map();
  const node=()=>({hidden:false,children:[],classList:{toggle(){}},setAttribute(){},appendChild(child){this.children.push(child);},replaceChildren(){this.children=[];}});
  const ids=['practiceStart','practiceDifficulty','practiceMode','practiceSetup','practiceArena','practiceBoard','practiceHand','practiceStatus','brawlSyncResult','brawlSkillResult','brawlMoveReview','brawlMoveReviews','brawlSkillLevel','brawlSkillProgress','brawlSkillNext','brawlSkillBooster','brawlMilestones','trophyPath','trophyTotal','practiceNote'];
  ids.forEach(id=>elements.set(id,node()));
  elements.get('practiceMode').value='skill';elements.get('practiceDifficulty').value='easy';
  const cards=engine.trainingCards(),requests=[];
  const context=vm.createContext({setInterval(){},animateBattleBoard(){},currentUserId:'u',PracticeEngine:engine,battleInventoryCache:cards,console,
    localStorage:{getItem(){return null;},setItem(){},removeItem(){}},navigator:{},window:{addEventListener(){}},
    document:{getElementById(id){assert.ok(elements.has(id),`Unknown UI element ${id}`);return elements.get(id);},createElement:node},
    buildBattleCardMarkup:card=>card.name,amuletNode:(tag,text)=>({...node(),textContent:text}),updateBalance(){},
    resourceRequest:async(url,body)=>{requests.push({url,body});if(url==='/brawl/skill')return skill.profile({});if(url==='/trophies')return {trophies:0,peak:0,claimed:[],path:[]};
      if(url==='/computer-battles/start')return {id:'m',seed:42,difficulty:{policy:'adaptive-v2',skill:500},initial:{board:Array(16).fill(null),player:cards,computer:cards,turn:'computer'},target:5,average:5,playerAverage:5};throw new Error('Unexpected request');}
  });
  vm.runInContext(fs.readFileSync('public/practice-battle.js','utf8'),context);
  vm.runInContext("practiceCards=PracticeEngine.trainingCards();practiceSelection=new Set(practiceCards.map(c=>c.id));var bobStarted=false;runPracticeComputer=()=>{bobStarted=true;};",context);
  return {context,elements,requests};
}
test('ranked UI uses server-selected first turn and does not need a starting-player control',async()=>{
  const {context,elements,requests}=harness();
  await vm.runInContext('startPracticeBattle()',context);
  assert.equal(vm.runInContext('bobStarted',context),true);
  assert.equal(requests.find(r=>r.url==='/computer-battles/start').body.first,undefined);
  assert.match(elements.get('practiceStatus').textContent,/Bob started/);
  assert.match(elements.get('brawlSkillLevel').textContent,/Placement games: 0 \/ 5/);
});
test('training starts locally without skill requests and placement summaries never show null ratings',async()=>{
  const {context,elements,requests}=harness();elements.get('practiceMode').value='training';
  await vm.runInContext('startPracticeBattle()',context);
  assert.ok(!requests.some(r=>r.url==='/computer-battles/start'));
  assert.match(elements.get('brawlSkillResult').textContent,/unchanged/);
  context.change=skill.settle({},1,.8,500).change;
  const result=vm.runInContext('formatBrawlSkillResult(change)',context);
  assert.match(result,/Placement 1\/5/);assert.ok(!result.includes('null'));
});
