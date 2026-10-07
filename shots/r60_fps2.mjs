// fps 排查：R60 对 city-night.html 的改动是否为零渲染影响 + 读数方差
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9377;
const URL0='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_fps2_'+Date.now();
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
async function until(expr,ms=45000){const t0=Date.now();while(Date.now()-t0<ms){if(await evaljs(expr))return true;await sleep(250)}return false}
const measure=`(async()=>{let n=0;const t0=performance.now();
  await new Promise(r=>{function f(){n++;if(performance.now()-t0<3000)requestAnimationFrame(f);else r()}requestAnimationFrame(f)});
  return +(n/((performance.now()-t0)/1000)).toFixed(1)})()`;

async function run(tag,q,extra){
  await send('Page.navigate',{url:`${URL0}?${q}`});
  if(!await until('window.__ready===true')){console.log('  '+tag+' LOAD_FAIL');return null}
  await sleep(1000); if(extra)await evaljs(extra);
  await sleep(4000);
  const f=await evaljs(measure);
  const lv=await evaljs('window.__perf?window.__perf().level:"?"');
  console.log(`  ${tag}  fps=${f}  L${lv}`);
  return f;
}
console.log('=== 默认态 3 次连续读数（方差检验）===');
const a=await run('第1次','time=night&still=1');
const b=await run('第2次','time=night&still=1');
const c=await run('第3次','time=night&still=1');
console.log(`  方差: ${a} / ${b} / ${c}`);
console.log('=== 昼间对照 ===');
await run('昼雪','time=day&still=1');
console.log('=== 运行时规模（判断是否为渲染改动导致）===');
await send('Page.navigate',{url:`${URL0}?time=night&q=0&still=1`});
await until('window.__ready===true');await sleep(3000);
console.log('  scene children = '+await evaljs('__scene.children.length'));
console.log('  geometries = '+await evaljs('__renderer.info.memory.geometries'));
console.log('  textures = '+await evaljs('__renderer.info.memory.textures'));
console.log('  programs = '+await evaljs('__renderer.info.programs.length'));
console.log('  err='+await evaljs('window.__err.length'));
ws.close();chrome.kill();await sleep(400);
try{fs.rmSync(prof,{recursive:true,force:true})}catch(e){}
process.exit(0);