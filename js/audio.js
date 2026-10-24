// Procedural WebAudio SFX + music drone
let ctx=null, master=null, sfx=null, mus=null, jetNode=null, muted=false, adMuted=false, musicStarted=false;
function gain(){ if(master) master.gain.value=(muted||adMuted)?0:0.8; }
function noiseBuf(){ const b=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate); const d=b.getChannelData(0); for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1; return b; }
let NB=null;
function noise(t,dur,freq,vol,type='lowpass'){ if(!ctx)return; const s=ctx.createBufferSource(); s.buffer=NB; const f=ctx.createBiquadFilter(); f.type=type; f.frequency.value=freq; const g=ctx.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur); s.connect(f).connect(g).connect(sfx); s.start(t); s.stop(t+dur); }
function tone(t,dur,f0,f1,vol,type='sine'){ if(!ctx)return; const o=ctx.createOscillator(); o.type=type; o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur); const g=ctx.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur); o.connect(g).connect(sfx); o.start(t); o.stop(t+dur); }
const now=()=>ctx?ctx.currentTime:0;
function music(){ if(musicStarted)return; musicStarted=true; mus=ctx.createGain(); mus.gain.value=.16; mus.connect(master);
  for(const f of [55,82.4,110.5]){ const o=ctx.createOscillator(); o.type='sawtooth'; o.frequency.value=f; const fl=ctx.createBiquadFilter(); fl.type='lowpass'; fl.frequency.value=260; const g=ctx.createGain(); g.gain.value=.25; o.connect(fl).connect(g).connect(mus); o.start(); }
  let beat=0; setInterval(()=>{ if(!ctx)return; const t=now()+.05; const g=ctx.createGain(); g.connect(mus); const o=ctx.createOscillator(); o.frequency.setValueAtTime(120,t); o.frequency.exponentialRampToValueAtTime(40,t+.25); g.gain.setValueAtTime(beat%4===0?1.4:.8,t); g.gain.exponentialRampToValueAtTime(.001,t+.3); o.connect(g); o.start(t); o.stop(t+.3); beat++; },470);
}
export const Sfx={
  get muted(){return muted;},
  unlock(){ if(!ctx){ try{ ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){return;} master=ctx.createGain(); master.connect(ctx.destination); sfx=ctx.createGain(); sfx.gain.value=.9; sfx.connect(master); NB=noiseBuf(); gain(); } ctx.resume&&ctx.resume(); music(); },
  setMuted(m){ muted=m; gain(); }, adMute(m){ adMuted=m; gain(); if(ctx){ m?ctx.suspend():ctx.resume(); } },
  punch(){const t=now(); tone(t,.18,140,45,.9); noise(t,.12,1800,.6);}, swing(){noise(now(),.12,900,.25,'bandpass');},
  zap(){const t=now(); tone(t,.12,1400,300,.18,'square');}, plasma(){tone(now(),.3,500,120,.25,'sawtooth');},
  hit(){const t=now(); noise(t,.25,600,.8); tone(t,.2,90,40,.6);}, dash(){noise(now(),.25,2500,.35,'highpass');},
  boom(k=1){const t=now(); noise(t,.9*k,400,1); tone(t,.6*k,80,25,.9);}, collapse(){const t=now(); noise(t,2.5,250,1.2); tone(t,1.5,60,20,.8); noise(t+.3,2,900,.3);},
  stomp(){const t=now(); tone(t,.35,70,28,.9);}, roar(){const t=now(); tone(t,.6,180,60,.4,'sawtooth'); noise(t,.5,700,.3);},
  horn(){const t=now(); tone(t,2.2,62,55,.6,'sawtooth'); tone(t,2.2,93,88,.4,'sawtooth');}, alarm(){const t=now(); for(let i=0;i<3;i++) tone(t+i*.25,.2,880,660,.18,'square');},
  pick(){tone(now(),.08,1200,1800,.1,'triangle');}, buy(){const t=now(); tone(t,.1,600,900,.2,'triangle'); tone(t+.1,.15,900,1300,.2,'triangle');},
  finisher(){const t=now(); tone(t,.8,200,40,1,'sawtooth'); noise(t,.8,1200,.8);},
  jet(on){ if(!ctx)return; if(on&&!jetNode){ const s=ctx.createBufferSource(); s.buffer=NB; s.loop=true; const f=ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=700; const g=ctx.createGain(); g.gain.value=.25; s.connect(f).connect(g).connect(sfx); s.start(); jetNode=s; } else if(!on&&jetNode){ jetNode.stop(); jetNode=null; } },
};
