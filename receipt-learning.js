(()=>{
 const KEY='bq_receipt_learning_v1';
 const MAX_EXAMPLES=120;
 let currentScan=null;

 const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{"examples":[],"totalLabels":{}}')}catch{return{examples:[],totalLabels:{}}}};
 const save=data=>localStorage.setItem(KEY,JSON.stringify(data));
 const normal=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
 const tokens=s=>new Set(normal(s).split(' ').filter(x=>x.length>2&&!/^(chf|total|summe|betrag|datum|mwst|kasse|beleg|quittung)$/.test(x)));
 const similarity=(a,b)=>{const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let hit=0;A.forEach(x=>B.has(x)&&hit++);return hit/Math.max(A.size,B.size)};
 const parseMoney=s=>{let v=String(s||'').replace(/\s/g,'').replace(/CHF/ig,'');if(v.includes(',')&&v.includes('.'))v=v.lastIndexOf(',')>v.lastIndexOf('.')?v.replace(/\./g,'').replace(',','.'):v.replace(/,/g,'');else v=v.replace(/'/g,'').replace(',','.');const n=Number(v.replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:NaN};
 const amountVariants=n=>{const fixed=Number(n).toFixed(2);return[fixed,fixed.replace('.',','),fixed.replace('.', '. '),fixed.replace('.',', ')];};

 function findLearnedTotal(text,labels){
  const lines=String(text||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const ranked=[];
  lines.forEach((line,index)=>{
   const l=normal(line);
   Object.entries(labels||{}).forEach(([label,count])=>{
    if(!label||!l.includes(label))return;
    const nums=(line.match(/\d{1,6}(?:[ .'’]\d{3})*[.,]\d{2}/g)||[]).map(parseMoney).filter(Number.isFinite);
    nums.forEach(value=>ranked.push({value,score:Number(count||1)*10+index}));
   });
  });
  ranked.sort((a,b)=>b.score-a.score);
  return ranked[0]?.value||0;
 }

 function bestExample(text){
  const data=load();let best=null;
  data.examples.forEach(example=>{const score=similarity(text,example.ocrText);if(!best||score>best.score)best={...example,score}});
  return best&&best.score>=.42?best:null;
 }

 function applyLearning(text){
  const data=load(),match=bestExample(text);
  const merchant=document.getElementById('receiptMerchant');
  const amount=document.getElementById('receiptAmount');
  const category=document.getElementById('receiptCategory');
  const status=document.getElementById('receiptStatus');
  let learned=false;
  if(match){
   if(merchant&&match.merchant){merchant.value=match.merchant;learned=true}
   if(category&&match.category&&[...category.options].some(o=>o.value===match.category||o.textContent===match.category)){category.value=match.category;learned=true}
  }
  const learnedTotal=findLearnedTotal(text,data.totalLabels);
  if(amount&&learnedTotal>0){amount.value=learnedTotal;learned=true}
  if(status&&learned)status.textContent='🧠 Aus deinen bisherigen Korrekturen erkannt – bitte kurz prüfen.';
  currentScan={ocrText:text,detectedMerchant:merchant?.value||'',detectedAmount:Number(amount?.value||0),detectedCategory:category?.value||''};
 }

 function learnTotalLabel(text,correctAmount,data){
  if(!(correctAmount>0))return;
  const variants=amountVariants(correctAmount),lines=String(text||'').split(/\r?\n/);
  for(const line of lines){
   if(!variants.some(v=>line.replace(/\s/g,'').includes(v.replace(/\s/g,''))))continue;
   const before=normal(line.replace(/\d{1,6}(?:[ .'’]\d{3})*[.,]\d{2}.*/,''));
   const label=before.split(' ').filter(x=>x.length>2).slice(-3).join(' ');
   if(label){data.totalLabels[label]=(data.totalLabels[label]||0)+1;break}
  }
 }

 function learnFromCorrection(){
  if(!currentScan?.ocrText)return;
  const merchant=document.getElementById('receiptMerchant')?.value.trim()||'';
  const amount=Number(document.getElementById('receiptAmount')?.value||0);
  const category=document.getElementById('receiptCategory')?.value||'';
  if(!merchant||!(amount>0))return;
  const data=load();
  const fingerprint=normal(currentScan.ocrText).slice(0,800);
  const existing=data.examples.find(x=>similarity(x.ocrText,fingerprint)>=.78);
  if(existing){existing.ocrText=fingerprint;existing.merchant=merchant;existing.category=category;existing.updatedAt=Date.now();existing.uses=(existing.uses||1)+1}
  else data.examples.unshift({ocrText:fingerprint,merchant,category,createdAt:Date.now(),uses:1});
  data.examples=data.examples.slice(0,MAX_EXAMPLES);
  learnTotalLabel(currentScan.ocrText,amount,data);
  save(data);
  sessionStorage.setItem('bq_receipt_learned','1');
 }

 function install(){
  if(typeof window.scanReceipt==='function'&&!window.scanReceipt.__learningWrapped){
   const originalScan=window.scanReceipt;
   const wrapped=async function(file){
    let captured='';
    const tess=window.Tesseract,originalRecognize=tess?.recognize;
    if(originalRecognize)tess.recognize=async function(...args){const result=await originalRecognize.apply(this,args);captured=result?.data?.text||'';return result};
    try{await originalScan(file);if(captured)applyLearning(captured)}finally{if(originalRecognize)tess.recognize=originalRecognize}
   };
   wrapped.__learningWrapped=true;window.scanReceipt=wrapped;
  }
  if(typeof window.saveReceipt==='function'&&!window.saveReceipt.__learningWrapped){
   const originalSave=window.saveReceipt;
   const wrapped=function(event){learnFromCorrection();const result=originalSave(event);currentScan=null;return result};
   wrapped.__learningWrapped=true;window.saveReceipt=wrapped;
  }
  const dialog=document.getElementById('receiptDialog');
  if(dialog&&!document.getElementById('receiptLearningHint')){
   const hint=document.createElement('div');hint.id='receiptLearningHint';hint.className='tiny';hint.style.marginTop='8px';hint.textContent='🧠 BudgetQuest merkt sich deine Korrekturen nur lokal auf diesem iPhone.';
   document.getElementById('receiptStatus')?.after(hint);
  }
 }

 document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install):install();
})();