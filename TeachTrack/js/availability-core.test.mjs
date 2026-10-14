import assert from 'node:assert/strict';
import {evaluateAvailability as check} from './availability-core.mjs';
const date='2026-10-12';
const schedule={termStart:'2026-10-01',termEnd:'2026-12-31',monday:[
 {start:'07:00',end:'08:30',kind:'class'},
 {start:'08:30',end:'09:30',kind:'vacant'},
 {start:'09:30',end:'11:30',kind:'class'},
 {start:'11:30',end:'13:00',kind:'vacant'},
 {start:'13:00',end:'14:00',kind:'class'}
]};
const test=(a,b,expected,sch=schedule,assigned=false)=>assert.equal(check(sch,'monday',a,b,assigned,date).status,expected,`${a}-${b}`);
test('11:30','13:30','busy');
test('11:30','13:00','available');
test('08:30','09:30','available');
test('09:00','10:00','busy');
test('06:00','07:00','before-duty');
test('14:00','15:00','after-duty');
test('11:30','13:00','assigned',schedule,true);
test('11:30','13:00','no-schedule',null);
test('11:30','13:00','not-approved',{...schedule,status:'pending'});
test('11:30','13:00','invalid-schedule',{...schedule,monday:[{start:'foo',end:'14:00',kind:'vacant'}]});
assert.equal(check(schedule,'monday','11:30','13:00',false,'2027-01-01').status,'outside-term');
console.log('11 availability checks passed');
