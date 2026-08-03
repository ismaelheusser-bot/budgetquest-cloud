(()=>{
  const $=id=>document.getElementById(id);
  const format=v=>'CHF '+Number(v||0).toLocaleString('de-CH',{maximumFractionDigits:2});
  const safe=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const monthName=d=>d.toLocaleDateString('de-CH',{month:'long'});
  const spentFor=(cat,month,year)=>monthTx(month,year).filter(t=>t.cat===cat&&Number(t.amount)>0).reduce((s,t)=>s+Number(t.amount||0),0);

  function installStyles(){
    if($('dashboard2Styles'))return;
    const style=document.createElement('style');
    style.id='dashboard2Styles';
    style.textContent=`
      #today{display:flex;flex-direction:column;gap:16px}
      #today .section{margin-top:0}
      .dq-hero{background:linear-gradient(135deg,#13233d,#0b1628);border:1px solid #263b5d;border-radius:24px;padding:22px;box-shadow:0 18px 45px rgba(0,0,0,.22)}
      .dq-hero-top{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}
      .dq-hero-value{font-size:clamp(34px,7vw,58px);font-weight:800;line-height:1;margin:8px 0 12px}
      .dq-hero-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}
      .dq-stat{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:12px}
      .dq-stat small{display:block;color:var(--muted);margin-bottom:5px}.dq-stat strong{font-size:17px}
      .dq-progress{height:12px;background:#1b2940;border-radius:999px;overflow:hidden;margin-top:14px}.dq-progress span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#35d07f,#f0c34a)}
      .dq-comparison{display:grid;grid-template-columns:1.3fr .7fr;gap:14px}
      .dq-card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:18px}
      .dq-compare-main{font-size:24px;font-weight:800;margin-top:8px}.dq-good{color:#43d58c}.dq-bad{color:#ff7070}.dq-neutral{color:var(--muted)}
      .dq-daily{display:flex;flex-direction:column;justify-content:center}.dq-daily strong{font-size:30px;margin:5px 0}
      .dq-budget-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:8px}.dq-budget-head h3{margin:0}
      .dq-category{padding:15px 0;border-bottom:1px solid var(--line)}.dq-category:last-child{border-bottom:0}
      .dq-row{display:flex;justify-content:space-between;gap:12px;align-items:center}.dq-row strong{font-size:16px}.dq-row span{text-align:right}
      .dq-meta{display:flex;justify-content:space-between;gap:10px;color:var(--muted);font-size:12px;margin-top:7px}.dq-cat-progress{height:8px;background:#1b2940;border-radius:999px;overflow:hidden;margin-top:9px}.dq-cat-progress span{display:block;height:100%;border-radius:inherit;background:#43d58c}.dq-cat-progress.warn span{background:#f0c34a}.dq-cat-progress.over span{background:#ff7070}
      .dq-change{font-weight:700}.dq-empty{color:var(--muted);padding:14px 0}
      #today>.hero,#today>.metric-grid,#today>.grid2{display:none!important}
      @media(max-width:720px){.dq-comparison{grid-template-columns:1fr}.dq-hero-grid{grid-template-columns:1fr}.dq-hero{padding:18px}.dq-row{align-items:flex-start}.dq-meta{flex-direction:column;gap:3px}}
    `;
    document.head.appendChild(style);
  }

  function buildShell(){
    const today=$('today');
    if(!today||$('dashboard2'))return;
    const shell=document.createElement('div');
    shell.id='dashboard2';
    shell.innerHTML=`
      <section class="dq-hero">
        <div class="dq-hero-top"><div><div class="eyebrow">Diesen Monat noch verfügbar</div><div class="dq-hero-value" id="dqAvailable">CHF 0</div><div class="tiny" id="dqMonthLabel"></div></div><div class="score-ring" id="dqScore"><span><b id="dqScoreValue">0</b><small>Finanz-Score</small></span></div></div>
        <div class="dq-progress"><span id="dqOverallProgress"></span></div>
        <div class="dq-hero-grid"><div class="dq-stat"><small>Monatsbudget</small><strong id="dqBudget">CHF 0</strong></div><div class="dq-stat"><small>Ausgegeben</small><strong id="dqSpent">CHF 0</strong></div><div class="dq-stat"><small>Noch verfügbar</small><strong id="dqRemaining">CHF 0</strong></div></div>
      </section>
      <section class="dq-comparison">
        <div class="dq-card"><div class="eyebrow">Vergleich zum Vormonat</div><div class="dq-compare-main" id="dqComparison">Noch kein Vergleich</div><div class="tiny" id="dqComparisonDetail"></div></div>
        <div class="dq-card dq-daily"><div class="eyebrow">Tagesbudget</div><strong id="dqDaily">CHF 0</strong><div class="tiny" id="dqDays"></div></div>
      </section>
      <section class="dq-card"><div class="dq-budget-head"><div><h3>Budgetübersicht</h3><div class="tiny">Aktueller Monat gegenüber Vormonat</div></div></div><div id="dqCategories"></div></section>
    `;
    today.insertBefore(shell,today.firstChild);
    const chart=[...today.children].find(el=>el.querySelector?.('#monthChart'));
    if(chart){chart.style.order='20';chart.querySelector('h3').textContent='Monatsentwicklung'}
  }

  function renderDashboard2(){
    if(!$('dashboard2'))return;
    const now=new Date(),month=now.getMonth(),year=now.getFullYear();
    const prevDate=new Date(year,month-1,1),prevMonth=prevDate.getMonth(),prevYear=prevDate.getFullYear();
    const variable=monthSpent(month,year),prevVariable=monthSpent(prevMonth,prevYear);
    const monthlyBudget=Math.max(0,Number(settings.income||0)-Number(settings.fixed||0)-Number(settings.saving||0));
    const remaining=monthlyBudget-variable;
    const progress=monthlyBudget?Math.max(0,Math.min(100,variable/monthlyBudget*100)):0;
    const lastDay=new Date(year,month+1,0).getDate(),daysLeft=Math.max(1,lastDay-now.getDate()+1),daily=Math.max(0,remaining)/daysLeft;
    const diff=variable-prevVariable,percent=prevVariable?diff/prevVariable*100:null;
    const financialScore=typeof score==='function'?score():0;

    $('dqAvailable').textContent=format(remaining);
    $('dqAvailable').className='dq-hero-value '+(remaining<0?'dq-bad':'');
    $('dqMonthLabel').textContent=`${monthName(now)} ${year} · nach Fixkosten und Sparziel`;
    $('dqBudget').textContent=format(monthlyBudget);
    $('dqSpent').textContent=format(variable);
    $('dqRemaining').textContent=format(remaining);
    $('dqOverallProgress').style.width=progress+'%';
    $('dqScore').style.setProperty('--p',financialScore);$('dqScoreValue').textContent=financialScore;
    $('dqDaily').textContent=format(daily)+' / Tag';
    $('dqDays').textContent=`Noch ${daysLeft} ${daysLeft===1?'Tag':'Tage'} im Monat`;

    const comparison=$('dqComparison'),detail=$('dqComparisonDetail');
    comparison.className='dq-compare-main';
    if(!prevVariable){comparison.textContent='Noch kein Vormonatsvergleich';detail.textContent='Sobald Buchungen aus dem Vormonat vorhanden sind, erscheint hier die Entwicklung.';comparison.classList.add('dq-neutral')}
    else if(Math.abs(diff)<.01){comparison.textContent='Gleich wie im Vormonat';detail.textContent=`Je ${format(variable)} in ${monthName(now)} und ${monthName(prevDate)}.`;comparison.classList.add('dq-neutral')}
    else{const better=diff<0;comparison.textContent=`${better?'↓':'↑'} ${format(Math.abs(diff))} ${better?'weniger':'mehr'}`;detail.textContent=`${Math.abs(percent).toFixed(1)} % ${better?'Verbesserung':'höhere Ausgaben'} gegenüber ${monthName(prevDate)}.`;comparison.classList.add(better?'dq-good':'dq-bad')}

    const cats=[...new Set([...budgets.map(b=>b.name),...tx.filter(t=>Number(t.amount)>0).map(t=>t.cat).filter(Boolean)])];
    const rows=cats.map(name=>{const budget=budgets.find(b=>b.name===name)?.limit||0,current=spentFor(name,month,year),previous=spentFor(name,prevMonth,prevYear);return{name,budget,current,previous,remaining:budget-current,change:current-previous}}).filter(r=>r.budget||r.current||r.previous).sort((a,b)=>(b.budget?b.current/b.budget:b.current)-(a.budget?a.current/a.budget:a.current));
    $('dqCategories').innerHTML=rows.length?rows.map(r=>{const p=r.budget?Math.max(0,Math.min(100,r.current/r.budget*100)):0,status=p>100?'over':p>=80?'warn':'',changeClass=r.change<0?'dq-good':r.change>0?'dq-bad':'dq-neutral',changeText=!r.previous&&r.current?'Neu in diesem Monat':r.change===0?'Unverändert':`${r.change<0?'↓':'↑'} ${format(Math.abs(r.change))} ${r.change<0?'weniger':'mehr'}`;return`<div class="dq-category"><div class="dq-row"><strong>${safe(r.name)}</strong><span>${format(r.current)} / ${r.budget?format(r.budget):'kein Limit'}</span></div><div class="dq-cat-progress ${status}"><span style="width:${p}%"></span></div><div class="dq-meta"><span>${r.budget?`Noch ${format(r.remaining)}`:'Budgetlimit nicht festgelegt'}</span><span class="dq-change ${changeClass}">${changeText}</span></div></div>`}).join(''):'<div class="dq-empty">Noch keine Ausgaben für einen Monatsvergleich vorhanden.</div>';
  }

  function start(){installStyles();buildShell();renderDashboard2();const originalRender=window.render;if(typeof originalRender==='function'){window.render=function(...args){const result=originalRender.apply(this,args);renderDashboard2();return result}}window.addEventListener('bq:cloud-data-applied',renderDashboard2);window.addEventListener('storage',renderDashboard2)}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start):start();
})();