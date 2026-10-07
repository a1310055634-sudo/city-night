// R60 fps 复测：稳定窗口 + 锁级对比（首读 1.2s 是初始化阶段，且当时已自动降档到 L2）
import {spawn} from 'node:child_process';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9375;
const URL0='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_fps_'+Date.now();
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

// 3s 窗口纯 rAF 计数（V23 账本坑：勿用 setInterval 混数）
const measure=`(async()=>{let n=0;const t0=performance.now();
  await new Promise(r=>{function f(){n++;if(performance.now()-t0<3000)requestAnimationFrame(f);else r()}requestAnimationFrame(f)});
  return +(n/((performance.now()-t0)/1000)).toFixed(1)})()`;

async function run(tag,q,extra){
  await send('Page.navigate',{url:`${URL0}?${q}`});
  if(!await until('window.__ready===true')){console.log('  '+tag+' LOAD_FAIL');return}
  await sleep(1000);
  if(extra)await evaljs(extra);
  await sleep(4000);                       // 稳定窗口：让降档/编译/纹理上传全部落定
  const f=await evaljs(measure);
  const lv=await evaljs('window.__perf?window.__perf().level:"?"');
  const dc=await evaljs('__renderer.info.render.calls');
  console.log(`  ${tag}  fps=${f}  level=L${lv}  calls(末pass)=${dc}`);
  return f;
}
console.log('=== R60 fps 复测（稳定窗口）===');
await run('默认夜雪(自动降档)','time=night&still=1');
await run('锁 L0','time=night&q=0&still=1');
await run('锁 L0·205m鸟瞰','time=night&q=0&still=1','__setView(131,42,205)');
await run('锁 L0·夜晴','time=night&weather=clear&q=0&still=1');
const e=await evaljs('window.__err.length');
console.log('  终检 err='+e);
ws.close();chrome.kill();await sleep(400);
try{fs.rmSync(prof,{recursive:true,force:true})}catch(e){}
process.exit(0);