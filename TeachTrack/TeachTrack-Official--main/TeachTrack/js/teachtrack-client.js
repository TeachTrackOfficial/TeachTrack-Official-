// TeachTrack PostgreSQL compatibility adapter. All writes go through role-checked API.
export const db = {};
export const firebaseConfig = {};
export const auth = {currentUser:null};
const request = async (action, payload={}) => {
  const response = await fetch('/api/teachtrack', {method:'POST', credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});
  const data = await response.json().catch(()=>({error:'Server unavailable'}));
  if(!response.ok) throw new Error(data.error||'Request failed');
  return data;
};
export const signInWithEmailAndPassword = async (_auth, username,password)=> {const {user}=await request('login',{username,password});auth.currentUser=user;return {user};};
export const signOut = async ()=> {await request('logout');auth.currentUser=null;};
export const onAuthStateChanged = (_auth,callback)=> {let active=true;request('me').then(({user})=>{if(active){auth.currentUser=user;callback(user);}}).catch(()=>{if(active)callback(null)});return ()=>{active=false};};
export const getAuth=()=>auth;
export const initializeApp=()=>({name:'TeacherCreationApp'});
export const getApps=()=>[];
export const createUserWithEmailAndPassword=async (_auth,username,password)=> {const {user}=await request('createTeacher',{username,password});return {user};};
export const doc=(_db,...parts)=>({path:parts.join('/')});
export const collection=(_db,...parts)=>({path:parts.join('/')});
export const where=(field,operator,value)=>({field,operator,value});
export const query=(ref,...filters)=>({...ref,filters});
export const serverTimestamp=()=>new Date().toISOString();
export const arrayUnion=(...values)=>({__arrayUnion:values});
const snapshot=(path,data)=>({id:path.split('/').at(-1),ref:{path},exists:()=>data!==null&&data!==undefined,data:()=>data});
export const getDoc=async(ref)=>snapshot(ref.path,(await request('get',{path:ref.path})).data);
export const getDocs=async(ref)=> {const {docs}=await request('list',{path:ref.path,filters:ref.filters||[]});const items=docs.map(d=>snapshot(d.path,d.data));return {docs:items,empty:items.length===0,size:items.length,forEach:fn=>items.forEach(fn)};};
export const setDoc=async(ref,data,options)=>request('set',{path:ref.path,data,merge:!!options?.merge});
export const updateDoc=async(ref,data)=>request('update',{path:ref.path,data});
export const addDoc=async(ref,data)=> {const {id}=await request('add',{path:ref.path,data});return {id,path:ref.path+'/'+id};};
