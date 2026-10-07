// R60 目标定位探针：猫（R41）与冰柱（R50）真实世界坐标
import {spawn} from 'node:child_process';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9367;
const URL0='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_probe2_'+Date.now();
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
async function until(expr,ms=45000){const t0=Date.now();while(Date.now()-t0<ms){if(await evaljs(expr))return true;await sleep(300)}return false}
await send('Page.navigate',{url:`${URL0}?time=dawn&q=0&still=1`});
if(await until('window.__ready===true')){
  await sleep(2500);
  console.log('=== CATS ===');
  console.log(await evaljs(`(()=>{
    const out=[];
    __scene.traverse(o=>{
      if(/cat/i.test(o.name||'')){
        const p=new (o.position.constructor)();
        o.getWorldPosition(p);
        out.push({name:o.name, vis:o.visible,
          pos:[+p.x.toFixed(2),+p.y.toFixed(2),+p.z.toFixed(2)]})}});
    return JSON.stringify(out)})()`));
  console.log('=== ICICLES ===');
  console.log(await evaljs(`(()=>{
    const out=[];
    __scene.traverse(o=>{
      if(/ice|icicl/i.test(o.name||'')){
        o.geometry.computeBoundingBox();
        const b=o.geometry.boundingBox;
        o.getWorldPosition(new (o.position.constructor)());
        const w=new (o.position.constructor)();o.getWorldPosition(w);
        out.push({name:o.name,vis:o.visible,
          w:[+w.x.toFixed(1),+w.y.toFixed(1),+w.z.toFixed(1)],
          size:[+(b.max.x-b.min.x).toFixed(1),+(b.max.y-b.min.y).toFixed(1),+(b.max.z-b.min.z).toFixed(1)]})}});
    return JSON.stringify(out.slice(0,6))})()`));
  console.log('=== ICICLES fn ===');
  console.log(await evaljs('JSON.stringify(window.__icicles?__icicles():"none")'));
  // 所有带 ice 关键词的 group 名
  console.log('=== names sample ===');
  console.log(await evaljs(`(()=>{const s=new Set();__scene.traverse(o=>{if(o.name)s.add(o.name)});
    return JSON.stringify([...s].filter(n=>/ice|cat|icicl|r50|r41/i.test(n)).slice(0,20))})()`));
} else console.log('LOAD_FAIL');
ws.close();chrome.kill();await sleep(400);
try{fs.rmSync(prof,{recursive:true,force:true})}catch(e){}
process.exit(0);