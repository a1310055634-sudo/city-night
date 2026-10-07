// R60 河景终拍：探针已测实——河面 x=82.8 起、沿 z 延伸（5.6 宽 × 55.6 长，z -26..29）
// 桥 z=16 横跨河。烟花 x86-89 z34-50（河的下游/南侧上空）
// 正确构图：站西南高处，沿河面向东北看 → 河面纵深 + 桥(z16) + 烟花(z34-50) 上空 + 水面倒影
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9365;
const DIR=import.meta.dirname;
const URL0='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_f3f_'+Date.now();
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

console.log('=== 河景（探针坐标法）===');
if(await load('time=night&q=0&still=1')){
  await evaljs(liveCam);
  // 相机在河西南外侧高处 → 河面(z-26..29)纵深展开、桥 z16 在中景、烟花 z34-50 在更远
  const cands=[
    ['V1',66,14,-30, 90,6,26],    // 西南高处，沿河向东北看
    ['V2',70,9,-36, 90,5,20],
    ['V3',60,18,-24, 92,8,30],
    ['V4',74,6,-32, 88,4,18],
    ['V5',64,11,-42, 90,7,34],
  ];
  for(const[tag,px,py,pz,tx,ty,tz]of cands){
    await evaljs(`__liveCam(${px},${py},${pz},${tx},${ty},${tz})`);
    await sleep(700);
    await evaljs('window.__hanabiFire("kiku",0,40);window.__hanabiFire("botan",1,48)');
    const ok=await until('(window.__hanabi&&__hanabi().bursts.filter(b=>b&&b.bloomed).length)>=2',7000);
    await sleep(850);await shot('f3try4-'+tag);
    console.log('     '+tag+' bloom='+ok+' peak='+await evaljs('__hanabi().peak'));
    await sleep(5200);
  }
  console.log('  err='+await evaljs('window.__err.length'));
} else console.log('FAIL');
ws.close();chrome.kill();await sleep(400);
try{fs.rmSync(prof,{recursive:true,force:true})}catch(e){}
process.exit(0);