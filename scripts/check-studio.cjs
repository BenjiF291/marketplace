const assert=require('node:assert/strict');const {chromium}=require(require.resolve('playwright',{paths:[require('node:path').resolve('.ui-tools')]}));const fs=require('fs');const path=require('path');const http=require('http');
const root=path.resolve('public');
const images=fs.readdirSync(path.join(root,'images')).filter(n=>/\.(png|jpe?g|webp)$/i.test(n)).slice(0,8);
const cards=images.map((name,i)=>({id:`i${i}`,name:name.replace(/\.[^.]+$/,'').replace(/[_-]/g,' '),imageUrl:'/images/'+encodeURIComponent(name),price:75+i*50,sold:false,sellerId:'other',itemType:'card',quantity:2}));
const items=[...cards.slice(0,6),{id:'pack',itemType:'pack',name:'Gold discovery pack',packColor:'#bca264',price:150,sellerId:'other',stock:3}];
items[0]={...items[0],vipDiscountPercent:25,vipPrice:56.25,vipDiscountApplied:true,payablePrice:56.25};
items[1]={...items[1],vipDiscountPercent:20,vipPrice:100,vipDiscountApplied:false,payablePrice:125};
items[items.length-1].dailyPackDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
items[items.length-1].expiresAt=new Date(Date.now()+432000000).toISOString();
const user={id:'ui-preview',username:'Club captain',isAdmin:true,balance:2450};
const battle=require('../public/practice-engine').trainingCards();battle[0]={...battle[0],name:'Mirror tester',linkedCardImage:'Mirror_test.png',mirrorPower:'focus'};
const tiers=[{id:'bronze',name:'Bronze',order:0,sellPrice:25,cards:images}];
const petPreview={rubyItems:{'pet:fox':1,'pet:snail':1,'pet:dragon':1,food:3,'food:trail':2,'food:feast':1},rubyEquipped:{pets:['pet:fox','pet:snail','pet:dragon']},gems:{bronze:300}};
const petTiers=['Bronze','Rare Bronze','Silver','Rare Silver','Gold','Rare Gold','Platinum','Lightning','Ultra','Genious'].map((name,order)=>({id:'pet'+order,name,order,packs:['pp'+order]}));
const petLoot=require('../pet-journeys').tables(petTiers,[{id:'pp4',name:'Gold',cardIds:[images[0]]}]);
const fixture=(url)=>{
 if(url==='/pet-journeys')return petLoot;
 if(url==='/ruby-shop'&&process.env.PET_JOURNEY_CHECK_ONLY==='1')return {catalog:require('../ruby-shop').CATALOG,owned:petPreview.rubyItems,equipped:petPreview.rubyEquipped,journeys:Object.values(petPreview.petJourneys||{}),serverNow:Date.now(),rubies:300,slots:[],treats:2};
 if(url==='/users')return [user,{id:'other',username:'Alex',balance:400}];
 if(url==='/ruby-shop')return {catalog:require('../ruby-shop').CATALOG,owned:{'pet:fox':1,'relic:rose':1,food:3},equipped:{pet:'pet:fox'},rubies:300,slots:[],treats:2};
 if(url==='/items')return items;
 if(url==='/inventory')return cards;
 if(url==='/ascend-tier-config')return tiers;
 if(url==='/battle-cards'||url==='/battle-inventory')return battle;
 if(url==='/brawl/skill')return require('../brawl-skill').profile({ratingVersion:2,placementsCompleted:5,skillLevel:436});
 if(url==='/trophies')return {trophies:250,peak:300,claimed:[25,75],path:require('../trophy-utils').PATH.map(reward=>({...reward,amuletName:require('../amulet-utils').EXCLUSIVES.find(entry=>entry.id===reward.amulet)?.name}))};
 if(url==='/amulets')return {slots:[null],slotCount:1,vipPrice:300,vipDays:30,owned:{},catalog:require('../amulet-utils').catalog([...tiers,{id:'silver',name:'Silver',order:2}]),effects:{},slotPrices:[0,50,150,500,1000],balance:2450,isAdmin:true,serverNow:Date.now(),gems:{bronze:18}};
 if(url==='/gem-converter')return {recipes:[{tierId:'bronze',tierName:'Bronze',gemKey:'bronze',gemName:'Ruby',unlocked:true,sellPrice:25,cards:images,costs:{1:25,2:50,3:75},rewards:{1:3,2:7,3:12}}],gems:{bronze:18},level:1,nextUpgrade:null};
 if(url==='/gem-workshop')return {theme:{},compressor:false,gems:{bronze:18},dyes:{bronze:5},tiers:[{gemKey:'bronze',gemName:'Ruby'}],areas:{buttons:'Buttons',navigation:'Navigation',background:'Background'}};
 if(url.includes('history'))return {transfers:[],items:[]};
 if(url==='/health')return {ok:true};return [];
};
(async()=>{
 const server=http.createServer((req,res)=>{const target=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(target,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',target.endsWith('.js')?'text/javascript':target.endsWith('.css')?'text/css':target.endsWith('.html')?'text/html':'image/png');res.end(data);});});await new Promise(r=>server.listen(4173,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1050},serviceWorkers:'block'});
 await context.addInitScript(()=>{localStorage.setItem('userId','ui-preview');localStorage.setItem('username','Club captain');localStorage.setItem('sessionToken','preview-only');});
 await context.route('https://marketplace-aw8b.onrender.com/**',async route=>{const req=route.request();if(req.method()!=='GET'&&process.env.PET_JOURNEY_CHECK_ONLY==='1'&&req.url().includes('/ruby-shop/journey-')){const body=req.postDataJSON(),j=require('../pet-journeys');let reward;if(req.url().endsWith('journey-start'))Object.assign(petPreview,j.start(petPreview,body.petId,body.foodId,petLoot,body.actionId,Date.now(),[999999,999999,0]));else {const trip=petPreview.petJourneys[body.petId];const claimed=j.claim(petPreview,body.petId,body.journeyId,trip.endsAt);Object.assign(petPreview,claimed.update);reward=claimed.reward;}await route.fulfill({json:{success:true,reward}});return;}if(req.method()!=='GET'){await route.fulfill({status:403,body:'Preview: writes blocked'});return;}await route.fulfill({json:fixture(new URL(req.url()).pathname)});});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
 await page.goto('http://127.0.0.1:4173/index.html');await page.waitForTimeout(800);
 if(process.env.PACK_CINEMA_CHECK_ONLY==='1'){
  await page.locator('#rubyShopButton').click();await page.locator('#rubyShopDialog select[aria-label="Shop category"]').selectOption('opening');
  await page.locator('#rubyShopDialog').getByRole('button',{name:'Preview animation'}).first().click();
  assert.equal(await page.locator('.pack-cinema').getAttribute('data-theme'),'embers');await page.waitForTimeout(1400);assert.equal(await page.locator('.pack-cinema').getAttribute('data-phase'),'charge');await page.screenshot({path:'.ui-tools/pack-embers-charge.png'});
  await page.waitForTimeout(3200);assert.equal(await page.locator('.pack-cinema').getAttribute('data-phase'),'reveal');await page.locator('.cinema-action').click();assert.equal(await page.locator('.pack-cinema').count(),0);
  await page.setViewportSize({width:390,height:844});await page.locator('#rubyShopDialog').getByRole('button',{name:'Preview animation'}).nth(1).click();await page.waitForTimeout(1500);await page.screenshot({path:'.ui-tools/pack-aurora-mobile-charge.png'});
  await page.locator('.cinema-action').click();assert.equal(await page.locator('.pack-cinema').getAttribute('data-phase'),'reveal');await page.waitForTimeout(1200);await page.screenshot({path:'.ui-tools/pack-aurora-mobile-reveal.png'});
  assert.equal(await page.locator('.pack-cinema').evaluate(n=>n.scrollWidth>n.clientWidth||n.scrollHeight>n.clientHeight),false);await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  await page.evaluate(image=>{document.body.dataset.rubyOpening='embers';showPackOpeningAnimation({imageUrl:'/images/'+encodeURIComponent(image),cardId:'Test discovery',packBonus:12,rubyBonus:1});},images[0]);await page.keyboard.press('Escape');
  assert.equal(await page.locator('.cinema-card-name').textContent(),'Test discovery');assert.ok((await page.locator('.cinema-bonus').textContent()).includes('12 Footy'));await page.waitForTimeout(1200);assert.ok(await page.locator('.cinema-reward img').evaluate(n=>n.complete&&n.naturalWidth>0));await page.screenshot({path:'.ui-tools/pack-real-card-mobile.png'});await page.keyboard.press('Escape');
  await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>playSpecialPackOpening({preview:true},'aurora'));assert.equal(await page.locator('.pack-cinema').getAttribute('data-phase'),'reveal');await page.locator('.cinema-action').click();
  await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>{playSpecialPackOpening({preview:true},'embers');playSpecialPackOpening({preview:true},'aurora');});assert.equal(await page.locator('.pack-cinema[open]').count(),1);await page.keyboard.press('Escape');await page.keyboard.press('Escape');await page.waitForTimeout(4300);assert.equal(await page.locator('.pack-cinema').count(),0);
  await page.evaluate(image=>{document.body.dataset.rubyOpening='';showPackOpeningAnimation({imageUrl:'/images/'+encodeURIComponent(image),cardId:'Normal card'});},images[0]);await page.waitForTimeout(800);assert.equal(await page.locator('#openedCardImage').isVisible(),true);await page.evaluate(()=>dismissPackOpening());
  assert.deepEqual(errors,[]);console.log('Pack cinema passed: shop previews, both themes, automatic reveal, skip/Escape, real card and bonuses, mobile layout, reduced motion, cleanup and standard opening.');await browser.close();await new Promise(r=>server.close(r));return;
 }
 if(process.env.PET_JOURNEY_CHECK_ONLY==='1'){
  assert.equal(await page.locator('.companion-stage:not([hidden])').count(),3);
  await page.locator('.ruby-pet').first().click();await page.getByRole('button',{name:'Play fetch',exact:true}).click();assert.equal(await page.locator('.pet-play-art').getAttribute('data-mood'),'fetch');
  await page.getByRole('button',{name:'Dance',exact:true}).click();assert.equal(await page.locator('.pet-play-art').getAttribute('data-mood'),'dance');await page.locator('#petInteraction').getByRole('button',{name:'Close',exact:true}).click();
  await page.locator('[data-companion-mode="roam"]').evaluateAll(nodes=>nodes.forEach(n=>n.click()));await page.evaluate(()=>{footyStudio.navigate('marketplace');scrollTo(0,0);});await page.waitForTimeout(1700);
  const peeks=await page.locator('.companion-world-peek:not([hidden])').evaluateAll(nodes=>nodes.map(n=>({object:n.dataset.object,rect:n.getBoundingClientRect().toJSON()})));
  assert.ok(peeks.length>=2,'multiple pets can roam together');assert.equal(new Set(peeks.map(p=>p.object)).size,peeks.length);
  for(let i=0;i<peeks.length;i++)for(let k=i+1;k<peeks.length;k++){const a=peeks[i].rect,b=peeks[k].rect;assert.ok(a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom,'roaming pets do not overlap');}
  await page.screenshot({path:'.ui-tools/multiple-pets-roaming.png'});
  await page.evaluate(()=>footyStudio.navigate('home'));await page.locator('[data-companion-mode="home"]').evaluateAll(nodes=>nodes.forEach(n=>n.click()));
  await page.locator('#petJourneys>summary').click();await page.locator('#petJourneys select').first().waitFor();assert.equal(await page.locator('#petJourneys select').count(),3);
  await page.locator('#petJourneys select').first().selectOption('food:feast');await page.locator('#petJourneys .ruby-tile details').first().locator('summary').click();
  assert.ok((await page.locator('#petJourneys .ruby-tile').first().textContent()).includes('Genious Crystal'));assert.ok((await page.locator('#petJourneys .ruby-tile').first().textContent()).includes('99%'));
  await page.setViewportSize({width:375,height:844});await page.locator('#petJourneys').scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'.ui-tools/pet-journeys-mobile.png'});
  await page.locator('#petJourneys .ruby-tile').first().getByRole('button',{name:'Send on a 4-hour journey'}).click();await page.locator('[data-claim-end]').waitFor();
  assert.equal(await page.locator('[data-claim-end]').isDisabled(),true);assert.equal(petPreview.rubyItems['food:feast'],0);assert.equal(await page.locator('.companion-stage:not([hidden])').count(),2);
  await page.locator('#petJourneys select').first().selectOption('food:trail');await page.locator('#petJourneys').getByRole('button',{name:'Send on a 4-hour journey'}).first().click();await page.waitForTimeout(500);assert.equal(await page.locator('[data-claim-end]').count(),2);
  petPreview.petJourneys['pet:fox'].endsAt=Date.now()-1;
  await page.locator('#rubyShopButton').click();await page.waitForTimeout(300);await page.keyboard.press('Escape');await page.locator('[data-claim-end]').first().click();await page.waitForTimeout(500);
  assert.equal(petPreview.gems['tier-pet9'],5);assert.equal(await page.locator('[data-claim-end]').count(),1);assert.ok((await page.locator('#petJourneys>[role="status"]').textContent()).includes('5 Genious Crystal'));
  assert.equal(await page.locator('#petJourneys').getByRole('button',{name:'Send on a 4-hour journey'}).first().isEnabled(),true);
  await page.locator('#rubyShopButton').click();await page.waitForTimeout(200);await page.locator('#rubyShopDialog .ruby-tile').filter({has:page.getByRole('heading',{name:'Starlight Feast',exact:true})}).getByRole('button',{name:'Journey loot odds'}).click();
  const oddsDialog=page.locator('dialog.pet-journeys');assert.equal(await oddsDialog.isVisible(),true);assert.ok((await oddsDialog.textContent()).includes('Genious Crystal'));await oddsDialog.getByLabel('Pet for loot odds').selectOption('pet:dragon');assert.ok((await oddsDialog.textContent()).includes('Treasure Hunter'));assert.ok((await oddsDialog.textContent()).includes('98%'));await oddsDialog.getByRole('button',{name:'Close',exact:true}).click();await page.keyboard.press('Escape');
  await page.locator('#uiVersionToggle').click();await page.locator('#rubyShopButton').click();await page.waitForTimeout(200);await page.locator('#rubyShopDialog').getByRole('button',{name:'Companion journeys',exact:true}).click();assert.equal(await page.locator('dialog[open] #petJourneys').isVisible(),true);await page.locator('dialog[open]').getByRole('button',{name:'Close',exact:true}).click();
  assert.deepEqual(errors,[]);console.log('Pet journeys UI passed: multiple companions, collision-free roaming, interactions, food odds, mobile layout, simultaneous departures, countdown and claim.');await browser.close();await new Promise(r=>server.close(r));return;
 }
 if(process.env.AMULET_CHECK_ONLY==='1'){
  await page.evaluate(()=>footyStudio.navigate('amulets'));await page.waitForTimeout(500);
  await page.locator('#amuletTier').selectOption('silver');assert.equal(await page.locator('#amuletShop .amulet-tile').count(),5);
  await page.locator('[data-amulet-view="all"]').click();assert.equal(await page.locator('#amuletTierPicker').isVisible(),false);
  assert.equal(await page.locator('#amuletShop .amulet-tier-heading').count(),3);assert.equal(await page.locator('#amuletShop .amulet-tile').count(),14);
  assert.equal(await page.locator('#amuletShop .amulet-tile').nth(5).locator('button').isDisabled(),true);
  await page.evaluate(()=>loadAmulets());assert.equal(await page.locator('[data-amulet-view="all"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-amulet-view="tier"]').click();assert.equal(await page.locator('#amuletTier').inputValue(),'silver');assert.equal(await page.locator('#amuletShop .amulet-tile').count(),5);
  await page.locator('[data-amulet-view="all"]').click();await page.setViewportSize({width:375,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('#amuletShop').screenshot({path:'.ui-tools/amulets-all-mobile.png',animations:'disabled'});
  assert.deepEqual(errors,[]);console.log('Amulet views passed: tier/all toggle, retained selection, reload, gem affordability, mobile layout.');await browser.close();await new Promise(r=>server.close(r));return;
 }
 await page.locator('#rubyShopButton').click();await page.waitForTimeout(200);assert.equal(await page.locator('#rubyShopDialog').isVisible(),true);assert.ok(await page.locator('.ruby-tile').count()>15);await page.screenshot({path:'.ui-tools/ruby-shop.png',fullPage:true});await page.keyboard.press('Escape');
 assert.equal(await page.locator('#dailyPackFeature h3').textContent(),'Gold discovery pack');
 const companion=page.locator('.companion-stage');assert.equal(await companion.isVisible(),true);
 await page.locator('[data-companion-mode="roam"]').click();await page.waitForTimeout(1400);
 assert.equal(await companion.getAttribute('data-explore'),'roam');
 assert.equal(await page.locator('.ruby-pet').isVisible(),false);
 await page.evaluate(()=>footyStudio.navigate('marketplace'));await page.waitForTimeout(1200);
 assert.equal(await page.locator('.companion-world-peek').isVisible(),true);
 assert.ok((await page.locator('.companion-world-peek').getAttribute('data-spot')).startsWith('market'));
 assert.equal(await page.locator('.companion-remote').count(),0);
 const anchored=await page.locator('.companion-world-peek').evaluate(node=>({top:node.getBoundingClientRect().top,spot:node.dataset.spot,scroll:scrollY}));
 await page.evaluate(()=>scrollBy(0,400));await page.waitForTimeout(150);
 const scrolled=await page.locator('.companion-world-peek').evaluate(node=>({top:node.getBoundingClientRect().top,spot:node.dataset.spot,scroll:scrollY,hidden:node.hidden}));
 assert.equal(scrolled.hidden,false);assert.equal(scrolled.spot,anchored.spot);
 assert.ok(Math.abs((scrolled.top-anchored.top)+(scrolled.scroll-anchored.scroll))<2,'pet follows its object without disappearing');
 await page.evaluate(y=>scrollTo(0,y),anchored.scroll);await page.waitForTimeout(100);

 await page.waitForTimeout(900);await page.screenshot({path:'.ui-tools/companion-roaming.png'});
 await page.locator('.companion-world-peek.is-leaving').waitFor({state:'attached',timeout:10000});
 assert.equal(await page.locator('.companion-world-peek').evaluate(node=>node.hidden),false);
 await page.waitForTimeout(800);assert.equal(await page.locator('.companion-world-peek').evaluate(node=>node.hidden),true);
 await page.evaluate(()=>footyStudio.navigate('home'));await page.locator('[data-companion-mode="home"]').click();assert.equal(await companion.getAttribute('data-explore'),'home');
 await page.waitForTimeout(800);assert.equal(await page.locator('.companion-world-peek').isVisible(),false);
 await page.evaluate(()=>footyStudio.navigate('home'));
 await page.locator('[data-companion-mode="hide"]').click();await page.waitForTimeout(1200);
 let found=false;
 for(const route of ['home','marketplace','inventory','amulets','workshop','spin','vip','wallet','sell','battle']){
  await page.evaluate(route=>footyStudio.navigate(route),route);await page.waitForTimeout(1100);
  for(let y=0;y<await page.evaluate(()=>document.documentElement.scrollHeight);y+=450){await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(100);if(await page.locator('.companion-world-peek').isVisible())break;}
  if(await page.locator('.companion-world-peek').isVisible()){
   await page.locator('.companion-world-peek button').evaluate(button=>button.click());found=true;break;
  }
 }
 assert.equal(found,true,'a hiding pet is discoverable around the registered page objects');
 assert.equal(await companion.getAttribute('data-explore'),'home');
 await page.evaluate(()=>footyStudio.navigate('home'));

 assert.ok((await page.locator('.ruby-pet').boundingBox()).width>=300);
 assert.ok((await page.locator('.ruby-pet svg').boundingBox()).width>=300);
 await page.locator('.ruby-pet').click();assert.equal(await companion.getAttribute('data-mood'),'hello');await page.locator('#petInteraction').getByRole('button',{name:'Close',exact:true}).click();
 await page.locator('.companion-perches [data-perch="crystal"]').click();assert.equal(await companion.getAttribute('data-perch'),'crystal');
 for(const kind of ['fox','snail','dragon']){await page.evaluate(kind=>{document.querySelector('.ruby-pet').innerHTML=companionArt('pet:'+kind);},kind);await companion.screenshot({path:'.ui-tools/companion-'+kind+'.png'});}
 await page.evaluate(()=>{document.querySelector('.ruby-pet').innerHTML=companionArt('pet:fox');});
 await page.setViewportSize({width:375,height:844});await companion.evaluate(node=>node.scrollIntoView({block:'center'}));await companion.screenshot({path:'.ui-tools/companion-mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.setViewportSize({width:1440,height:1050});await page.evaluate(()=>scrollTo(0,0));

 assert.equal(await page.locator('[data-todays-pack] .daily-pack-badge').textContent(),"TODAY'S DAILY PACK");
 if(process.env.COMPANION_CHECK_ONLY==='1'){
  await page.setViewportSize({width:375,height:844});
  await page.locator('[data-companion-mode="roam"]').click();
  await page.evaluate(()=>{footyStudio.navigate('inventory');scrollTo(0,0);});await page.waitForTimeout(1900);
  assert.equal(await page.locator('.companion-world-peek').isVisible(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'.ui-tools/companion-roaming-mobile.png',animations:'disabled'});
  await page.evaluate(()=>footyStudio.navigate('home'));await page.locator('[data-companion-mode="home"]').click();await page.waitForTimeout(1400);
  assert.equal(await page.locator('.companion-world-peek').isVisible(),false);
  assert.equal(await companion.getAttribute('data-explore'),'home');
  await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>footyStudio.navigate('home'));
  await page.locator('[data-companion-mode="hide"]').click();
  assert.equal(await page.locator('.ruby-pet').evaluate(node=>getComputedStyle(node).transitionDuration),'0s');
  await page.evaluate(()=>footyStudio.navigate('home'));await page.locator('[data-companion-mode="home"]').click();
  assert.deepEqual(errors,[]);console.log('Companion checks passed: dive, cross-tab roaming, hide-and-seek, recall, mobile layout, and reduced motion.');
  await browser.close();await new Promise(r=>server.close(r));return;
 }
 await page.screenshot({path:'.ui-tools/home-desktop.png',fullPage:true});
 const routes=['marketplace','inventory','workshop','amulets','battle','wallet','spin','vip','sell','admin','battle-manager'];const report=[];
 for(const r of routes){await page.evaluate(r=>footyStudio.navigate(r),r);await page.waitForTimeout(300);report.push({route:r,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),panels:await page.locator('.main-grid > section:visible').count()});if(['marketplace','battle','admin','workshop','amulets','inventory','spin','vip'].includes(r))await page.screenshot({path:'.ui-tools/'+r+'-desktop.png',fullPage:true});}
 await page.evaluate(()=>footyStudio.navigate('workshop'));await page.locator('#uiVersionToggle').click();
 const restored=await page.evaluate(()=>document.querySelector('#gemConverter').parentElement.id==='inventorySection'&&!document.body.classList.contains('studio-ui'));
 await page.locator('#uiVersionToggle').click();await page.evaluate(()=>footyStudio.navigate('home'));
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await page.screenshot({path:'.ui-tools/home-mobile.png',fullPage:true});
 for(const r of ['marketplace','inventory','battle','admin','workshop','amulets','wallet','spin','vip','battle-manager']){await page.evaluate(r=>footyStudio.navigate(r),r);await page.waitForTimeout(200);report.push({mobile:r,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});if(['battle','marketplace'].includes(r))await page.screenshot({path:'.ui-tools/'+r+'-mobile.png',fullPage:true});}
 await page.evaluate(()=>footyStudio.navigate('amulets'));await page.waitForTimeout(250);await page.locator('#amuletTier').selectOption('trophy-road');
 assert.equal(await page.locator('#amuletShop .amulet-exclusive').count(),4);assert.equal(await page.locator('#amuletShop button').count(),0);
 await page.screenshot({path:'.ui-tools/trophy-amulets-mobile.png',fullPage:true});
 await page.evaluate(async()=>{footyStudio.navigate('battle');await loadTrophyPath();document.getElementById('trophyPath').closest('details').open=true;});
 assert.equal(await page.locator('#trophyPath article').count(),24);assert.equal(await page.locator('#trophyPath .marketplace-pack-icon').count(),6);
 assert.match(await page.locator('#trophyPath').innerText(),/Trailblazer Chime/);
 await page.screenshot({path:'.ui-tools/trophy-road-mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 // Exercise controls, not only route rendering.
 await page.setViewportSize({width:1440,height:1000});await page.waitForTimeout(250);
 await page.evaluate(()=>footyStudio.navigate('marketplace'));await page.waitForTimeout(150);
 assert.match(await page.locator('#items').innerText(),/VIP 25% off: 56.25 Footy - applied/);
 assert.match(await page.locator('#items').innerText(),/VIP 20% off: 100 Footy - with active VIP/);
 assert.match(await page.locator('#items').innerText(),/You pay 56.25 Footy/);
 await page.locator('#studioFilter-items').fill('nonexistent-card');assert.equal(await page.locator('#items > li:visible').count(),0);
 await page.locator('#studioFilter-items').fill('');assert.ok(await page.locator('#items > li:visible').count()>0);
 await page.keyboard.press('Control+k');await page.locator('#studioSearchInput').fill('gems');await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.body.dataset.studioPage),'workshop');
 assert.equal(await page.locator('#studioSearch').isVisible(),false);
 await page.evaluate(()=>footyStudio.navigate('battle'));await page.waitForTimeout(200);
 assert.equal(await page.locator('#battleDeckPanel').isVisible(),false);
 await page.locator('[data-ui-control="duel"]').click();assert.equal(await page.locator('#practiceBattle').isVisible(),false);assert.equal(await page.locator('#battleDeckPanel').isVisible(),true);
 await page.locator('[data-ui-control="bob"]').click();await page.locator('#practiceMode').selectOption('training');await page.locator('#practiceStart').click();
 assert.equal(await page.evaluate(()=>{const game=practiceGame;footyStudio.setMode(false);footyStudio.setMode(true);return game===practiceGame;}),true);
 await page.evaluate(()=>{if(practiceWorker)practiceWorker.terminate();practiceGeneration++;practiceGame.turn='player';practiceGame.player=[{...PracticeEngine.trainingCards()[0],name:'Mirror tester',linkedCardImage:'Mirror_test.png',mirrorPower:'focus'}];practiceGame.computer=[];practiceGame.board=Array(16).fill(null);practiceGame.selected=0;renderPracticeBattle();});
 await page.locator('#practiceBoard > button').first().click();assert.equal(await page.locator('.battle-power-dialog').isVisible(),true);
 await page.locator('.battle-power-dialog select').selectOption('1');await page.locator('.battle-power-dialog button').first().click();
 await page.waitForFunction(()=>practiceGame.board[0]!==null);assert.equal(await page.evaluate(()=>practiceGame.board[0].right),3);assert.equal(await page.evaluate(()=>practiceGame.board[0].top),0);
 assert.equal(await page.locator('#practiceBoard .battle-special-badge').count(),1);
 await page.waitForTimeout(500);await page.screenshot({path:'.ui-tools/mirror-battle.png',fullPage:true});
 await page.evaluate(()=>toggleDyeMode());await page.locator('#studioNav [data-ui-nav="inventory"]').click();assert.equal(await page.evaluate(()=>document.body.dataset.studioPage),'inventory');await page.evaluate(()=>cancelDyeMode());
 await page.locator('#uiVersionToggle').click();await page.reload();await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>footyStudio.enabled),false);
 await page.locator('#uiVersionToggle').click();await page.reload();await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>footyStudio.enabled),true);
 await page.evaluate(()=>{currentUserIsAdmin=false;dispatchEvent(new Event('footy-role-changed'));footyStudio.navigate('admin');});assert.equal(await page.evaluate(()=>document.body.dataset.studioPage),'home');assert.equal(await page.locator('[data-admin-nav]').isVisible(),false);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await page.locator('.studio-menu-button').click();assert.equal(await page.evaluate(()=>document.querySelector('#studioSidebar').inert),false);await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.querySelector('#studioSidebar').inert),true);
 for(const width of [320,375,768]){await page.setViewportSize({width,height:844});await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`home overflow at ${width}`);}
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>footyStudio.navigate('inventory'));await page.waitForTimeout(300);
 const thumbs=page.locator('#inventoryItems img.item-image');
 const boxes=await Promise.all([0,1,2].map(i=>thumbs.nth(i).boundingBox()));assert.equal(Math.round(boxes[0].y),Math.round(boxes[2].y));assert.ok(boxes[2].x>boxes[1].x);
 await thumbs.first().click();assert.equal(await page.locator('.studio-card-preview').isVisible(),true);await page.keyboard.press('Escape');assert.equal(await page.locator('.studio-card-preview').isVisible(),false);
 await page.screenshot({path:'.ui-tools/inventory-three-columns.png',fullPage:true});
 assert.ok(restored);assert.deepEqual(errors,[]);assert.ok(report.every(r=>!r.overflow),JSON.stringify(report));
 await page.goto('http://127.0.0.1:4173/login.html');await page.waitForTimeout(200);await page.screenshot({path:'.ui-tools/login-mobile.png',fullPage:true});assert.equal(await page.locator('.auth-container').isVisible(),true);
 console.log(JSON.stringify({restored,errors,report,checks:'Search, route isolation, battle preservation, dye navigation, saved preference, admin visibility, mobile drawer and 320-1440px sizing passed.'},null,2));await browser.close();await new Promise(r=>server.close(r));
})().catch(e=>{console.error(e);process.exit(1)});
