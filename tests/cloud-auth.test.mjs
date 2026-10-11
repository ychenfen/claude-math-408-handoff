import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../netlify/functions/sync.mjs';
test('private endpoint fails closed, rejects other users and cross-origin writes before database access',async()=>{
 let calls=0;const database=()=>{calls++;throw Error('must not access database');};
 const request=new Request('https://fictional.netlify.app/.netlify/functions/sync');
 for(const [owner,user,status] of [[null,null,503],['fictional-owner',null,401],['fictional-owner',{id:'different-user'},403]]){
  const handler=createHandler({ownerId:()=>owner,currentUser:async()=>user,database});
  const r=await handler(request);assert.equal(r.status,status);assert.match(r.headers.get('Cache-Control'),/no-store/);
 }
 const handler=createHandler({ownerId:()=>'fictional-owner',currentUser:async()=>({id:'fictional-owner'}),database});
 const r=await handler(new Request(request.url,{method:'PUT',headers:{Origin:'https://other.example'},body:'{}'}));
 assert.equal(r.status,403);assert.equal(calls,0);
});
