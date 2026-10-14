(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.StudyCloudSync=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const allowed=k=>/^(study-v1|study-drill-v1|bed-v1):[^\r\n]{1,400}$/.test(k);
  function create({storage,request,uuid,onStatus=()=>{},onRemote=()=>{}}){
    const metaKey='wengu-private-sync-v1';
    let state;try{state=JSON.parse(storage.getItem(metaKey)||'null');}catch{}
    state=state&&state.format===1?state:{format:1,owner:null,versions:{},pending:{},conflicts:{}};
    let active=false,running=false,timer;
    const save=()=>storage.setItem(metaKey,JSON.stringify(state));
    const status=message=>onStatus({message,conflicts:state.conflicts,pending:Object.keys(state.pending).length});
    function reload(){const latest=JSON.parse(storage.getItem(metaKey)||'null');if(latest?.format===1){for(const k of Object.keys(state))delete state[k];Object.assign(state,latest);}}
    function enqueue(key,value){
      if(!allowed(key))return;
      reload();
      const old=state.pending[key];
      state.pending[key]={key,value,baseVersion:old?old.baseVersion:(state.versions[key]||0),requestId:uuid()};
      save();status(active?'本机已保存，等待同步':'未登录 · 本机已保存');clearTimeout(timer);timer=setTimeout(()=>sync(),800);
    }
    function apply(row){state.versions[row.key]=row.version;if(storage.getItem(row.key)!==row.value){storage.setItem(row.key,row.value);onRemote(row.key,row.value);}}
    async function sync(){
      if(!active||running)return;
      running=true;
      try{
        const snapshot=await request('GET');
        reload();
        if(state.owner&&state.owner!==snapshot.owner){active=false;throw Error('账号与本机草稿不匹配，请退出');}
        state.owner=snapshot.owner;
        const remote=new Map(snapshot.items.map(x=>[x.key,x]));
        // Existing local drafts migrate after login. A differing existing cloud draft is a conflict.
        for(let i=0;i<storage.length;i++){
          const key=storage.key(i);if(!allowed(key)||state.pending[key]||state.conflicts[key])continue;
          const row=remote.get(key),value=storage.getItem(key);
          if(state.versions[key]===undefined && (!row||row.value!==value))enqueue(key,value);
        }
        for(const row of snapshot.items){
          if(!allowed(row.key))continue;
          if(!state.pending[row.key]&&!state.conflicts[row.key])apply(row);
        }
        save();
        for(const key of Object.keys(state.pending)){
          if(state.conflicts[key])continue;
          const item=state.pending[key];
          const result=await request('PUT',item);
          reload();
          state.versions[key]=result.row.version;
          if(!result.accepted){
            state.conflicts[key]={local:state.pending[key]?.value??item.value,remote:result.row.value,version:result.row.version};
          }else if(state.pending[key]?.requestId===item.requestId){
            delete state.pending[key];
            if(result.row.value!==item.value)apply(result.row);
          }else{
            // A keystroke during the request must survive its acknowledgement.
            if(state.pending[key])state.pending[key].baseVersion=item.baseVersion+1;
          }
          save();
        }
        status(Object.keys(state.conflicts).length?'有两个版本待选择':Object.keys(state.pending).length?'本机已保存，等待同步':'云端已同步');
      }catch(e){status(e.message||'本机已保存，云端暂时不可用');}
      finally{running=false;}
    }
    function resolve(key,choice){
      reload();
      const c=state.conflicts[key];if(!c)return;
      // Retain both versions locally even after making a choice.
      const archive=JSON.parse(storage.getItem('wengu-private-conflicts-v1')||'[]');
      archive.push({key,...c,chosen:choice,at:new Date().toISOString()});storage.setItem('wengu-private-conflicts-v1',JSON.stringify(archive));
      delete state.conflicts[key];delete state.pending[key];state.versions[key]=c.version;
      if(choice==='cloud')apply({key,value:c.remote,version:c.version});
      else enqueue(key,storage.getItem(key)??c.local);
      save();sync();
    }
    return {enqueue,sync,resolve,reload,start(){active=true;return sync();},stop(){active=false;clearTimeout(timer);status('未登录 · 仅本机保存');},state};
  }
  return {create,allowed};
});
