// R60 补拍三：显式相机坐标法（R35 账本在册：复杂机位勿用 az/el/dist 推算）
// 关键坐标：神社群组 (64,0,0) 台 z-70..-56 参道朝南 / 河 x82-100 桥 z16 / 烟花 x86-89 z34-50 y20-29
// 活体渲染（不冻结）：__setTarget 定位注视点后用 __freeCam 风格显式摆位需配 __freeze，
// 但 freeze 下 ticker 停跑→烟花不推进。故烟花用 __setTarget+__setView 活体，机位靠 target 逼近。
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9359;
const DIR=import.meta.dirname;
const URL0='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_f3d_'+Date.now();
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

// 活体自由机位：每帧把相机拉回设定处（模拟 __freeCam 但不冻结，ticker 继续跑）
const liveCam=`window.__liveCam=(px,py,pz,tx,ty,tz)=>{window.__lc={p:[px,py,pz],t:[tx,ty,tz]};
  if(!window.__lcHooked){window.__lcHooked=true;
    (function loop(){if(window.__lc){const L=window.__lc;
      __camera.position.set(L.p[0],L.p[1],L.p[2]);__camera.lookAt(L.t[0],L.t[1],L.t[2]);
      __controls.target.set(L.t[0],L.t[1],L.t[2]);__camera.updateMatrixWorld();}
    requestAnimationFrame(loop)})()}};`;

// ═══ ① 烟花 + 河 + 桥同框：从河东岸高处斜看西，桥在画面下、烟花在河上方
console.log('=== A. 河上烟花（显式机位）===');
if(await load('time=night&q=0&still=1')){
  await evaljs(liveCam);
  const cands=[
    ['R1',112,9,8, 87,17,40],      // 河东岸，桥(z16)近、烟花(z34-50)远
    ['R2',104,6,-6, 87,16,38],
    ['R3',118,12,16, 88,18,42],
    ['R4',100,4,-14,87,15,40],
    ['R5',108,8,26, 88,19,44],
  ];
  for(const[tag,px,py,pz,tx,ty,tz]of cands){
    await evaljs(`__liveCam(${px},${py},${pz},${tx},${ty},${tz})`);
    await sleep(600);
    await evaljs('window.__hanabiFire("kiku",0,40);window.__hanabiFire("botan",1,48)');
    const ok=await until('(window.__hanabi&&__hanabi().bursts.filter(b=>b&&b.bloomed).length)>=2',7000);
    await sleep(850);
    await shot('f3try2-'+tag);
    console.log('     '+tag+' bloom='+ok);
    await sleep(5200);
  }
  console.log('  err='+await evaljs('window.__err.length'));
} else console.log('A FAIL');

// ═══ ② 神社参道：群组 (64,0,-63) 台面，参道朝南 → 从南向北看（相机 z 更小）
console.log('=== B. 神社参道（显式机位）===');
if(await load('time=dusk&q=0&still=1')){
  await evaljs(liveCam);
  const cands=[
    ['T1',64,2.2,-44, 64,3,-62],   // 参道南端正对
    ['T2',64,4.5,-40, 64,2,-64],
    ['T3',58,3,-46, 64,2.5,-62],
    ['T4',70,3,-46, 64,2.5,-62],
  ];
  for(const[tag,px,py,pz,tx,ty,tz]of cands){
    await evaljs(`__liveCam(${px},${py},${pz},${tx},${ty},${tz})`);
    await sleep(700);await shot('f3try2-'+tag);
  }
  console.log('  err='+await evaljs('window.__err.length'));
} else console.log('B FAIL');

// ═══ ③ 银河：城市天际线 + 天空银河。相机压低仰角看北天（银河斜 35°）
console.log('=== C. 银河（显式机位）===');
if(await load('time=night&weather=clear&q=0&still=1')){
  await evaljs(liveCam);
  const cands=[
    ['M1',131,6,60, 100,60,-40],   // 从南向北望，相机低→天空占大半
    ['M2',150,4,80, 90,55,-30],
    ['M3',110,5,70, 95,50,-20],
    ['M4',131,8,95, 80,58,-60],
  ];
  for(const[tag,px,py,pz,tx,ty,tz]of cands){
    await evaljs(`__liveCam(${px},${py},${pz},${tx},${ty},${tz})`);
    await sleep(800);await shot('f3try2-'+tag);
  }
  console.log('  starOp='+await evaljs('(__stars&&__stars().starOp)'));
  console.log('  err='+await evaljs('window.__err.length'));
} else console.log('C FAIL');

// ═══ ④ 打烊街：看向商铺密集的街区（霓虹区 31,24 / -30,-24 一带）
console.log('=== D. 打烊街（显式机位）===');
if(await load('time=night&flow=1&q=0&still=1')){
  await evaljs(liveCam);
  await evaljs('window.__setGameHour(23.7)');
  const ok=await until('(window.__shops&&__shops().closed)>=28',40000);
  console.log('  级联='+ok+' '+String(await evaljs('JSON.stringify(__shops())')).slice(0,150));
  const cands=[
    ['C1',31,4.5,44, 31,3,22],     // 霓虹区北侧向南看打烊的店招
    ['C2',-30,4,4, -30,3,-24],
    ['C3',31,3.5,10, 31,3,26],
  ];
  for(const[tag,px,py,pz,tx,ty,tz]of cands){
    await evaljs(`__liveCam(${px},${py},${pz},${tx},${ty},${tz})`);
    await sleep(800);await shot('f3try2-'+tag);
  }
  console.log('  err='+await evaljs('window.__err.length'));
} else console.log('D FAIL');

ws.close();chrome.kill();await sleep(500);
try{fs.rmSync(prof,{recursive:true,force:true})}catch(e){}
process.exit(0);