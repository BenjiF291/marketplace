const path=require('node:path');
function key(item){if(item.itemType==='pack'&&item.packId)return `pack:${item.packId}`;if(item.imageUrl)return `card:${path.basename(item.imageUrl)}`;return `item:${item.name}`;}
function purchases(items,viewer){return new Set(items.filter(i=>i.buyerId===viewer&&i.purchasedViaMarketplace===true).map(i=>i.purchaseLimitKey||key(i)));}
function visible(item,viewer,groups,owned){
 if(!viewer||item.sellerId===viewer)return true;
 if(item.listingGroupId){const group=groups.get(item.listingGroupId);if(!group)return false;const limit=Number(group.perUserLimit)||0,count=Number(group.purchaseCounts?.[viewer])||0;if(limit>0&&count>=limit)return false;}
 if(item.limitOnePerUser&&owned.has(item.purchaseLimitKey||key(item)))return false;
 return true;
}
module.exports={key,purchases,visible};
