// R60 补拍二：活体渲染模式（__setTarget+__setView，不冻结）修三张
// 坑：__freeze 下 ticker 停跑，烟花物理不推进（bloomed=0）；且 captureScreenshot 取陈旧帧（R53 账本在册）
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9357;
const DIR=import.meta.dirname;
const URL0='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_f3c_'+Date.now();
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
async function until(expr,ms=9000){const t0=Date.now();while(Date.now()-t0<ms){if(await evaljs(expr))return true;await sleep(200)}return false}
async function load(q){for(let a=0;a<3;a++){await send('Page.navigate',{url:`${URL0}?${q}`});
  if(await until('window.__ready===true',45000))return true;console.log('  retry '+(a+1))}return false}

// ═══ ① 桥+烟花+倒影同框（河 x=82-100 / 桥 z=16 / 烟花 x≈86-89 z≈34-50 y≈20-29）
console.log('=== hanabi 同框（活体渲染）===');
if(await load('time=night&q=0&still=1')){
  // target 放在河与桥之间上空，el 压低让天空进画
  const cands=[
    ['H1',88,12,26, 315,14,52],
    ['H2',88,14,30, 300,12,58],
    ['H3',88,10,22, 340,16,48],
    ['H4',90,16,34, 285,10,62],
    ['H5',88,13,28, 250,15,55],
  ];
  for(const[tag,tx,ty,tz,az,el,d]of cands){
    await evaljs(`__setTarget(${tx},${ty},${tz})`);
    await evaljs(`__setView(${az},${el},${d})`);
    await sleep(700);
    await evaljs('window.__hanabiFire("kiku",0,40);window.__hanabiFire("botan",1,48)');
    const ok=await until('(window.__hanabi&&__hanabi().bursts.filter(b=>b&&b.bloomed).length)>=2',7000);
    await sleep(900);
    await shot('f3try-'+tag);
    console.log('     '+tag+' 绽放='+ok+' cam='+await evaljs('[__camera.position.x|0,__camera.position.y|0,__camera.position.z|0].join()'));
    await sleep(5200);   // 等花凋，下一组重放
  }
  console.log('  err='+await evaljs('window.__err.length'));
} else console.log('LOAD_FAIL');

// ═══ ② 神社参道：setView 绕城市中心 TARGET，必须先 __setTarget 到神社 (64,-64)
console.log('=== 神社参道 ===');
if(await load('time=dusk&q=0&still=1')){
  const cands=[
    ['S1',64,0,-64, 200,10,20],
    ['S2',64,0,-60, 190,16,26],
    ['S3',64,0,-58, 205,8,16],
    ['S4',64,0,-62, 175,12,22],
  ];
  for(const[tag,tx,ty,tz,az,el,d]of cands){
    await evaljs(`__setTarget(${tx},${ty},${tz})`);await evaljs(`__setView(${az},${el},${d})`);
    await sleep(700);await shot('f3try-'+tag);
  }
  console.log('  err='+await evaljs('window.__err.length'));
} else console.log('LOAD_FAIL');

// ═══ ③ 银河：el 压到 10-20 让天空进画，dist 拉远
console.log('=== 银河 ===');
if(await load('time=night&weather=clear&q=0&still=1')){
  const cands=[
    ['G1',131,20,0, 40,12,120],
    ['G2',131,24,0, 25,16,140],
    ['G3',131,16,10, 60,10,100],
    ['G4',131,28,-6, 350,18,150],
  ];
  for(const[tag,tx,ty,tz,az,el,d]of cands){
    await evaljs(`__setTarget(${tx},${ty},${tz})`);await evaljs(`__setView(${az},${el},${d})`);
    await sleep(900);await shot('f3try-'+tag);
  }
  console.log('  starOp='+await evaljs('(__stars&&__stars().starOp)'));
  console.log('  err='+await evaljs('window.__err.length'));
} else console.log('LOAD_FAIL');

ws.close();chrome.kill();await sleep(500);
try{fs.rmSync(prof,{recursive:true,force:true})}catch(e){}
process.exit(0);