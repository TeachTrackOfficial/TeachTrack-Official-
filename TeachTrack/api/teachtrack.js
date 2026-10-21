import {Pool} from 'pg';
import {randomUUID,randomBytes,scryptSync,timingSafeEqual,createHmac} from 'node:crypto';
const pool = new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL?.includes('localhost')?false:{rejectUnauthorized:true},max:3});
const key=()=>{if(!process.env.SESSION_SECRET||process.env.SESSION_SECRET.length<32)throw Error('SESSION_SECRET must be at least 32 characters');return process.env.SESSION_SECRET};
const sign=v=>createHmac('sha256',key()).update(v).digest('hex');
const hash=password=>{const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex')};
const verify=(password,stored)=>{try{const [salt,hex]=stored.split(':');return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(hex,'hex'))}catch{return false}};
const cookie=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split('=')));
async function current(req){const token=cookie(req).tt_session;if(!token)return null;const [id,signature]=token.split('.');if(!id||!signature||sign(id)!==signature)return null;const r=await pool.query('select id,username,role,name from tt_users where session_id=$1 and session_expires>now() and enabled=true',[id]);return r.rows[0]||null;}
const collections=new Set(['users','schedules','substituteRequests','termScheduleDrafts','termScheduleSubmissions','teacherTermSchedules']);
function parse(path){if(typeof path!=='string'||path.length>240)throw Error('Invalid path');const seg=path.split('/');if(!collections.has(seg[0])||seg.some(x=>!x||!/^[a-zA-Z0-9_-]{1,100}$/.test(x)))throw Error('Invalid collection path');return seg;}
function allowed(user,seg,write,data){if(user.role==='admin')return true;if(seg[0]==='users')return !write&&seg.length===2&&seg[1]===user.id;if(seg[0]==='schedules'||seg[0]==='termScheduleDrafts'||seg[0]==='teacherTermSchedules')return seg.length>=2&&seg[1]===user.id;if(seg[0]==='termScheduleSubmissions')return !write || (data?.teacherId===user.id && data?.status==='pending');if(seg[0]==='substituteRequests')return !write || (seg.length===2 && data?.assignedTeacherId===user.id);return false;}
const fail=(res,code,error)=>res.status(code).json({error});
export default async function handler(req,res){if(req.method!=='POST')return fail(res,405,'POST required');res.setHeader('Cache-Control','no-store');try{
const {action,username,password,name,path,data,merge,filters=[]}=req.body||{};
if(action==='register') {
  // Teacher self-registration only. Accounts require an administrator's approval.
  if(typeof username!=='string'||typeof password!=='string'||typeof name!=='string')return fail(res,400,'Complete all fields');
  const email=username.trim().toLowerCase(), fullName=name.trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return fail(res,400,'Enter a valid school email address');
  if(fullName.length<2||fullName.length>100)return fail(res,400,'Enter your full name');
  if(password.length<12||password.length>128)return fail(res,400,'Password must be 12–128 characters');
  const id=randomUUID();
  await pool.query('insert into tt_users(id,username,password_hash,role,name,enabled) values($1,$2,$3,$4,$5,false)',[id,email,hash(password),'teacher',fullName]);
  await pool.query('insert into tt_documents(path,collection,data) values($1,$2,$3)', ['users/'+id,'users',JSON.stringify({name:fullName,email,role:'teacher'})]);
  return res.status(201).json({ok:true,message:'Registration received. A school administrator must approve your account before you can sign in.'});
}
if(action==='login') {if(typeof username!=='string'||typeof password!=='string')return fail(res,400,'Username and password required');const r=await pool.query('select * from tt_users where lower(username)=lower($1)',[username.trim()]);const u=r.rows[0];if(!u||!verify(password,u.password_hash))return fail(res,401,'Incorrect username or password');if(!u.enabled)return fail(res,403,'Account pending school administrator approval');const id=randomUUID();await pool.query("update tt_users set session_id=$1,session_expires=now()+interval '7 days' where id=$2",[id,u.id]);res.setHeader('Set-Cookie',`tt_session=${id}.${sign(id)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`);return res.json({user:{uid:u.id,username:u.username,email:u.username,role:u.role}})}
const user=await current(req);
if(action==='pendingTeachers'){
 if(!user||user.role!=='admin')return fail(res,403,'Admin only');
 const r=await pool.query("select id,username,name from tt_users where role='teacher' and enabled=false order by username limit 200");
 return res.json({teachers:r.rows});
}
if(action==='approveTeacher'){
 if(!user||user.role!=='admin')return fail(res,403,'Admin only');
 if(typeof req.body?.teacherId!=='string')return fail(res,400,'Teacher ID required');
 const r=await pool.query("update tt_users set enabled=true where id=$1 and role='teacher' and enabled=false returning id",[req.body.teacherId]);
 if(!r.rowCount)return fail(res,404,'Pending teacher not found');
 return res.json({ok:true});
}

if(action==='me')return res.json({user:user?{uid:user.id,username:user.username,email:user.username,role:user.role}:null});
if(!user)return fail(res,401,'Please sign in');
if(action==='logout'){await pool.query('update tt_users set session_id=null where id=$1',[user.id]);res.setHeader('Set-Cookie','tt_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');return res.json({ok:true})}
if(action==='deleteTeacher'){
 if(user.role!=='admin')return fail(res,403,'Admin only');
 const teacherId=req.body?.teacherId;
 if(typeof teacherId!=='string'||!teacherId||teacherId.length>100)return fail(res,400,'Valid teacher ID required');
 if(req.body?.confirmation!=='DELETE')return fail(res,400,'Deletion confirmation required');
 if(teacherId===user.id)return fail(res,403,'You cannot delete your own account');
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const removed=await client.query("delete from tt_users where id=$1 and role='teacher' returning id",[teacherId]);
  if(!removed.rowCount){await client.query('ROLLBACK');return fail(res,404,'Teacher account not found');}
  await client.query('delete from tt_documents where path=$1 and collection=$2',['users/'+teacherId,'users']);
  await client.query('COMMIT');
  return res.json({ok:true});
 }catch(error){await client.query('ROLLBACK');throw error}
 finally{client.release()}
}
if(action==='createTeacher'){if(user.role!=='admin')return fail(res,403,'Admin only');if(!/^[a-zA-Z0-9_.-]{3,40}$/.test(username||'')||typeof password!=='string'||password.length<10)return fail(res,400,'Invalid username or password (minimum 10 characters)');const id=randomUUID();await pool.query('insert into tt_users(id,username,password_hash,role,name) values($1,$2,$3,$4,$5)',[id,username,hash(password),'teacher',username]);await pool.query('insert into tt_documents(path,collection,data) values($1,$2,$3)', ['users/'+id,'users',JSON.stringify({name:username,email:username,role:'teacher'})]);return res.json({user:{uid:id,email:username,username}})}
const seg=parse(path);const write=['set','update','add'].includes(action);
// Substitute responses must be authorized against the stored assignment, not
// the partial update payload sent by the teacher's browser.
if(user.role!=='admin'&&seg[0]==='substituteRequests'&&write){
 if(action!=='update'||seg.length!==2)return fail(res,403,'Only assigned teachers can respond to substitute requests');
 if(!data||typeof data!=='object'||Array.isArray(data))return fail(res,400,'Invalid response');
 if(!['accepted','declined_pending_review'].includes(data.status))return fail(res,403,'Invalid substitute response status');
 const keys=Object.keys(data);
 if(keys.some(k=>!['status','respondedAt','declineReason'].includes(k)))return fail(res,403,'Only response fields can be changed');
 if(data.status==='declined_pending_review'&&(!data.declineReason||typeof data.declineReason!=='string'||!data.declineReason.trim()))return fail(res,400,'Decline reason required');
 if(data.status==='accepted'&&'declineReason' in data)return fail(res,400,'Decline reason not allowed for acceptance');
 const result=await pool.query(`update tt_documents
  set data = data || $1::jsonb
  where path=$2 and collection='substituteRequests'
    and data->>'assignedTeacherId'=$3
    and data->>'status'='pending'
  returning path`,[JSON.stringify({...data,respondedAt:new Date().toISOString()}),path,user.id]);
 if(!result.rowCount)return fail(res,409,'Request is no longer pending or is not assigned to your account');
 return res.json({ok:true,id:seg[1]});
}

if(!allowed(user,seg,write,data))return fail(res,403,'Access denied');
if(action==='get'){const r=await pool.query('select data from tt_documents where path=$1',[path]);if(seg[0]==='users'&&seg[1]===user.id&&!r.rows.length)return res.json({data:{name:user.name,email:user.username,role:user.role}});return res.json({data:r.rows[0]?.data??null})}
if(action==='list'){if(seg.length!==1&&!(seg.length===3&&seg[0]==='teacherTermSchedules'))return fail(res,400,'Invalid collection');let rows=(await pool.query('select path,data from tt_documents where collection=$1',[path])).rows;if(user.role!=='admin'){rows=rows.filter(x=>{const d=x.data;return (seg[0]==='substituteRequests'&&(d.assignedTeacherId===user.id||d.requestedBy===user.id))||(seg[0]==='termScheduleSubmissions'&&d.teacherId===user.id)||(seg[0]==='schedules'&&x.path.endsWith('/'+user.id))||(seg[0]==='termScheduleDrafts'&&x.path.endsWith('/'+user.id))||(seg[0]==='teacherTermSchedules'&&x.path.includes('/'+user.id+'/'))})}if(seg[0]==='users'&&user.role==='admin'){const users=(await pool.query('select id,username,role,name from tt_users where enabled=true')).rows;rows=users.map(u=>({path:'users/'+u.id,data:{...rows.find(x=>x.path==='users/'+u.id)?.data,name:u.name,email:u.username,role:u.role}}))}for(const f of filters){if(f.operator!=='==')return fail(res,400,'Unsupported filter');rows=rows.filter(x=>x.data?.[f.field]===f.value)}return res.json({docs:rows})}
if(!write)return fail(res,400,'Unknown action');
if(seg[0]==='users'&&user.role!=='admin')return fail(res,403,'Access denied');
if(action==='add'&&seg.length!==1)return fail(res,400,'Invalid collection');
if(action!=='add'&&seg.length%2!==0)return fail(res,400,'Document path required');
const id=action==='add'?randomUUID():seg.at(-1);const full=action==='add'?path+'/'+id:path;
if(typeof data!=='object'||!data||Array.isArray(data))return fail(res,400,'Invalid document');
// Teachers cannot approve schedules, impersonate other users or change their own role.
if(user.role!=='admin'&&((seg[0]==='termScheduleSubmissions'&&data.status!=='pending')||(seg[0]==='substituteRequests'&&data.status==='approved')))return fail(res,403,'Admin approval required');
const previous=(await pool.query('select data from tt_documents where path=$1',[full])).rows[0]?.data||{};
const next=(action==='update'||merge)?{...previous,...data}:data;
for(const [k,v] of Object.entries(next)){if(v&&typeof v==='object'&&Array.isArray(v.__arrayUnion))next[k]=[...new Set([...(Array.isArray(previous[k])?previous[k]:[]),...v.__arrayUnion])];}
await pool.query('insert into tt_documents(path,collection,data) values($1,$2,$3) on conflict(path) do update set data=excluded.data',[full,action==='add'?path:seg.slice(0,-1).join('/'),JSON.stringify(next)]);
return res.json({id,ok:true});
}catch(e){console.error('TeachTrack API:',e);return fail(res,e.code==='23505'?409:500,e.code==='23505'?'Username already exists':'Server error; check configuration and database')}}
