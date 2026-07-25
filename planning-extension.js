(()=>{
 const SCHOOL_KEY='bq_private_school_monthly';
 const money=v=>'CHF '+Number(v||0).toLocaleString('de-CH',{minimumFractionDigits:2,maximumFractionDigits:2});
 const schoolCost=()=>Math.max(0,Number(localStorage.getItem(SCHOOL_KEY)||0));
 let receiptScanGeneration=0;

 function migrateSarahProfile(){
  if(typeof householdProfiles!=='undefined'&&Array.isArray(householdProfiles)){
   let changed=false;
   householdProfiles=householdProfiles.map((profile,index)=>{
    const name=String(profile?.name||'').trim();
    if(profile?.id==='partner'||/^partnerin$/i.test(name)||(!name&&index===1)){
     changed=changed||name!=='Sarah Heusser';
     return{...profile,id:profile?.id||'partner',name:'Sarah Heusser',emoji:profile?.emoji||'👤'};
    }
    return profile;
   });
   if(changed&&typeof saveProfiles==='function')saveProfiles();
   if(typeof renderProfiles==='function')renderProfiles();
  }
  document.querySelectorAll('.share-box h3').forEach(el=>{
   if(/partnerin/i.test(el.textContent||''))el.textContent='Mit Sarah Heusser teilen';
  });
 }

 function restoreThreeYearHomeView(){
  [4,5].forEach(year=>document.getElementById('homePrice'+year)?.closest('.home-year')?.remove());
  document.getElementById('homeTimelineControls')?.remove();
  const grid=document.querySelector('#home .timeline-grid');
  if(grid){grid.style.gridTemplateColumns='';grid.style.overflowX='';grid.style.scrollSnapType='';grid.style.padding='';}
 }

 function makeCollapsible(card,title,summaryFn){
  if(!card||card.dataset.collapsibleReady)return;
  card.dataset.collapsibleReady='1';
  const body=document.createElement('div');body.className='collapsible-body';
  while(card.firstChild)body.appendChild(card.firstChild);
  const head=document.createElement('button');head.type='button';head.className='collapsible-head';
  head.innerHTML=`<span><strong>${title}</strong><small class="collapsible-summary"></small></span><b>▾</b>`;
  card.append(head,body);
  const setOpen=open=>{card.classList.toggle('collapsed',!open);head.querySelector('b').textContent=open?'▴':'▾';head.querySelector('.collapsible-summary').textContent=summaryFn?summaryFn():''};
  head.onclick=()=>setOpen(card.classList.contains('collapsed'));
  card._setCollapsed=()=>setOpen(false);card._setOpen=()=>setOpen(true);setOpen(true);
 }

 function ensureSchoolInput(){
  const form=document.querySelector('#budget form[onsubmit*="saveSettings"]');
  if(!form||document.getElementById('privateSchoolInput'))return;
  const fixed=document.getElementById('fixedInput'),fixedLabel=fixed?.closest('label');
  if(fixedLabel)fixedLabel.childNodes[0].textContent='Übrige Fixkosten';
  const label=document.createElement('label');
  label.innerHTML='Privatschule pro Monat<input id="privateSchoolInput" type="number" min="0" step="0.05" inputmode="decimal"><small class="tiny">Wird als feste monatliche Ausgabe zusätzlich zu den übrigen Fixkosten gerechnet.</small>';
  fixedLabel?.after(label);
  document.getElementById('privateSchoolInput').value=schoolCost();
  const card=form.closest('.card');
  makeCollapsible(card,'Grunddaten',()=>`Einkommen ${money(settings?.income)} · Fixkosten ${money(Number(settings?.fixed||0)+schoolCost())} · Sparziel ${money(settings?.saving)}`);
  form.addEventListener('submit',()=>{
   localStorage.setItem(SCHOOL_KEY,String(Math.max(0,Number(document.getElementById('privateSchoolInput')?.value||0))));
   setTimeout(()=>{card?._setCollapsed?.();window.dispatchEvent(new Event('bq:fixed-costs-updated'))},0);
  },true);
 }

 function ensureOtherCollapsibles(){
  const addForm=document.querySelector('#budget form[onsubmit*="addBudget"]'),addCard=addForm?.closest('.card');
  makeCollapsible(addCard,'Kategorie hinzufügen',()=>`${budgets?.length||0} Kategorien eingerichtet`);
  addForm?.addEventListener('submit',()=>setTimeout(()=>addCard?._setCollapsed?.(),0),true);
  const homeCard=document.querySelector('#home .card.section');
  makeCollapsible(homeCard,'Eigenheim-Angaben',()=>`Eigenkapital ${homeMoney(typeof homePlan!=='undefined'?homePlan.equity:0)} · Sparen ${homeMoney(typeof homePlan!=='undefined'?homePlan.monthlySaving:0)}/Monat`);
 }

 function resetReceiptImportState(){
  receiptScanGeneration++;
  const input=document.getElementById('receiptCameraInput');
  if(input)input.value='';
  const preview=document.getElementById('receiptPreview');
  if(preview?.src?.startsWith('blob:'))URL.revokeObjectURL(preview.src);
  if(preview){preview.hidden=true;preview.removeAttribute('src')}
  const previewBox=document.getElementById('receiptPreviewBox');
  if(previewBox)previewBox.hidden=true;
  const form=document.getElementById('receiptForm');
  if(form){form.reset();form.hidden=true}
  const merchant=document.getElementById('receiptMerchant');if(merchant)merchant.value='';
  const amount=document.getElementById('receiptAmount');if(amount)amount.value='';
  const status=document.getElementById('receiptStatus');if(status)status.textContent='Noch kein Beleg.';
 }

 function ensureReceiptRemoveButton(){
  const preview=document.getElementById('receiptPreview');
  if(!preview||document.getElementById('receiptPreviewBox'))return;
  const box=document.createElement('div');box.id='receiptPreviewBox';box.className='receipt-preview-box';box.hidden=preview.hidden;
  preview.before(box);box.appendChild(preview);
  const remove=document.createElement('button');
  remove.type='button';remove.id='removeReceiptImage';remove.className='receipt-remove';remove.setAttribute('aria-label','Importiertes Foto entfernen');remove.textContent='×';
  remove.onclick=resetReceiptImportState;box.appendChild(remove);
  const observer=new MutationObserver(()=>{box.hidden=preview.hidden||!preview.getAttribute('src')});
  observer.observe(preview,{attributes:true,attributeFilter:['hidden','src']});
 }

 function ensureQuickImportActions(){
  const form=document.querySelector('#txDialog form');
  if(!form||document.getElementById('quickImportActions'))return;
  const title=form.querySelector('h3');
  const actions=document.createElement('div');actions.id='quickImportActions';actions.className='quick-import-actions';
  actions.innerHTML='<button type="button" class="btn" id="quickReceiptImport">📷 Beleg scannen</button><button type="button" class="btn secondary" id="quickCsvImport">📄 CSV importieren</button><div class="quick-import-divider"><span>oder manuell erfassen</span></div>';
  title?.after(actions);
  document.getElementById('quickReceiptImport').onclick=()=>{document.getElementById('txDialog')?.close();resetReceiptImportState();document.getElementById('receiptDialog')?.showModal()};
  document.getElementById('quickCsvImport').onclick=()=>{document.getElementById('txDialog')?.close();document.getElementById('csvDialog')?.showModal()};
 }

 function wrapReceiptScanner(){
  if(typeof window.scanReceipt!=='function'||window.scanReceipt.__removeWrapped)return;
  const original=window.scanReceipt;
  const wrapped=async function(file){
   const generation=++receiptScanGeneration;
   const box=document.getElementById('receiptPreviewBox');if(box)box.hidden=!file;
   await original(file);
   if(generation!==receiptScanGeneration)resetReceiptImportState();
  };
  wrapped.__removeWrapped=true;window.scanReceipt=wrapped;
 }

 function renderExtension(){migrateSarahProfile();restoreThreeYearHomeView();ensureSchoolInput();ensureOtherCollapsibles();ensureReceiptRemoveButton();ensureQuickImportActions();wrapReceiptScanner()}
 const style=document.createElement('style');
 style.textContent='.collapsible-head{width:100%;display:flex;justify-content:space-between;align-items:center;background:transparent;border:0;color:inherit;padding:0;text-align:left}.collapsible-head span{display:grid;gap:4px}.collapsible-summary{color:var(--muted);font-size:12px}.collapsed .collapsible-body{display:none}.collapsed{padding-bottom:16px}.receipt-preview-box{position:relative;margin-top:10px}.receipt-preview-box[hidden]{display:none}.receipt-preview-box .receipt-preview{margin-top:0}.receipt-remove{position:absolute;z-index:2;top:8px;right:8px;width:38px;height:38px;border:1px solid #ffffff55;border-radius:50%;background:#08111fd9;color:#fff;font-size:28px;line-height:32px;font-weight:500;display:grid;place-items:center;box-shadow:0 4px 14px #0008;cursor:pointer}.quick-import-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:4px}.quick-import-divider{grid-column:1/-1;display:flex;align-items:center;gap:10px;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin:3px 0}.quick-import-divider:before,.quick-import-divider:after{content:"";height:1px;background:var(--line);flex:1}@media(max-width:420px){.quick-import-actions{grid-template-columns:1fr}}';
 document.head.appendChild(style);
 const start=()=>{renderExtension();const original=window.render;if(typeof original==='function'&&!original.__planningWrapped){const wrapped=function(){original();renderExtension()};wrapped.__planningWrapped=true;window.render=wrapped}window.addEventListener('bq:savings-updated',renderExtension);window.addEventListener('bq:fixed-costs-updated',renderExtension);window.addEventListener('bq:income-updated',renderExtension)};
 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start):start();
})();