export function sameDay(aISO,bISO){
  const a=new Date(aISO), b=new Date(bISO);
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
export const currency = n => Number((n||0).toFixed(2));

export function buildSalaryRows({ dayISO, cfg, transactions, members, onlyOwner=null }){
  const dayTx = transactions.filter(t => sameDay(t.dateISO, dayISO) && (!onlyOwner || t.owner===onlyOwner));
  const byMember = new Map();
  for(const t of dayTx){
    const k = String(t.memberId || (t.owner+'|'+t.member));
    if(!byMember.has(k)){
      const mm = members.find(m => String(m._id)===String(t.memberId)) || {};
      byMember.set(k,{
        owner:t.owner, member:t.member, group:t.group||'', date:t.dateISO,
        opening:mm.opening||0,
        memberBonusOverride:(typeof mm.bonusRateOverride==='number')?mm.bonusRateOverride:null,
        topUp:0, fiat:0, payout:0, txCharge:0, percBonusAcc:0, fixedBonusAcc:0
      });
    }
    const r = byMember.get(k);
    if (t.type==='USDT Top Up') r.topUp += t.amount;
    else if (t.type==='Fiat Convert') r.fiat += t.amount;
    else if (t.type==='Payout'){
      r.payout += t.amount;
      const br=(typeof t.bonusRate==='number')?t.bonusRate : (r.memberBonusOverride!==null?r.memberBonusOverride:cfg.bonusRate);
      r.percBonusAcc += t.amount*br;
      r.fixedBonusAcc += cfg.fixedPerTask;
    }
    if (typeof t.fee==='number') r.txCharge += t.fee||0;
  }

  const rows=[];
  for(const [,r] of byMember){
    const percBonus=currency(r.percBonusAcc);
    const fixedBonus=currency(r.fixedBonusAcc);
    const gross=currency(percBonus+fixedBonus);
    const remaining=currency((r.opening||0)+r.fiat+r.topUp - r.payout - r.txCharge - gross);
    rows.push({
      date:r.date, receptionist:r.owner, group:r.group, member:r.member,
      topUp:currency(r.topUp), fiat:currency(r.fiat), payout:currency(r.payout),
      percBonus, fixedBonus, txCharge:currency(r.txCharge), gross, remaining
    });
  }
  rows.sort((a,b)=> (a.receptionist.localeCompare(b.receptionist)||a.member.localeCompare(b.member)));
  return rows;
}
