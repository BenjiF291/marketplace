/* Presentation-only ordered consumer; never submits gameplay actions. */
(function(root){
 class BrawlEventQueue{
  constructor(){this.epoch=0;this.seen=new Set();this.tail=Promise.resolve();}
  cancel(){this.epoch++;this.seen.clear();}
  run(events,consume,{timeout=2500,onError=()=>{},reconcile=()=>{}}={}){const epoch=this.epoch;
   const job=async()=>{try{for(const event of events){if(epoch!==this.epoch)break;const key=event.seq;if(this.seen.has(key))continue;this.seen.add(key);let timer;try{await Promise.race([consume(event,()=>epoch!==this.epoch),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Presentation event timed out')),timeout);})]);}catch(error){onError(error);break;}finally{clearTimeout(timer);}}}finally{if(epoch===this.epoch)reconcile();}};
   const next=this.tail.then(job,job);this.tail=next.catch(()=>{});return next;
  }
 }
 if(typeof module!=='undefined')module.exports=BrawlEventQueue;else root.BrawlEventQueue=BrawlEventQueue;
})(typeof window==='undefined'?globalThis:window);
