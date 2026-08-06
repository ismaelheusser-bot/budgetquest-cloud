(()=>{
  const DIALOG_ID='transactionDeleteConfirm';
  const STYLE_ID='transactionDeleteSafetyStyles';
  const originalRemove=typeof removeTransaction==='function'?removeTransaction:null;
  let pendingIndex=null;

  function closeRow(shell){
    const row=shell?.querySelector('.transaction');
    if(row)row.style.transform='translateX(0)';
    shell?.classList.remove('delete-revealed','swipe-ready','swipe-dragging');
  }

  function closeOtherRows(current){
    document.querySelectorAll('.transaction-shell.delete-revealed').forEach(shell=>{
      if(shell!==current)closeRow(shell);
    });
  }

  function ensureStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .transaction-shell{position:relative;overflow:hidden}
      .transaction-shell .transaction{touch-action:pan-y;user-select:none;-webkit-user-select:none;transition:transform .2s ease}
      .transaction-shell.swipe-dragging .transaction{transition:none!important}
      .transaction-shell .delete-bg{width:128px;display:flex;align-items:center;justify-content:center;gap:6px;font-weight:800;cursor:pointer;user-select:none;-webkit-user-select:none}
      .transaction-shell .delete-bg:before{content:'🗑️'}
      .transaction-shell:not(.delete-revealed) .delete-bg{pointer-events:none}
      .transaction-shell.delete-revealed .delete-bg{pointer-events:auto}
      .transaction-shell.swipe-ready .delete-bg{filter:brightness(1.12)}
      .transaction-delete-confirm{width:min(430px,calc(100% - 24px));border:1px solid var(--line);border-radius:22px;background:var(--card);color:inherit;padding:0;box-shadow:0 24px 70px #000a}
      .transaction-delete-confirm::backdrop{background:#020813bb;backdrop-filter:blur(4px)}
      .transaction-delete-confirm-inner{padding:22px}
      .transaction-delete-confirm-icon{width:50px;height:50px;border-radius:16px;display:grid;place-items:center;background:#ef66731c;border:1px solid #ef667355;font-size:25px;margin-bottom:14px}
      .transaction-delete-confirm h3{margin:0 0 8px;font-size:22px}
      .transaction-delete-confirm p{margin:0;color:var(--muted);line-height:1.5}
      .transaction-delete-summary{margin:16px 0;background:#0d1728;border:1px solid var(--line);border-radius:15px;padding:13px;display:grid;gap:4px}
      .transaction-delete-summary strong{font-size:16px}
      .transaction-delete-summary span{color:var(--muted);font-size:12px}
      .transaction-delete-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}
      .transaction-delete-danger{background:#d94f5d!important;border-color:#ef6673!important;color:white!important}
      @media(max-width:420px){.transaction-delete-actions{grid-template-columns:1fr}.transaction-delete-danger{order:-1}}
    `;
    document.head.appendChild(style);
  }

  function ensureDialog(){
    let dialog=document.getElementById(DIALOG_ID);
    if(dialog)return dialog;
    dialog=document.createElement('dialog');
    dialog.id=DIALOG_ID;
    dialog.className='transaction-delete-confirm';
    dialog.innerHTML=`<div class="transaction-delete-confirm-inner"><div class="transaction-delete-confirm-icon">🗑️</div><h3>Buchung wirklich löschen?</h3><p>Die Buchung wird erst nach deiner Bestätigung entfernt.</p><div class="transaction-delete-summary"><strong id="transactionDeleteTitle">Buchung</strong><span id="transactionDeleteMeta"></span></div><div class="transaction-delete-actions"><button type="button" class="btn secondary" id="transactionDeleteCancel">Abbrechen</button><button type="button" class="btn transaction-delete-danger" id="transactionDeleteConfirmButton">Endgültig löschen</button></div></div>`;
    document.body.appendChild(dialog);
    dialog.querySelector('#transactionDeleteCancel').onclick=()=>{pendingIndex=null;dialog.close()};
    dialog.querySelector('#transactionDeleteConfirmButton').onclick=()=>{
      const index=pendingIndex;
      pendingIndex=null;
      dialog.close();
      if(Number.isInteger(index)&&originalRemove)originalRemove(index);
    };
    dialog.addEventListener('cancel',()=>{pendingIndex=null});
    dialog.addEventListener('click',event=>{
      if(event.target===dialog){pendingIndex=null;dialog.close()}
    });
    return dialog;
  }

  function requestDelete(shell){
    if(!shell?.classList.contains('delete-revealed'))return;
    const index=Number(shell.dataset.index);
    if(!Number.isInteger(index))return;
    pendingIndex=index;
    const title=shell.querySelector('.tx-title')?.textContent?.trim()||'Buchung';
    const meta=shell.querySelector('.tx-meta')?.textContent?.trim()||'';
    const amount=shell.querySelector('.transaction>strong')?.textContent?.trim()||'';
    const dialog=ensureDialog();
    dialog.querySelector('#transactionDeleteTitle').textContent=title+(amount?' · '+amount:'');
    dialog.querySelector('#transactionDeleteMeta').textContent=meta;
    dialog.showModal();
  }

  function prepareShell(shell){
    if(!shell||shell.dataset.safeDeleteReady==='1')return;
    let row=shell.querySelector('.transaction');
    const background=shell.querySelector('.delete-bg');
    if(!row||!background)return;

    const cleanRow=row.cloneNode(true);
    row.replaceWith(cleanRow);
    row=cleanRow;
    shell.dataset.safeDeleteReady='1';
    background.textContent='Löschen';
    background.setAttribute('role','button');
    background.setAttribute('aria-label','Buchung löschen');
    background.tabIndex=0;

    let startX=0,startY=0,delta=0,active=false,horizontal=false,pointerId=null;
    const reset=()=>{delta=0;active=false;horizontal=false;pointerId=null;shell.classList.remove('swipe-dragging','swipe-ready')};
    const finish=()=>{
      if(!active)return;
      const reveal=horizontal&&delta<=-96;
      if(reveal){
        row.style.transform='translateX(-118px)';
        shell.classList.add('delete-revealed');
      }else closeRow(shell);
      reset();
    };

    row.addEventListener('pointerdown',event=>{
      if(event.pointerType==='mouse'&&event.button!==0)return;
      closeOtherRows(shell);
      startX=event.clientX;startY=event.clientY;delta=0;active=true;horizontal=false;pointerId=event.pointerId;
      try{row.setPointerCapture(pointerId)}catch(_){ }
    });
    row.addEventListener('pointermove',event=>{
      if(!active||event.pointerId!==pointerId)return;
      const dx=event.clientX-startX,dy=event.clientY-startY;
      if(!horizontal){
        if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>10){reset();return}
        if(dx>-14||Math.abs(dx)<14)return;
        horizontal=true;shell.classList.add('swipe-dragging');
      }
      event.preventDefault();
      delta=Math.max(-128,Math.min(0,dx));
      row.style.transform=`translateX(${delta}px)`;
      shell.classList.toggle('swipe-ready',delta<=-96);
    });
    row.addEventListener('pointerup',finish);
    row.addEventListener('pointercancel',()=>{closeRow(shell);reset()});
    row.addEventListener('click',event=>{
      if(shell.classList.contains('delete-revealed')){
        event.preventDefault();event.stopPropagation();closeRow(shell);
      }
    });
    background.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();requestDelete(shell)});
    background.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();requestDelete(shell)}
    });
  }

  function bindSafeDeletion(){
    document.querySelectorAll('.transaction-shell').forEach(prepareShell);
  }

  function start(){
    ensureStyles();ensureDialog();bindSafeDeletion();
    const list=document.getElementById('transactionsList');
    if(list){
      new MutationObserver(()=>queueMicrotask(bindSafeDeletion)).observe(list,{childList:true,subtree:true});
    }
  }

  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start):start();
})();
