import {Pool} from 'pg';import {randomUUID,randomBytes,scryptSync} from 'node:crypto';
const [username,password]=process.argv.slice(2);if(!/^[a-zA-Z0-9_.-]{3,40}$/.test(username||'')||!password||password.length<12)throw Error('Usage: node scripts/create-admin.mjs ADMIN_USERNAME PASSWORD_AT_LEAST_12_CHARS');
const salt=randomBytes(16).toString('hex');const hashed=salt+':'+scryptSync(password,salt,64).toString('hex');const pool=new Pool({connectionString:process.env.DATABASE_URL});
try{const id=randomUUID();await pool.query('insert into tt_users(id,username,password_hash,role,name) values($1,$2,$3,$4,$5)',[id,username,hashed,'admin','Administrator']);console.log('Admin created:',username)}finally{await pool.end()}
