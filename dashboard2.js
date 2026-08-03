(()=>{
  const ROOT_ID='dashboard2Overview';
  const STYLE_ID='dashboard2Styles';
  const money2=value=>'CHF '+Number(value||0).toLocaleString('de-CH',{minimumFractionDigits:0,maximumFractionDigits:2});
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const positiveExpenses=rows=>rows.filter(row=>Number(row.amount)>0);
  const sumExpenses=rows=>positiveExpenses(rows).reduce((sum,row)=>sum+Number(row.amount||0),0);
  const categoryIcon=name=>/lebensmittel|essen|migros|coop/i.test(name)?'🛒':/haushalt|wohnen|heim/i.test(name)?'🏠':/transport|auto|mobil|sbb/i.test(name)?'🚗':/freizeit|restaurant|ferien/i.test(name)?'🎉':/shopping|kleider/i.test(name)?'🛍️':/abo|abonnement|vertrag/i.test(name)?'📱':'💳';

  function installStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #today.bq-dashboard-v2>.hero,
      #today.bq-dashboard-v2>.metric-grid,
      #today.bq-dashboard-v2>.grid2.section,
      #today.bq-dashboard-v2>#savingsGoalOverview{display:none!important}
      #dashboard2Overview{display:grid;gap:14px;margin-bottom:16px}
      .bq2-hero{background:linear-gradient(135deg,#142640,#0b1628);border:1px solid #29405f;border-radius:24px;padding:22px;box-shadow:0 16px 42px rgba(0,0,0,.22)}
      .bq2-hero-top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
      .bq2-eyebrow{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.08em;font-weight:700}
      .bq2-main-value{font-size:clamp(36px,8vw,58px);line-height:1;font-weight:850;margin:8px 0 9px}
      .bq2-main-value.negative{color:#ff7979}
      .bq2-subline{color:var(--muted);font-size:13px}
      .bq2-progress{height:12px;border-radius:999px;background:#1b2a42;overflow:hidden;margin-top:17px}
      .bq2-progress>span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#40d48b,#f0c64f);transition:width .25s ease}
      .bq2-progress.over>span{background:linear-gradient(90deg,#f3b64b,#ff6d73)}
      .bq2-summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:13px}
      .bq2-summary{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.08);border-radius:15px;padding:11px}
      .bq2-summary small{display:block;color:var(--muted);margin-bottom:5px}.bq2-summary strong{font-size:16px}
      .bq2-kpis{display:grid;grid-template-columns:1.25fr .75fr;gap:14px}
      .bq2-card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:18px}
      .bq2-card h3{margin:0}.bq2-card-title{display:flex;align-items:center;justify-content:space-between;gap:12px}
      .bq2-comparison{font-size:24px;font-weight:850;margin:9px 0 4px}.bq2-good{color:#43d58c}.bq2-bad{color:#ff7378}.bq2-neutral{color:var(--muted)}
      .bq2-daily{display:flex;flex-direction:column;justify-content:center}.bq2-daily strong{font-size:31px;line-height:1.1;margin:8px 0 4px}.bq2-tiny{font-size:12px;color:var(--muted)}
      .bq2-budget-head{display:flex;justify-content:space-between;gap:12px;align-items:end;margin-bottom:5px}.bq2-budget-head p{margin:4px 0 0}
      .bq2-category{padding:15px 0;border-bottom:1px solid var(--line)}.bq2-category:last-child{border-bottom:0;padding-bottom:2px}
      .bq2-cat-head,.bq2-cat-values,.bq2-cat-foot{display:flex;justify-content:space-between;align-items:center;gap:12px}
      .bq2-cat-head strong{font-size:15px}.bq2-cat-values{margin-top:7px}.bq2-cat-values>span:first-child{font-weight:750}.bq2-cat-values>span:last-child{color:var(--muted);font-size:13px;text-align:right}
      .bq2-cat-progress{height:8px;border-radius:999px;background:#1b2940;overflow:hidden;margin:9px 0 7px}.bq2-cat-progress span{height:100%;display:block;border-radius:inherit;background:#41d28a}.bq2-category.warning .bq2-cat-progress span{background:#f0c34a}.bq2-category.danger .bq2-cat-progress span{background:#ff6d73}
      .bq2-cat-foot{font-size:12px;color:var(--muted)}.bq2-cat-foot .bq2-good,.bq2-cat-foot .bq2-bad,.bq2-cat-foot .bq2-neutral{font-weight:750}
      .bq2-empty{padding:18px 0;color:var(--muted);text-align:center}
      @media(max-width:720px){
        .bq2-hero{padding:18px}.bq2-hero-top{display:block}.bq2-summary-grid{grid-template-columns:1fr 1fr}.bq2-summary:last-child{grid-column:1/-1}
        .bq2-kpis{grid-template-columns:1fr}.bq2-comparison{font-size:21px}.bq2-daily strong{font-size:27px}
        .bq2-budget-head{align-items:flex-start}.bq2-cat-values{align-items:flex-start}.bq2-cat-values>span:last-child{max-width:48%}
      }
    `;
    document.head.appendChild(style);
  }

  function fixedCosts(){
    let total=Number(settings.fixed||0);
    try{
      if(typeof budgetQuestStorage!=='undefined'&&typeof BudgetQuestStorageKeys!=='undefined')total+=Number(budgetQuestStorage.get(BudgetQuestStorageKeys.privateSchoolMonthly,0)||0);
    }catch(error){}
    return total;
  }

  function rowsForPeriod(month,year,dayLimit){
    const rows=typeof monthTx==='function'?monthTx(month,year):[];
    if(!dayLimit)return rows;
    return rows.filter(row=>{
      const date=typeof parseDate==='function'?parseDate(row.date):new Date(row.date);
      return date&&!Number.isNaN(date.getTime())&&date.getDate()<=dayLimit;
    });
  }

  function comparisonMarkup(current,previous){
    const diff=current-previous;
    if(Math.abs(diff)<0.005)return{className:'bq2-neutral',icon:'•',text:'Unverändert',percentText:'0 %'};
    if(previous<=0)return{className:diff>0?'bq2-bad':'bq2-good',icon:diff>0?'▲':'▼',text:`${money2(Math.abs(diff))} ${diff>0?'mehr':'weniger'}`,percentText:'kein Vergleichswert'};
    const percent=Math.round(Math.abs(diff)/previous*100);
    return{className:diff<0?'bq2-good':'bq2-bad',icon:diff<0?'▼':'▲',text:`${money2(Math.abs(diff))} ${diff<0?'weniger':'mehr'}`,percentText:`${percent} %`};
  }

  function collectCategories(currentRows,previousRows){
    const limits=new Map((Array.isArray(budgets)?budgets:[]).map(item=>[String(item.name||'Nicht zugeordnet'),Number(item.limit||0)]));
    [...currentRows,...previousRows].forEach(row=>{
      const name=String(row.cat||'Nicht zugeordnet');
      if(!limits.has(name))limits.set(name,0);
    });
    return [...limits.entries()].map(([name,limit])=>{
      const current=sumExpenses(currentRows.filter(row=>String(row.cat||'Nicht zugeordnet')===name));
      const previous=sumExpenses(previousRows.filter(row=>String(row.cat||'Nicht zugeordnet')===name));
      return{name,limit,current,previous};
    }).sort((a,b)=>{
      const aBudgeted=a.limit>0?1:0,bBudgeted=b.limit>0?1:0;
      return bBudgeted-aBudgeted||b.current-a.current||a.name.localeCompare(b.name,'de');
    });
  }

  function renderDashboard2(){
    const today=document.getElementById('today');
    if(!today||typeof monthTx!=='function'||typeof settings==='undefined'||typeof budgets==='undefined')return;
    installStyles();
    today.classList.add('bq-dashboard-v2');
    let root=document.getElementById(ROOT_ID);
    if(!root){root=document.createElement('div');root.id=ROOT_ID;today.prepend(root)}

    const now=new Date();
    const previousDate=new Date(now.getFullYear(),now.getMonth()-1,1);
    const day=Math.min(now.getDate(),new Date(previousDate.getFullYear(),previousDate.getMonth()+1,0).getDate());
    const currentRows=rowsForPeriod(now.getMonth(),now.getFullYear(),now.getDate());
    const previousRows=rowsForPeriod(previousDate.getMonth(),previousDate.getFullYear(),day);
    const currentSpent=sumExpenses(currentRows);
    const previousSpent=sumExpenses(previousRows);
    const totalBudget=(Array.isArray(budgets)?budgets:[]).reduce((sum,item)=>sum+Math.max(0,Number(item.limit||0)),0);
    const remaining=totalBudget-currentSpent;
    const usedPercent=totalBudget>0?currentSpent/totalBudget*100:0;
    const remainingDays=Math.max(1,new Date(now.getFullYear(),now.getMonth()+1,0).getDate()-now.getDate()+1);
    const dailyBudget=Math.max(0,remaining)/remainingDays;
    const totalComparison=comparisonMarkup(currentSpent,previousSpent);
    const categories=collectCategories(currentRows,previousRows);
    const previousLabel=previousDate.toLocaleDateString('de-CH',{month:'long'});
    const currentLabel=now.toLocaleDateString('de-CH',{month:'long'});

    const categoryHtml=categories.length?categories.map(category=>{
      const percent=category.limit>0?category.current/category.limit*100:0;
      const remainingCategory=category.limit-category.current;
      const state=category.limit>0?(percent>100?'danger':percent>=80?'warning':'good'):'unbudgeted';
      const comparison=comparisonMarkup(category.current,category.previous);
      const limitText=category.limit>0?`${money2(category.current)} von ${money2(category.limit)}`:`${money2(category.current)} · kein Budget gesetzt`;
      const remainingText=category.limit>0?(remainingCategory>=0?`${money2(remainingCategory)} noch frei`:`${money2(Math.abs(remainingCategory))} über Budget`):'Im Bereich Budget ein Limit setzen';
      return`<div class="bq2-category ${state}">
        <div class="bq2-cat-head"><strong>${categoryIcon(category.name)} ${escapeHtml(category.name)}</strong><span class="bq2-tiny">${category.limit>0?`${Math.round(percent)} %`:'ohne Limit'}</span></div>
        <div class="bq2-cat-values"><span>${limitText}</span><span>${remainingText}</span></div>
        ${category.limit>0?`<div class="bq2-cat-progress"><span style="width:${Math.min(100,Math.max(0,percent))}%"></span></div>`:''}
        <div class="bq2-cat-foot"><span>Vergleich bis Tag ${day}</span><span class="${comparison.className}">${comparison.icon} ${comparison.text}</span></div>
      </div>`;
    }).join(''):'<div class="bq2-empty">Noch keine Kategorien oder Buchungen vorhanden.</div>';

    root.innerHTML=`
      <section class="bq2-hero">
        <div class="bq2-hero-top">
          <div>
            <div class="bq2-eyebrow">Noch verfügbar im ${currentLabel}</div>
            <div class="bq2-main-value ${remaining<0?'negative':''}">${remaining>=0?money2(remaining):'− '+money2(Math.abs(remaining))}</div>
            <div class="bq2-subline">Für deine variablen Kategorien · Fixkosten separat</div>
          </div>
        </div>
        <div class="bq2-progress ${usedPercent>100?'over':''}"><span style="width:${Math.min(100,Math.max(0,usedPercent))}%"></span></div>
        <div class="bq2-summary-grid">
          <div class="bq2-summary"><small>Kategorienbudget</small><strong>${money2(totalBudget)}</strong></div>
          <div class="bq2-summary"><small>Ausgegeben</small><strong>${money2(currentSpent)}</strong></div>
          <div class="bq2-summary"><small>Fixkosten separat</small><strong>${money2(fixedCosts())}</strong></div>
        </div>
      </section>
      <div class="bq2-kpis">
        <section class="bq2-card">
          <div class="bq2-eyebrow">Vergleich mit ${previousLabel}</div>
          <div class="bq2-comparison ${totalComparison.className}">${totalComparison.icon} ${totalComparison.text}</div>
          <div class="bq2-tiny">${totalComparison.percentText} · jeweils bis zum ${day}. des Monats</div>
        </section>
        <section class="bq2-card bq2-daily">
          <div class="bq2-eyebrow">Tagesbudget</div>
          <strong>${money2(dailyBudget)}</strong>
          <div class="bq2-tiny">pro Tag für noch ${remainingDays} Tage</div>
        </section>
      </div>
      <section class="bq2-card">
        <div class="bq2-budget-head">
          <div><h3>Budgetübersicht</h3><p class="bq2-tiny">Aktueller Stand und Vergleich zum Vormonat</p></div>
          <span class="bq2-tiny">${categories.length} Kategorien</span>
        </div>
        <div>${categoryHtml}</div>
      </section>
    `;
  }

  function start(){
    installStyles();
    const original=window.render;
    if(typeof original==='function'&&!original.__dashboard2Wrapped){
      const wrapped=function(...args){const result=original.apply(this,args);renderDashboard2();return result};
      wrapped.__dashboard2Wrapped=true;
      window.render=wrapped;
    }
    renderDashboard2();
    ['bq:savings-updated','bq:fixed-costs-updated','bq:income-updated'].forEach(eventName=>window.addEventListener(eventName,renderDashboard2));
    window.addEventListener('storage',renderDashboard2);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderDashboard2()});
  }

  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start):start();
})();
