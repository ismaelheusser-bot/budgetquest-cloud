(function(global){
'use strict';

const storage=global.budgetQuestStorage;
const keys=global.BudgetQuestStorageKeys;

const number=(value,fallback=0)=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:fallback};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const array=value=>Array.isArray(value)?value:[];

function normalizeProfiles(value){
 const source=array(value);
 const cleaned=source.map((profile,index)=>({
  id:String(profile?.id||`legacy-${index+1}`),
  name:String(profile?.name||`Profil ${index+1}`),
  emoji:String(profile?.emoji||'👤')
 })).filter(profile=>profile.id&&profile.name);
 return cleaned.length?cleaned:[{id:'isme',name:'Ismael',emoji:'👤'},{id:'partner',name:'Partnerin',emoji:'👤'}];
}

function normalizeHomePlan(value){
 const plan=object(value);
 return {
  equity:Math.max(0,number(plan.equity??plan.eigenkapital)),
  annualGross:Math.max(0,number(plan.annualGross??plan.grossIncome??plan.bruttoJahr)),
  monthlySaving:Math.max(0,number(plan.monthlySaving??plan.monthlySavings??plan.saving)),
  pillar3aBalance:Math.max(0,number(plan.pillar3aBalance??plan.pillar3a??plan.saeule3a)),
  pillar3aAnnual:Math.max(0,number(plan.pillar3aAnnual??plan.annual3a)),
  pillar3aMode:['withdraw','pledge','none'].includes(plan.pillar3aMode)?plan.pillar3aMode:'withdraw',
  incomeGrowth:Math.max(0,number(plan.incomeGrowth)),
  equityShare:Math.max(0,number(plan.equityShare,20)),
  affordabilityShare:Math.max(1,number(plan.affordabilityShare,33)),
  calcInterest:Math.max(0,number(plan.calcInterest,5)),
  maintenance:Math.max(0,number(plan.maintenance,1)),
  amortizationYears:Math.max(1,number(plan.amortizationYears,15))
 };
}

function normalizeWealth(value){
 const wealth=object(value);
 return {
  cash:Math.max(0,number(wealth.cash)),pillar3a:Math.max(0,number(wealth.pillar3a??wealth.saeule3a)),
  etf:Math.max(0,number(wealth.etf)),stocks:Math.max(0,number(wealth.stocks)),
  crypto:Math.max(0,number(wealth.crypto)),other:Math.max(0,number(wealth.other))
 };
}

function normalizeBackup(raw){
 const data=object(raw);
 if(data.format&&data.format!=='budgetquest-household')throw new Error('Keine BudgetQuest-Haushaltsdatei');
 const profiles=normalizeProfiles(data.profiles??data.householdProfiles);
 const active=String(data.activeProfileId||data.activeProfile||profiles[0].id);
 return {
  format:'budgetquest-household',version:3,appVersion:number(data.appVersion??data.version,1),
  revision:Math.max(0,number(data.revision)),exportedAt:data.exportedAt||null,
  editedBy:object(data.editedBy),household:String(data.household||data.householdName||'Mein Haushalt'),
  profiles,activeProfileId:profiles.some(profile=>profile.id===active)?active:profiles[0].id,
  settings:{...object(typeof settings!=='undefined'?settings:{}),...object(data.settings)},
  budgets:array(data.budgets).map(item=>({name:String(item?.name||item?.category||'Budget'),limit:Math.max(0,number(item?.limit??item?.amount))})),
  transactions:array(data.transactions??data.tx).map(item=>({...object(item),title:String(item?.title||item?.name||'Buchung'),amount:number(item?.amount),cat:String(item?.cat||item?.category||'Sonstiges'),date:item?.date||new Date().toISOString().slice(0,10)})),
  xp:Math.max(0,number(data.xp)),homePlan:normalizeHomePlan(data.homePlan),wealth:normalizeWealth(data.wealth),
  incomePlan:object(data.incomePlan),budgetStart:data.budgetStart||null
 };
}

async function importLegacyCompatible(file){
 if(!file)return;
 try{
  const data=normalizeBackup(JSON.parse(await file.text()));
  const stamp=data.exportedAt?new Date(data.exportedAt).toLocaleString('de-CH'):'unbekannt';
  const editor=data.editedBy?.name||'Unbekannt';
  const currentRevision=number(storage.get(keys.sharedRevision,0));
  const warning=data.revision&&currentRevision&&data.revision<currentRevision?`\n\nAchtung: Diese Datei ist älter als der Stand ${currentRevision} auf diesem Gerät.`:'';
  if(!confirm(`BudgetQuest-Backup – Stand ${data.revision||'?'}\nGespeichert: ${stamp}\nVon: ${editor}${warning}\n\nAktuelle Daten auf diesem Gerät ersetzen?`)){global.setCloudStatus?.('Öffnen abgebrochen.');return}

  household=data.household;
  householdProfiles=data.profiles;
  activeProfileId=data.activeProfileId;
  settings=data.settings;
  budgets=data.budgets;
  tx=data.transactions;
  xp=data.xp;
  homePlan=data.homePlan;

  storage.set(keys.homePlan,data.homePlan);
  storage.set(keys.wealth,data.wealth);
  storage.set(keys.incomePlan,data.incomePlan);
  if(data.budgetStart)storage.set(keys.budgetStart,data.budgetStart);
  storage.set(keys.setupComplete,'1');
  storage.set(keys.sharedRevision,String(data.revision));
  storage.set(keys.lastCloudRestore,new Date().toISOString());
  storage.set(keys.lastCloudEditor,editor);
  storage.set(keys.iCloudFilename,global.cleanCloudFilename?global.cleanCloudFilename(file.name):file.name);

  saveProfiles();saveAll();renderProfiles();render();
  global.setCloudStatus?.(`Stand ${data.revision||'?'} von ${editor} geladen und auf das aktuelle Format migriert.`);
  global.profileDialog?.close();
  alert(`BudgetQuest-Stand ${data.revision||'?'} wurde vollständig importiert und aktualisiert.`);
  location.reload();
 }catch(error){
  const message='Import nicht möglich: '+(error?.message||String(error));
  global.setCloudStatus?.(message,true);alert(message);
 }finally{
  const input=document.getElementById('icloudImportInput');if(input)input.value='';
 }
}

function install(){
 if(typeof global.importHousehold!=='function')return false;
 global.importHousehold=importLegacyCompatible;
 global.BudgetQuestLegacyImport={normalizeBackup,importLegacyCompatible};
 return true;
}

let attempts=0;
const timer=global.setInterval(()=>{attempts+=1;if(install()||attempts>100)global.clearInterval(timer)},100);
})(window);
