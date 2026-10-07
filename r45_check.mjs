import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9369;
const DIR='D:/vibe coding/city-night/shots';
const BASE='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_r45_'+Date.now();
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
      const r=await evaljs('window.__ready===true&&!!window.__shops');
      if(r===true)return true;
      await sleep(500)}
    console.log('load retry',a+1)}
  return false}
const results=[];
const ok=(name,cond,detail)=>{results.push([name,!!cond]);console.log((cond?'PASS':'FAIL')+' '+name+(detail?'  '+detail:''))};

// ===== 1 默认态：非 flow 全开（红线⑤）=====
if(!await load('still=1')){console.log('LOAD_FAIL');ws.close();chrome.kill();process.exit(1)}
let err=await evaljs('window.__err.length');
ok('fresh-load-err0',err===0,'__err.length='+err);
let y=JSON.parse(await evaljs('JSON.stringify(window.__shops())'));
console.log('shops:',JSON.stringify(y));
ok('total-28plus',y.total>=28,'total='+y.total+' (R03 账本 ~45 为估算虚高,实测 '+y.total+')');
ok('default-all-open',y.closed===0&&y.dim===0);
ok('default-signs-full',y.sample.every(v=>v>=0.98),JSON.stringify(y.sample));
ok('perm-closed-exist',y.permClosed>=1,'perm='+y.permClosed);
// ===== 2 名片营业状态（非 flow=営業中）=====
await evaljs(`__focus('${y.first}')`);
await sleep(400);
let card=await evaljs(`JSON.stringify({t:document.getElementById('fc-type').textContent,
  fi:window.__focusInfo().status})`);
ok('card-status-open',card.includes('営業中'),card);
await evaljs('__unfocus()');await sleep(600);
// ===== 3 flow 打烊级联：22 点快进 → 全闭 =====
await evaljs('__flow(true);__setGameHour(23)');
let monoOK=true,prevC=-1,closed=-1;
for(let i=0;i<25;i++){await sleep(1000);
  y=JSON.parse(await evaljs('JSON.stringify(window.__shops())'));
  if(y.closed<prevC)monoOK=false;prevC=y.closed;closed=y.closed;
  if(y.closed>=y.openShops)break}
ok('cascade-closes-all',closed>=y.openShops,'closed='+closed+'/'+y.openShops);
ok('cascade-monotonic',monoOK);
ok('signs-dim-on-close',y.sample.every(v=>v<=0.1),JSON.stringify(y.sample));
// ===== 4 打烊街景主打（卷帘+熄招牌+便利店独亮）=====
await evaljs('__freeze=true;__camera.position.set(3,3,4);__camera.lookAt(0,1.2,-26);__camera.updateMatrixWorld();__composer.render()');
await sleep(300);await shot('r45-closed-street');await evaljs('__unfreeze()');
// ===== 5 卷帘中间态（22.2 重新级联抓滑落中）=====
await evaljs('__setGameHour(8)');await sleep(2500);   // 先全开
await evaljs('__setGameHour(22.2)');
let mid=false;
for(let i=0;i<12;i++){await sleep(250);
  y=JSON.parse(await evaljs('JSON.stringify(window.__shops())'));
  if(y.dim>0&&y.closed<y.dim){mid=true;break}}
ok('shutter-mid-caught',mid,'dim='+y.dim+' closed='+y.closed);
await evaljs('__freeze=true;__camera.position.set(3,3,4);__camera.lookAt(0,1.2,-26);__camera.updateMatrixWorld();__composer.render()');
await sleep(200);await shot('r45-shutter-mid');await evaljs('__unfreeze()');
// ===== 6 清晨开店 + 黄昏营业 + 非 flow 恢复 =====
await evaljs('__setGameHour(10)');await sleep(2500);
y=JSON.parse(await evaljs('JSON.stringify(window.__shops())'));
ok('morning-reopen',y.dim===0&&y.closed===0,'closed='+y.closed+' dim='+y.dim);
await evaljs('__setGameHour(20)');await sleep(800);
y=JSON.parse(await evaljs('JSON.stringify(window.__shops())'));
ok('evening-open',y.closed===0);
await evaljs('__flow(false)');await sleep(600);
y=JSON.parse(await evaljs('JSON.stringify(window.__shops())'));
ok('non-flow-restore',y.dim===0&&y.closed===0);
// ===== 7 konbini 24h + 閉店中名片 =====
ok('konbini-24h',await evaljs('window.__shopOpen("konbini")')==='営業中');
await evaljs('__flow(true);__setGameHour(23)');await sleep(3500);
await evaljs(`__focus('${y.first}')`);await sleep(400);
card=await evaljs(`JSON.stringify({t:document.getElementById('fc-type').textContent,
  fi:window.__focusInfo().status})`);
ok('card-status-closed',card.includes('閉店中'),card);
await evaljs('__unfocus()');
await evaljs('__freeze=true;__camera.position.set(3,3,4);__camera.lookAt(0,1.2,-26);__camera.updateMatrixWorld();__composer.render()');
await sleep(200);await shot('r45-closed-card');await evaljs('__unfreeze()');
await evaljs('__flow(false)');await sleep(600);
// ===== 8 draw 差值（?q=2 远景 205m，卷帘 IM 单 draw）=====
await load('still=1&q=2');
await evaljs('__setView(131,42,205)');await sleep(400);
const dd=JSON.parse(await evaljs(`(()=>{const g=__scene.getObjectByName('r45shutter');
  __freeze=true;__renderer.info.autoReset=false;__renderer.info.reset();
  g.visible=false;__composer.render();
  const h=__renderer.info.render.calls;__renderer.info.reset();
  g.visible=true;__composer.render();
  const s=__renderer.info.render.calls;
  __renderer.info.autoReset=true;__renderer.info.reset();
  return JSON.stringify({h,s,diff:s-h})})()`));
ok('draw-diff<=3',dd.diff<=3,JSON.stringify(dd));
await evaljs('__unfreeze()');
// ===== 9 矩阵 + fps + 终检 =====
await load('still=1');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r45-night-overview');
await load('still=1&weather=thunder');
await evaljs('__setView(131,42,80)');await sleep(400);await shot('r45-night-thunder');
await evaljs('__setView(131,30,205)');await sleep(600);
const fog=await evaljs('+__scene.fog.density.toFixed(5)');
ok('far-fog-0.00182',fog>0.0015&&fog<0.0021,'fog='+fog);
await shot('r45-far-regression');
await load('still=1');await evaljs('__unfreeze()');await sleep(1500);
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
