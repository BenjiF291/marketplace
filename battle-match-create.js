module.exports=(a,b,averageLimit,prize,timeControlSeconds,now=new Date())=>({
 status:'setup',averageLimit,prize,prizePaid:false,timeControlSeconds,
 clocks:{[a.id]:timeControlSeconds*1000,[b.id]:timeControlSeconds*1000},participantIds:[a.id,b.id],
 participants:{[a.id]:{username:a.name},[b.id]:{username:b.name}},decks:{[a.id]:[],[b.id]:[]},colors:{[a.id]:null,[b.id]:null},ready:{[a.id]:false,[b.id]:false},
 starterId:null,starterCard:null,turnPlayerId:null,board:Array(16).fill(null),createdAt:now,updatedAt:now
});
