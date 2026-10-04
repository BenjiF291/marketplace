// Gem currencies are indivisible. Preserve legacy fractions by rounding balances up once.
function whole(value){const n=Number(value)||0;return Number.isFinite(n)?Math.min(Number.MAX_SAFE_INTEGER,Math.max(0,Math.ceil(n))):0;}
function wallet(gems){return Object.fromEntries(Object.entries(gems||{}).map(([key,n])=>[key,whole(n)]));}
function price(value,currency){const n=Number(value);if(!Number.isFinite(n)||n<=0)throw Error('Invalid price');return String(currency).toLowerCase()==='footy'?Math.round(n*100)/100:Math.max(1,Math.round(n));}
function user(u){return {...u,gems:wallet(u.gems)};}
async function repair(db,ref,u){const gems=wallet(u.gems);if(JSON.stringify(gems)===JSON.stringify(u.gems||{}))return u;return db.runTransaction(async tx=>{const doc=await tx.get(ref);if(!doc.exists)throw Error('Account not found.');const current=doc.data(),next=wallet(current.gems);if(JSON.stringify(next)!==JSON.stringify(current.gems||{}))tx.update(ref,{gems:next});return {...current,gems:next};});}
module.exports={whole,wallet,price,user,repair};
