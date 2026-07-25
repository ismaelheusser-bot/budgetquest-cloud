(()=>{
  const PDF_VERSION='4.10.38';
  const PDF_MODULE=`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VERSION}/pdf.min.mjs`;
  const PDF_WORKER=`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_VERSION}/pdf.worker.min.mjs`;
  const originalImport=window.importReceiptFiles;
  let queue=[];
  let busy=false;

  function formatReceiptAmount(value){
    const amount=typeof value==='number'?value:parseAmount(value);
    return Number.isFinite(amount)&&amount>0?amount.toFixed(2):'';
  }

  function applySwissReceiptFormat(){
    const input=document.getElementById('receiptAmount');
    if(!input)return;
    input.step='0.01';
    input.inputMode='decimal';
    if(input.value)input.value=formatReceiptAmount(input.value);
  }

  function setupReceiptAmountFormatting(){
    const input=document.getElementById('receiptAmount');
    const form=document.getElementById('receiptForm');
    if(!input||!form||input.dataset.swissAmount==='1')return;
    input.dataset.swissAmount='1';
    input.step='0.01';
    input.inputMode='decimal';
    input.addEventListener('blur',applySwissReceiptFormat);
    new MutationObserver(()=>{if(!form.hidden)applySwissReceiptFormat()}).observe(form,{attributes:true,attributeFilter:['hidden']});
  }

  async function loadPdf(){
    const pdfjs=await import(PDF_MODULE);
    pdfjs.GlobalWorkerOptions.workerSrc=PDF_WORKER;
    return pdfjs;
  }

  async function pdfToCanvas(file){
    const pdfjs=await loadPdf();
    const data=await file.arrayBuffer();
    const doc=await pdfjs.getDocument({data}).promise;
    const page=await doc.getPage(1);
    const viewport=page.getViewport({scale:1.8});
    const canvas=document.createElement('canvas');
    canvas.width=Math.round(viewport.width);
    canvas.height=Math.round(viewport.height);
    await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
    return canvas;
  }

  async function processPdf(file){
    const status=document.getElementById('receiptStatus');
    const preview=document.getElementById('receiptPreview');
    const form=document.getElementById('receiptForm');
    form.hidden=true;
    preview.hidden=true;
    status.textContent=`${file.name} wird ausgewertet…`;
    try{
      const canvas=await pdfToCanvas(file);
      preview.src=canvas.toDataURL('image/jpeg',0.88);
      preview.hidden=false;
      const result=await Tesseract.recognize(canvas,'deu');
      const detected=extractFast(result.data.text);
      document.getElementById('receiptMerchant').value=detected.merchant;
      document.getElementById('receiptAmount').value=formatReceiptAmount(detected.amount);
      document.getElementById('receiptCategory').value=budgets.some(b=>b.name===detected.cat)?detected.cat:(budgets[0]?.name||'');
      form.hidden=false;
      status.textContent=detected.amount?'Erkannt – bitte prüfen und übernehmen.':'Betrag nicht sicher erkannt – bitte ergänzen.';
    }catch(error){
      form.hidden=true;
      preview.hidden=true;
      status.textContent='PDF-Import fehlgeschlagen: '+(error?.message||String(error));
    }
  }

  async function runQueue(){
    if(busy)return;
    busy=true;
    while(queue.length){
      await processPdf(queue.shift());
      if(queue.length) break;
    }
    busy=false;
  }

  window.importReceiptFiles=function(files){
    const all=Array.from(files||[]);
    const images=all.filter(f=>f.type.startsWith('image/'));
    const pdfs=all.filter(f=>f.type==='application/pdf'||/\.pdf$/i.test(f.name));
    if(images.length&&typeof originalImport==='function')originalImport(images);
    if(pdfs.length){queue.push(...pdfs);runQueue();}
  };

  function loadReceiptLearning(){
    if(document.querySelector('script[data-receipt-learning]'))return;
    const script=document.createElement('script');
    script.src='./receipt-learning.js?v=1';
    script.dataset.receiptLearning='1';
    document.head.appendChild(script);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{setupReceiptAmountFormatting();loadReceiptLearning()});
  else{setupReceiptAmountFormatting();loadReceiptLearning()}
})();