// R60 河景探针：先测出河面与桥的真实世界坐标和包围盒，再决定机位（不再凭猜）
import {spawn} from 'node:child_process';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9363;
const URL0='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_probe_'+Date.now();
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
await send('Page.navigate',{url:`${URL0}?time=night&q=0&still=1`});
if(await until('window.__ready===true')){
  // 场景中所有大尺寸水平面（河/桥/路）——按几何尺寸与高度过滤
  const r=await evaljs(`(()=>{
    const out=[];
    __scene.traverse(o=>{
      if(!o.isMesh||!o.geometry)return;
      o.geometry.computeBoundingBox();
      const b=o.geometry.boundingBox;if(!b)return;
      const sx=b.max.x-b.min.x, sy=b.max.y-b.min.y, sz=b.max.z-b.min.z;
      const area=sx*sz;
      if(area>300 && sy<6){
        const c=[(b.min.x+b.max.x)/2,(b.min.y+b.max.y)/2,(b.min.z+b.max.z)/2];
        out.push({size:[+sx.toFixed(1),+sy.toFixed(2),+sz.toFixed(1)],
          min:[+b.min.x.toFixed(1),+b.min.y.toFixed(2),+b.min.z.toFixed(1)],
          c, area:+area.toFixed(0), name:o.name||'', uuid:o.uuid.slice(0,8)});
      }});
    // 只保留 x>70 的（河在东侧 x82-100）
    const east=out.filter(o=>o.min[0]>70).sort((a,b)=>b.area-a.area).slice(0,8);
    return JSON.stringify({all:out.length, east},null,1)})()`);
  console.log(r);
  // 烟花位置
  const h=await evaljs('JSON.stringify(__hanabi())');
  console.log('HANABI',h);
} else console.log('LOAD_FAIL');
ws.close();chrome.kill();await sleep(400);
try{fs.rmSync(prof,{recursive:true,force:true})}catch(e){}
process.exit(0);