// Pure, fail-closed availability evaluation shared by the admin availability checker.
const minute = value => {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return NaN;
  const [h,m] = value.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59 ? h*60+m : NaN;
};
const overlap = (a,b,c,d) => a < d && b > c;
export function evaluateAvailability(schedule, day, startTime, endTime, isAssigned = false, date = '') {
  const start = minute(startTime), end = minute(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return {status:'invalid', label:'Invalid time range',available:false};
  if (!schedule) return {status:'no-schedule',label:'No Approved Schedule',available:false};
  if (date && ((schedule.termStart && date < schedule.termStart) || (schedule.termEnd && date > schedule.termEnd)))
    return {status:'outside-term',label:'No Active Approved Term',available:false};
  if (schedule.status && schedule.status !== 'approved') return {status:'not-approved',label:'Schedule Not Approved',available:false};
  const entries = schedule[day];
  if (!Array.isArray(entries) || !entries.length) return {status:'no-duty',label:'No Scheduled Duty',available:false};
  const parsed = entries.map(p=>({start:minute(p.start),end:minute(p.end),kind:String(p.kind||'class').toLowerCase().trim()}));
  if (parsed.some(p=>!Number.isFinite(p.start)||!Number.isFinite(p.end)||p.start>=p.end))
    return {status:'invalid-schedule',label:'Schedule Needs Review',available:false};
  const work = parsed.filter(p=>!['vacant','recess','lunch','unspecified'].includes(p.kind));
  if (!work.length) return {status:'no-duty',label:'No Scheduled Duty',available:false};
  const arrival = Math.min(...work.map(p=>p.start)), departure = Math.max(...work.map(p=>p.end));
  if (end <= arrival) return {status:'before-duty',label:'Not Yet On Duty',available:false};
  if (start >= departure) return {status:'after-duty',label:'Off Duty',available:false};
  if (start < arrival || end > departure) return {status:'outside-duty',label:'Outside Duty Hours',available:false};
  if (isAssigned) return {status:'assigned',label:'Already Assigned',available:false};
  const busy = parsed.filter(p=>!['vacant','recess'].includes(p.kind));
  if (busy.some(p=>overlap(start,end,p.start,p.end))) return {status:'busy',label:'Has Scheduled Activity',available:false};
  // Only explicit Vacant counts. Recess requires a separately configured school policy.
  const vacant = parsed.filter(p=>p.kind==='vacant').sort((a,b)=>a.start-b.start);
  let covered = start;
  for (const p of vacant) if (p.start <= covered && p.end > covered) covered = p.end;
  if (covered < end) return {status:'not-vacant',label:'No Full Vacant Coverage',available:false};
  return {status:'available',label:'Available',available:true};
}
