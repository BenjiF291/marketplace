const KINDS=new Set(['fox','dragon','snail','rill','brugar','krynn','fenra','veyrin','tharos','talren','northern-talren','defender-talren','rill-species','brugar-species']);
const RARITIES=new Set(['','common','rare','epic','legendary','unique']);
function validateEntry(body,kind){
 if(!KINDS.has(kind))throw Error('Unknown creature');
 const result={};
 for(const [field,max] of [['description',2000],['origin',200],['individualDescription',2000]]){
  if(typeof body[field]!=='string'||body[field].length>max)throw Error(`Invalid ${field} (maximum ${max} characters)`);
  result[field]=body[field].trim();
 }
 if(!RARITIES.has(body.rarity))throw Error('Choose a valid rarity');
 result.rarity=body.rarity;
 if(!['rill','brugar','krynn','fenra','veyrin','tharos'].includes(kind))result.individualDescription='';
 return result;
}
module.exports=(app,db,authenticate)=>{
 app.get('/creature-book',async(req,res)=>{try{
  const snapshot=await db.collection('creatureBookEntries').get();
  const entries={};for(const doc of snapshot.docs)if(KINDS.has(doc.id)){const data=doc.data();entries[doc.id]={description:data.description||'',origin:data.origin||'',individualDescription:data.individualDescription||'',rarity:RARITIES.has(data.rarity)?data.rarity:''};}
  if(entries.veyrin)entries.tharos={...(entries.tharos||{}),description:entries.veyrin.description,origin:entries.veyrin.origin};
  if(entries.rill)entries['rill-species']={...(entries['rill-species']||{}),description:entries.rill.description,origin:entries.rill.origin};
  if(entries.brugar)entries['brugar-species']={...(entries['brugar-species']||{}),description:entries.brugar.description,origin:entries.brugar.origin};
  let canEdit=false;const owned=Object.fromEntries([...KINDS].map(kind=>[kind,false]));
  if(req.header('Authorization')){try{const id=await authenticate(req),user=await db.collection('users').doc(id).get();if(user.exists){const data=user.data();canEdit=data.isAdmin===true;for(const kind of ['fox','snail','dragon'])owned[kind]=Number(data.rubyItems?.['pet:'+kind]||0)>0;}}catch{}}
  res.set('Cache-Control','no-store');res.json({entries,canEdit,owned});
 }catch(e){res.status(500).send('Could not load creature information');}});
 app.put('/admin/creature-book/:kind',async(req,res)=>{
  let id;try{id=await authenticate(req);}catch{return res.status(401).send('Please log in again to edit the creature book');}
  try{
   const user=await db.collection('users').doc(id).get();if(!user.exists||user.data().isAdmin!==true)return res.status(403).send('Only admins can edit the creature book');
   let entry;try{entry=validateEntry(req.body||{},req.params.kind);}catch(e){return res.status(400).send(e.message);}
   const audit={updatedBy:id,updatedAt:new Date().toISOString()};
   if(req.params.kind==='tharos'){const batch=db.batch();batch.set(db.collection('creatureBookEntries').doc('veyrin'),{description:entry.description,origin:entry.origin,...audit},{merge:true});batch.set(db.collection('creatureBookEntries').doc('tharos'),{individualDescription:entry.individualDescription,rarity:entry.rarity,...audit});await batch.commit();}
   else if(req.params.kind==='rill-species'){const batch=db.batch();batch.set(db.collection('creatureBookEntries').doc('rill'),{description:entry.description,origin:entry.origin,...audit},{merge:true});batch.set(db.collection('creatureBookEntries').doc('rill-species'),{individualDescription:'',rarity:entry.rarity,...audit});await batch.commit();}
   else if(req.params.kind==='brugar-species'){const batch=db.batch();batch.set(db.collection('creatureBookEntries').doc('brugar'),{description:entry.description,origin:entry.origin,...audit},{merge:true});batch.set(db.collection('creatureBookEntries').doc('brugar-species'),{individualDescription:'',rarity:entry.rarity,...audit});await batch.commit();}
   else await db.collection('creatureBookEntries').doc(req.params.kind).set({...entry,...audit});
   res.json(entry);
  }catch(e){res.status(500).send('Could not save creature information');}
 });
};
module.exports.validateEntry=validateEntry;
