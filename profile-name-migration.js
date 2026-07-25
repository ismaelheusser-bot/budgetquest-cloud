(()=>{
  if(typeof householdProfiles==='undefined'||!Array.isArray(householdProfiles))return;
  let changed=false;
  householdProfiles=householdProfiles.map((profile,index)=>{
    const name=String(profile?.name||'').trim();
    if(profile?.id==='partner'||/^partnerin$/i.test(name)||(!name&&index===1)){
      changed=changed||name!=='Sarah Heusser';
      return{...profile,id:profile?.id||'partner',name:'Sarah Heusser',emoji:profile?.emoji||'👤'};
    }
    if(profile?.id==='isme'&&/^ismael$/i.test(name)){
      changed=true;
      return{...profile,name:'Ismael Heusser'};
    }
    return profile;
  });
  if(changed){saveProfiles();renderProfiles();}
})();