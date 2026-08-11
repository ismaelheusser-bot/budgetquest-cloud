(()=>{
  'use strict';

  const SDK_VERSION='12.16.0';
  const COLLECTION='pushReminders';
  const FINGERPRINT_KEY='bq:push-reminder-tx-fingerprint';
  const STYLE_ID='pushReminderStyles';
  let messagingApi=null;
  let messaging=null;
  let registeredUnsubscribe=null;
  let syncTimer=null;

  const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
  const el=id=>document.getElementById(id);
  const currentInterval=()=>Number(el('pushReminderInterval')?.value||3)===2?2:3;
  const messagingUrl=()=>`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-messaging.js`;

  function transactionFingerprint(){
    try{
      const rows=budgetQuestStorage.get(BudgetQuestStorageKeys.transactions,[]);
      if(!Array.isArray(rows)||!rows.length)return '0';
      const tail=rows.slice(-8).map(row=>`${row.date||''}|${row.title||''}|${row.amount||''}|${row.cat||''}`).join('~');
      return `${rows.length}:${tail}`;
    }catch(_){return 'unknown'}
  }

  function setStatus(text,tone=''){
    const node=el('pushReminderStatus');
    if(!node)return;
    node.textContent=text;
    node.dataset.tone=tone;
  }

  function installStyles(){
    if(el(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .push-reminder-card{display:grid;gap:12px}
      .push-reminder-row{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end}
      .push-reminder-row label{display:grid;gap:6px;color:var(--muted);font-size:12px}
      .push-reminder-row select{min-width:122px;border:1px solid #31425f;border-radius:12px;padding:10px 12px;background:#0d1728;color:#fff}
      .push-reminder-actions{display:flex;gap:8px;flex-wrap:wrap}
      .push-reminder-status{font-size:12px;color:var(--muted);line-height:1.45}
      .push-reminder-status[data-tone="ok"]{color:var(--green)}
      .push-reminder-status[data-tone="warn"]{color:#f0b83f}
      .push-reminder-status[data-tone="bad"]{color:#ef6673}
      @media(max-width:520px){.push-reminder-row{grid-template-columns:1fr}.push-reminder-row select{width:100%}.push-reminder-actions .btn{flex:1}}
    `;
    document.head.appendChild(style);
  }

  function ensureUI(){
    installStyles();
    if(el('pushReminderCard'))return;
    const dialog=el('profileDialog');
    if(!dialog)return;
    const card=document.createElement('div');
    card.id='pushReminderCard';
    card.className='cloud-note section push-reminder-card';
    card.innerHTML=`
      <div><strong>🔔 Buchungs-Erinnerungen</strong><p>BudgetQuest erinnert dich automatisch, deine Buchungen nachzutragen.</p></div>
      <div class="push-reminder-row">
        <label>Rhythmus<select id="pushReminderInterval"><option value="2">Alle 2 Tage</option><option value="3" selected>Alle 3 Tage</option></select></label>
        <div class="push-reminder-actions"><button type="button" class="btn" id="pushReminderEnable">Push aktivieren</button><button type="button" class="btn secondary" id="pushReminderDisable" hidden>Ausschalten</button></div>
      </div>
      <div id="pushReminderStatus" class="push-reminder-status">Status wird geladen …</div>
    `;
    const anchor=el('firebaseAccount');
    if(anchor)anchor.after(card);else dialog.appendChild(card);
    el('pushReminderEnable').addEventListener('click',enablePush);
    el('pushReminderDisable').addEventListener('click',disablePush);
    el('pushReminderInterval').addEventListener('change',saveInterval);
  }

  async function firebaseContext(){
    if(!window.budgetQuestFirebaseReady)throw new Error('Firebase ist noch nicht bereit.');
    return window.budgetQuestFirebaseReady;
  }

  async function reminderRef(){
    const ctx=await firebaseContext();
    const user=ctx.auth.currentUser;
    if(!user)return {ctx,user:null,ref:null};
    return {ctx,user,ref:ctx.firestoreApi.doc(ctx.db,COLLECTION,user.uid)};
  }

  async function writeReminder(fields){
    const {ctx,user,ref}=await reminderRef();
    if(!user||!ref)throw new Error('Bitte zuerst bei BudgetQuest Cloud anmelden.');
    await ctx.firestoreApi.setDoc(ref,{uid:user.uid,email:user.email||'',...fields},{merge:true});
    return {ctx,user,ref};
  }

  async function saveFid(fid){
    if(!fid)return;
    try{
      const {ctx}=await firebaseContext();
      await writeReminder({fid:String(fid),registrationUpdatedAt:ctx.firestoreApi.serverTimestamp(),updatedAt:ctx.firestoreApi.serverTimestamp()});
    }catch(error){console.warn('BudgetQuest Push FID konnte nicht gespeichert werden',error)}
  }

  async function ensureMessagingRegistration(){
    const {app}=await firebaseContext();
    if(!('serviceWorker' in navigator))throw new Error('Service Worker werden auf diesem Gerät nicht unterstützt.');
    const swRegistration=await navigator.serviceWorker.ready;
    if(!messagingApi)messagingApi=await import(messagingUrl());
    if(!messaging)messaging=messagingApi.getMessaging(app);

    if(typeof messagingApi.onRegistered==='function'&&typeof messagingApi.register==='function'){
      if(!registeredUnsubscribe){
        registeredUnsubscribe=messagingApi.onRegistered(messaging,fid=>saveFid(fid));
      }
      const options={serviceWorkerRegistration:swRegistration};
      if(window.BudgetQuestWebPushVapidKey)options.vapidKey=window.BudgetQuestWebPushVapidKey;
      await messagingApi.register(messaging,options);
      return;
    }

    if(typeof messagingApi.getToken==='function'){
      const options={serviceWorkerRegistration:swRegistration};
      if(window.BudgetQuestWebPushVapidKey)options.vapidKey=window.BudgetQuestWebPushVapidKey;
      const token=await messagingApi.getToken(messaging,options);
      if(!token)throw new Error('Es konnte keine Push-Registrierung erstellt werden.');
      const {ctx}=await firebaseContext();
      await writeReminder({token,registrationUpdatedAt:ctx.firestoreApi.serverTimestamp(),updatedAt:ctx.firestoreApi.serverTimestamp()});
      return;
    }
    throw new Error('Firebase Messaging wird von diesem Browser nicht unterstützt.');
  }

  async function enablePush(){
    ensureUI();
    const button=el('pushReminderEnable');
    try{
      button.disabled=true;
      setStatus('Push wird eingerichtet …');
      const {ctx,user}=await reminderRef();
      if(!user)throw new Error('Bitte zuerst bei BudgetQuest Cloud anmelden.');
      if(isIOS()&&!isStandalone())throw new Error('Auf dem iPhone funktioniert Push nur mit der installierten BudgetQuest-App. Bitte zuerst „Zum Home-Bildschirm“ wählen.');
      if(!('Notification' in window))throw new Error('Push-Benachrichtigungen werden auf diesem Gerät nicht unterstützt.');
      const permission=await Notification.requestPermission();
      if(permission!=='granted')throw new Error('Benachrichtigungen wurden nicht erlaubt. Du kannst die Berechtigung in den iPhone-Einstellungen ändern.');
      await ensureMessagingRegistration();
      await writeReminder({
        enabled:true,
        intervalDays:currentInterval(),
        enabledAt:ctx.firestoreApi.serverTimestamp(),
        lastTransactionAt:ctx.firestoreApi.serverTimestamp(),
        updatedAt:ctx.firestoreApi.serverTimestamp()
      });
      localStorage.setItem(FINGERPRINT_KEY,transactionFingerprint());
      await loadState();
    }catch(error){
      console.warn('BudgetQuest Push konnte nicht aktiviert werden',error);
      setStatus(error?.message||'Push konnte nicht aktiviert werden.','bad');
    }finally{button.disabled=false}
  }

  async function disablePush(){
    const button=el('pushReminderDisable');
    try{
      button.disabled=true;
      const {ctx}=await firebaseContext();
      await writeReminder({enabled:false,updatedAt:ctx.firestoreApi.serverTimestamp()});
      await loadState();
    }catch(error){setStatus(error?.message||'Push konnte nicht ausgeschaltet werden.','bad')}
    finally{button.disabled=false}
  }

  async function saveInterval(){
    try{
      const {ctx,user,ref}=await reminderRef();
      if(!user||!ref)return;
      const snap=await ctx.firestoreApi.getDoc(ref);
      if(!snap.exists()||!snap.data()?.enabled)return;
      await ctx.firestoreApi.setDoc(ref,{intervalDays:currentInterval(),updatedAt:ctx.firestoreApi.serverTimestamp()},{merge:true});
      setStatus(`Aktiv · Erinnerung alle ${currentInterval()} Tage`,'ok');
    }catch(error){setStatus('Rhythmus konnte nicht gespeichert werden.','bad')}
  }

  async function syncTransactionActivity(force=false){
    clearTimeout(syncTimer);
    syncTimer=setTimeout(async()=>{
      try{
        const fingerprint=transactionFingerprint();
        const previous=localStorage.getItem(FINGERPRINT_KEY);
        if(!force&&previous===null){localStorage.setItem(FINGERPRINT_KEY,fingerprint);return}
        if(!force&&previous===fingerprint)return;
        const {ctx,user,ref}=await reminderRef();
        if(!user||!ref){localStorage.setItem(FINGERPRINT_KEY,fingerprint);return}
        const snap=await ctx.firestoreApi.getDoc(ref);
        if(snap.exists()&&snap.data()?.enabled){
          await ctx.firestoreApi.setDoc(ref,{lastTransactionAt:ctx.firestoreApi.serverTimestamp(),updatedAt:ctx.firestoreApi.serverTimestamp()},{merge:true});
        }
        localStorage.setItem(FINGERPRINT_KEY,fingerprint);
      }catch(error){console.warn('BudgetQuest Push Aktivität konnte nicht synchronisiert werden',error)}
    },450);
  }

  async function loadState(){
    ensureUI();
    try{
      const {ctx,user,ref}=await reminderRef();
      const enable=el('pushReminderEnable'),disable=el('pushReminderDisable'),select=el('pushReminderInterval');
      if(!user||!ref){
        enable.hidden=false;disable.hidden=true;select.disabled=true;
        setStatus('Für Push-Erinnerungen bitte zuerst bei BudgetQuest Cloud anmelden.','warn');
        return;
      }
      select.disabled=false;
      const snap=await ctx.firestoreApi.getDoc(ref);
      const data=snap.exists()?snap.data():{};
      const enabled=data.enabled===true;
      select.value=String(Number(data.intervalDays)===2?2:3);
      enable.hidden=enabled;disable.hidden=!enabled;
      if(enabled){
        setStatus(`Aktiv · Erinnerung alle ${Number(data.intervalDays)===2?2:3} Tage`,'ok');
        if(Notification.permission==='granted')ensureMessagingRegistration().catch(error=>console.warn('Push-Registrierung konnte nicht erneuert werden',error));
        syncTransactionActivity(false);
      }else{
        setStatus(Notification.permission==='denied'?'Benachrichtigungen sind auf diesem Gerät blockiert.':'Push-Erinnerungen sind ausgeschaltet.',Notification.permission==='denied'?'bad':'');
      }
    }catch(error){
      console.warn('BudgetQuest Push Status konnte nicht geladen werden',error);
      setStatus('Push-Status konnte nicht geladen werden.','bad');
    }
  }

  function openRequestedScreen(){
    const params=new URLSearchParams(location.search);
    const target=params.get('screen');
    if(!target)return;
    setTimeout(()=>{
      const screen=el(target);
      if(!screen)return;
      document.querySelectorAll('.screen').forEach(node=>node.classList.remove('active'));
      document.querySelectorAll('.nav button').forEach(node=>node.classList.toggle('active',node.dataset.target===target));
      screen.classList.add('active');
      params.delete('screen');
      const query=params.toString();
      history.replaceState(null,'',location.pathname+(query?'?'+query:'')+location.hash);
      window.scrollTo({top:0,behavior:'smooth'});
    },350);
  }

  function observeTransactions(){
    const list=el('transactionsList');
    if(!list||list.dataset.pushReminderObserved)return;
    list.dataset.pushReminderObserved='1';
    new MutationObserver(()=>syncTransactionActivity(false)).observe(list,{childList:true,subtree:true,characterData:true});
  }

  function start(){
    ensureUI();
    openRequestedScreen();
    observeTransactions();
    loadState();
    window.addEventListener('focus',()=>{ensureUI();observeTransactions();loadState()});
    window.addEventListener('bq:cloud-synced',()=>{observeTransactions();syncTransactionActivity(false)});
  }

  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start):start();
})();