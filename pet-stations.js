// Read legacy single-pet saves without changing them on page loads.
function stations(u){return u.petStations ? Object.values(u.petStations) : u.petStation ? [u.petStation] : [];}
function has(u,pet){return stations(u).some(s=>s.pet===pet);}
module.exports={stations,has};
