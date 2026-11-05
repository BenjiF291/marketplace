// Legacy family balances stay with the base creature; never duplicate currency.
function wallet(profile={}){const tokens={...profile.tokens};if(Object.hasOwn(tokens,'veyrin')){tokens.kael=(Number(tokens.kael)||0)+(Number(tokens.veyrin)||0);delete tokens.veyrin;}return tokens;}
module.exports={wallet};
