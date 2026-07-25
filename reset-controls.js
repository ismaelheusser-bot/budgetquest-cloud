(()=>{
  const TX_KEY='bq_tx';
  const START_KEY='bq_budget_start';
  const currentMonthStart=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`};
  const readTx=()=>{try{return JSON.parse(localStorage.getItem(TX_KEY)||'[]')}catch{return[]}};
  const writeTx=rows=>localStorage.setItem(TX_KEY,JSON.stringify(rows));

  function clearAllTransactions(){
    const rows=readTx();
    if(!rows.length){alert('Es sind keine Buchungen vorhanden.');return}
    if(!confirm(`Wirklich alle ${rows.length} Buchungen löschen und frisch ab diesem Monat starten?\n\nLöhne, Fixkosten, Budgets und Sparziele bleiben bestehen.`))return;
    writeTx([]);
    localStorage.setItem(START_KEY,currentMonthStart());
    localStorage.removeItem('bq_transfer_ledger');
    localStorage.removeItem('bq_income_sources');
    location.reload();
  }

  function addToolbar(){
    const section=document.getElementById('transactions');
    const actions=section?.querySelector('.section-head .actions');
    if(!actions||document.getElementById('clearAllTransactionsBtn'))return;
    const btn=document.createElement('button');
    btn.id='clearAllTransactionsBtn';
    btn.className='btn danger';
    btn.type='button';
    btn.textContent='🗑 Alle Buchungen löschen';
    btn.onclick=clearAllTransactions;
    actions.appendChild(btn);

    const note=document.createElement('div');
    note.className='info-note section';
    note.innerHTML=`<strong>Budgetstart: ${new Date().toLocaleDateString('de-CH',{month:'long',year:'numeric'})}</strong><br>Mit „Alle Buchungen löschen“ startest du bei CHF 0.00. Deine Budget- und Lohneinstellungen bleiben erhalten.`;
    section.querySelector('.section-head')?.insertAdjacentElement('afterend',note);
  }

  function enhanceRows(){
    const stored=readTx();
    const sorted=stored.map((t,i)=>({...t,_storageIndex:i})).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
    document.querySelectorAll('#transactionsList .transaction-shell').forEach((shell,visibleIndex)=>{
      if(shell.querySelector('.tx-delete-visible'))return;
      const item=sorted[visibleIndex];
      if(!item)return;
      const row=shell.querySelector('.transaction');
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='btn danger tx-delete-visible';
      btn.textContent='Löschen';
      btn.style.marginLeft='12px';
      btn.onclick=e=>{
        e.stopPropagation();
        if(!confirm(`Buchung „${item.title||'Ohne Bezeichnung'}“ löschen?`))return;
        const rows=readTx();
        rows.splice(item._storageIndex,1);
        writeTx(rows);
        location.reload();
      };
      row.appendChild(btn);
    });
  }

  window.clearAllBudgetQuestTransactions=clearAllTransactions;
  addToolbar();
  enhanceRows();
  const list=document.getElementById('transactionsList');
  if(list)new MutationObserver(enhanceRows).observe(list,{childList:true,subtree:true});
})();
