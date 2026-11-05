const animals=require('./public/stable-animals').animals;
function creature(option,catalog){const id=option.kind==='animal'?option.id:option.kind==='rubyItem'&&option.id.startsWith('pet:')?option.id.slice(4):null;if(!id)return null;const entry=catalog[option.kind]?.find(e=>e.id===option.id);return (entry?.rarity||option.rarity)==='unique'?id:null;}
function owned(user,id){const animal=animals.find(a=>a.id===id);return animal?.companion?Number(user.rubyItems?.['pet:'+id])>0:Number(user.stableAnimals?.[id])>0;}
function cards(source,catalog,user,awarded=new Set()){
 return source.flatMap(card=>{let removed=0;const options=card.options.filter(option=>{const id=creature(option,catalog);if(id&&(owned(user,id)||awarded.has(id))){removed+=option.chance;return false;}return true;}).map(option=>creature(option,catalog)?{...option,min:1,max:1}:{...option});const active=options.filter(o=>o.chance>0);if(!active.length)return [];for(const option of active)option.chance+=removed/active.length;return [{...card,options}];});
}
module.exports={creature,owned,cards};
