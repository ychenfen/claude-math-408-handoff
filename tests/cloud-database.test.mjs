import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NetlifyDB} from '@netlify/database-dev';
import pg from 'pg';
import {writeState,validWrite} from '../netlify/lib/sync-store.mjs';
test('database migration, concurrent compare-and-swap, idempotent retry, and owner isolation',async()=>{
 const db=new NetlifyDB({logger:()=>{}});let pool;
 try {
  const url=await db.start();await db.applyMigrations('netlify/database/migrations');pool=new pg.Pool({connectionString:url});
  const key='study-v1:fictional:2099-01-01:draft';
  const first={key,value:'fictional first',baseVersion:0,requestId:'00000000-0000-4000-8000-000000000001'};
  const second={...first,value:'fictional second',requestId:'00000000-0000-4000-8000-000000000002'};
  assert(validWrite(first));assert(!validWrite({...first,key:'nf_jwt'}));
  const results=await Promise.all([writeState(pool,'owner-a',first),writeState(pool,'owner-a',second)]);
  assert.equal(results.filter(x=>x.accepted).length,1);
  const retry=await writeState(pool,'owner-a',first);assert.equal(retry.accepted,results[0].accepted);
  const history=await pool.query('SELECT * FROM study_versions WHERE owner_id=$1',['owner-a']);assert.equal(history.rows.length,2);
  const other=await writeState(pool,'owner-b',first);assert.equal(other.accepted,true);assert.equal(other.row.version,1);
  const state=await pool.query('SELECT * FROM study_state WHERE owner_id=$1',['owner-a']);assert.equal(state.rows[0].version, '1');
 } finally {if(pool)await pool.end();await db.stop();}
});
