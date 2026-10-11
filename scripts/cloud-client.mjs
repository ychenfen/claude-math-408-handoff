import {handleAuthCallback,getUser,getSettings,login,logout,oauthLogin,acceptInvite,updateUser,refreshSession,onAuthChange} from '@netlify/identity';
const cloud=window.WenguCloud={ready:null,enqueue(){}};
cloud.ready=(async()=>{
  // GitHub Pages remains usable locally. No Identity requests on that origin.
  if(!location.hostname.endsWith('.netlify.app'))return;
  const box=document.createElement('details');box.className='cloud-panel';
  box.innerHTML='<summary>作答同步 · <span role="status">正在检查登录</span></summary><div class="cloud-body"></div>';
  document.querySelector('.topbar').after(box);
  const label=box.querySelector('[role=status]'),body=box.querySelector('.cloud-body');
  const error=e=>{label.textContent=e.message||'暂时无法同步';};
  const button=(text,fn)=>{const b=document.createElement('button');b.type='button';b.className='text-button';b.textContent=text;b.onclick=()=>Promise.resolve(fn()).catch(error);return b;};
  const refresh=button('显示另一台设备的更新',()=>{location.reload();});refresh.hidden=true;
  const sync=window.StudyCloudSync.create({storage:localStorage,uuid:()=>crypto.randomUUID(),
    request:async(method,item)=>{
      const r=await fetch('/.netlify/functions/sync',{method,credentials:'same-origin',cache:'no-store',headers:item?{'Content-Type':'application/json'}:{},body:item?JSON.stringify(item):undefined,signal:AbortSignal.timeout(15000)});
      const data=await r.json();
      if(!r.ok&&r.status!==409){const messages={owner_not_configured:'账户权限尚未配置 · 仅本机保存',login_required:'登录已过期 · 本机保存，重新登录后同步',owner_only:'仅站主账户可同步',sync_unavailable:'本机已保存 · 云端暂时不可用'};throw Error(messages[data.error]||`同步失败 HTTP ${r.status}`);}
      return data;
    },
    onRemote:(key,value)=>{
      // Keep the editor stable while writing; refresh is explicit and local drafts are already saved.
      refresh.hidden=false;
      window.dispatchEvent(new CustomEvent('wengu-remote',{detail:{key,value}}));
    },
    onStatus:({message,conflicts,pending})=>{
      label.textContent=message;
      let list=body.querySelector('.cloud-conflicts');if(!list){list=document.createElement('div');list.className='cloud-conflicts';body.append(list);}list.replaceChildren();
      for(const [key,c] of Object.entries(conflicts)){
        const card=document.createElement('details'),title=document.createElement('summary');title.textContent='版本冲突 · '+key;card.append(title);
        for(const [name,value] of [['本机版本',localStorage.getItem(key)??c.local],['云端版本',c.remote]]){const h=document.createElement('strong'),pre=document.createElement('pre');h.textContent=name;pre.textContent=value;card.append(h,pre);}
        card.append(button('保留本机作为当前版本',()=>sync.resolve(key,'local')),button('使用云端作为当前版本',()=>sync.resolve(key,'cloud')));
        const note=document.createElement('p');note.textContent='选择后两个版本仍保留在本机冲突备份；提交过的版本另在云端保留。';card.append(note);list.append(card);
      }
    }});
  cloud.enqueue=(key,value)=>{try{sync.enqueue(key,value);}catch{label.textContent='同步队列未能保存，请导出备份';}};
  let callback;
  try{callback=await handleAuthCallback();}catch(e){error(e);body.textContent='登录回调未完成，请检查 Netlify Identity 设置。当前继续保存在本机。';cloud.enqueue=()=>{};return;}
  const settings=await getSettings().catch(e=>{error(e);return null;});
  if(!settings){body.textContent='请在 Netlify 控制台开启 Identity，并设为仅邀请。当前继续保存在本机。';cloud.enqueue=()=>{};return;}
  const form=document.createElement('form');
  form.innerHTML='<label>邮箱 <input type="email" autocomplete="username" required></label><label>密码 <input type="password" autocomplete="current-password" minlength="8" required></label><button class="primary" type="submit">登录并同步</button>';
  body.prepend(form);
  let special=callback?.type==='invite'||callback?.type==='recovery';
  if(special){box.open=true;form.querySelector('[type=email]').required=false;form.querySelector('[type=email]').closest('label').hidden=true;form.querySelector('[type=password]').autocomplete='new-password';form.querySelector('button').textContent='设置密码并接着复习';}
  form.onsubmit=async e=>{e.preventDefault();const password=form.querySelector('[type=password]');try{
    if(special){if(callback.type==='invite')await acceptInvite(callback.token,password.value);else await updateUser({password:password.value});special=false;location.reload();return;}
    await login(form.querySelector('[type=email]').value,password.value);await session();
  }catch(e){error(e);}finally{password.value='';}};
  const providers=document.createElement('div');
  for(const [name,enabled] of Object.entries(settings.providers||{}))if(enabled&&name!=='email')providers.append(button('使用 '+name+' 登录',()=>oauthLogin(name)));
  body.append(providers,refresh,button('立即检查同步',()=>sync.sync()));
  const exit=button('退出登录',async()=>{sync.stop();await logout();await session();});body.append(exit);
  const backup=button('导出同步与冲突备份',()=>{
    const items={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(window.StudyCloudSync.allowed(key)||key.startsWith('wengu-private-'))items[key]=localStorage.getItem(key);}
    const url=URL.createObjectURL(new Blob([JSON.stringify({app:'wengu-private-backup',version:1,items},null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='温故私有草稿备份.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });body.append(backup);
  async function session(){const user=await getUser();form.hidden=!!user&&!special;providers.hidden=!!user;exit.hidden=!user;if(user){await refreshSession();await sync.start();}else sync.stop();}
  onAuthChange(event=>{if(event==='logout')sync.stop();});
  await session();
  refresh.hidden=true;
  setInterval(()=>{if(document.visibilityState==='visible')sync.sync();},15000);
  addEventListener('online',()=>sync.sync());
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')sync.sync();});
  addEventListener('storage',e=>{if(e.key==='wengu-private-sync-v1')sync.reload();if(window.StudyCloudSync.allowed(e.key||'')){label.textContent='另一标签页有更新，请刷新';refresh.hidden=false;}});
})();
