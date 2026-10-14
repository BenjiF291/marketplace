/* Non-destructive display masks for existing collectible card PNGs. */
(() => {
 const files=window.CardMaskFiles||{},managed=new WeakMap();
 function attach(image){
  let url,name,hash;
  try{
   url=new URL(image.getAttribute('src')||'',document.baseURI);
   const allowed=new Set([location.origin]);
   if(typeof API_URL!=='undefined')allowed.add(new URL(API_URL,document.baseURI).origin);
   if(allowed.has(url.origin)&&/\/images\/[^/]+$/.test(url.pathname)){
    name=decodeURIComponent(url.pathname.split('/').pop());hash=Object.hasOwn(files,name)?files[name]:null;
   }
  }catch{}
  if(!hash){
   const previous=managed.get(image);if(!previous)return;
   for(const [property,value] of previous)image.style.setProperty(property,value);
   image.classList.remove('card-image-cutout');managed.delete(image);return;
  }
  if(!managed.has(image))managed.set(image,['mask-image','-webkit-mask-image'].map(property=>[property,image.style.getPropertyValue(property)]));
  const mask=new URL('assets/card-masks/'+encodeURIComponent(name)+'.svg?v='+hash.maskHash.slice(0,12),document.baseURI);
  const value='url("'+mask.href+'")';
  image.style.setProperty('mask-image',value);image.style.setProperty('-webkit-mask-image',value);
  image.classList.add('card-image-cutout');
 }
 function scan(node){if(node.nodeType!==1)return;if(node.matches('img'))attach(node);node.querySelectorAll('img').forEach(attach);}
 const observer=new MutationObserver(records=>{
  for(const record of records){if(record.type==='attributes')attach(record.target);else record.addedNodes.forEach(scan);}
 });
 document.querySelectorAll('img').forEach(attach);
 observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
 window.addEventListener('pagehide',event=>{if(!event.persisted)observer.disconnect();});
 window.CardCutouts={attach};
})();
