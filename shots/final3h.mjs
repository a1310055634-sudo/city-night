// R60 冰柱终拍：冰柱实例在 y=2.2（檐下），相机需退远平视该实例
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9371;
const DIR=import.meta.dirname;
const URL0='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_f3h_'+Date.now();
const chrome=spawn(CHROME,[`--remote-debugging-port=${PORT}`,'--headless=new','--no-first-run','--window-size=1680,945','about:blank'],{stdio:'ignore'});
async function getPageWs(){for(let i=0;i<50;i++){try{const l=await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();const p=l.find(t=>t.type==='page');if(p)return p.webSocketDebuggerUrl}catch(e){}await sleep(300)}throw new Error('no chrome')}
const ws=new WebSocket(await getPageWs());
await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej});
let id=0;const pend=new Map();
ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}};
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
const evaljs=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});
  if(r.result?.exceptionDetails)return 'EXC:'+String(r.result.exceptionDetails.exception?.description||'').slice(0,200);
  return r.result?.result?.value};
async function shot(name){const s=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(DIR+'/'+name+'.png',Buffer.from(s.result.data,'base64'));
  console.log('  -> '+name)}
async function until(expr,ms=9000){const t0=Date.now();while(Date.now()-t0<ms){if(await evaljs(expr))return true;await sleep(200)}return false}
async function load(q){for(let a=0;a<3;a++){await send('Page.navigate',{url:`${URL0}?${q}`});
  if(await until('window.__ready===true',45000))return true;console.log('  retry '+(a+1))}return false}
const liveCam=`window.__liveCam=(px,py,pz,tx,ty,tz)=>{window.__lc={p:[px,py,pz],t:[tx,ty,tz]};
  if(!window.__lcHooked){window.__lcHooked=true;
    (function loop(){if(window.__lc){const L=window.__lc;
      __camera.position.set(L.p[0],L.p[1],L.p[2]);__camera.lookAt(L.t[0],L.t[1],L.t[2]);
      __controls.target.set(L.t[0],L.t[1],L.t[2]);__camera.updateMatrixWorld();}
    requestAnimationFrame(loop)})()}};`;

console.log('=== 冰柱檐（退远平视）===');
if(await load('time=day&weather=clear&q=0&still=1')){
  await evaljs(liveCam);
  await evaljs('window.__icicles(0.95)');await sleep(1000);
  const len=await evaljs('__icicles().avgLen');
  console.log('  avgLen='+len);
  // 实例在 (19.8,2.2,-9.3)(44.2,2.2,0.6)(-19.8,2.2,1.2) 等；退 8-14m 平视略仰
  const cands=[
    ['J1',19.8,2.0,2.5, 19.8,2.4,-9.3],   // 同x，退 12mz，平视略仰
    ['J2',12.0,1.8,-9.3, 19.8,2.4,-9.3],  // 侧向 8m
    ['J3',19.8,1.6,-20.0,19.8,2.5,-9.3],  // 退 11m
    ['J4',44.2,2.0,9.0, 44.2,2.5,0.6],
  ];
  for(const[tag,px,py,pz,tx,ty,tz]of cands){
    await evaljs(`__liveCam(${px},${py},${pz},${tx},${ty},${tz})`);
    await sleep(800);await shot('f3try6-'+tag);
  }
  console.log('  melt='+await evaljs('__icicles().melt')+' count='+await evaljs('__icicles().count'));
  console.log('  err='+await evaljs('window.__err.length'));
} else console.log('FAIL');
ws.close();chrome.kill();await sleep(400);
try{fs.rmSync(prof,{recursive:true,force:true})}catch(e){}
process.exit(0);