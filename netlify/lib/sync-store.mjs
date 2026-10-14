export const allowedKey = key => typeof key === 'string' && /^(study-v1|study-drill-v1|bed-v1):[^\r\n]{1,400}$/.test(key);
export function validWrite(item) {
  return item && allowedKey(item.key) && typeof item.value === 'string' &&
    Buffer.byteLength(item.value, 'utf8') <= 131072 && Number.isSafeInteger(item.baseVersion) && item.baseVersion >= 0 &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.requestId);
}
// Lock also covers a missing row; two first writes cannot both claim version zero.
export async function writeState(pool, owner, item) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [owner + ':' + item.key]);
    const previous = await c.query('SELECT key, value, base_version, accepted FROM study_versions WHERE owner_id=$1 AND request_id=$2', [owner,item.requestId]);
    const result = await c.query('SELECT key,value,version,updated_at FROM study_state WHERE owner_id=$1 AND key=$2', [owner,item.key]);
    let row = result.rows[0] || {key:item.key,value:'',version:0};
    let accepted;
    if (previous.rows.length) {
      const p=previous.rows[0];
      if (p.key !== item.key || p.value !== item.value || Number(p.base_version) !== item.baseVersion) throw Error('request id reused');
      accepted=p.accepted;
    } else {
      await c.query('INSERT INTO study_state(owner_id,key,value,version) VALUES($1,$2,\'\',0) ON CONFLICT(owner_id,key) DO NOTHING', [owner,item.key]);
      const next=await c.query('UPDATE study_state SET value=$3,version=version+1,updated_at=now() WHERE owner_id=$1 AND key=$2 AND version=$4 RETURNING key,value,version,updated_at', [owner,item.key,item.value,item.baseVersion]);
      accepted=next.rows.length===1;
      if(accepted)row=next.rows[0];
      else row=(await c.query('SELECT key,value,version,updated_at FROM study_state WHERE owner_id=$1 AND key=$2',[owner,item.key])).rows[0];
      await c.query('INSERT INTO study_versions(owner_id,request_id,key,value,base_version,accepted) VALUES($1,$2,$3,$4,$5,$6)', [owner,item.requestId,item.key,item.value,item.baseVersion,accepted]);
    }
    await c.query('COMMIT');
    return {accepted,row:{...row,version:Number(row.version)}};
  } catch(e) { await c.query('ROLLBACK'); throw e; }
  finally { c.release(); }
}
