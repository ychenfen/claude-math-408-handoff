import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { getDatabase } from '@netlify/database';
import { allowedKey, validWrite, writeState } from '../lib/sync-store.mjs';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
export function createHandler({ownerId=()=>Netlify.env.get('WENGU_OWNER_ID'),currentUser=getUser,database=getDatabase,checkOrigin=verifyRequestOrigin}={}) {return async function(req) {
  if(!['GET','PUT'].includes(req.method)) return reply({error:'method'},405);
  try {
    // Fail closed until the one permitted Identity user has been configured.
    const owner=ownerId();
    if(!owner) return reply({error:'owner_not_configured'},503);
    const user=await currentUser();
    if(!user) return reply({error:'login_required'},401);
    if(user.id!==owner) return reply({error:'owner_only'},403);
    if(req.method==='PUT') {try{checkOrigin(req);}catch{return reply({error:'origin'},403);}}
    const db=database();
    if(req.method==='GET') {
      const key=new URL(req.url).searchParams.get('history');
      if(key!==null) {
        if(!allowedKey(key)) return reply({error:'key'},400);
        const result=await db.sql`SELECT value,base_version,accepted,created_at FROM study_versions WHERE owner_id=${owner} AND key=${key} ORDER BY created_at DESC LIMIT 30`;
        return reply({versions:result});
      }
      const result=await db.sql`SELECT key,value,version,updated_at FROM study_state WHERE owner_id=${owner}`;
      return reply({owner,items:result.map(row=>({...row,version:Number(row.version)}))});
    }
    const body=await req.text();
    if(new TextEncoder().encode(body).length>800000) return reply({error:'too_large'},413);
    let item;try {item=JSON.parse(body);}catch{return reply({error:'json'},400);}
    if(!validWrite(item)) return reply({error:'invalid_write'},400);
    const result=await writeState(db.pool,owner,item);
    return reply(result,result.accepted?200:409);
  } catch(e) {
    if(e instanceof Response) return e;
    // Never log a draft, token, email, password or database error contents.
    return reply({error:'sync_unavailable'},503);
  }
};}
export default createHandler();
