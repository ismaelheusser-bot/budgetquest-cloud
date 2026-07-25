(()=>{
const KEY='bq_income_plan_v1';
const RISK_KEY='bq_bonus_risk_factor';
const defaults={
 people:[
  {name:'Ismael Heusser',sources:[{name:'Oberholzer AG',monthly:8564,type:'Hauptlohn'}],annual:[{name:'Jährlicher Bonus',amount:0,month:6},{name:'13. Monatslohn',amount:0,month:12}]},
  {name:'Sarah Heusser',sources:[{name:'Ärztefon AG',monthly:1196,type:'Nebeneinkommen'},{name:'Kinderpraxis Uster',monthly:1024,type:'Nebeneinkommen'},{name:'Diakoniewerk Neumünster',monthly:811,type:'Nebeneinkommen'}],annual:[{name:'Jährlicher Bonus',amount:0,month:12},{name:'13. Monatslohn',amount:0,month:12}]}
 ]
};
let plan=JSON.parse(localStorage.getItem(KEY)||'null')||defaults;
let bonusRiskFactor=Math.min(100,Math.max(0,Number(localStorage.getItem(RISK_KEY)||70)));
const fmt=v=>'CHF '+Number(v||0).toLocaleString('de-CH',{maximumFractionDigits:2});
const esc2=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const isBonus=x=>/bonus|prämie|provision|erfolgsbeteiligung/i.test(String(x?.name||''));
function personTotals(p){
 const regular=p.sources.reduce((s,x)=>s+(+x.monthly||0),0);
 const annualRaw=p.annual.reduce((s,x)=>s+(+x.amount||0),0);
 const bonusRaw=p.annual.filter(isBonus).reduce((s,x)=>s+(+x.amount||0),0);
 const fixedAnnual=p.annual.filter(x=>!isBonus(x)).reduce((s,x)=>s+(+x.amount||0),0);
 const bonusSafe=bonusRaw*bonusRiskFactor/100;
 const annualSafe=fixedAnnual+bonusSafe;
 return{regular,annualSafe,annualRaw,bonusRaw,bonusSafe,fixedAnnual,monthlyEquivalent:regular+annualSafe/12,yearRaw:regular*12+annualRaw,yearSafe:regular*12+annualSafe};
}
function householdTotals(){
 const t=plan.people.map(personTotals);
 return{
  regular:t.reduce((s,x)=>s+x.regular,0),
  annualSafe:t.reduce((s,x)=>s+x.annualSafe,0),
  annualRaw:t.reduce((s,x)=>s+x.annualRaw,0),
  bonusRaw:t.reduce((s,x)=>s+x.bonusRaw,0),
  bonusSafe:t.reduce((s,x)=>s+x.bonusSafe,0),
  yearRaw:t.reduce((s,x)=>s+x.yearRaw,0),
  yearSafe:t.reduce((s,x)=>s+x.yearSafe,0),
  monthlyEquivalent:t.reduce((s,x)=>s+x.monthlyEquivalent,0)
 };
}
function syncBudgetIncome(){const total=householdTotals().monthlyEquivalent;if(typeof settings!=='undefined'){settings.income=Math.round(total*100)/100;localStorage.setItem('bq_settings',JSON.stringify(settings));const input=document.getElementById('incomeInput');if(input){input.value=settings.income;input.readOnly=true;input.title='Wird automatisch aus der Einkommensplanung berechnet.'}window.dispatchEvent(new Event('bq:income-updated'))}}
function save(){localStorage.setItem(KEY,JSON.stringify(plan));localStorage.setItem(RISK_KEY,String(bonusRiskFactor));syncBudgetIncome();renderIncomePlanner();if(typeof render==='function')render()}
function renderIncomePlanner(){const host=document.getElementById('incomePlanner');if(!host)return;const totals=plan.people.map(personTotals),all=householdTotals();
 host.innerHTML=`<div class="section-head"><div><h2>👤 Einkommensplanung</h2><div class="tiny">Das Budget-Einkommen wird daraus automatisch berechnet.</div></div></div>
 <div class="metric-grid"><div class="metric"><label>Regelmässig pro Monat</label><strong class="positive">${fmt(all.regular)}</strong></div><div class="metric"><label>Jahresbruttolohn gesamt</label><strong>${fmt(all.yearRaw)}</strong></div><div class="metric"><label>Risikobereinigter Jahreslohn</label><strong>${fmt(all.yearSafe)}</strong></div><div class="metric"><label>Budget-Einkommen pro Monat</label><strong class="positive">${fmt(all.monthlyEquivalent)}</strong></div></div>
 <div class="card section"><div class="section-head"><div><h3>Jahresübersicht Haushalt</h3><div class="tiny">Brutto vor Risikoabzug und konservativer Planungswert im Vergleich.</div></div></div><div class="budget-reality-grid"><div><span>Monatslöhne × 12</span><strong>${fmt(all.regular*12)}</strong></div><div><span>Bonus/variable Einkommen brutto</span><strong>${fmt(all.bonusRaw)}</strong></div><div><span>Bonus nach Risikoabzug</span><strong>${fmt(all.bonusSafe)}</strong></div><div><span>Jahresbruttolohn gesamt</span><strong>${fmt(all.yearRaw)}</strong></div></div></div>
 <div class="card section"><div class="section-head"><div><h3>Bonus-Sicherheitsfaktor</h3><div class="tiny">Nur Bonus, Prämien und Provisionen werden reduziert. Ein 13. Monatslohn wird zu 100 % berücksichtigt.</div></div><strong id="bonusRiskLabel">${bonusRiskFactor} %</strong></div><input id="bonusRiskFactor" type="range" min="0" max="100" step="5" value="${bonusRiskFactor}" style="width:100%"><div class="tiny">Beispiel: Bei 70 % werden von CHF 10’000 Bonus nur CHF 7’000 in der Jahresplanung berücksichtigt.</div></div>
 <div class="grid2 section">${plan.people.map((p,pi)=>{const t=totals[pi];return`<div class="card"><div class="section-head"><div><h3>${pi===0?'👨':'👩'} ${esc2(p.name)}</h3><div class="tiny">${fmt(t.regular)} regelmässig · ${fmt(t.monthlyEquivalent)} Ø pro Monat</div></div></div>
 <div class="budget-reality-grid person-year-grid"><div><span>Jahresbruttolohn</span><strong>${fmt(t.yearRaw)}</strong></div><div><span>Risikobereinigt</span><strong>${fmt(t.yearSafe)}</strong></div><div><span>Bonus brutto</span><strong>${fmt(t.bonusRaw)}</strong></div><div><span>Bonus berücksichtigt</span><strong>${fmt(t.bonusSafe)}</strong></div></div>
 <h4>Regelmässige Einkommen</h4>${p.sources.map((x,si)=>`<div class="category-review"><div><strong>${esc2(x.name)}</strong><div class="tiny">${esc2(x.type||'Einkommen')}</div></div><div><input style="max-width:130px" type="number" step="1" value="${+x.monthly||0}" onchange="updateIncomeSource(${pi},${si},this.value)"><button class="text-btn" onclick="removeIncomeSource(${pi},${si})">Löschen</button></div></div>`).join('')}
 <button class="btn secondary" onclick="addIncomeSource(${pi})">+ Einkommensquelle</button>
 <h4 class="section">Variable/Jährliche Einkommen</h4>${p.annual.map((x,ai)=>`<div class="category-review"><div><strong>${esc2(x.name)}</strong><div class="tiny">Auszahlung Monat ${x.month||12}${isBonus(x)?` · ${bonusRiskFactor} % berücksichtigt`:' · 100 % berücksichtigt'}</div></div><div><input style="max-width:130px" type="number" step="1" value="${+x.amount||0}" onchange="updateAnnualIncome(${pi},${ai},this.value)"><button class="text-btn" onclick="removeAnnualIncome(${pi},${ai})">Löschen</button></div></div>`).join('')}
 <button class="btn secondary" onclick="addAnnualIncome(${pi})">+ Bonus / 13. Monatslohn</button></div>`}).join('')}</div>`;
 const slider=document.getElementById('bonusRiskFactor');if(slider)slider.oninput=()=>{bonusRiskFactor=Number(slider.value);document.getElementById('bonusRiskLabel').textContent=bonusRiskFactor+' %';save()};
 if(!document.getElementById('incomePlannerYearStyles')){const st=document.createElement('style');st.id='incomePlannerYearStyles';st.textContent='.person-year-grid{grid-template-columns:repeat(2,minmax(0,1fr));margin-bottom:16px}@media(max-width:720px){#incomePlanner>.metric-grid{grid-template-columns:1fr 1fr}.person-year-grid{grid-template-columns:1fr 1fr}}';document.head.appendChild(st)}
}
window.updateIncomeSource=(pi,si,v)=>{plan.people[pi].sources[si].monthly=Math.max(0,+v||0);save()};
window.updateAnnualIncome=(pi,ai,v)=>{plan.people[pi].annual[ai].amount=Math.max(0,+v||0);save()};
window.removeIncomeSource=(pi,si)=>{plan.people[pi].sources.splice(si,1);save()};
window.removeAnnualIncome=(pi,ai)=>{plan.people[pi].annual.splice(ai,1);save()};
window.addIncomeSource=pi=>{const name=prompt('Einkommensquelle / Arbeitgeber');if(!name)return;const amount=+prompt('Monatlicher Nettobetrag in CHF','0');plan.people[pi].sources.push({name,monthly:Math.max(0,amount||0),type:'Lohn'});save()};
window.addAnnualIncome=pi=>{const name=prompt('Bezeichnung, z. B. Bonus oder 13. Monatslohn','Jährlicher Bonus');if(!name)return;const amount=+prompt('Jährlicher Betrag in CHF','0'),month=Math.min(12,Math.max(1,+prompt('Auszahlungsmonat 1–12','12')||12));plan.people[pi].annual.push({name,amount:Math.max(0,amount||0),month});save()};
window.getBudgetQuestIncomePlan=()=>plan;window.getBudgetQuestCalculatedIncome=()=>householdTotals().monthlyEquivalent;
const budget=document.getElementById('budget');if(budget){const host=document.createElement('div');host.id='incomePlanner';host.className='section';budget.appendChild(host);syncBudgetIncome();renderIncomePlanner()}
let manualMode=false;
const step2=document.querySelector('.wizard-step[data-step="2"]');if(step2){const actions=step2.querySelector('.wizard-actions'),manual=document.createElement('button');manual.type='button';manual.className='btn secondary';manual.textContent='Ohne Import manuell einrichten';manual.onclick=()=>window.startManualSetup();actions?.insertBefore(manual,actions.lastElementChild);const note=document.createElement('p');note.className='tiny';note.textContent='Der CSV-Import ist optional. Bei ungenauen Bankdaten kannst du Löhne, Fixkosten und Sparziel vollständig selbst eintragen.';step2.insertBefore(note,actions)}
function manualIncomeTotal(){return householdTotals().monthlyEquivalent}
window.startManualSetup=()=>{manualMode=true;const income=document.getElementById('setupIncome'),fixed=document.getElementById('setupFixed'),saving=document.getElementById('setupSaving'),cats=document.getElementById('setupCategories');income.value=manualIncomeTotal();fixed.value=Number(JSON.parse(localStorage.getItem('bq_settings')||'null')?.fixed||0);saving.value=Number(JSON.parse(localStorage.getItem('bq_settings')||'null')?.saving||0);cats.innerHTML=`<div class="info-note"><strong>Manuelle Einrichtung</strong><br>Das Einkommen wird aus der Einkommensplanung berechnet. Fixkosten und Sparziel kannst du hier festlegen.</div>${plan.people.map((p,i)=>`<div class="category-review"><span>${i?'👩':'👨'} ${esc2(p.name)}</span><strong>${fmt(personTotals(p).monthlyEquivalent)}/Monat</strong></div>`).join('')}`;window.setupNext(4)};
const originalFinish=window.finishSetup;window.finishSetup=function(){if(!manualMode)return originalFinish();const household=(document.getElementById('setupHousehold').value||'Unser Haushalt').trim(),newSettings={income:manualIncomeTotal(),fixed:+document.getElementById('setupFixed').value||0,saving:+document.getElementById('setupSaving').value||0};localStorage.setItem('bq_household',household);localStorage.setItem('bq_settings',JSON.stringify(newSettings));localStorage.setItem(KEY,JSON.stringify(plan));localStorage.setItem('bq_setup_done','1');document.getElementById('setupWizard').hidden=true;location.reload()};
const now=new Date(),budgetStart=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`,inCurrentBudget=row=>row&&String(row.date||'')>=budgetStart;localStorage.setItem('bq_budget_start',budgetStart);if(Array.isArray(tx)){const current=tx.filter(inCurrentBudget);if(current.length!==tx.length){tx=current;saveAll();render()}}
const finishWithDateFilter=window.finishSetup;window.finishSetup=function(){if(!manualMode&&setupAnalysis&&Array.isArray(setupAnalysis.rows))setupAnalysis.rows=setupAnalysis.rows.filter(inCurrentBudget);return finishWithDateFilter.apply(this,arguments)};const importCsvWithDateFilter=window.importCsv;window.importCsv=function(){if(Array.isArray(csvRows))csvRows=csvRows.filter(inCurrentBudget);return importCsvWithDateFilter.apply(this,arguments)};
if(!document.querySelector('script[data-bq-reset-controls]')){const script=document.createElement('script');script.src='reset-controls.js?v=18';script.dataset.bqResetControls='1';document.body.appendChild(script)}
})();