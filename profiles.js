const profileDefaults=[{id:'isme',name:'Ismael',emoji:'👤'},{id:'partner',name:'Partnerin',emoji:'👤'}];
const BQ_SHARED_FILE_VERSION=20;
const BQ_DEFAULT_CLOUD_FILE='BudgetQuest-Familie-Heusser.json';
let householdProfiles=JSON.parse(localStorage.getItem('bq_profiles')||'null')||profileDefaults;
let activeProfileId=localStorage.getItem('bq_active_profile')||householdProfiles[0].id;

function saveProfiles(){localStorage.setItem('bq_profiles',JSON.stringify(householdProfiles));localStorage.setItem('bq_active_profile',activeProfileId)}
function activeProfile(){return householdProfiles.find(p=>p.id===activeProfileId)||householdProfiles[0]}
function renderProfiles(){
  const p=activeProfile();
  const chip=document.getElementById('profileChip');
  if(chip)chip.innerHTML=`<span>${p.emoji}</span><b>${esc(p.name)}</b>`;
  const list=document.getElementById('profileList');
  if(list)list.innerHTML=householdProfiles.map(x=>`<button class="profile-row ${x.id===activeProfileId?'active':''}" onclick="switchProfile('${x.id}')"><span class="profile-avatar">${x.emoji}</span><span><b>${esc(x.name)}</b><small>${x.id===activeProfileId?'Aktives Profil':'Zum Profil wechseln'}</small></span></button>`).join('');
  ['txOwner','receiptOwner'].forEach(id=>{const el=document.getElementById(id);if(el){el.innerHTML=householdProfiles.map(x=>`<option value="${x.id}" ${x.id===activeProfileId?'selected':''}>${x.emoji} ${esc(x.name)}</option>`).join('')}});
}
function switchProfile(id){activeProfileId=id;saveProfiles();renderProfiles();profileDialog.close();render()}
function addProfile(e){e.preventDefault();const name=document.getElementById('profileName').value.trim();if(!name)return;const id='p'+Date.now().toString(36);householdProfiles.push({id,name,emoji:'👤'});activeProfileId=id;saveProfiles();e.target.reset();renderProfiles();render()}
function renameHousehold(){const value=prompt('Name des Haushalts',household);if(value&&value.trim()){household=value.trim();saveAll();render()}}

function cloudSettings(){
 return{
  folder:localStorage.getItem('bq_icloud_folder')||'iCloud Drive/BudgetQuest',
  filename:localStorage.getItem('bq_icloud_filename')||BQ_DEFAULT_CLOUD_FILE
 };
}
function cleanCloudFilename(value){
 let name=(value||BQ_DEFAULT_CLOUD_FILE).trim().replace(/[\\/:*?"<>|]+/g,'-');
 if(!name.toLowerCase().endsWith('.json'))name+='.json';
 return name||BQ_DEFAULT_CLOUD_FILE;
}
function saveCloudSettings(e){
 if(e)e.preventDefault();
 const folder=(document.getElementById('icloudFolder')?.value||'iCloud Drive/BudgetQuest').trim();
 const filename=cleanCloudFilename(document.getElementById('icloudFilename')?.value);
 localStorage.setItem('bq_icloud_folder',folder);
 localStorage.setItem('bq_icloud_filename',filename);
 const fileInput=document.getElementById('icloudFilename');if(fileInput)fileInput.value=filename;
 setCloudStatus(`Gespeichert: ${folder} / ${filename}`);
}
function nextSharedRevision(){return Number(localStorage.getItem('bq_shared_revision')||0)+1}
function householdBackupData(revision=nextSharedRevision()){
 const editor=activeProfile();
 return{
  format:'budgetquest-household',version:3,appVersion:BQ_SHARED_FILE_VERSION,revision,
  exportedAt:new Date().toISOString(),editedBy:{id:editor?.id||'',name:editor?.name||'Unbekannt'},household,
  profiles:householdProfiles,activeProfileId,settings,budgets,transactions:tx,xp,
  homePlan:JSON.parse(localStorage.getItem('bq_home_plan')||'null'),
  wealth:JSON.parse(localStorage.getItem('bq_wealth')||'null'),
  incomePlan:JSON.parse(localStorage.getItem('bq_income_plan_v1')||'null'),
  budgetStart:localStorage.getItem('bq_budget_start')||null
 };
}
function backupFile(data){
 const filename=cleanCloudFilename(cloudSettings().filename);
 return new File([JSON.stringify(data,null,2)],filename,{type:'application/json'});
}
function setCloudStatus(text,isError=false){const el=document.getElementById('icloudStatus');if(el){el.textContent=text;el.style.color=isError?'#ff8d8d':''}}
async function saveHouseholdToICloud(){
 saveCloudSettings();
 const revision=nextSharedRevision();
 const data=householdBackupData(revision);
 const file=backupFile(data);
 const cfg=cloudSettings();
 setCloudStatus(`Stand ${revision} wird für ${cfg.filename} vorbereitet…`);
 try{
  if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
   await navigator.share({title:`BudgetQuest V${BQ_SHARED_FILE_VERSION} – ${household}`,text:`In ${cfg.folder} speichern und die vorhandene Datei ersetzen.`,files:[file]});
  }else{
   const a=document.createElement('a'),url=URL.createObjectURL(file);a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  localStorage.setItem('bq_shared_revision',String(revision));
  localStorage.setItem('bq_last_cloud_backup',data.exportedAt);
  localStorage.setItem('bq_last_cloud_editor',data.editedBy.name);
  setCloudStatus(`Stand ${revision} von ${data.editedBy.name} erstellt. In ${cfg.folder} speichern und ${cfg.filename} ersetzen.`);
 }catch(err){
  if(err?.name==='AbortError'){setCloudStatus('Sicherung abgebrochen.');return}
  setCloudStatus('Sicherung nicht möglich: '+err.message,true);
 }
}
function chooseICloudBackup(){document.getElementById('icloudImportInput')?.click()}
function downloadHousehold(){saveHouseholdToICloud()}
async function importHousehold(file){
 if(!file)return;
 try{
  const data=JSON.parse(await file.text());
  if(data.format!=='budgetquest-household')throw new Error('Keine BudgetQuest-Haushaltsdatei');
  const stamp=data.exportedAt?new Date(data.exportedAt).toLocaleString('de-CH'):'unbekannt';
  const revision=Number(data.revision||0);
  const editor=data.editedBy?.name||'Unbekannt';
  const currentRevision=Number(localStorage.getItem('bq_shared_revision')||0);
  const warning=revision&&currentRevision&&revision<currentRevision?`\n\nAchtung: Diese Datei ist älter als der Stand ${currentRevision} auf diesem Gerät.`:'';
  if(!confirm(`Gemeinsame Datei – Stand ${revision||'?'}\nGespeichert: ${stamp}\nVon: ${editor}${warning}\n\nAktuelle Daten auf diesem Gerät ersetzen?`)){setCloudStatus('Öffnen abgebrochen.');return}
  household=data.household||household;
  householdProfiles=Array.isArray(data.profiles)&&data.profiles.length?data.profiles:profileDefaults;
  activeProfileId=data.activeProfileId&&householdProfiles.some(p=>p.id===data.activeProfileId)?data.activeProfileId:householdProfiles[0].id;
  settings=data.settings||settings;
  budgets=Array.isArray(data.budgets)?data.budgets:budgets;
  tx=Array.isArray(data.transactions)?data.transactions:tx;
  xp=Number(data.xp||xp);
  if(data.homePlan)localStorage.setItem('bq_home_plan',JSON.stringify(data.homePlan));
  if(data.wealth)localStorage.setItem('bq_wealth',JSON.stringify(data.wealth));
  if(data.incomePlan)localStorage.setItem('bq_income_plan_v1',JSON.stringify(data.incomePlan));
  if(data.budgetStart)localStorage.setItem('bq_budget_start',data.budgetStart);
  localStorage.setItem('bq_setup_done','1');
  localStorage.setItem('bq_shared_revision',String(revision));
  localStorage.setItem('bq_last_cloud_restore',new Date().toISOString());
  localStorage.setItem('bq_last_cloud_editor',editor);
  localStorage.setItem('bq_icloud_filename',cleanCloudFilename(file.name));
  saveProfiles();saveAll();renderProfiles();render();
  setCloudStatus(`Stand ${revision||'?'} von ${editor} geladen.`);
  profileDialog.close();
  alert(`BudgetQuest-Stand ${revision||'?'} von ${editor} wurde geladen.`);
  location.reload();
 }catch(err){setCloudStatus('Import nicht möglich: '+err.message,true);alert('Import nicht möglich: '+err.message)}
 finally{const input=document.getElementById('icloudImportInput');if(input)input.value=''}
}
function installICloudControls(){
 const box=document.querySelector('.cloud-note');if(!box)return;
 const last=localStorage.getItem('bq_last_cloud_backup');
 const revision=localStorage.getItem('bq_shared_revision')||'0';
 const editor=localStorage.getItem('bq_last_cloud_editor')||activeProfile()?.name||'';
 const cfg=cloudSettings();
 box.innerHTML=`<strong>☁️ Gemeinsame iCloud-Datei · Version ${BQ_SHARED_FILE_VERSION}</strong><p>Lege den gewünschten Ordner und Dateinamen fest. Die App merkt sich diese Angaben. iOS öffnet beim Laden und Speichern weiterhin die sichere Dateien-Auswahl.</p><form class="form section" onsubmit="saveCloudSettings(event)"><label>iCloud-Ordner (Merkhilfe)<input id="icloudFolder" value="${esc(cfg.folder)}" placeholder="iCloud Drive/BudgetQuest"></label><label>Gemeinsamer Dateiname<input id="icloudFilename" value="${esc(cfg.filename)}" placeholder="BudgetQuest-Familie-Heusser.json"></label><button class="btn secondary" type="submit">Einstellungen merken</button></form><div class="actions"><button class="btn" type="button" onclick="saveHouseholdToICloud()">Aktuellen Stand speichern</button><button class="btn secondary" type="button" onclick="chooseICloudBackup()">Gemeinsamen Stand öffnen</button></div><input id="icloudImportInput" type="file" accept="application/json,.json" hidden onchange="importHousehold(this.files[0])"><div id="icloudStatus" class="tiny" style="margin-top:10px">${last?`Stand ${revision} · ${editor} · ${new Date(last).toLocaleString('de-CH')}`:'Noch keine gemeinsame Datei gespeichert.'}</div><p class="tiny"><b>Ablauf:</b> Beide verwenden denselben freigegebenen iCloud-Ordner und denselben Dateinamen. Vor dem Bearbeiten zuerst öffnen, danach speichern und die bestehende Datei ersetzen.</p><p class="tiny">Apple-ID und Passwort werden nicht abgefragt oder gespeichert. Eine Web-App darf aus Sicherheitsgründen nicht direkt auf dein iCloud-Konto zugreifen.</p>`;
}

const originalAddTransaction=window.addTransaction;
window.addTransaction=function(e){const before=tx.length;originalAddTransaction(e);if(tx.length>before){tx[tx.length-1].profileId=document.getElementById('txOwner')?.value||activeProfileId;saveAll();render()}};
const originalSaveReceipt=window.saveReceipt;
window.saveReceipt=function(e){const before=tx.length;originalSaveReceipt(e);if(tx.length>before){tx[tx.length-1].profileId=document.getElementById('receiptOwner')?.value||activeProfileId;saveAll();render()}};
const originalRenderTransactions=window.renderTransactions;
window.renderTransactions=function(){originalRenderTransactions();document.querySelectorAll('.transaction-shell').forEach(shell=>{const i=Number(shell.dataset.index),t=tx[i],p=householdProfiles.find(x=>x.id===(t?.profileId||''));const meta=shell.querySelector('.tx-meta');if(meta&&p)meta.insertAdjacentHTML('beforeend',` · ${p.emoji} ${esc(p.name)}`)})};
const originalSaveAll=window.saveAll;
window.saveAll=function(){originalSaveAll();saveProfiles()};
renderProfiles();render();installICloudControls();
const proScript=document.createElement('script');proScript.src='pro.js?v=30';document.body.appendChild(proScript);