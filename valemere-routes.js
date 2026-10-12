const rules=require('./valemere');
module.exports=(app,db,authenticate)=>{
 const route=(method,path,handler)=>app[method](path,async(req,res)=>{let id;try{id=await authenticate(req);}catch{return res.status(401).send('Please log in again.');}try{res.json(await handler(id,req.body||{}));}catch(e){res.status(400).send(e.message);}});
 const run=(id,body)=>db.runTransaction(async tx=>{const ref=db.collection('users').doc(id),doc=await tx.get(ref);if(!doc.exists)throw Error('Account not found.');const u=doc.data();const state=u.valemere===undefined?rules.initial():u.valemere;if(!state||state.version!==1)throw Error('This Valemere save needs an update. It has not been replaced.');
 const dev=process.env.NODE_ENV==='development'&&process.env.VALEMERE_DEV_TOOLS==='1'&&u.isAdmin===true;
 if(!body){if(u.valemere===undefined)tx.update(ref,{valemere:state});return {state,dev,serverNow:Date.now()};}
 const result=rules.apply(state,body,Date.now(),dev);if(!result.duplicate)tx.update(ref,{valemere:result.state,...(result.xp?require('./town-hall-progress').grant(u,result.xp,'Valemere milestone'): {})});return {state:result.state,dev,xp:result.xp,serverNow:Date.now()};});
 route('get','/valemere',id=>run(id));route('post','/valemere/action',(id,body)=>run(id,body));
};
