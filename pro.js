(()=>{
const q=s=>document.querySelector(s), money=v=>'CHF '+Math.round(Number(v||0)).toLocaleString('de-CH');
const defaults={cash:85000,pillar3a:118000,etf:64000,stocks:18000,crypto:0,other:0};
let wealth={...defaults,...JSON.parse(localStorage.getItem('bq_wealth')||'{}')};
const link=document.createElement('link');link.rel='stylesheet';link.href='pro.css?v=26';document.head.appendChild(link);
function inject(){
 const nav=q('.nav');
 if(nav){nav.querySelector('[data-target="wealth"]')?.remove();nav.style.removeProperty('grid-template-columns')}
 const today=q('#today'); if(today&&!q('#proOverview')){
  const block=document.createElement('div');block.id='proOverview';block.innerHTML=`<div class="pro-grid section"><div class="pro-card wealth-preview" onclick="openScreen('wealth')"><div class="pro-kicker">Gesamtvermögen</div><strong id="proWealthTotal"></strong><span id="proWealthSub"></span><div class="mini-donut" id="proDonut"></div></div><div class="pro-card cashflow-card"><div class="pro-kicker">Cashflow diesen Monat</div><div class="flow"><span>Einnahmen<b id="flowIncome"></b></span><i></i><span>Fixkosten<b id="flowFixed"></b></span><i></i><span>Variabel<b id="flowVariable"></b></span><i></i><span class="flow-save">Übrig<b id="flowLeft"></b></span></div></div></div>`;
  today.querySelector('.metric-grid')?.after(block);
 }
 if(!q('#wealth')){
  const page=document.createElement('section');page.id='wealth';page.className='screen';page.innerHTML=`<div class="page-title"><div><div class="pro-kicker">Vermögenscockpit</div><h2>Euer Vermögen</h2></div><div class="wealth-total" id="wealthTotal"></div></div><div class="wealth-layout section"><div class="pro-card"><div class="wealth-ring" id="wealthRing"><span><small>Gesamt</small><b id="wealthRingTotal"></b></span></div><div id="wealthLegend" class="wealth-legend"></div></div><div class="card"><h3>Vermögenswerte erfassen</h3><div class="wealth-form"><label>Sparkonto / Cash<input data-wealth="cash" type="number" step="1000"></label><label>Säule 3a<input data-wealth="pillar3a" type="number" step="1000"></label><label>ETF<input data-wealth="etf" type="number" step="1000"></label><label>Aktien<input data-wealth="stocks" type="number" step="1000"></label><label>Krypto<input data-wealth="crypto" type="number" step="1000"></label><label>Weitere Werte<input data-wealth="other" type="number" step="1000"></label></div><div class="info-note">Die Werte werden lokal auf diesem Gerät gespeichert und fliessen in die Eigenheim-Übersicht ein.</div></div></div>`;
  q('.app').appendChild(page);
  bindNav();
  document.querySelectorAll('[data-wealth]').forEach(el=>el.addEventListener('input',()=>{wealth[el.dataset.wealth]=Number(el.value||0);localStorage.setItem('bq_wealth',JSON.stringify(wealth));renderPro()}));
 }
}
function bindNav(){document.querySelectorAll('.nav button').forEach(btn=>btn.onclick=()=>openScreen(btn.dataset.target,btn));}
window.openScreen=(id,button)=>{document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.target===id));document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id===id));if(id==='wealth')renderPro();scrollTo({top:0,behavior:'smooth'});};
function renderPro(){
 const total=Object.values(wealth).reduce((a,b)=>a+Number(b||0),0), variable=typeof monthSpent==='function'?monthSpent():0, left=Number(settings.income||0)-Number(settings.fixed||0)-variable;
 const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val};
 set('proWealthTotal',money(total));set('proWealthSub',`${money(wealth.pillar3a)} in Säule 3a`);set('flowIncome',money(settings.income));set('flowFixed',money(settings.fixed));set('flowVariable',money(variable));set('flowLeft',money(left));set('wealthTotal',money(total));set('wealthRingTotal',money(total));
 document.querySelectorAll('[data-wealth]').forEach(el=>{if(document.activeElement!==el)el.value=wealth[el.dataset.wealth]||0});
 const labels=[['Cash',wealth.cash],['3a',wealth.pillar3a],['ETF',wealth.etf],['Aktien',wealth.stocks],['Krypto',wealth.crypto],['Weitere',wealth.other]].filter(x=>x[1]>0);
 const legend=q('#wealthLegend');if(legend)legend.innerHTML=labels.map(([n,v])=>`<div><span>${n}</span><b>${money(v)}</b><small>${total?Math.round(v/total*100):0}%</small></div>`).join('');
 const ring=q('#wealthRing');if(ring){let p=0;const cols=['#f5c400','#5de29a','#6aa9ff','#c17cff','#ff8d8d','#8fa3bf'];ring.style.background=`conic-gradient(${labels.map((x,i)=>{const a=p;p+=x[1]/Math.max(total,1)*100;return `${cols[i]} ${a}% ${p}%`}).join(',')})`;}
 const d=q('#proDonut');if(d)d.style.setProperty('--p',total?Math.min(100,wealth.pillar3a/total*100):0);
 if(typeof homePlan!=='undefined'&&homePlan){homePlan.equity=wealth.cash+wealth.etf+wealth.stocks+wealth.crypto+wealth.other;homePlan.pillar3aBalance=wealth.pillar3a;localStorage.setItem('bq_home_plan',JSON.stringify(homePlan));if(typeof renderHome==='function')renderHome();}
}
inject();bindNav();const old=window.render;window.render=function(){old();inject();renderPro()};renderPro();
})();