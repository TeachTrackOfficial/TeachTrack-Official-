import { auth, db } from './teachtrack-client.js';
import { onAuthStateChanged } from "./teachtrack-client.js";
import { collection, doc, getDoc, getDocs, query, where, addDoc, updateDoc, setDoc, serverTimestamp } from "./teachtrack-client.js";

// One teacher, one Monday-Friday semester timetable. Teachers add independent
// day/time blocks; the table automatically builds a shared axis and merged cells.
const adminPage = location.pathname.toLowerCase().endsWith('dashboard.html');
const DAYS = ['monday','tuesday','wednesday','thursday','friday'];
const TYPES = ['class','activity','seminar','meeting','duty','vacant','recess','lunch'];
const NAMED = ['class','activity','seminar','meeting','duty'];
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const validTime = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
const toMinutes = t => Number(t.slice(0,2))*60 + Number(t.slice(3,5));
const clock = t => {if(!validTime(t))return t||'—';const h=Number(t.slice(0,2));return `${h%12||12}:${t.slice(3)} ${h<12?'AM':'PM'}`;};
function installClock(id){
 const input=$(id);input.type='hidden';
 const wrap=document.createElement('div');wrap.className='tt-time-picker';
 const trigger=document.createElement('button');trigger.type='button';trigger.className='tt-time-trigger';
 trigger.setAttribute('aria-label',id==='ttBlockStart'?'Choose start time':'Choose end time');
 trigger.setAttribute('aria-expanded','false');
 const pop=document.createElement('div');pop.className='tt-time-popover';pop.hidden=true;
 const title=document.createElement('strong');title.textContent=id==='ttBlockStart'?'Start time':'End time';
 const fields=document.createElement('div');fields.className='tt-time-fields';
 const hour=document.createElement('input'),minute=document.createElement('input'),ampm=document.createElement('select');
 hour.type='number';hour.min='1';hour.max='12';hour.inputMode='numeric';hour.setAttribute('aria-label','Hour');
 minute.type='number';minute.min='0';minute.max='59';minute.inputMode='numeric';minute.setAttribute('aria-label','Minute');
 for(const v of ['AM','PM'])ampm.add(new Option(v,v));
 ampm.setAttribute('aria-label','AM or PM');
 fields.append(hour,minute,ampm);
 const shortcuts=document.createElement('div');shortcuts.className='tt-time-shortcuts';
 const caption=document.createElement('small');caption.textContent='Quick minutes';
 for(const m of [0,15,30,45]){const b=document.createElement('button');b.type='button';b.textContent=':'+String(m).padStart(2,'0');b.onclick=()=>{minute.value=String(m);update();};shortcuts.append(b);}
 const footer=document.createElement('div');footer.className='tt-time-footer';
 const done=document.createElement('button');done.type='button';done.textContent='Apply time';done.className='tt-time-apply';
 const error=document.createElement('small');error.className='tt-time-error';error.setAttribute('role','status');
 function update(){
  const h=Number(hour.value),m=Number(minute.value);
  if(!Number.isInteger(h)||h<1||h>12||!Number.isInteger(m)||m<0||m>59){error.textContent='Enter hour 1–12 and minute 0–59.';return false;}
  error.textContent='';
  const h24=h%12+(ampm.value==='PM'?12:0);
  input.value=String(h24).padStart(2,'0')+':'+String(m).padStart(2,'0');
  trigger.textContent='◷  '+clock(input.value)+'  ▾';
  return true;
 }
 const refresh=()=>{const t=validTime(input.value)?input.value:'07:00';const h=Number(t.slice(0,2));hour.value=String(h%12||12);minute.value=String(Number(t.slice(3)));ampm.value=h>=12?'PM':'AM';trigger.textContent='◷  '+clock(t)+'  ▾';};
 const close=()=>{pop.hidden=true;trigger.setAttribute('aria-expanded','false');};
 trigger.onclick=()=>{const opening=pop.hidden;document.querySelectorAll('.tt-time-popover').forEach(el=>el.hidden=true);document.querySelectorAll('.tt-time-trigger').forEach(el=>el.setAttribute('aria-expanded','false'));pop.hidden=!opening;trigger.setAttribute('aria-expanded',String(opening));if(opening){refresh();hour.focus();}};
 done.onclick=()=>{if(update())close();};
 for(const field of [hour,minute,ampm])field.addEventListener('change',update);
 for(const field of [hour,minute])field.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();done.click();}});
 pop.append(title,fields,caption,shortcuts,error,footer);footer.append(done);
 wrap.append(trigger,pop);input.after(wrap);input.ttRefresh=refresh;refresh();
 document.addEventListener('click',e=>{if(!wrap.contains(e.target))close();});
}
const refreshClock=id=>$(id)?.ttRefresh?.();
const emptyCell = () => ({type:'unspecified',subject:'',section:''});
const state = {user:null,teachers:[],teacherId:'',term:'',termStart:'',termEnd:'',entries:[],selected:-1};
function status(message, bad=false){const el=$('ttStatus');if(el){el.textContent=message;el.style.color=bad?'#b91c1c':'#166534';}}
function label(e){return e.kind==='class'?e.subject:NAMED.includes(e.kind)?e.subject:e.kind;}
function normalizeEntry(e){return {day:String(e.day||'').toLowerCase(),start:e.start,end:e.end,kind:e.kind||e.type||'class',subject:e.subject||'',section:e.section||''};}
function sortEntries(){state.entries.sort((a,b)=>DAYS.indexOf(a.day)-DAYS.indexOf(b.day)||a.start.localeCompare(b.start));}
function readForm(){state.term=$('ttTerm').value.trim();state.termStart=$('ttStart').value;state.termEnd=$('ttEnd').value;if(adminPage)state.teacherId=$('ttTeacher').value;}
function validateEntries(){
 if(!state.teacherId)throw Error('Select a teacher first.');
 if(!state.term||!state.termStart||!state.termEnd||state.termStart>state.termEnd)throw Error('Enter the semester name and valid start/end dates.');
 if(!state.entries.length)throw Error('Add at least one schedule block.');

 if(state.entries.length>100)throw Error('Maximum 100 schedule blocks per semester.');
 for(const e of state.entries){
  if(!DAYS.includes(e.day)||!TYPES.includes(e.kind)||!validTime(e.start)||!validTime(e.end)||e.start>=e.end)throw Error('Invalid day, period type, or time range.');
  if(NAMED.includes(e.kind)&&!e.subject.trim())throw Error(`Enter a subject/activity for ${e.day} ${e.start}-${e.end}.`);
  if(e.kind==='class'&&!e.section.trim())throw Error(`Enter a section for ${e.day} ${e.start}-${e.end}.`);
  if(state.entries.some(other=>other!==e&&other.day===e.day&&e.start<other.end&&other.start<e.end))throw Error(`Overlapping blocks on ${e.day}: ${e.start}-${e.end}.`);
 }
}
function inferBounds(day){
 const periods=state.entries.filter(e=>e.day===day&&e.kind!=='vacant'&&e.kind!=='recess'&&e.kind!=='lunch');
 if(!periods.length)return {arrival:'',dismissal:''};
 return {arrival:periods.reduce((a,e)=>e.start<a?e.start:a,periods[0].start),dismissal:periods.reduce((a,e)=>e.end>a?e.end:a,periods[0].end)};
}
function legacyRowsToEntries(rows){
 const entries=[];
 for(const day of DAYS){
  for(const row of [...rows].sort((a,b)=>a.start.localeCompare(b.start))){
   const cell=row.cells?.[day]||emptyCell();if(cell.type==='unspecified')continue;
   const prev=entries[entries.length-1];
   if(prev&&prev.day===day&&prev.end===row.start&&prev.kind===cell.type&&prev.subject===(cell.subject||'')&&prev.section===(cell.section||''))prev.end=row.end;
   else entries.push(normalizeEntry({day,start:row.start,end:row.end,kind:cell.type,subject:cell.subject,section:cell.section}));
  }
 }
 return entries;
}
function boundaries(){return [...new Set(state.entries.flatMap(e=>[e.start,e.end]))].filter(validTime).sort();}
function entriesToLegacyRows(){
 const ticks=boundaries(), rows=[];
 for(let i=0;i<ticks.length-1;i++){
  const start=ticks[i],end=ticks[i+1];
  const cells={};for(const day of DAYS){const e=state.entries.find(x=>x.day===day&&x.start<=start&&x.end>=end);cells[day]=e?{type:e.kind,subject:e.subject,section:e.section}:emptyCell();}
  rows.push({start,end,cells});
 }
 return rows;
}
function dutyWindow(day){
 const work=state.entries.filter(e=>e.day===day&&!['vacant','recess','lunch'].includes(e.kind));
 if(!work.length)return null;
 return {first:work.reduce((v,e)=>e.start<v?e.start:v,work[0].start),last:work.reduce((v,e)=>e.end>v?e.end:v,work[0].end)};
}
function paint(){
 const body=$('ttBody');if(!body)return;body.replaceChildren();
 const ticks=boundaries();
 if(ticks.length<2){const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=6;td.textContent='No schedule yet. Use the editor above to add your first block.';td.style.padding='24px';tr.append(td);body.append(tr);}
 const skip=Object.fromEntries(DAYS.map(day=>[day,new Set()]));
 for(let i=0;i<ticks.length-1;i++){
  const tr=document.createElement('tr'),time=document.createElement('td');
  tr.style.height=`${Math.max(46,Math.round((toMinutes(ticks[i+1])-toMinutes(ticks[i]))*1.15))}px`;
  time.className='tt-time-cell';time.textContent=`${clock(ticks[i])} – ${clock(ticks[i+1])}`;tr.append(time);
  for(const day of DAYS){
   if(skip[day].has(i))continue;
   const entry=state.entries.find(e=>e.day===day&&e.start<=ticks[i]&&e.end>=ticks[i+1]);
   let span=1;
   if(entry){while(i+span<ticks.length-1&&ticks[i+span]<entry.end){skip[day].add(i+span);span++;}}
   const td=document.createElement('td');td.rowSpan=span;
   if(entry){const btn=document.createElement('button');btn.type='button';btn.className='tt-grid-cell tt-kind-'+entry.kind;btn.innerHTML=`<strong>${esc(label(entry))}</strong>${entry.section?`<small>${esc(entry.section)}</small>`:''}`;btn.title=`${day} ${clock(entry.start)}–${clock(entry.end)} · Click to edit`;btn.onclick=()=>editEntry(state.entries.indexOf(entry));td.append(btn);}
   else{
    const window=dutyWindow(day);
    const statusName=!window?'No scheduled duty':ticks[i+1]<=window.first?'Not yet on duty':ticks[i]>=window.last?'Off duty':null;
    if(statusName){const statusCell=document.createElement('div');statusCell.className='tt-grid-cell tt-kind-offduty';statusCell.textContent=statusName;statusCell.title='Not eligible for automatic substitute matching';td.append(statusCell);tr.append(td);continue;}
    const spanButton=document.createElement('button');spanButton.type='button';spanButton.className='tt-grid-cell tt-kind-unspecified';spanButton.textContent='+ Add';spanButton.title=`Add ${day} ${ticks[i]}-${ticks[i+1]}`;spanButton.onclick=()=>{resetEditor();$('ttDay').value=day;$('ttBlockStart').value=ticks[i];$('ttBlockEnd').value=ticks[i+1];refreshClock('ttBlockStart');refreshClock('ttBlockEnd');$('ttBlockForm').scrollIntoView({behavior:'smooth',block:'nearest'});};td.append(spanButton);}
   tr.append(td);
  }
  body.append(tr);
 }
}

function toggleFields(){const kind=$('ttKind').value;$('ttSubjectFields').hidden=!NAMED.includes(kind);$('ttSectionField').hidden=kind!=='class';$('ttSubjectLabel').textContent=kind==='class'?'Subject *':'Activity / event name *';}
function resetEditor(){state.selected=-1;$('ttDay').value='monday';$('ttBlockStart').value='07:00';$('ttBlockEnd').value='08:00';$('ttKind').value='class';$('ttSubject').value='';$('ttSection').value='';$('ttAddBlock').textContent='+ Add to timetable';$('ttDeleteBlock').hidden=true;toggleFields();refreshClock('ttBlockStart');refreshClock('ttBlockEnd');}
function editEntry(index){const e=state.entries[index];if(!e)return;state.selected=index;$('ttDay').value=e.day;$('ttBlockStart').value=e.start;$('ttBlockEnd').value=e.end;$('ttKind').value=e.kind;$('ttSubject').value=e.subject;$('ttSection').value=e.section;$('ttAddBlock').textContent='Save changes';$('ttDeleteBlock').hidden=false;toggleFields();refreshClock('ttBlockStart');refreshClock('ttBlockEnd');$('ttBlockForm').scrollIntoView({behavior:'smooth',block:'nearest'});}
function applyEntry(){
 const entry=normalizeEntry({day:$('ttDay').value,start:$('ttBlockStart').value,end:$('ttBlockEnd').value,kind:$('ttKind').value,subject:$('ttSubject').value.trim(),section:$('ttSection').value.trim()});
 if(!validTime(entry.start)||!validTime(entry.end)||entry.start>=entry.end){status('Choose valid start and end times.',true);return;}
 if(NAMED.includes(entry.kind)&&!entry.subject){status('Enter the subject or activity name.',true);return;}
 if(entry.kind==='class'&&!entry.section){status('Enter the class section.',true);return;}
 if(!NAMED.includes(entry.kind))entry.subject='';if(entry.kind!=='class')entry.section='';
 if(state.entries.some((e,i)=>i!==state.selected&&e.day===entry.day&&entry.start<e.end&&e.start<entry.end)){status(`Time conflict on ${entry.day}. Edit or delete the existing block first.`,true);return;}
 if(state.selected<0)state.entries.push(entry);else state.entries[state.selected]=entry;
 sortEntries();resetEditor();paint();status('Timetable updated locally. Click Save draft to store it in TeachTrack.');
}
function deleteEntry(){if(state.selected<0)return;if(!confirm('Delete this schedule block?'))return;state.entries.splice(state.selected,1);resetEditor();paint();status('Block removed. Save draft to keep this change.');}
async function loadTeacher(){
 if(!state.teacherId)return;
 try{
  const [draft,active]=await Promise.all([getDoc(doc(db,'termScheduleDrafts',state.teacherId)),getDoc(doc(db,'schedules',state.teacherId))]);
  const data=draft.exists()?draft.data():active.exists()?active.data():null;
  if(data){state.term=data.term||'';state.termStart=data.termStart||'';state.termEnd=data.termEnd||'';state.entries=Array.isArray(data.entries)?data.entries.map(normalizeEntry):Array.isArray(data.rows)?legacyRowsToEntries(data.rows):DAYS.flatMap(day=>(data[day]||[]).map(e=>normalizeEntry({...e,day,kind:e.kind||'class'})));status(draft.exists()?'Saved draft loaded.':'Approved schedule loaded. Changes will be a separate draft.');}
  else{state.term='';state.termStart='';state.termEnd='';state.entries=[];status('Ready for a new semester timetable.');}
  sortEntries();$('ttTerm').value=state.term;$('ttStart').value=state.termStart;$('ttEnd').value=state.termEnd;resetEditor();paint();
 }catch(e){status('Unable to load teacher schedule: '+e.message,true);}
}
async function saveDraft(){try{readForm();validateEntries();const rows=entriesToLegacyRows();if(rows.length>100)throw Error('Too many distinct time boundaries (maximum 100).');await setDoc(doc(db,'termScheduleDrafts',state.teacherId),{teacherId:state.teacherId,term:state.term,termStart:state.termStart,termEnd:state.termEnd,rows,updatedBy:state.user.uid,updatedAt:serverTimestamp()});status('Draft saved online. Approved timetable remains unchanged.');}catch(e){status('Draft not saved: '+e.message,true);}}
async function submit(){try{readForm();validateEntries();if(!confirm(adminPage?'Approve and activate this semester schedule?':'Submit this semester schedule for admin approval?'))return;const data={teacherId:state.teacherId,term:state.term,termStart:state.termStart,termEnd:state.termEnd,rows:state.entries.map(e=>({...e,kind:e.kind})),status:adminPage?'approved':'pending',submittedBy:state.user.uid,submittedAt:serverTimestamp(),fileName:'TeachTrack timetable editor',fileType:'manual-grid'};const ref=await addDoc(collection(db,'termScheduleSubmissions'),data);if(adminPage)await activate(ref.id,data);status(adminPage?'Schedule approved and saved.':'Submitted for approval. Existing approved schedule remains unchanged.');await refresh();}catch(e){status('Submission failed: '+e.message,true);}}
async function activate(id,data){const days=Object.fromEntries(DAYS.map(d=>[d,[]]));for(const e of data.rows){if(!days[e.day])continue;days[e.day].push({start:e.start,end:e.end,subject:e.subject||e.kind,section:e.section||'',kind:e.kind});}const active={teacherId:data.teacherId,...days,term:data.term,termStart:data.termStart,termEnd:data.termEnd,sourceSubmissionId:id,updatedAt:serverTimestamp()};await setDoc(doc(db,'teacherTermSchedules',data.teacherId,'terms',id),active);await setDoc(doc(db,'schedules',data.teacherId),active);}
async function refresh(){const holder=$('ttSubmissions');if(!holder)return;holder.replaceChildren();try{const q=adminPage?query(collection(db,'termScheduleSubmissions'),where('status','==','pending')):query(collection(db,'termScheduleSubmissions'),where('teacherId','==',state.user.uid));const snap=await getDocs(q);if(snap.empty){holder.textContent='No submissions to display.';return;}for(const d of snap.docs){const v=d.data(),card=document.createElement('div');card.className='tt-submission-card';const name=state.teachers.find(t=>t.id===v.teacherId)?.name||v.teacherId;card.innerHTML=`<strong>${esc(adminPage?name+' · '+v.term:v.term)}</strong> · ${esc(v.termStart)} - ${esc(v.termEnd)} · ${esc(v.status)} · ${v.rows?.length||0} blocks`;const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Review timetable';details.append(summary);const pre=document.createElement('pre');pre.style.whiteSpace='pre-wrap';pre.textContent=(v.rows||[]).map(r=>`${r.day} ${clock(r.start)} – ${clock(r.end)}: ${r.kind||'class'} ${r.subject||''} ${r.section||''}`).join('\n');details.append(pre);card.append(details);if(adminPage){const approve=document.createElement('button');approve.textContent='Approve & activate';approve.onclick=async()=>{if(!confirm('Approve this teacher timetable?'))return;approve.disabled=true;try{await activate(d.id,v);await updateDoc(d.ref,{status:'approved',reviewedBy:state.user.uid,reviewedAt:serverTimestamp()});await refresh();status('Approved.');}catch(e){status(e.message,true);approve.disabled=false;}};const reject=document.createElement('button');reject.textContent='Reject';reject.onclick=async()=>{const note=prompt('Reason for rejection:');if(note===null)return;try{await updateDoc(d.ref,{status:'rejected',reviewNote:note,reviewedBy:state.user.uid,reviewedAt:serverTimestamp()});await refresh();}catch(e){status(e.message,true);}};card.append(approve,reject);}holder.append(card);}}catch(e){holder.textContent='Unable to load submissions: '+e.message;}}
async function init(user){
 state.user=user;const profile=await getDoc(doc(db,'users',user.uid));if(!profile.exists())throw Error('User profile missing.');if(profile.data().role!==(adminPage?'admin':'teacher'))throw Error('This account does not have permission to open this timetable editor.');
 const host=adminPage?$('termScheduleMount'):$('mySchedule');if(!host)throw Error('Schedule section missing.');const wrapper=document.createElement('div');wrapper.className='tt-term-editor';
 wrapper.innerHTML=`<h2>▦ ${adminPage?'Teacher Semester Timetable':'My Semester Timetable'}</h2><p>Add each class or activity with its own time. The Monday–Friday table builds itself automatically, including merged cells.</p><div class="tt-editor-fields">${adminPage?'<label>Teacher<select id="ttTeacher"></select></label>':''}<label>School year / semester<input id="ttTerm" placeholder="SY 2026–2027 · Semester 2" maxlength="100"></label><label>Semester start<input id="ttStart" type="date"></label><label>Semester end<input id="ttEnd" type="date"></label></div><section id="ttBlockForm" class="tt-simple-form"><h3>Add or edit schedule block</h3><div class="tt-block-fields"><label>Day<select id="ttDay">${DAYS.map(d=>`<option value="${d}">${d[0].toUpperCase()+d.slice(1)}</option>`).join('')}</select></label><label>Start time<input id="ttBlockStart" type="time" value="07:00"></label><label>End time<input id="ttBlockEnd" type="time" value="08:00"></label><label>Period type<select id="ttKind">${TYPES.map(k=>`<option value="${k}">${k[0].toUpperCase()+k.slice(1)}</option>`).join('')}</select></label><div id="ttSubjectFields"><label><span id="ttSubjectLabel">Subject *</span><input id="ttSubject" placeholder="e.g. Research / FRC / Seminar"></label><label id="ttSectionField">Section *<input id="ttSection" placeholder="e.g. Grade 12 – Quezon"></label></div></div><div class="tt-editor-actions"><button id="ttAddBlock" type="button">+ Add to timetable</button><button id="ttDeleteBlock" type="button" hidden>Delete block</button><button id="ttClearBlock" type="button">Clear form</button></div></section><div class="tt-overview-heading"><h3>Schedule Overview</h3><span>Monday – Friday</span></div><p class="tt-editor-tip">Click a colored block to edit it. Gray cells outside scheduled duty hours show Not yet on duty / Off duty; gaps between classes are not automatically vacant. Click + Add to enter a block. Each day can have different class lengths.</p><div class="tt-grid-scroll"><table class="tt-semester-grid"><thead><tr><th>Time</th>${DAYS.map(d=>`<th>${d[0].toUpperCase()+d.slice(1)}</th>`).join('')}</tr></thead><tbody id="ttBody"></tbody></table></div><div class="tt-editor-actions"><button id="ttSave" type="button">Save draft</button><button id="ttSubmit" type="button">${adminPage?'Approve & activate':'Submit for admin approval'}</button></div><p id="ttStatus" role="status" aria-live="polite"></p><h3>${adminPage?'Pending teacher submissions':'My submissions'}</h3><div id="ttSubmissions"></div>`;
 if(adminPage)host.replaceChildren(wrapper);else host.append(wrapper);
 for(const id of ['ttBlockStart','ttBlockEnd'])installClock(id);

 $('ttKind').onchange=toggleFields;$('ttAddBlock').onclick=applyEntry;$('ttDeleteBlock').onclick=deleteEntry;$('ttClearBlock').onclick=resetEditor;$('ttSave').onclick=saveDraft;$('ttSubmit').onclick=submit;resetEditor();
 if(adminPage){const snap=await getDocs(collection(db,'users'));state.teachers=snap.docs.filter(d=>d.data().role==='teacher').map(d=>({id:d.id,name:d.data().name||d.data().email||d.id})).sort((a,b)=>a.name.localeCompare(b.name));const sel=$('ttTeacher');sel.add(new Option('Select teacher',''));for(const t of state.teachers)sel.add(new Option(t.name,t.id));sel.onchange=async()=>{state.teacherId=sel.value;if(state.teacherId)await loadTeacher();};}else{state.teacherId=user.uid;await loadTeacher();}paint();await refresh();
}
onAuthStateChanged(auth,user=>{if(user)init(user).catch(e=>{console.error('TeachTrack timetable:',e);const el=adminPage?$('termScheduleMount'):$('mySchedule');if(el){const p=document.createElement('p');p.textContent='Timetable editor could not load: '+e.message;el.replaceChildren(p);}});});
