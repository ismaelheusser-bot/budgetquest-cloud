'use strict';

const {onSchedule}=require('firebase-functions/v2/scheduler');
const {initializeApp}=require('firebase-admin/app');
const {getFirestore,Timestamp}=require('firebase-admin/firestore');
const {getMessaging}=require('firebase-admin/messaging');

initializeApp();

const DAY_MS=24*60*60*1000;
const APP_URL='https://budgetquest-cloud.web.app/?screen=transactions';

function millis(value){
  return value&&typeof value.toMillis==='function'?value.toMillis():0;
}

exports.sendBookkeepingReminders=onSchedule({
  schedule:'30 19 * * *',
  timeZone:'Europe/Zurich',
  region:'europe-west6',
  retryCount:0
},async()=>{
  const db=getFirestore();
  const snapshot=await db.collection('pushReminders').where('enabled','==',true).get();
  const now=Date.now();

  const jobs=snapshot.docs.map(async doc=>{
    const data=doc.data()||{};
    const fid=String(data.fid||'').trim();
    const token=String(data.token||'').trim();
    if(!fid&&!token)return;

    const intervalDays=Number(data.intervalDays)===2?2:3;
    const anchor=Math.max(
      millis(data.lastTransactionAt),
      millis(data.lastSentAt),
      millis(data.enabledAt)
    );
    if(!anchor||now-anchor<intervalDays*DAY_MS)return;

    const message={
      notification:{
        title:'BudgetQuest',
        body:'Zeit, deine Buchungen nachzutragen. So bleibt dein Budget aktuell.'
      },
      data:{
        kind:'bookkeeping-reminder',
        screen:'transactions'
      },
      webpush:{
        fcmOptions:{link:APP_URL}
      }
    };
    if(fid)message.fid=fid;else message.token=token;

    try{
      await getMessaging().send(message);
      await doc.ref.set({
        lastSentAt:Timestamp.now(),
        lastError:null,
        lastErrorAt:null
      },{merge:true});
    }catch(error){
      console.error('Push reminder failed',doc.id,error);
      await doc.ref.set({
        lastError:String(error?.code||error?.message||error).slice(0,300),
        lastErrorAt:Timestamp.now()
      },{merge:true});
    }
  });

  await Promise.allSettled(jobs);
});
