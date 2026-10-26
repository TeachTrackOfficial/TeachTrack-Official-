// Teacher-only monthly report. The API also filters substituteRequests by the authenticated teacher.
import {auth, db, collection, getDocs} from './teachtrack-client.js';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmtDate = value => { const [y,m,d]=String(value||'').split('-').map(Number);return y&&m&&d ? new Date(y,m-1,d).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}) : (value||'—'); };
const fmtTime = value => { if (!value) return '—'; const match=String(value).match(/^(\d{1,2}):(\d{2})/); if(!match)return String(value); const hour=Number(match[1]);return `${hour%12||12}:${match[2]} ${hour>=12?'PM':'AM'}`; };
let loaded=false;
async function loadReport(){
  const month=$('teacherRecordMonth')?.value;
  const container=$('teacherMonthlyRecords');
  if(!month||!container||!auth.currentUser)return;
  $('printTeacherRecords').disabled=true;
  container.textContent='Loading your monthly records…';
  try {
    const snapshot=await getDocs(collection(db,'substituteRequests'));
    const id=auth.currentUser.uid;
    const rows=[];
    snapshot.forEach(doc=>{const r=doc.data();if(String(r.date||'').startsWith(month) && (r.assignedTeacherId===id || r.absentTeacherId===id || r.requestedBy===id))rows.push(r);});
    rows.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||String(a.startTime||'').localeCompare(String(b.startTime||'')));
    const accepted=rows.filter(r=>r.status==='accepted').length;
    const declined=rows.filter(r=>['declined','declined_pending_review'].includes(r.status)).length;
    const pending=rows.filter(r=>r.status==='pending').length;
    $('teacherRecordTotal').textContent=rows.length;
    $('teacherRecordAccepted').textContent=accepted;
    $('teacherRecordDeclined').textContent=declined;
    $('teacherRecordPending').textContent=pending;
    if(!rows.length){container.textContent='No substitute activity recorded for this month.';}
    else {
      container.innerHTML=`<table><thead><tr><th>Date</th><th>My Role</th><th>Absent Teacher</th><th>Substitute</th><th>Subject / Section</th><th>Time</th><th>Status</th><th>Decline Reason</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(fmtDate(r.date))}</td><td>${r.assignedTeacherId===id?'Substitute':'Absent / Requester'}</td><td>${esc(r.absentTeacherName||'—')}</td><td>${esc(r.assignedTeacherName||'—')}</td><td>${esc(r.subject||'—')} / ${esc(r.section||'—')}</td><td>${esc(fmtTime(r.startTime))} – ${esc(fmtTime(r.endTime))}</td><td>${esc(String(r.status||'pending').replaceAll('_',' '))}</td><td>${esc(r.declineReason||'—')}</td></tr>`).join('')}</tbody></table>`;
    }
    $('printTeacherRecords').disabled=false;
    loaded=true;
  } catch(error){console.error('Teacher monthly report:',error);container.textContent='Unable to load your records. Please refresh and try again.';}
}
$('teacherRecordMonth').value=new Date().toLocaleDateString('en-CA').slice(0,7);
$('teacherRecordMonth').addEventListener('change',loadReport);
document.querySelector('[data-section="myMonthlyRecords"]')?.addEventListener('click',()=>{if(auth.currentUser)loadReport();else setTimeout(loadReport,600);});
$('printTeacherRecords').addEventListener('click',()=>{
  if(!loaded)return;
  const report=$('tt-teacher-print-report')||document.createElement('div');
  report.id='tt-teacher-print-report';report.className='tt-print-report';
  report.innerHTML=`<h1>TeachTrack | Individual Monthly Activity</h1><p>Month: ${esc($('teacherRecordMonth').value)}</p><p>Total: ${esc($('teacherRecordTotal').textContent)} · Accepted: ${esc($('teacherRecordAccepted').textContent)} · Declined / under review: ${esc($('teacherRecordDeclined').textContent)} · Pending: ${esc($('teacherRecordPending').textContent)}</p>`;
  const table=$('teacherMonthlyRecords').querySelector('table');
  if(table)report.appendChild(table.cloneNode(true));else {const p=document.createElement('p');p.textContent=$('teacherMonthlyRecords').textContent;report.appendChild(p);}
  document.body.appendChild(report);window.print();
});
