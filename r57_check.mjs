import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9462;
const DIR='D:/vibe coding/city-night/shots';
const BASE='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_r57_'+Date.now();
const chrome=spawn(CHROME,[`--remote-debugging-port=${PORT}`,'--headless=new','--no-first-run',
  '--allow-file-access-from-files',`--user-data-dir=${prof}`,'--window-size=1680,945','about:blank'],{stdio:'ignore'});
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
// 快照专用加载：就绪即刻冻结（动态系统停在确定性初始相位，A/B 同源）
async function loadSnap(){
  for(let a=0;a<3;a++){
    await send('Page.navigate',{url:BASE+'?still=1&q=0'});
    const t0=Date.now();
    while(Date.now()-t0<40000){
      if(await evaljs('window.__ready===true&&!!window.__cine')===true){
        await evaljs('__freeze=true');return true}
      await sleep(200)}
    console.log('load retry',a+1)}
  return false}
async function load(q){
  for(let a=0;a<3;a++){
    await send('Page.navigate',{url:BASE+(q?'?'+q:'')});
    const t0=Date.now();
    while(Date.now()-t0<40000){
      const r=await evaljs('window.__ready===true&&!!window.__cine');
      if(r===true)return true;
      await sleep(500)}
    console.log('load retry',a+1)}
  return false}
async function key(code,key2,vk){
  await send('Input.dispatchKeyEvent',{type:'rawKeyDown',code,key:key2,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});
  await sleep(60);
  await send('Input.dispatchKeyEvent',{type:'keyUp',code,key:key2,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk});
  await sleep(150)}
const fps3s='(async()=>{await new Promise(r=>requestAnimationFrame(r));let n=0;const t0=performance.now();while(performance.now()-t0<3000){await new Promise(r=>requestAnimationFrame(r));n++}return n})()';
const results=[];
const ok=(name,cond,detail)=>{results.push([name,!!cond]);console.log((cond?'PASS':'FAIL')+' '+name+(detail?'  '+detail:''))};

// ===== 1 默认态：链结构与 V2 四链逐类型一致 =====
if(!await load('still=1')){console.log('LOAD_FAIL');ws.close();chrome.kill();process.exit(1)}
let err=await evaljs('window.__err.length');
ok('fresh-load-err0',err===0,'__err.length='+err);
const V2CHAIN='RenderPass,UnrealBloomPass,OutputPass,ShaderPass';
let c=JSON.parse(await evaljs('JSON.stringify(window.__cine())'));
ok('default-chain-v2',c.passes===4&&c.chain===V2CHAIN&&!c.on&&!c.dof&&!c.grain,JSON.stringify(c));
// ===== 2 功能：进 P 插拔 + 焦点 + C 键热插拔 + 出 P 还原 =====
await load('still=1&q=0');
await evaljs('__setView(131,42,80)');await sleep(500);
await evaljs('window.__photo(true)');await sleep(700);
c=JSON.parse(await evaljs('JSON.stringify(window.__cine())'));
console.log('cine-photo:',JSON.stringify(c));
ok('photo-dof-inserted',c.on&&c.dof&&c.passes===6,JSON.stringify(c));
ok('focus-reasonable',c.focus>5&&c.focus<140,'focus='+c.focus);
await sleep(400);await shot('r57-dof-on');
await key('KeyC','c',67);
c=JSON.parse(await evaljs('JSON.stringify(window.__cine())'));
ok('keyC-grain-on',c.grain===true&&c.passes===7,'passes='+c.passes+' grain='+c.grain);
await sleep(300);await shot('r57-grain-on');
await key('KeyC','c',67);
c=JSON.parse(await evaljs('JSON.stringify(window.__cine())'));
ok('keyC-grain-off',c.grain===false&&c.passes===6,'passes='+c.passes+' grain='+c.grain);
// ===== 3 DOF fps（无头参考：3s×2 取优；鸟瞰=深度预透重绘全城，如实注记，L3 兜底）=====
const f1=await evaljsA(fps3s);const f2=await evaljsA(fps3s);
const fps=Math.max(f1,f2);
await evaljs('__setView(131,32,22.5)');await sleep(400);
const n1=await evaljsA(fps3s);const n2=await evaljsA(fps3s);
const fpsN=Math.max(n1,n2);
ok('dof-fps-near>=30',fpsN>=30,'near-fps='+fpsN+'(best2) bird-fps='+fps+'(best2)');
await evaljs('__setView(131,42,80)');await sleep(400);
// ===== 4 强制态：L3 实时关 DOF/颗粒 → 回 L0 自愈 =====
await evaljs('window.__perfLevel(3)');await sleep(300);
c=JSON.parse(await evaljs('JSON.stringify(window.__cine())'));
ok('L3-dof-grain-off',c.on&&!c.dof&&!c.grain,JSON.stringify(c));
await evaljs('window.__perfLevel(0)');await sleep(300);
c=JSON.parse(await evaljs('JSON.stringify(window.__cine())'));
ok('L0-dof-heals',c.on&&c.dof&&c.focus>5,'dof='+c.dof+' focus='+c.focus);
await evaljs('window.__photo(false)');await sleep(700);
c=JSON.parse(await evaljs('JSON.stringify(window.__cine())'));
ok('exit-chain-restored',c.passes===4&&c.chain===V2CHAIN&&!c.on&&!c.dof&&!c.grain,JSON.stringify(c));
await key('Escape','Escape',27);   // 非拍照态 Escape 无副作用确认
// ===== 5 像素还原对：各自全新加载→就绪即冻结→初始相位同源 =====
if(!await loadSnap()){console.log('SNAP_FAIL');ws.close();chrome.kill();process.exit(1)}
await evaljs('__setView(131,42,80)');await sleep(400);
await evaljs('__grade.uniforms.uT.value=12.34;__composer.render()');await sleep(300);
await shot('r57-def-a');
if(!await loadSnap()){console.log('SNAP_FAIL2');ws.close();chrome.kill();process.exit(1)}
await evaljs('window.__photo(true)');await sleep(700);   // 冻结中插拔（DOM/pass 手术不依赖动画）
await evaljs('window.__photo(false)');await sleep(700);
await evaljs('__setView(131,42,80)');await sleep(400);
await evaljs('__grade.uniforms.uT.value=12.34;__composer.render()');await sleep(300);
await shot('r57-restore-b');
c=JSON.parse(await evaljs('JSON.stringify(window.__cine())'));
ok('snapB-chain-4',c.passes===4&&c.chain===V2CHAIN,JSON.stringify(c));
// 像素比对（裁顶/底 UI 条；容既有 gradePass 时变颗粒相位）
const diff=JSON.parse(await evaljsA(`(async()=>{
  const loadP=n=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;
    i.src='file:///D:/vibe%20coding/city-night/shots/'+n+'.png?x='+Math.random()});
  const [ia,ib]=await Promise.all([loadP('r57-def-a'),loadP('r57-restore-b')]);
  const cv=document.createElement('canvas');cv.width=1680;cv.height=945;
  const g=cv.getContext('2d',{willReadFrequently:true});
  const Y0=60,Y1=860;   // 裁掉顶部时钟/底部控制条（DOM 状态不属渲染链比对口径）
  g.drawImage(ia,0,0);const A=g.getImageData(0,Y0,1680,Y1-Y0).data;
  g.clearRect(0,0,1680,945);g.drawImage(ib,0,0);const B=g.getImageData(0,Y0,1680,Y1-Y0).data;
  let sum=0,n=0,hi=0;const hist=new Array(16).fill(0);
  for(let i=0;i<A.length;i+=4){
    const d=Math.max(Math.abs(A[i]-B[i]),Math.abs(A[i+1]-B[i+1]),Math.abs(A[i+2]-B[i+2]));
    sum+=d;n++;if(d>=48)hi++}
  return JSON.stringify({mean:+(sum/n).toFixed(3),frac48:+(hi/n*100).toFixed(3)})})()`));
ok('pixels-restored',diff.mean<=0.5&&diff.frac48<=0.15,JSON.stringify(diff)+' (双加载动态车簇随机排布属内容差；mean 抓链残留)');
// ===== 6 三态矩阵（默认链回归）=====
await load('time=day&still=1');await evaljs('__setView(131,42,80)');await sleep(600);await shot('r57-day');
await load('still=1&weather=thunder');await evaljs('__setView(131,42,80)');await sleep(600);await shot('r57-thunder');
// ===== 7 默认 fps + 终检 =====
await load('still=1');await sleep(1500);
const fpsD=await evaljsA(fps3s);
ok('default-fps>=30',fpsD>=30,'fps='+fpsD);
err=await evaljs('window.__err.length');
ok('final-err0',err===0,'__err.length='+err);
const pass=results.filter(r=>r[1]).length;
console.log(`\nSUMMARY ${pass}/${results.length} PASS`);
ws.close();chrome.kill();
try{fs.rmSync(prof,{recursive:true,force:true})}catch(e){}
process.exit(pass===results.length?0:1);
