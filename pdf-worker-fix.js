(()=>{
  const PDF_VERSION='4.10.38';
  const WORKER_URL=`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VERSION}/pdf.worker.min.mjs`;

  function configurePdfWorker(){
    const pdf=window.pdfjsLib;
    if(!pdf?.GlobalWorkerOptions)return false;
    if(pdf.GlobalWorkerOptions.workerSrc!==WORKER_URL){
      pdf.GlobalWorkerOptions.workerSrc=WORKER_URL;
    }
    return true;
  }

  const timer=setInterval(()=>{
    if(configurePdfWorker())clearInterval(timer);
  },25);
  setTimeout(()=>clearInterval(timer),15000);

  document.addEventListener('change',event=>{
    const input=event.target;
    if(!(input instanceof HTMLInputElement)||input.type!=='file')return;
    const receiptDialog=input.closest('#receiptDialog');
    if(!receiptDialog)return;
    const form=document.getElementById('receiptForm');
    const status=document.getElementById('receiptStatus');
    if(form)form.hidden=true;
    if(status)status.textContent='Datei wird vorbereitet…';
    configurePdfWorker();
  },true);
})();
