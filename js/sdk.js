// CrazyGames SDK v3 wrapper. Every call is safe when SDK is missing/disabled.
let SDK=null, active=false, inGameplay=false, lastMid=-1e9, adHooks={onStart(){},onEnd(){}};
export const sdkLog=[];
const note=m=>{sdkLog.push(m);};
export async function initSDK(){
  try{
    const root=window.CrazyGames;
    if(!root||!root.SDK){note('missing');return false;}
    await Promise.race([root.SDK.init(),new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),5000))]);
    SDK=root.SDK; active=SDK.environment==='crazygames'||SDK.environment==='local';
    note('init:'+SDK.environment);
  }catch(e){note('init-fail');SDK=null;active=false;}
  return active;
}
function call(m){ if(!active||!SDK.game||!SDK.game[m])return; try{SDK.game[m]();note(m);}catch(e){note(m+'-err');} }
export const loadingStart=()=>call('loadingStart');
export const loadingStop=()=>call('loadingStop');
export function gameplayStart(){ if(inGameplay)return; inGameplay=true; call('gameplayStart'); }
export function gameplayStop(){ if(!inGameplay)return; inGameplay=false; call('gameplayStop'); }
export const happytime=()=>call('happytime');
export function setAdHooks(h){adHooks=h;}
function ad(type){
  return new Promise(res=>{
    if(!active||!SDK.ad){note('ad-skip:'+type);res(type==='rewarded'?'unavailable':'skip');return;}
    let done=false; const fin=v=>{if(done)return;done=true;adHooks.onEnd();res(v);};
    try{SDK.ad.requestAd(type,{adStarted:()=>{note('adStart:'+type);adHooks.onStart();},adFinished:()=>fin('ok'),adError:()=>fin('error')});}
    catch(e){fin('error');}
  });
}
export async function midgame(){
  const now=performance.now(); if(now-lastMid<120000){note('mid-cooldown');return 'cooldown';}
  lastMid=now; return ad('midgame');
}
export const rewarded=()=>ad('rewarded');
export const sdkActive=()=>active;
export function saveData(k,v){ const s=JSON.stringify(v); try{ if(active&&SDK.data)SDK.data.setItem(k,s); }catch(e){} try{localStorage.setItem(k,s);}catch(e){} }
export function loadData(k){ let s=null; try{ if(active&&SDK.data)s=SDK.data.getItem(k);}catch(e){} if(!s){try{s=localStorage.getItem(k);}catch(e){}} try{return s?JSON.parse(s):null;}catch(e){return null;} }
