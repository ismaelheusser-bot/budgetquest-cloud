(()=>{
 const money=v=>'CHF '+Number(v||0).toLocaleString('de-CH',{minimumFractionDigits:2,maximumFractionDigits:2});
 const activeSaving=()=>Number(localStorage.getItem('bq_active_savings_monthly')||0);
 const schoolCost=()=>Math.max(0,Number(localStorage.getItem('bq_private_school_monthly')||0));

 function ensureDetailDialog(){
  if(document.getElementById('savingsDetailDialog'))return;
  const dialog=document.createElement('dialog');
  dialog.id='savingsDetailDialog';
  dialog.className='savings-detail-dialog';
  dialog.innerHTML='<div class="savings-detail-head"><div><div class="tiny" id="sdEyebrow"></div><h2 id="sdTitle"></h2></div><button type="button" class="icon-btn" id="sdClose" aria-label="Schliessen">✕</button></div><p id="sdIntro" class="savings-detail-intro"></p><div class="savings-detail-value" id="sdValue"></div><div class="savings-detail-sub" id="sdSub"></div><div class="progress savings-detail-progress"><span id="sdProgress"></span></div><div class="savings-detail-grid" id="sdRows"></div><div class="info-note" id="sdInfo"></div><div class="actions"><button type="button" class="btn" id="sdAction"></button><button type="button" class="btn secondary" id="sdDone">Schliessen</button></div>';
  document.body.appendChild(dialog);
  dialog.querySelector('#sdClose').onclick=()=>dialog.close();
  dialog.querySelector('#sdDone').onclick=()=>dialog.close();
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
 }

 function openScreen(target){
  document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('active',x.dataset.target===target));
  document.getElementById(target)?.classList.add('active');
  document.getElementById('savingsDetailDialog')?.close();
  scrollTo({top:0,behavior:'smooth'});
 }

 function openDetail(type){
  ensureDetailDialog();
  const d=window.bqSavingsGoal||{};
  const dialog=document.getElementById('savingsDetailDialog');
  const title=document.getElementById('sdTitle'),eyebrow=document.getElementById('sdEyebrow'),intro=document.getElementById('sdIntro'),value=document.getElementById('sdValue'),sub=document.getElementById('sdSub'),rows=document.getElementById('sdRows'),info=document.getElementById('sdInfo'),progress=document.getElementById('sdProgress'),action=document.getElementById('sdAction');
  const configs={
   target:{icon:'🎯',title:'Sparziel',intro:'Dein festgelegtes Monatsziel, das du jeden Monat erreichen möchtest.',value:d.target,sub:'Festgelegtes Monatsziel',progress:d.income?d.target/d.income*100:0,rows:[['Monatliches Einkommen',d.income],['Maximaler Ausgabenrahmen',d.maxSpend],['Noch verfügbar',d.remaining]],info:'Das Sparziel wird im Budget festgelegt. Einkommen minus Sparziel ergibt den maximalen Ausgabenrahmen für den Monat.',action:'Sparziel bearbeiten',screen:'budget'},
   expected:{icon:'📈',title:'Erwartete Ersparnis',intro:'Prognose auf Basis deiner bisherigen Ausgaben im aktuellen Monat.',value:d.expected,sub:d.delta>=0?`${money(d.delta)} über Sparziel`:`${money(Math.abs(d.delta))} unter Sparziel`,progress:d.target?d.expected/d.target*100:0,rows:[['Einnahmen',d.income],['Hochgerechnete Ausgaben',d.income-d.expected],['Sparziel',d.target]],info:'Die App rechnet deine bisher erfassten variablen Ausgaben auf den gesamten Monat hoch und zieht sie zusammen mit den Fixkosten vom Einkommen ab.',action:'Buchungen prüfen',screen:'transactions'},
   levers:{icon:'💡',title:'Aktivierte Sparhebel',intro:'Zusätzliches monatliches Sparpotenzial aus den von dir aktivierten Massnahmen.',value:d.active,sub:'Zusätzlich möglich',progress:d.target?d.active/d.target*100:0,rows:[['Aktivierte Sparhebel',d.active],['Sparziel',d.target],['Anteil am Sparziel',d.target?d.active/d.target*100:null,true]],info:'Nur Sparhebel, die du im Spar-Assistenten bewusst aktiviert hast, werden hier eingerechnet.',action:'Sparhebel ansehen',screen:'assistant'},
   possible:{icon:'🏡',title:'Mögliches Sparen',intro:'Deine erwartete Ersparnis zuzüglich aller aktivierten Sparhebel.',value:d.possible,sub:'Prognose inklusive Sparhebel',progress:d.target?d.possible/d.target*100:0,rows:[['Erwartete Ersparnis',d.expected],['Aktivierte Sparhebel',d.active],['Differenz zum Sparziel',d.possible-d.target]],info:'Dieser Wert ist eine Prognose. Er zeigt, was möglich wäre, wenn deine aktuelle Ausgabenentwicklung anhält und du die aktivierten Sparhebel umsetzt.',action:'Eigenheim-Prognose öffnen',screen:'home'}
  };
  const c=configs[type];if(!c)return;
  eyebrow.textContent=c.icon+' Details';title.textContent=c.title;intro.textContent=c.intro;value.textContent=money(c.value);sub.textContent=c.sub;
  progress.style.width=Math.max(0,Math.min(100,Number(c.progress||0)))+'%';
  rows.innerHTML=c.rows.map(([label,val,isPercent])=>`<div><span>${label}</span><strong>${val===null?'–':isPercent?Number(val).toLocaleString('de-CH',{maximumFractionDigits:1})+' %':money(val)}</strong></div>`).join('');
  info.textContent=c.info;action.textContent=c.action;action.onclick=()=>openScreen(c.screen);
  dialog.showModal();
 }

 function ensureUI(){
  const today=document.getElementById('today');
  if(today&&!document.getElementById('savingsGoalOverview')){
   document.getElementById('budgetReality')?.remove();
   const block=document.createElement('div');block.id='savingsGoalOverview';block.className='section';
   block.innerHTML=`<div class="savings-goal-grid"><button type="button" class="metric savings-goal-card" data-savings-detail="target"><label>🎯 Sparziel</label><strong id="sgTarget"></strong><small>Festgelegtes Monatsziel</small><span class="card-hint">Details ›</span></button><button type="button" class="metric savings-goal-card" data-savings-detail="expected"><label>📈 Erwartete Ersparnis</label><strong id="sgExpected"></strong><small id="sgExpectedDelta"></small><span class="card-hint">Details ›</span></button><button type="button" class="metric savings-goal-card" data-savings-detail="levers"><label>💡 Aktivierte Sparhebel</label><strong class="positive" id="sgLevers"></strong><small>Zusätzlich möglich</small><span class="card-hint">Details ›</span></button><button type="button" class="metric savings-goal-card" data-savings-detail="possible"><label>🏡 Mögliches Sparen</label><strong class="positive" id="sgPossible"></strong><small>Prognose inkl. Sparhebel</small><span class="card-hint">Details ›</span></button></div><div class="card section"><div class="section-head"><div><h3>Monatsbudget im Überblick</h3><div class="tiny">Das Sparziel bestimmt deinen maximalen Ausgabenrahmen.</div></div></div><div class="budget-reality-grid"><div><span>Max. Ausgaben gemäss Sparziel</span><strong id="sgMaxSpend"></strong><small>Einkommen − Sparziel</small></div><div><span>Budgetierte Ausgaben total</span><strong id="sgBudgeted"></strong><small>Fixkosten inkl. Privatschule + Kategorienbudgets</small></div><div><span>Bereits verbraucht</span><strong id="sgUsed"></strong><small>Fixkosten inkl. Privatschule + erfasste Ausgaben</small></div><div><span>Noch verfügbar</span><strong id="sgRemaining"></strong><small>Bis zum Sparziel-Rahmen</small></div></div><div class="progress budget-reality-progress"><span id="sgProgress"></span></div><div id="sgForecast" class="info-note"></div></div>`;
   today.querySelector('.hero')?.after(block);
   block.querySelectorAll('[data-savings-detail]').forEach(card=>card.onclick=()=>openDetail(card.dataset.savingsDetail));
  }
  const budget=document.getElementById('budget');if(budget&&!document.getElementById('budgetGoalCheck')){const note=document.createElement('div');note.id='budgetGoalCheck';note.className='info-note section';budget.querySelector('.section-head')?.after(note)}
  ensureDetailDialog();
  if(!document.getElementById('savingsGoalStyles')){const st=document.createElement('style');st.id='savingsGoalStyles';st.textContent='.savings-goal-grid,.budget-reality-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.savings-goal-grid .metric small,.budget-reality-grid small,.budget-reality-grid span{color:var(--muted);font-size:12px}.savings-goal-grid .metric{display:grid;gap:5px}.savings-goal-card{position:relative;width:100%;text-align:left;color:inherit;cursor:pointer;appearance:none;transition:transform .15s,border-color .15s,background .15s}.savings-goal-card:active{transform:scale(.98)}.savings-goal-card:hover,.savings-goal-card:focus-visible{border-color:#5de29a88;background:#15243a}.card-hint{position:absolute;right:13px;bottom:11px;color:#5de29a;font-size:11px;font-weight:800}.budget-reality-grid>div{background:#0d1728;border:1px solid var(--line);border-radius:15px;padding:13px;display:grid;gap:5px}.budget-reality-grid strong{font-size:19px}.budget-reality-progress{margin:14px 0}.goal-ok{border-color:#2fc98f!important}.goal-warn{border-color:#f0b83f!important}.goal-bad{border-color:#ef6673!important}.savings-detail-dialog{width:min(560px,calc(100% - 20px));max-height:88dvh;overflow:auto}.savings-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:15px}.savings-detail-head h2{margin:4px 0 0}.savings-detail-intro{color:var(--muted);line-height:1.5}.savings-detail-value{font-size:clamp(34px,9vw,52px);font-weight:900;color:var(--green);margin-top:16px}.savings-detail-sub{color:var(--muted);margin-top:4px}.savings-detail-progress{margin:18px 0}.savings-detail-grid{display:grid;gap:0;margin-bottom:14px}.savings-detail-grid>div{display:flex;justify-content:space-between;gap:15px;padding:13px 0;border-bottom:1px solid var(--line)}.savings-detail-grid span{color:var(--muted)}.savings-detail-grid strong{text-align:right}@media(max-width:720px){.savings-goal-grid,.budget-reality-grid{grid-template-columns:1fr 1fr}}';document.head.appendChild(st)}
 }

 function update(){
  ensureUI();if(typeof settings==='undefined'||typeof budgets==='undefined'||typeof monthSpent!=='function')return;
  const income=Number(settings.income||0),baseFixed=Number(settings.fixed||0),school=schoolCost(),fixed=baseFixed+school,target=Number(settings.saving||0),active=activeSaving(),categoryBudget=budgets.reduce((s,b)=>s+Number(b.limit||0),0),allocated=fixed+categoryBudget,maxSpend=Math.max(0,income-target),variableFrame=Math.max(0,maxSpend-fixed),variableUsed=monthSpent(),used=fixed+variableUsed,now=new Date(),day=Math.max(1,now.getDate()),days=new Date(now.getFullYear(),now.getMonth()+1,0).getDate(),projectedVariable=variableUsed/day*days,projectedExpenses=fixed+projectedVariable,expected=income-projectedExpenses,possible=expected+active,remaining=maxSpend-used,delta=expected-target,allocationDelta=categoryBudget-variableFrame;
  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};
  set('sgTarget',money(target));set('sgExpected',money(expected));set('sgLevers','+'+money(active));set('sgPossible',money(possible));set('sgMaxSpend',money(maxSpend));set('sgBudgeted',money(allocated));set('sgUsed',money(used));set('sgRemaining',money(remaining));
  const expectedEl=document.getElementById('sgExpected');if(expectedEl)expectedEl.className=expected>=target?'positive':'negative';
  set('sgExpectedDelta',delta>=0?`${money(delta)} über Sparziel`:`${money(Math.abs(delta))} unter Sparziel`);
  const progress=document.getElementById('sgProgress');if(progress)progress.style.width=`${Math.min(100,maxSpend?used/maxSpend*100:0)}%`;
  const forecast=document.getElementById('sgForecast');if(forecast)forecast.innerHTML=expected>=target?`✅ Wenn du in diesem Tempo weitermachst, erreichst du dein Sparziel und sparst voraussichtlich <strong>${money(expected)}</strong>. Mit aktivierten Sparhebeln sind <strong>${money(possible)}</strong> möglich.`:`⚠️ Wenn du in diesem Tempo weitermachst, verfehlst du dein Sparziel voraussichtlich um <strong>${money(Math.abs(delta))}</strong>.`;
  const check=document.getElementById('budgetGoalCheck');if(check){check.className='info-note section '+(allocationDelta>0?'goal-bad':allocationDelta<0?'goal-warn':'goal-ok');check.innerHTML=allocationDelta>0?`⚠️ Deine Kategorienbudgets überschreiten den verfügbaren variablen Rahmen von <strong>${money(variableFrame)}</strong> um <strong>${money(allocationDelta)}</strong>. Die Privatschule ist bereits als Fixkostenposition berücksichtigt.`:allocationDelta<0?`💰 Deine Kategorienbudgets liegen <strong>${money(Math.abs(allocationDelta))}</strong> unter dem verfügbaren variablen Rahmen von ${money(variableFrame)}. Die Privatschule von ${money(school)} ist bereits abgezogen.`:`✅ Deine Kategorienbudgets entsprechen genau dem variablen Rahmen von <strong>${money(variableFrame)}</strong>. Die Privatschule ist bereits berücksichtigt.`}
  const hero=document.getElementById('incomeHero'),sub=document.getElementById('heroSpent');if(hero)hero.textContent=money(remaining);if(sub)sub.textContent=`Noch verfügbar bis zum Sparziel · Rahmen ${money(maxSpend)}`;
  const rate=document.getElementById('savingRateMetric');if(rate)rate.textContent=`${(income?expected/income*100:0).toLocaleString('de-CH',{maximumFractionDigits:1})} % · ${money(expected)}`;
  const expense=document.getElementById('expenseMetric');if(expense)expense.textContent=money(used);const goal=document.getElementById('goalValue');if(goal)goal.textContent=money(target);
  window.bqSavingsGoal={income,baseFixed,school,fixed,target,active,maxSpend,variableFrame,categoryBudget,allocated,used,remaining,expected,possible,delta};
 }

 const start=()=>{update();const original=window.render;if(typeof original==='function'&&!original.__savingsWrapped){const wrapped=function(){original();update()};wrapped.__savingsWrapped=true;window.render=wrapped}window.addEventListener('bq:savings-updated',update);window.addEventListener('bq:fixed-costs-updated',update)};
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start):start();
})();