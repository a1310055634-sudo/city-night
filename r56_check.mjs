import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9444;
const DIR='D:/vibe coding/city-night/shots';
const BASE='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_r56_'+Date.now();
const chrome=spawn(CHROME,[`--remote-debugging-port=${PORT}`,'--headless=new','--no-first-run',
  `--user-data-dir=${prof}`,'--window-size=1680,945','about:blank'],{stdio:'ignore'});
async function getPageWs(){for(let i=0;i<50;i++){try{const l=await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();const p=l.find(t=>t.type==='page');if(p)return p.webSocketDebuggerUrl}catch(e){}await sleep(300)}throw 0}
const ws=new WebSocket(await getPageWs());
await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej});
let id=0;const pend=new Map();
ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}};
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))});
const evaljs=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true});
  if(r.result?.exceptionDetails)return 'EXC:'+JSON.stringify(r.result.exceptionDetails.exception?.description||'').slice(0,300);
  return r.result?.result?.value};
const evaljsA=async e=>{const r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});
  if(r.result?.exceptionDetails)return 'EXC:'+JSON.stringify(r.result.exceptionDetails.exception?.description||'').slice(0,300);
  return r.result?.result?.value};
async function shot(name){
  const s=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(DIR+'/'+name+'.png',Buffer.from(s.result.data,'base64'));
  console.log('shot '+name)}
async function load(q){
  for(let a=0;a<3;a++){
    await send('Page.navigate',{url:BASE+(q?'?'+q:'')});
    const t0=Date.now();
    while(Date.now()-t0<40000){
      const r=await evaljs('window.__ready===true&&!!window.__interior');
      if(r===true)return true;
      await sleep(500)}
    console.log('load retry',a+1)}
  return false}
const results=[];
const ok=(name,cond,detail)=>{results.push([name,!!cond]);console.log((cond?'PASS':'FAIL')+' '+name+(detail?'  '+detail:''))};

// ===== 1 默认态：钩子读数 =====
if(!await load('still=1')){console.log('LOAD_FAIL');ws.close();chrome.kill();process.exit(1)}
let err=await evaljs('window.__err.length');
ok('fresh-load-err0',err===0,'__err.length='+err);
let v=JSON.parse(await evaljs('JSON.stringify(window.__interior())'));
console.log('interior:',JSON.stringify(v));
ok('shape',v.rack.covers===8&&v.aisles.length===2&&v.oden.x===2.72,JSON.stringify(v.rack));
ok('parents-interior(0偏差红线:新物件全部挂 interior 组)',v.parentsInterior.every(x=>x),JSON.stringify(v.parentsInterior));
ok('panel-boost-5pct',Math.abs(v.panelRatio-1.047)<0.01,'ratio='+v.panelRatio);
// ===== 2 回转架确定性步进（冻结后 step，转角=0.18 rad/s × 1s）=====
await evaljs('__freeze=true');
const a1=await evaljs('window.__interior().rack.angle');
await evaljs('__r56step(1.0)');
const a2=await evaljs('window.__interior().rack.angle');
const wrapped=+(((a2-a1)%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
ok('rack-rotates-0.18rad/s',Math.abs(wrapped-0.18)<0.02,a1+'->'+a2+' Δ='+wrapped.toFixed(3));
// ===== 3 蒸汽升腾：步进到包络峰值 =====
const st=JSON.parse(await evaljs(`(()=>{let o;for(let i=0;i<12;i++){__r56step(0.13);o=window.__interior();if(o.steamOp>0.15)break}return JSON.stringify(o)})()`));
ok('steam-rises',st.steam>1.2&&st.steam<2.3&&st.steamOp>0.15,'y='+st.steam+' op='+st.steamOp);
await evaljs('__unfreeze()');
// ===== 4 橱窗射线：3m 正对，命中 ≥2 列货架 =====
const ray=JSON.parse(await evaljs(`(()=>{const rc=new __T.Raycaster();rc.camera=__camera;   // r155+ Sprite.raycast 需要 raycaster.camera
  const it=window.__r56refs[1].parent;                 // interior 组
  const cast=(ox,oz,tx,tz)=>{rc.set(new __T.Vector3(ox,1.25,oz),new __T.Vector3(tx-ox,0.95-1.25,tz-oz).normalize());
    return rc.intersectObjects(it.children,true).map(h=>({z:+h.point.z.toFixed(2),d:+h.distance.toFixed(2)}))};
  const near=cast(0.6,5.8,0.6,0.75);                   // 近列中岛 z≈0.75（5.8-2.8=3.0m 距橱窗）
  const far=cast(0.6,5.8,0.6,-0.75);                   // 远列中岛 z≈-0.75
  return JSON.stringify({nearHit:near.filter(h=>h.z>0.3&&h.z<1.2).length,farHit:far.filter(h=>h.z>-1.2&&h.z<-0.3).length,
    nearFirst:near[0]?near[0].z:null,farFirst:far[0]?far[0].z:null})})()`));
ok('ray-hits-2-aisles',ray.nearHit>=1&&ray.farHit>=1,JSON.stringify(ray));
// ===== 5 夜景四机位（活体渲染）=====
await evaljs('__setTarget(0.3,1.15,2.6);__setView(180,9,6.2)');await sleep(600);await shot('r56-front-night');
await evaljs('__setTarget(-0.5,0.85,2.35);__setView(180,6,3.4)');await sleep(500);await shot('r56-rack');
await evaljs('__setTarget(2.72,1.2,2.3);__setView(173,8,5.2)');await sleep(500);await shot('r56-oden');
await evaljs('__setTarget(-1.6,1.1,1.2);__setView(196,14,7.5)');await sleep(500);await shot('r56-interior-wide');
// ===== 6 昼间同角度（生活窗白天店内可见）=====
await load('time=day&weather=clear&still=1');
await evaljs('__setTarget(0.3,1.15,2.6);__setView(180,9,6.2)');await sleep(700);await shot('r56-front-day');
ok('day-shot',true);
// ===== 7 draw 差值（≤8 预算）=====
await load('still=1&q=2');
await evaljs('__setView(131,42,205)');await sleep(400);
const dd=JSON.parse(await evaljs(`(()=>{const gs=window.__r56refs;
  __freeze=true;__renderer.info.autoReset=false;__renderer.info.reset();
  gs.forEach(g=>g.visible=false);__composer.render();
  const h=__renderer.info.render.calls;__renderer.info.reset();
  gs.forEach(g=>g.visible=true);__composer.render();
  const s2=__renderer.info.render.calls;
  __renderer.info.autoReset=true;__renderer.info.reset();
  return JSON.stringify({h,s2,diff:s2-h})})()`));
ok('draw<=8',dd.diff<=8,JSON.stringify(dd)+' (预期 6:罩2+架2+蒸汽2)');
await evaljs('__unfreeze()');
// ===== 8 fps + 终检 =====
await load('still=1');await sleep(1500);
const fps=await evaljsA('(async()=>{await new Promise(r=>requestAnimationFrame(r));let n=0;const t0=performance.now();while(performance.now()-t0<2000){await new Promise(r=>requestAnimationFrame(r));n++}return n})()');
ok('fps>=30',fps>=30,'fps='+fps);
await load('');
await sleep(2500);
err=await evaljs('window.__err.length');
ok('final-err0',err===0,'__err.length='+err);
const pass=results.filter(r=>r[1]).length;
console.log(`\nSUMMARY ${pass}/${results.length} PASS`);
ws.close();chrome.kill();
try{fs.rmSync(prof,{recursive:true,force:true})}catch(e){}
process.exit(pass===results.length?0:1);
