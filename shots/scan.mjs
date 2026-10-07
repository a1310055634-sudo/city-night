import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9345;
const DIR=import.meta.dirname;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_scan3_'+Date.now();
const chrome=spawn(CHROME,[`--remote-debugging-port=${PORT}`,'--headless=new','--no-first-run','--window-size=1680,945','about:blank'],{stdio:'ignore'});
async function getPageWs(){for(let i=0;i<50;i++){try{const l=await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();const p=l.find(t=>t.type==='page');if(p)return p.webSocketDebuggerUrl}catch(e){}await sleep(300)}throw 0}
const ws=new WebSocket(await getPageWs());
await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej});
let id=0;const pend=new Map();
ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}};
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
const evaljs=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true});
  if(r.result?.exceptionDetails)return 'EXC:'+JSON.stringify(r.result.exceptionDetails.exception?.description||'').slice(0,300);
  return r.result?.result?.value};
async function shot(name){
  const s=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(DIR+'/'+name+'.png',Buffer.from(s.result.data,'base64'));
  process.stdout.write(name+' ')}

// R59 scan v3：4 主态×8 全视角 + 7 副态×4 代表视角 + 烟花机位 2 = 62 张
const views=[
  ['bird',131,42,80],['origin',131,32,22.5],['neon',135,14,44],['park',220,16,26],
  ['station',180,10,24],['tower',200,16,52],['river',280,20,50],['street',112,11,11.5]
];
const repViews=[['bird',131,42,80],['origin',131,32,22.5],['neon',135,14,44],['river',280,20,50]];
const mainStates=[
  ['night-snow','time=night'],
  ['night-clear','time=night&weather=clear'],
  ['day-snow','time=day'],
  ['dusk-clear','time=dusk&weather=clear']
];
const subStates=[
  ['night-thunder','time=night&weather=thunder'],
  ['night-rain','time=night&weather=rain'],
  ['dawn-snow','time=dawn'],
  ['dusk-snow','time=dusk'],
  ['day-clear','time=day&weather=clear'],
  ['day-rain','time=day&weather=rain'],
  ['dawn-clear','time=dawn&weather=clear']
];
let count=0;const errs=[];
async function loadState(q){
  for(let a=0;a<3;a++){
    await send('Page.navigate',{url:`file:///D:/vibe%20coding/city-night/city-night.html?${q}&still=1`});
    const t0=Date.now();
    while(Date.now()-t0<40000){if(await evaljs('window.__ready===true')===true)return true;await sleep(500)}
    console.log('load retry',a+1)}
  return false}
for(const[state,q]of mainStates){
  console.log(`\n=== ${state} ===`);
  if(!await loadState(q)){errs.push(state+':LOAD_FAIL');continue}
  const e=await evaljs('window.__err.length');
  if(e!==0)errs.push(state+':err='+e);
  for(const[name,az,el,d]of views){
    await evaljs(`__setView(${az},${el},${d})`);
    await sleep(300);
    await shot(`v3-scan-${state}-${name}`);
    count++}
}
for(const[state,q]of subStates){
  console.log(`\n=== ${state} ===`);
  if(!await loadState(q)){errs.push(state+':LOAD_FAIL');continue}
  const e=await evaljs('window.__err.length');
  if(e!==0)errs.push(state+':err='+e);
  for(const[name,az,el,d]of repViews){
    await evaljs(`__setView(${az},${el},${d})`);
    await sleep(300);
    await shot(`v3-scan-${state}-${name}`);
    count++}
}
// 烟花机位 2（夜雪+绽放帧 / 河面倒影帧）
console.log('\n=== hanabi ===');
if(await loadState('time=night&q=0')){
  await evaljs('window.__hanabiFire("kiku",0,40);window.__hanabiFire("botan",1,48)');
  await sleep(3100);
  await evaljs('__setView(280,14,46)');await sleep(300);
  await shot('v3-scan-hanabi-bridge');count++;
  await evaljs('__freeze=true;__camera.position.set(84,3.5,26);__camera.lookAt(89,20,46);__camera.updateMatrixWorld();__composer.render()');
  await sleep(300);await shot('v3-scan-hanabi-river');count++;
  await evaljs('__unfreeze()');
  const e=await evaljs('window.__err.length');
  if(e!==0)errs.push('hanabi:err='+e);
}
console.log(`\ntotal: ${count} screenshots  errs: ${errs.length?errs.join(';'):'none'}`);
ws.close();chrome.kill();
try{fs.rmSync(prof,{recursive:true,force:true})}catch(e){}
process.exit(0);
