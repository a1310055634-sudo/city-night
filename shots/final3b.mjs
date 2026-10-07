// R60 补拍：① 桥+烟花+倒影同框（R58 遗留构图）② 真正打烊后的街（R45 级联需 ≤25s 现实时间）
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9353;
const DIR=import.meta.dirname;
const URL0='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_f3b_'+Date.now();
const chrome=spawn(CHROME,[`--remote-debugging-port=${PORT}`,'--headless=new','--no-first-run','--window-size=1680,945','about:blank'],{stdio:'ignore'});
async function getPageWs(){for(let i=0;i<50;i++){try{const l=await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();const p=l.find(t=>t.type==='page');if(p)return p.webSocketDebuggerUrl}catch(e){}await sleep(300)}throw new Error('no chrome')}
const ws=new WebSocket(await getPageWs());
await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej});
let id=0;const pend=new Map();
ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}};
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
const evaljs=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});
  if(r.result?.exceptionDetails)return 'EXC:'+JSON.stringify(r.result.exceptionDetails.exception?.description||'').slice(0,240);
  return r.result?.result?.value};
async function shot(name){const s=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(DIR+'/'+name+'.png',Buffer.from(s.result.data,'base64'));
  console.log('  -> '+name)}
async function until(expr,ms=8000){const t0=Date.now();while(Date.now()-t0<ms){if(await evaljs(expr))return true;await sleep(200)}return false}
async function load(q){for(let a=0;a<3;a++){await send('Page.navigate',{url:`${URL0}?${q}`});
  if(await until('window.__ready===true',45000))return true;console.log('  retry '+(a+1))}return false}

// ═══ ① 桥+烟花+倒影同框：河在 x=82-100，桥 z=16，烟花 x≈86-89 z≈34-50 y≈20-29
// 从河东岸低机位朝西北看，桥在画面近景、烟花在河上方、倒影在桥前水面
console.log('=== A. hanabi-bridge framing ===');
if(await load('time=night&q=0&still=1')){
  const cands=[
    ['A1',120,3.0,-6, 88,20,34],
    ['A2',124,2.2,2, 88,22,40],
    ['A3',112,1.8,-10,87,24,42],
    ['A4',130,4.0,4, 88,20,36],
  ];
  for(const[tag,px,py,pz,tx,ty,tz]of cands){
    await evaljs(`__freeze=true;__camera.position.set(${px},${py},${pz});__camera.lookAt(${tx},${ty},${tz});__camera.updateMatrixWorld();__composer.render()`);
    await sleep(250);
    await evaljs('window.__hanabiFire("kiku",0,42);window.__hanabiFire("botan",1,48)');
    await until('(window.__hanabi&&__hanabi().bursts.filter(b=>b&&b.bloomed).length)>=2',7000);
    await sleep(700);                       // 爆后 0.8-1.2s 散开未凋（R58 取帧时机）
    await shot('f3try-'+tag);
    const bloomed=await evaljs('__hanabi().bursts.filter(b=>b&&b.bloomed).length');
    console.log('     '+tag+' bloomed='+bloomed);
    await evaljs('window.__hanabiGroupReset&&window.__hanabiGroupReset()');
    await sleep(2600);
  }
  await evaljs('__unfreeze()');
  console.log('  err='+await evaljs('window.__err.length'));
} else console.log('A LOAD_FAIL');

// ═══ ② 真正打烊：等 R45 级联完成（≤25s 现实时间）
console.log('=== B. closed street ===');
if(await load('time=night&flow=1&q=0&still=1')){
  await evaljs('window.__setGameHour(23.7)');
  console.log('  级联等待中…');
  const ok=await until('(window.__shops&&__shops().closed)>=28',40000);
  const st=await evaljs('JSON.stringify(__shops())');
  console.log('  级联完成='+ok+'  '+String(st).slice(0,200));
  await evaljs('__setView(131,10,26)');await sleep(800);
  await shot('f3try-B-closed');
  // 便利店必须仍亮（24h 例外）
  await evaljs('__setView(131,5,13)');await sleep(800);
  await shot('f3try-B-konbini');
  console.log('  err='+await evaljs('window.__err.length'));
} else console.log('B LOAD_FAIL');

ws.close();chrome.kill();await sleep(500);
try{fs.rmSync(prof,{recursive:true,force:true})}catch(e){}
process.exit(0);