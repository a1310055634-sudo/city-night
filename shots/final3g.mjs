// R60 终拍：探针坐标法——猫已定位 5 只；冰柱逐实例读矩阵
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9369;
const DIR=import.meta.dirname;
const URL0='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_f3g_'+Date.now();
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

// ═══ ①晨间猫：黎明，原点店旁那只猫 (-5.5,-8.5)
console.log('=== 晨猫 ===');
if(await load('time=dawn&q=0&still=1')){
  await evaljs(liveCam);
  // 读猫实时位置（会巡游）→ 相机在猫侧后方低机位
  const cands=[
    ['K1',-2.0,1.1,-5.6, -5.5,0.35,-8.5],
    ['K2',-1.5,0.9,-11.5, -5.5,0.3,-8.5],
    ['K3',-8.5,1.3,-5.0, -5.5,0.3,-8.5],
    ['K4',-5.5,1.0,-3.4, -5.5,0.3,-8.5],
  ];
  for(const[tag,px,py,pz,tx,ty,tz]of cands){
    await evaljs(`__liveCam(${px},${py},${pz},${tx},${ty},${tz})`);
    await sleep(900);await shot('f3try5-'+tag);
  }
  const cp=await evaljs(`(()=>{const o=[];__scene.traverse(x=>{if(/r41cat/i.test(x.name||'')){const p=new(x.position.constructor)();x.getWorldPosition(p);o.push([+p.x.toFixed(1),+p.z.toFixed(1)])}});return JSON.stringify(o)})()`);
  console.log('  cats now '+cp);
  console.log('  err='+await evaljs('window.__err.length'));
} else console.log('A FAIL');

// ═══ ② 冰柱檐：晴昼 + melt 强制高位，逐实例取位置
console.log('=== 冰柱檐 ===');
if(await load('time=day&weather=clear&q=0&still=1')){
  await evaljs(liveCam);
  await evaljs('window.__icicles(0.9)');await sleep(900);
  const pos=await evaljs(`(()=>{
    let im=null;__scene.traverse(o=>{if(o.isInstancedMesh&&/r50ice/i.test(o.name||''))im=o});
    if(!im)return 'none';
    const M=new (__scene.constructor.prototype.constructor===Object?Object:Object)();
    const out=[];const m=new (window.__renderer.constructor===Object?Object:Object)();
    // 借用 three 的矩阵：借 __camera.matrixWorld.constructor
    const Mat=__camera.matrixWorld.constructor;
    const mm=new Mat();
    for(let i=0;i<im.count;i++){im.getMatrixAt(i,mm);
      const e=mm.elements;
      out.push([+e[12].toFixed(1),+e[13].toFixed(1),+e[14].toFixed(1)])}
    return JSON.stringify(out)})()`);
  console.log('  ice instances '+String(pos).slice(0,300));
  // 取前几个实例位置，围绕其拍
  let arr=[];try{arr=JSON.parse(pos)}catch(e){}
  if(arr.length){
    const p0=arr[0],p1=arr[Math.min(1,arr.length-1)];
    const cands=[
      ['I1',p0[0]+3.2,1.8,p0[2]+3.6, p0[0],p0[1],p0[2]],
      ['I2',p1[0]-3.0,1.5,p1[2]+3.0, p1[0],p1[1],p1[2]],
      ['I3',p0[0]+2.2,1.2,p0[2]-2.8, p0[0],p0[1],p0[2]],
    ];
    for(const[tag,px,py,pz,tx,ty,tz]of cands){
      await evaljs(`__liveCam(${px},${py},${pz},${tx},${ty},${tz})`);
      await sleep(800);await shot('f3try5-'+tag);
    }
  }
  console.log('  melt='+await evaljs('__icicles().melt'));
  console.log('  err='+await evaljs('window.__err.length'));
} else console.log('B FAIL');

ws.close();chrome.kill();await sleep(400);
try{fs.rmSync(prof,{recursive:true,force:true})}catch(e){}
process.exit(0);