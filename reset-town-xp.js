// Explicit, idempotent account migration. Preview by default; --apply writes XP fields only.
const {db}=require('./firebase-server');
const {resetToLevelStart}=require('./town-hall-progress');
(async()=>{
 const apply=process.argv.includes('--apply');let scanned=0,changed=0,cursor;
 while(true){
  let query=db.collection('users').orderBy('__name__').limit(200);if(cursor)query=query.startAfter(cursor);
  const page=await query.get();if(page.empty)break;
  for(const doc of page.docs){scanned++;if(!Object.keys(resetToLevelStart(doc.data())).length)continue;
   if(apply){const did=await db.runTransaction(async tx=>{const fresh=await tx.get(doc.ref);if(!fresh.exists)return false;const update=resetToLevelStart(fresh.data());if(!Object.keys(update).length)return false;tx.update(doc.ref,update);return true;});if(did)changed++;}else changed++;
  }
  cursor=page.docs.at(-1);
 }
 console.log(JSON.stringify({mode:apply?'applied':'preview',scanned,changed}));
 await db.terminate();
})().catch(error=>{console.error(error.message);process.exitCode=1;});
