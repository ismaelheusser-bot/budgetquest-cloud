(()=>{
 const money=v=>'CHF '+Number(v||0).toLocaleString('de-CH',{minimumFractionDigits:2,maximumFractionDigits:2});
 const activeSaving=()=>Number(localStorage.getItem('bq_active_savings_monthly')||0);
 function ensureUI(){
  const today=document.getElementById('today');
  if(today&&!document.getElementById('savingsGoalOverview')){
   const block=document.createElement('div');block.id='savingsGoalOverview';block.className='section';
   block.innerHTML=`<div class="savings-goal-grid"><div class="metric"><label>🎯 Sparziel</label><strong id="sgTarget"></strong><small>Festgelegtes Monatsziel</small></div><div class="metric"><label>📈 Erwartete Ersparnis</label><strong id="sgExpected"></strong><small id="sgExpectedDelta"></small></div><div class="metric"><label>💡 Aktivierte Sparhebel</label><strong class="positive" id="sgLevers"></strong><small>Zusätzlich möglich</small></div><div class="metric"><label>🏡 Mögliches Sparen</label><strong class="positive" id="sgPossible"></strong><small>Prognose inkl. Sparhebel</small></div></div><div class="card section"><div class="section-head"><div><h3>Monatsbudget im Überblick</h3><div class="tiny">Das Sparziel bestimmt deinen maximalen Ausgabenrahmen.</div></div></div><div class="budget-reality-grid"><div><span>Max. Ausgaben gemäss Sparziel</span><strong id="sgMaxSpend"></strong><small>Einkommen − Sparziel</small></div><div><span>Budgetierte Kategorien total</span><strong id="sgBudgeted"></strong><small>Fixkosten + Kategorienbudgets</small></div><div><span>Bereits verbraucht</span><strong id="sgUsed"></strong><small>Fixkosten + erfasste Ausgaben</small></div><div><span>Noch verfügbar</span><strong id="sgRemaining"></strong><small>Bis zum Sparziel-Rahmen</small></div></div><div class="progress budget-reality-progress"><span id="sgProgress"></span></div><div id="sgForecast" class="info-note"></div></div>`;
   today.querySelector('.hero')?.after(block);
  }
  const budget=document.getElementById('budget');
  if(budget&&!document.getElementById('budgetGoalCheck')){const note=document.createElement('div');note.id='budgetGoalCheck';note.className='info-note section';budget.querySelector('.section-head')?.after(note)}
  if(!document.getElementById('savingsGoalStyles')){const st=document.createElement('style');st.id='savingsGoalStyles';st.textContent='.savings-goal-grid,.budget-reality-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.savings-goal-grid .metric small,.budget-reality-grid small,.budget-reality-grid span{color:var(--muted);font-size:12px}.savings-goal-grid .metric{display:grid;gap:5px}.budget-reality-grid>div{background:#0d1728;border:1px solid var(--line);border-radius:15px;padding:13px;display:grid;gap:5px}.budget-reality-grid strong{font-size:19px}.budget-reality-progress{margin:14px 0}.goal-ok{border-color:#2fc98f!important}.goal-warn{border-color:#f0b83f!important}.goal-bad{border-color:#ef6673!important}@media(max-width:720px){.savings-goal-grid,.budget-reality-grid{grid-template-columns:1fr 1fr}}';document.head.appendChild(st)}
 }
 function update(){
  ensureUI();if(typeof settings==='undefined'||typeof budgets==='undefined'||typeof monthSpent!=='function')return;
  const income=Number(settings.income||0),fixed=Number(settings.fixed||0),target=Number(settings.saving||0),active=activeSaving();
  const categoryBudget=budgets.reduce((s,b)=>s+Number(b.limit||0),0),allocated=fixed+categoryBudget;
  const maxSpend=Math.max(0,income-target),variableFrame=Math.max(0,maxSpend-fixed),variableUsed=monthSpent(),used=fixed+variableUsed;
  const now=new Date(),day=Math.max(1,now.getDate()),days=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  const projectedVariable=variableUsed/day*days,projectedExpenses=fixed+projectedVariable,expected=income-projectedExpenses,possible=expected+active;
  const remaining=maxSpend-used,delta=expected-target,allocationDelta=categoryBudget-variableFrame;
  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};
  set('sgTarget',money(target));set('sgExpected',money(expected));set('sgLevers','+'+money(active));set('sgPossible',money(possible));
  set('sgMaxSpend',money(maxSpend));set('sgBudgeted',money(allocated));set('sgUsed',money(used));set('sgRemaining',money(remaining));
  const expectedEl=document.getElementById('sgExpected');if(expectedEl)expectedEl.className=expected>=target?'positive':'negative';
  set('sgExpectedDelta',delta>=0?`${money(delta)} über Sparziel`:`${money(Math.abs(delta))} unter Sparziel`);
  const progress=document.getElementById('sgProgress');if(progress)progress.style.width=`${Math.min(100,maxSpend?used/maxSpend*100:0)}%`;
  const forecast=document.getElementById('sgForecast');if(forecast){forecast.innerHTML=expected>=target?`✅ Wenn du in diesem Tempo weitermachst, erreichst du dein Sparziel und sparst voraussichtlich <strong>${money(expected)}</strong>. Mit aktivierten Sparhebeln sind <strong>${money(possible)}</strong> möglich.`:`⚠️ Wenn du in diesem Tempo weitermachst, verfehlst du dein Sparziel voraussichtlich um <strong>${money(Math.abs(delta))}</strong>.`}
  const check=document.getElementById('budgetGoalCheck');if(check){check.className='info-note section '+(allocationDelta>0?'goal-bad':allocationDelta<0?'goal-warn':'goal-ok');check.innerHTML=allocationDelta>0?`⚠️ Deine Kategorienbudgets überschreiten den verfügbaren variablen Rahmen von <strong>${money(variableFrame)}</strong> um <strong>${money(allocationDelta)}</strong>. Dadurch ist das Sparziel rechnerisch nicht erreichbar.`:allocationDelta<0?`💰 Deine Kategorienbudgets liegen <strong>${money(Math.abs(allocationDelta))}</strong> unter dem verfügbaren variablen Rahmen von ${money(variableFrame)}. Dieser Betrag bleibt als Reserve.`:`✅ Deine Kategorienbudgets entsprechen genau dem variablen Rahmen von <strong>${money(variableFrame)}</strong>.`}
  const hero=document.getElementById('incomeHero'),sub=document.getElementById('heroSpent');if(hero)hero.textContent=money(remaining);if(sub)sub.textContent=`Noch verfügbar bis zum Sparziel · Rahmen ${money(maxSpend)}`;
  const rate=document.getElementById('savingRateMetric');if(rate)rate.textContent=`${(income?expected/income*100:0).toLocaleString('de-CH',{maximumFractionDigits:1})} % · ${money(expected)}`;
  const goal=document.getElementById('goalValue');if(goal)goal.textContent=money(target);
  window.bqSavingsGoal={income,fixed,target,active,maxSpend,variableFrame,categoryBudget,allocated,used,remaining,expected,possible,delta};
 }
 function start(){update();const old=window.render;if(typeof old==='function'&&!old.__goalWrapped){const wrapped=function(){old();update()};wrapped.__goalWrapped=true;window.render=wrapped}window.addEventListener('bq:savings-updated',update)}
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start):start();
})();