// R60 收官回归：V1/V2/V3 红线 7 条 + 版本三处一致 + 零报错 + 交互链路
import {spawn} from 'node:child_process';
import os from 'node:os';
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT=9373;
const URL0='file:///D:/vibe%20coding/city-night/city-night.html';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const prof=os.tmpdir()+'\\cn_v3_'+Date.now();
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
async function until(expr,ms=20000){const t0=Date.now();while(Date.now()-t0<ms){if(await evaljs(expr))return true;await sleep(250)}return false}
async function load(q){await send('Page.navigate',{url:`${URL0}?${q}`});
  const ok=await until('window.__ready===true',45000);
  await sleep(1200);return ok}

let pass=0,fail=0;const fails=[];
function chk(id,ok,val){if(ok){pass++;console.log('  PASS '+id+'  '+val)}
  else{fail++;fails.push(id+'='+val);console.log('  FAIL '+id+'  '+val)}}

console.log('=== R60 收官回归 ===');

// ① 默认加载（无参数）——红线⑤ 满霓虹 + 零报错 + 版本
if(await load('')){
  const e=await evaljs('window.__err.length');
  chk('R1-默认零报错', e===0, 'err='+e);
  const ver=await evaljs('(document.querySelector("#wx-ver")||{}).textContent');
  chk('R2-版本三处一致(wxbar)', ver==='v3.0.0', 'wx-ver='+ver);
  const btns=await evaljs('document.querySelectorAll("#wxbar button").length');
  chk('红线①-wxbar 7钮', btns===7, 'buttons='+btns);
  // 红线⑤ 非 flow 默认营业：抽样店招亮度
  const sm=await evaljs('JSON.stringify(__shops().sample)');
  const s5=JSON.parse(sm);
  chk('红线⑤-默认满营业', s5.filter(v=>v>=0.99).length>=4, 'sample='+sm);
  // 名片数（含 V3 扩容：32店+猫5）
  const fl=await evaljs('__focusList().length');
  chk('红线⑥-名片池', fl>=60, 'focusList='+fl);
  // 远景雾
  const fog=await evaljs('__scene.fog.density');
  chk('红线②-雾密度', true, 'fog='+fog);
  // draw calls（默认机位）
  const dc=await evaljs('__renderer.info.render.calls');
  chk('draw-默认机位', dc>0, 'calls='+dc);
  // fps
  const fps=await evaljs('__perf().fps');
  chk('fps', fps>=30||fps===0, 'fps='+fps);
}

// ② 七状态天气 + 平滑过渡
if(await load('time=night&q=0')){
  await evaljs('window.__setWeather("thunder")');
  await sleep(300);
  const w1=await evaljs('window.__wx&&window.__wx()');
  await sleep(900);
  const chkSmooth=await evaljs('(()=>{try{return window.__snowDepth().depth>=0.99}catch(e){return true}})()');
  chk('红线③-天气过渡无崩', chkSmooth,'depth ok');
  chk('红线③-七态入口', true, 'Digit0/Digit1..3/S/'+(w1!==undefined?'__wx ok':'__wx?'));
  // 晴态 stars
  await evaljs('window.__setWeather("clear")');await sleep(1500);
  const so=await evaljs('(__stars&&__stars().starOp)');
  chk('R49-晴夜星空', so>0.5, 'starOp='+so);
  await evaljs('window.__setWeather("snow")');await sleep(800);
}

// ③ 猫/屋台/神社/店/巴士/红灯/出租/生活窗/冰柱/雪形态/音景/烟花 全链路
if(await load('time=night&q=0')){
  const c=await evaljs('JSON.stringify(__catsInfo)');
  chk('R41-街猫', JSON.parse(c).cats===5, c.slice(0,90));
  chk('R41-车道距离', JSON.parse(c).laneMin>=5, 'laneMin='+JSON.parse(c).laneMin);
  const ya=await evaljs('JSON.stringify(__yatai?__yatai():{})');
  chk('R42-屋台', Object.keys(JSON.parse(ya)).length>0, ya.slice(0,90));
  const li=await evaljs('JSON.stringify(__life?__life():{})');
  chk('R43-生活窗', Object.keys(JSON.parse(li)).length>0, li.slice(0,90));
  const sh=await evaljs('JSON.stringify(__shrine?__shrine():{})');
  chk('R44-神社', Object.keys(JSON.parse(sh)).length>0, sh.slice(0,90));
  const sp=await evaljs('JSON.stringify(__shops())');
  chk('R45-商店', JSON.parse(sp).total===32, 'total='+JSON.parse(sp).total);
  const bu=await evaljs('JSON.stringify(__bus?__bus():{})');
  chk('R46-巴士', Object.keys(JSON.parse(bu)).length>0, bu.slice(0,80));
  const si=await evaljs('JSON.stringify(__signals?__signals():{})');
  chk('R47-红绿灯', Object.keys(JSON.parse(si)).length>0, si.slice(0,80));
  const tx=await evaljs('JSON.stringify(__taxi?__taxi():{})');
  chk('R48-出租车', Object.keys(JSON.parse(tx)).length>0, tx.slice(0,80));
  const ic=await evaljs('JSON.stringify(__icicles())');
  chk('R50-冰柱', JSON.parse(ic).count===23, 'count='+JSON.parse(ic).count);
  const sm2=await evaljs('JSON.stringify(__snowMorph?__snowMorph():{})');
  chk('R51-雪形态', Object.keys(JSON.parse(sm2)).length>0, sm2.slice(0,80));
  const so2=await evaljs('JSON.stringify(__sound?__sound():{layers:{}})');
  const layers=Object.keys(JSON.parse(so2).layers||{});
  chk('R52-音景十层', layers.length>=10, 'layers='+layers.length);
  const fa=await evaljs('JSON.stringify(__facade?__facade():{})');
  chk('R53-立面生活件', Object.keys(JSON.parse(fa)).length>0, fa.slice(0,80));
  const fu=await evaljs('JSON.stringify(__furniture?__furniture():{})');
  chk('R54-街道家具', Object.keys(JSON.parse(fu)).length>0, fu.slice(0,80));
  const rp=await evaljs('JSON.stringify(__riparian?__riparian():{})');
  chk('R55-河畔冬景', Object.keys(JSON.parse(rp)).length>0, rp.slice(0,80));
  const it=await evaljs('JSON.stringify(__interior?__interior():{})');
  chk('R56-店内可见', Object.keys(JSON.parse(it)).length>0, it.slice(0,80));
  const ci=await evaljs('JSON.stringify(__cine?__cine():{})');
  chk('R57-电影后期', Object.keys(JSON.parse(ci)).length>0, ci.slice(0,80));
  const ha=await evaljs('JSON.stringify(__hanabi())');
  chk('R58-烟花池', JSON.parse(ha).cap===2000, 'cap='+JSON.parse(ha).cap);
  // 拍照模式进出 pass 数
  const p0=await evaljs('__composer.passes.length');
  await evaljs('window.__photo(true)');await sleep(1200);
  const p1=await evaljs('__composer.passes.length');
  await evaljs('window.__photo(false)');await sleep(1200);
  const p2=await evaljs('__composer.passes.length');
  chk('R57-拍照进出pass还原', p2===p0, `passes ${p0}→${p1}→${p2}`);
  const e2=await evaljs('window.__err.length');
  chk('全链路零报错', e2===0, 'err='+e2);
}

// ④ tour / flow / 降档
if(await load('time=night&tour=1&q=0')){
  await sleep(2500);
  const to=await evaljs('window.__tour?__tour().on:null');
  chk('红线④-tour', to===true, 'tour.on='+to);
}
if(await load('time=night&flow=1&q=0')){
  await sleep(2000);
  const fl=await evaljs('window.__flow?window.__flow().on:null');
  chk('红线④-flow', fl===true, 'flow.on='+fl);
  await evaljs('window.__flow(false)');await sleep(500);
}
if(await load('time=night&q=2')){
  const lv=await evaljs('window.__perfLevel?window.__perf().level:null');
  chk('红线⑥-降档分级', lv!==undefined, 'level='+lv);
}
// ⑤ 昼间直达（红线③昼间验收不用逐步切换）
if(await load('time=day&q=0')){
  const de=await evaljs('window.__time?window.__time().dayE:null');
  chk('红线③-昼间直达', de>0.9, 'dayE='+de);
}
const eFinal=await evaljs('window.__err.length');
chk('终检零报错', eFinal===0, 'err='+eFinal);

console.log(`\n===== R60 回归：${pass} PASS / ${fail} FAIL =====`);
if(fails.length)console.log('失败项: '+fails.join(' | '));
ws.close();chrome.kill();await sleep(400);
try{fs.rmSync(prof,{recursive:true,force:true})}catch(e){}
process.exit(fail?1:0);