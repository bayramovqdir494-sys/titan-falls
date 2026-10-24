import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as S from './sdk.js';
import { Sfx } from './audio.js';

const $=id=>document.getElementById(id);
const isTouch=('ontouchstart' in window)||navigator.maxTouchPoints>0||/[?&]touch/.test(location.search);
const lowQ=isTouch;
const rnd=(a,b)=>a+Math.random()*(b-a);
const V3=THREE.Vector3; const tmp=new V3(), tmp2=new V3();

// ---------- renderer ----------
const canvas=$('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:!lowQ,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,lowQ?1.25:1.75));
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.25;
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
{ const cv=document.createElement('canvas'); cv.width=4; cv.height=256; const g=cv.getContext('2d');
  const gr=g.createLinearGradient(0,0,0,256); gr.addColorStop(0,'#0a0d18'); gr.addColorStop(.45,'#2a2238'); gr.addColorStop(.7,'#7a3a22'); gr.addColorStop(1,'#1a1012');
  g.fillStyle=gr; g.fillRect(0,0,4,256); const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; scene.background=t; }
scene.fog=new THREE.FogExp2(0x2a1c1e,0.0105);
const camera=new THREE.PerspectiveCamera(60,1,0.3,400);
scene.add(new THREE.HemisphereLight(0x7088b8,0x3a2418,1.1));
const sun=new THREE.DirectionalLight(0xffa868,2.6); sun.position.set(-40,50,-30); sun.castShadow=true;
const SS=lowQ?1024:2048; sun.shadow.mapSize.set(SS,SS); Object.assign(sun.shadow.camera,{left:-45,right:45,top:45,bottom:-45,near:1,far:160}); sun.shadow.bias=-0.0005;
scene.add(sun,sun.target);
const rim=new THREE.DirectionalLight(0x40a0ff,0.9); rim.position.set(30,20,40); scene.add(rim);
const composer=new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(256,256),0.55,0.45,0.9); composer.addPass(bloom);
composer.addPass(new OutputPass());
function resize(){ const w=innerWidth,h=innerHeight; renderer.setSize(w,h,false); composer.setSize(w,h);
  bloom.resolution.set(w/(lowQ?3:2),h/(lowQ?3:2)); camera.aspect=w/h; camera.fov=w<h?78:60; camera.updateProjectionMatrix(); }
addEventListener('resize',resize); resize();

// ---------- assets ----------
const loader=new GLTFLoader(); const A={};
const files=['player','scout','brute','spider','titan','bld_tower','bld_block','bld_glass','props','arena'];
function prep(root){ root.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; const m=o.material; if(m&&m.emissiveIntensity!==undefined&&m.emissive&&m.emissive.getHex()) m.toneMapped=true; } }); return root; }
async function loadAll(onp){ let n=0; await Promise.all(files.map(f=>loader.loadAsync('assets/models/'+f+'.glb').then(g=>{A[f]=g; prep(g.scene); onp(++n/files.length);}))); }

// ---------- particles ----------
const MAXP=lowQ?1400:2600;
const pGeo=new THREE.BufferGeometry(); const pPos=new Float32Array(MAXP*3), pCol=new Float32Array(MAXP*3), pSize=new Float32Array(MAXP);
pGeo.setAttribute('position',new THREE.BufferAttribute(pPos,3)); pGeo.setAttribute('color',new THREE.BufferAttribute(pCol,3)); pGeo.setAttribute('size',new THREE.BufferAttribute(pSize,1));
const spr=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.35,'rgba(255,255,255,.55)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);})();
const pMat=new THREE.ShaderMaterial({uniforms:{map:{value:spr},scale:{value:innerHeight}},vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
 vertexShader:`attribute float size;varying vec3 vC;uniform float scale;void main(){vC=color;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=size*scale/-mv.z;gl_Position=projectionMatrix*mv;}`,
 fragmentShader:`uniform sampler2D map;varying vec3 vC;void main(){vec4 t=texture2D(map,gl_PointCoord);gl_FragColor=vec4(vC*t.a,t.a);}`});
const pts=new THREE.Points(pGeo,pMat); pts.frustumCulled=false; scene.add(pts);
// smoke (normal blending)
const sGeo=new THREE.BufferGeometry(); const MAXS=lowQ?300:600; const sPos=new Float32Array(MAXS*3), sCol=new Float32Array(MAXS*3), sSize=new Float32Array(MAXS);
sGeo.setAttribute('position',new THREE.BufferAttribute(sPos,3)); sGeo.setAttribute('color',new THREE.BufferAttribute(sCol,3)); sGeo.setAttribute('size',new THREE.BufferAttribute(sSize,1));
const sMat=pMat.clone(); sMat.uniforms.map.value=spr; sMat.blending=THREE.NormalBlending; sMat.fragmentShader=`uniform sampler2D map;varying vec3 vC;void main(){vec4 t=texture2D(map,gl_PointCoord);gl_FragColor=vec4(vC,t.a*.55);}`;
const smk=new THREE.Points(sGeo,sMat); smk.frustumCulled=false; scene.add(smk);
const P=[],SM=[];
function emit(pos,n,o){ for(let i=0;i<n;i++){ const arr=o.smoke?SM:P; if(arr.length>=(o.smoke?MAXS:MAXP))arr.shift();
  const sp=o.speed||8; const d=new V3(rnd(-1,1),rnd(o.up??-0.2,1),rnd(-1,1)).normalize().multiplyScalar(sp*rnd(.3,1));
  arr.push({p:pos.clone().add(new V3(rnd(-1,1),rnd(-1,1),rnd(-1,1)).multiplyScalar(o.spread||0.3)),v:d,life:o.life*rnd(.6,1.2),max:0,c:o.color,s:o.size*rnd(.7,1.3),g:o.grav??-12,grow:o.grow||0});
  arr[arr.length-1].max=arr[arr.length-1].life; } }
const COL={spark:new THREE.Color(3,1.6,.5),fire:new THREE.Color(2.5,.8,.15),blue:new THREE.Color(.5,2,3),red:new THREE.Color(3,.3,.2),dust:new THREE.Color(.32,.28,.25),dark:new THREE.Color(.08,.07,.07),gold:new THREE.Color(2.5,1.8,.4),ember:new THREE.Color(2,.5,.1)};
function updParticles(dt){
  const run=(arr,pos,col,size)=>{ for(let i=arr.length-1;i>=0;i--){const q=arr[i];q.life-=dt;if(q.life<=0){arr.splice(i,1);continue;}
    q.v.y+=q.g*dt; q.v.multiplyScalar(1-dt*1.5); q.p.addScaledVector(q.v,dt); if(q.p.y<0.05){q.p.y=0.05;q.v.y*=-.3;} q.s+=q.grow*dt; }
    for(let i=0;i<arr.length;i++){const q=arr[i],k=q.life/q.max; pos[i*3]=q.p.x;pos[i*3+1]=q.p.y;pos[i*3+2]=q.p.z; col[i*3]=q.c.r*k;col[i*3+1]=q.c.g*k;col[i*3+2]=q.c.b*k; size[i]=q.s*(arr===SM?1:(.4+.6*k)); }
    return arr.length; };
  pGeo.setDrawRange(0,run(P,pPos,pCol,pSize)); sGeo.setDrawRange(0,run(SM,sPos,sCol,sSize));
  for(const a of ['position','color','size']){pGeo.attributes[a].needsUpdate=true; sGeo.attributes[a].needsUpdate=true;}
}
function explode(pos,big=1){ emit(pos,30*big,{color:COL.fire,speed:14*big,life:.7,size:2.2*big,up:0}); emit(pos,20*big,{color:COL.spark,speed:24*big,life:.5,size:.6,grav:-20}); emit(pos,10*big,{smoke:true,color:COL.dark,speed:4*big,life:2,size:5*big,grav:2,grow:4}); ring(pos,8*big,0xff7030); light(pos,0xff7030,40*big,.35); }
// shockwave rings & flash lights (code VFX)
const rings=[]; const ringGeo=new THREE.RingGeometry(.85,1,48); ringGeo.rotateX(-Math.PI/2);
function ring(pos,r,color,t=.5){ const m=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  m.position.copy(pos); m.position.y=.15; scene.add(m); rings.push({m,r,t,max:t}); }
const lights=[]; const lpool=[]; for(let i=0;i<4;i++){const l=new THREE.PointLight(0xffffff,0,30,2); scene.add(l); lpool.push(l);}
function light(pos,c,int,t){ const l=lpool.find(l=>l.intensity===0)||lpool[0]; l.position.copy(pos).y+=2; l.color.setHex(c); l.intensity=int; lights.push({l,t,max:t,int}); }

// ---------- state ----------
const save=Object.assign({scrap:0,best:0,up:{armor:0,fists:0,cannon:0,thrust:0,reactor:0}},S.loadData('titanfalls_v1')||{});
const UPS=[['armor','ARMOR PLATING','+30 max armor'],['fists','HYDRAULIC FISTS','+25% punch damage'],['cannon','ARC CANNON','+25% damage, faster fire'],['thrust','THRUSTERS','faster dash, more jet fuel'],['reactor','REACTOR','armor regen + finisher heal']];
const cost=(k,l)=>Math.round([60,50,50,45,70][UPS.findIndex(u=>u[0]===k)]*Math.pow(1.7,l));
const persist=()=>S.saveData('titanfalls_v1',save);
let state='loading', wave=0, runScrap=0, revived=false, timeScale=1, slowT=0, shake=0, lastAdTime=0;
const world={buildings:[],props:[],enemies:[],proj:[],pickups:[],debris:[],markers:[],waves:[]};

// ---------- actors ----------
function makeActor(key,scale=1){
  const root=SkeletonUtils.clone(A[key].scene); root.scale.setScalar(scale);
  const mats=[]; root.traverse(o=>{if(o.isMesh){o.material=o.material.clone(); mats.push({m:o.material,e:o.material.emissive.clone(),ei:o.material.emissiveIntensity});}});
  const mixer=new THREE.AnimationMixer(root); const acts={};
  for(const c of A[key].animations){ const a=mixer.clipAction(c); acts[c.name]=a; if(['punch','dash','death'].includes(c.name)){a.setLoop(THREE.LoopOnce); a.clampWhenFinished=true;} }
  scene.add(root);
  const actor={root,mixer,acts,mats,cur:null,flashT:0};
  actor.play=(n,fade=.15,ts=1)=>{ const a=acts[n]; if(!a)return; if(actor.cur===n&&!['punch','dash'].includes(n)){a.timeScale=ts;return;} const prev=acts[actor.cur]; a.reset(); a.timeScale=ts; a.enabled=true; a.setEffectiveWeight(1); a.play(); if(prev&&prev!==a)prev.crossFadeTo(a,fade,false); actor.cur=n; };
  actor.flash=(c=0xffffff,t=.1)=>{ actor.flashT=t; for(const q of mats){q.m.emissive.setHex(c); q.m.emissiveIntensity=1.2;} };
  actor.updFlash=dt=>{ if(actor.flashT>0){actor.flashT-=dt; if(actor.flashT<=0) for(const q of mats){q.m.emissive.copy(q.e); q.m.emissiveIntensity=q.ei;}} };
  return actor;
}
const player={pos:new V3(),vy:0,yaw:0,face:0,hp:100,maxHp:100,fuel:1,dashT:0,dashCd:0,inv:0,atkT:0,combo:0,comboT:0,fireCd:0,heat:0,dead:false,air:false,slam:false};
let pa=null;
const stats=()=>{const u=save.up;return{maxHp:100+30*u.armor,punch:22*(1+.25*u.fists),cannon:7*(1+.25*u.cannon),fireRate:.16-.015*u.cannon,dashCd:1.1-.12*u.thrust,fuelUse:.55-.06*u.thrust,regen:.6*u.reactor};};

const ETYPES={
 scout:{hp:45,speed:7.5,dmg:8,range:3.4,cd:1.1,scale:1,r:1.1,scrap:6,ws:1.7,hitY:1.8},
 spider:{hp:70,speed:5,dmg:10,range:20,cd:2.3,scale:1,r:2,scrap:9,ws:1.3,hitY:1.6,ranged:true},
 brute:{hp:170,speed:4,dmg:22,range:5.5,cd:2,scale:1,r:2.2,scrap:16,ws:.9,hitY:3.2,charge:true},
 titan:{hp:1000,speed:3.2,dmg:30,range:11,cd:2.6,scale:1,r:5,scrap:120,ws:.6,hitY:9,boss:true},
};
function spawnEnemy(type,hpMul=1){
  const T=ETYPES[type]; const a=makeActor(type,T.scale);
  const ang=Math.random()*Math.PI*2, R=T.boss?48:rnd(40,55);
  const e={type,T,a,pos:new V3(Math.cos(ang)*R,T.boss?0:30,Math.sin(ang)*R),vel:new V3(),hp:T.hp*hpMul,max:T.hp*hpMul,cd:rnd(.5,1.5),atk:0,stun:0,dead:false,deadT:0,face:0,drop:!T.boss,charge:0,tele:0,stompCd:6,barCd:10};
  a.root.position.copy(e.pos); a.play('idle'); world.enemies.push(e);
  if(T.boss){ shake=1; S.happytime&&0; msg('⚠ TITAN INBOUND ⚠',2.5); $('bosswrap').classList.remove('hide'); Sfx.horn(); }
  return e;
}

// ---------- world ----------
const BLD=[['bld_tower',9,9],['bld_block',13,10],['bld_glass',10,10]];
function buildWorld(){
  scene.add(A.arena.scene);
  const spots=[]; for(const x of [-46,-27]) for(const z of [-46,-27]) for(const sx of[1,-1]) for(const sz of[1,-1]) spots.push([x*sx,z*sz]);
  spots.forEach(([x,z],i)=>{ const t=BLD[i%3]; const g=A[t[0]].scene; const intact=g.getObjectByName('intact').clone(); const rot=(i%4)*Math.PI/2;
    const holder=new THREE.Group(); holder.position.set(x+rnd(-2,2),0,z+rnd(-2,2)); holder.rotation.y=rot; holder.add(intact); scene.add(holder);
    const sw=(i%2)?t[2]:t[1], sd=(i%2)?t[1]:t[2];
    world.buildings.push({key:t[0],holder,intact,hp:260,w:sw/2+.3,d:sd/2+.3,alive:true,x:holder.position.x,z:holder.position.z}); });
  const pr=A.props.scene; const place=(n,x,z,ry=0,solid=0)=>{const o=pr.getObjectByName(n).clone(); o.position.set(x,0,z); o.rotation.y=ry; scene.add(o); if(solid)world.props.push({o,x,z,r:solid,hp:30}); return o;};
  for(let i=-5;i<=5;i++){ if(Math.abs(i)<2)continue; place('streetlight',9.5,i*11,Math.PI); place('streetlight',-9.5,i*11+5,0); }
  const fires=[];
  for(let i=0;i<10;i++){ const ang=rnd(0,6.28),R=rnd(16,38); const n=Math.random()<.5?'wreck':'car'; place(n,Math.cos(ang)*R,Math.sin(ang)*R,rnd(0,6.28),2.2); if(n==='wreck')fires.push(new V3(Math.cos(ang)*R,1,Math.sin(ang)*R)); }
  for(let i=0;i<8;i++){ const ang=i/8*6.28+.3; place(i%2?'barrier':'crate',Math.cos(ang)*21,Math.sin(ang)*21,ang,1.4); }
  for(let i=0;i<6;i++){ const ang=rnd(0,6.28),R=rnd(30,55); place('rubble',Math.cos(ang)*R,Math.sin(ang)*R,rnd(0,6)); }
  world.fires=fires;
  const fl=new THREE.PointLight(0xff6020,30,25,2); fl.position.copy(fires[0]||new V3(10,1,10)).y=3; scene.add(fl); world.fireLight=fl;
}
function collideCircle(p,r){
  for(const b of world.buildings){ if(!b.alive)continue; const dx=p.x-b.x,dz=p.z-b.z; const cx=Math.max(-b.w,Math.min(b.w,dx)),cz=Math.max(-b.d,Math.min(b.d,dz)); const ox=dx-cx,oz=dz-cz; const d=Math.hypot(ox,oz);
    if(d<r){ if(d>1e-4){p.x+=ox/d*(r-d);p.z+=oz/d*(r-d);} else {p.x=b.x+Math.sign(dx||1)*(b.w+r);} return b; } }
  for(const q of world.props){ const dx=p.x-q.x,dz=p.z-q.z,d=Math.hypot(dx,dz),rr=r+q.r; if(d<rr&&d>1e-4){p.x+=dx/d*(rr-d);p.z+=dz/d*(rr-d);} }
  const L=59-r; p.x=Math.max(-L,Math.min(L,p.x)); p.z=Math.max(-L,Math.min(L,p.z)); return null;
}
function damageBuilding(b,d,from){ if(!b||!b.alive)return; b.hp-=d; b.intact.position.set(rnd(-.15,.15),0,rnd(-.15,.15)); if(b.hp<=0) collapse(b,from); }
function collapse(b,from){
  b.alive=false; b.holder.remove(b.intact);
  const ch=A[b.key].scene.getObjectByName('chunks').clone(); b.holder.add(ch); b.holder.updateMatrixWorld(true);
  const c=new V3(b.x,0,b.z); const away=from?tmp.copy(c).sub(from).setY(0).normalize():new V3();
  for(const k of [...ch.children]){ const wp=k.getWorldPosition(new V3()); const v=wp.clone().sub(c).setY(0).normalize().multiplyScalar(rnd(2,7)).addScaledVector(away,rnd(2,8)); v.y=rnd(1,6);
    world.debris.push({o:k,v,av:new V3(rnd(-2,2),rnd(-2,2),rnd(-2,2)),t:0,h:wp.y,delay:wp.y*0.025}); }
  for(let i=0;i<6;i++) emit(new V3(b.x+rnd(-5,5),rnd(1,12),b.z+rnd(-5,5)),6,{smoke:true,color:COL.dust,speed:6,life:3.5,size:9,grav:.5,grow:6,spread:3});
  emit(new V3(b.x,4,b.z),40,{color:COL.spark,speed:20,life:.8,size:.7,spread:4}); ring(new V3(b.x,0,b.z),22,0xffa060,.8);
  shake=Math.max(shake,1.2); Sfx.collapse(); addScrap(10,new V3(b.x,1,b.z),3);
}
function updDebris(dt){ for(let i=world.debris.length-1;i>=0;i--){ const d=world.debris[i]; if(d.delay>0){d.delay-=dt;continue;} d.t+=dt;
  if(d.t<3){ d.v.y-=22*dt; d.o.position.addScaledVector(d.v,dt); d.o.rotation.x+=d.av.x*dt; d.o.rotation.z+=d.av.z*dt; if(d.o.position.y<1){d.o.position.y=1; d.v.multiplyScalar(.4); d.v.y=Math.abs(d.v.y)*.2; d.av.multiplyScalar(.5);} }
  else if(d.t<6){ d.o.position.y-=dt*.8; } else { d.o.parent&&d.o.parent.remove(d.o); world.debris.splice(i,1);} } }

// ---------- pickups ----------
function addScrap(n,pos,count=1){ for(let i=0;i<count;i++){ const o=A.props.scene.getObjectByName('scrap').clone(); o.position.copy(pos).add(new V3(rnd(-1,1),.5,rnd(-1,1))); scene.add(o); world.pickups.push({o,v:new V3(rnd(-5,5),rnd(6,10),rnd(-5,5)),val:Math.ceil(n/count),t:0}); } }
function updPickups(dt){ for(let i=world.pickups.length-1;i>=0;i--){ const q=world.pickups[i]; q.t+=dt; q.o.rotation.y+=dt*3;
  const d=tmp.copy(player.pos).setY(1.5).sub(q.o.position); const L=d.length();
  if(q.t>.6&&L<12&&!player.dead){ q.v.lerp(d.normalize().multiplyScalar(28),dt*6); } else { q.v.y-=20*dt; q.v.x*=.97;q.v.z*=.97; }
  q.o.position.addScaledVector(q.v,dt); if(q.o.position.y<.5){q.o.position.y=.5;q.v.y=Math.abs(q.v.y)*.4;}
  if(L<1.8&&q.t>.6||q.t>20){ if(q.t<=20){runScrap+=q.val; Sfx.pick();} scene.remove(q.o); world.pickups.splice(i,1);} } }

// ---------- projectiles ----------
const boltGeo=new THREE.SphereGeometry(.35,8,6); const boltMat=new THREE.MeshBasicMaterial({color:new THREE.Color(1.5,4,6)}); const orbMat=new THREE.MeshBasicMaterial({color:new THREE.Color(5,1,6)}); const misMat=new THREE.MeshBasicMaterial({color:new THREE.Color(6,1.5,.6)});
function shoot(from,dir,speed,dmg,enemy,mat,size=1){ const m=new THREE.Mesh(boltGeo,mat); m.scale.set(size,size,size*(enemy?1:2.5)); m.position.copy(from); m.lookAt(tmp.copy(from).add(dir)); scene.add(m); world.proj.push({m,v:dir.clone().multiplyScalar(speed),dmg,enemy,t:0}); }
function updProj(dt){ for(let i=world.proj.length-1;i>=0;i--){ const p=world.proj[i]; p.t+=dt; p.m.position.addScaledVector(p.v,dt); let hit=false; const pp=p.m.position;
  if(!lowQ||i%2==0) emit(pp,1,{color:p.enemy?(p.m.material===orbMat?new THREE.Color(1.5,.3,2):COL.fire):COL.blue,speed:.5,life:.25,size:.8,grav:0});
  if(p.enemy){ if(!player.dead&&pp.distanceTo(tmp.copy(player.pos).setY(player.pos.y+2))<1.8){ hurtPlayer(p.dmg,pp); hit=true; } }
  else for(const e of world.enemies){ if(e.dead)continue; if(pp.distanceTo(tmp.copy(e.pos).setY(e.pos.y+e.T.hitY))<e.T.r+.8){ hurtEnemy(e,p.dmg,p.v.clone().normalize().multiplyScalar(2)); hit=true; break; } }
  if(!hit) for(const b of world.buildings){ if(b.alive&&Math.abs(pp.x-b.x)<b.w&&Math.abs(pp.z-b.z)<b.d&&pp.y<25){ damageBuilding(b,p.dmg*.6,pp); hit=true; break; } }
  if(pp.y<0.1) hit=true;
  if(hit||p.t>2.5){ emit(pp,8,{color:p.enemy?COL.red:COL.blue,speed:10,life:.3,size:.7}); scene.remove(p.m); world.proj.splice(i,1);} } }

// ---------- combat ----------
function msg(t,dur=1.6){ const m=$('msg'); m.textContent=t; m.style.opacity=1; clearTimeout(msg.h); msg.h=setTimeout(()=>m.style.opacity=0,dur*1000); }
function hurtPlayer(d,from){ if(player.inv>0||player.dead||state!=='play')return; player.hp-=d; shake=Math.max(shake,.5); $('flash').style.opacity=1; setTimeout(()=>$('flash').style.opacity=0,120); pa.flash(0xff2000,.08); Sfx.hit();
  if(player.hp<=0){ player.hp=0; die(); } }
function hurtEnemy(e,d,kb){ if(e.dead)return; e.hp-=d; e.a.flash(0xffffff,.07); if(kb&&!e.T.boss){ e.vel.add(kb); e.stun=Math.max(e.stun,.25);} emit(tmp.copy(e.pos).setY(e.pos.y+e.T.hitY),6,{color:COL.spark,speed:14,life:.35,size:.6});
  if(e.hp<=0) killEnemy(e); }
function killEnemy(e){ e.dead=true; e.a.play('death',.1); explode(tmp.copy(e.pos).setY(e.T.hitY),e.T.boss?3:1); Sfx.boom(e.T.boss?2:1); addScrap(e.T.scrap,e.pos,e.T.boss?12:3);
  if(e.T.boss){ S.happytime(); slowT=1.2; msg('TITAN DOWN',2.5); $('bosswrap').classList.add('hide'); for(let i=0;i<6;i++)setTimeout(()=>explode(new V3(e.pos.x+rnd(-5,5),rnd(3,12),e.pos.z+rnd(-5,5)),2),i*180); } }
function nearestEnemy(maxD,cone){ let best=null,bd=maxD; const fx=Math.sin(player.yaw),fz=Math.cos(player.yaw);
  for(const e of world.enemies){ if(e.dead||e.pos.y>2)continue; const dx=e.pos.x-player.pos.x,dz=e.pos.z-player.pos.z,d=Math.hypot(dx,dz)-e.T.r; if(d>bd)continue; if(cone&&(dx*fx+dz*fz)/Math.max(d,0.1)<cone)continue; best=e;bd=d; } return best; }
function doPunch(){
  if(player.atkT>0||player.dead)return; const st=stats();
  if(player.air&&player.pos.y>3){ player.slam=true; player.vy=-40; pa.play('punch',.05,1.4); player.atkT=.5; return; }
  player.combo=player.comboT>0?(player.combo+1)%3:0; player.comboT=.9; player.atkT=player.combo===2?.42:.3;
  const t=nearestEnemy(9,-.2); if(t) player.face=Math.atan2(t.pos.x-player.pos.x,t.pos.z-player.pos.z);
  pa.play('punch',.05,player.combo===2?1.5:1.9); Sfx.swing();
  setTimeout(()=>{ if(player.dead)return; const fx=Math.sin(player.face),fz=Math.cos(player.face); let any=false;
    const hp=new V3(player.pos.x+fx*2.8,player.pos.y+2,player.pos.z+fz*2.8);
    for(const e of world.enemies){ if(e.dead)continue; const d=Math.hypot(e.pos.x-hp.x,e.pos.z-hp.z)-e.T.r; if(d<2.4&&Math.abs(e.pos.y-player.pos.y)<6){
      const fin=e.hp<=e.max*.25&&!e.T.boss||(e.T.boss&&e.hp<=st.punch*3);
      let dmg=st.punch*(player.combo===2?1.8:1); if(fin){ dmg=e.hp+1; finisher(e); }
      hurtEnemy(e,dmg,new V3(fx,0,fz).multiplyScalar(player.combo===2?22:9)); any=true; } }
    for(const b of world.buildings){ if(b.alive&&Math.abs(hp.x-b.x)<b.w+1.5&&Math.abs(hp.z-b.z)<b.d+1.5){ damageBuilding(b,st.punch*.7,player.pos); any=true; } }
    if(any){ Sfx.punch(); shake=Math.max(shake,player.combo===2?.6:.3); emit(hp,18,{color:COL.spark,speed:18,life:.35,size:.8}); ring(hp,4,0x60e0ff,.25); hitstop(.06);} },player.combo===2?140:100);
}
function finisher(e){ slowT=.55; $('finish').style.opacity=1; setTimeout(()=>$('finish').style.opacity=0,700); runScrap+=5; player.hp=Math.min(stats().maxHp,player.hp+4*save.up.reactor+3); Sfx.finisher(); shake=1; }
let stopT=0; const hitstop=t=>stopT=Math.max(stopT,t);
function doFire(){ const st=stats(); if(player.fireCd>0||player.heat>=1||player.dead)return; player.fireCd=st.fireRate; player.heat+=.07;
  const t=nearestEnemy(45,.75); const fx=Math.sin(player.yaw),fz=Math.cos(player.yaw); const side=(shoot.s=-(shoot.s||1));
  const from=new V3(player.pos.x+Math.cos(player.yaw)*side*1.0+fx*.8,player.pos.y+3.35,player.pos.z-Math.sin(player.yaw)*side*1.0+fz*.8);
  const dir=t?tmp2.copy(t.pos).setY(t.pos.y+t.T.hitY).sub(from).normalize():new V3(fx,-.02,fz);
  shoot(from,dir,70,st.cannon,false,boltMat); emit(from,4,{color:COL.blue,speed:6,life:.15,size:1}); Sfx.zap(); if(!t) player.face=player.yaw; else player.face=Math.atan2(dir.x,dir.z); }
function doDash(){ if(player.dashCd>0||player.dead)return; player.dashT=.24; player.dashCd=stats().dashCd; player.inv=.35; pa.play('dash',.05,1.6); Sfx.dash(); }
function die(){ player.dead=true; pa.play('death',.1); slowT=1; explode(player.pos.clone().setY(2),1.5); S.gameplayStop();
  setTimeout(()=>{ state='dead'; $('deadInfo').innerHTML=`Reached wave <b>${wave}</b> · ⬢ <b>${runScrap}</b> scrap collected`; $('revive').classList.toggle('hide',revived); show('dead'); exitLock(); },1600); }

// ---------- enemies ----------
function updEnemies(dt){
  let alive=0;
  for(let i=world.enemies.length-1;i>=0;i--){ const e=world.enemies[i]; e.a.mixer.update(dt*(e.T.boss?1:1)); e.a.updFlash(dt);
    if(e.dead){ e.deadT+=dt; if(e.deadT>2.5){ e.a.root.position.y-=dt*2; } if(e.deadT>4){ scene.remove(e.a.root); world.enemies.splice(i,1);} continue; }
    alive++;
    if(e.pos.y>0){ e.pos.y-=dt*35; if(e.pos.y<=0){ e.pos.y=0; emit(e.pos.clone(),12,{smoke:true,color:COL.dust,speed:6,life:1.2,size:3,grav:0,grow:3}); ring(e.pos,6,0xffa040,.4); } e.a.root.position.copy(e.pos); continue; }
    const T=e.T, dx=player.pos.x-e.pos.x, dz=player.pos.z-e.pos.z, dist=Math.hypot(dx,dz); const tf=Math.atan2(dx,dz);
    e.cd-=dt; e.stun-=dt; e.atk-=dt;
    let spd=0;
    if(e.stun<=0&&!player.dead){
      if(e.charge>0){ e.charge-=dt; const fx=Math.sin(e.face),fz=Math.cos(e.face); e.pos.x+=fx*26*dt; e.pos.z+=fz*26*dt; if(Math.random()<.5)emit(e.pos.clone().setY(.5),2,{smoke:true,color:COL.dust,speed:2,life:.8,size:2.5,grav:0,grow:2});
        if(dist<T.r+1.5&&!e.hitDone){ e.hitDone=true; hurtPlayer(T.dmg,e.pos); } }
      else if(e.tele>0){ e.tele-=dt; e.face=lerpAng(e.face,tf,dt*6); if(e.tele<=0){ e.charge=.65; e.hitDone=false; e.a.play('dash',.05,1); Sfx.roar(); } }
      else if(e.atk>0){ /* winding */ }
      else {
        e.face=lerpAng(e.face,tf,dt*(T.boss?1.5:5));
        const want=T.ranged?16:T.range*.8;
        if(T.charge&&dist>10&&dist<26&&e.cd<=0){ e.tele=.8; e.cd=T.cd+2; e.a.flash(0xff6000,.8); }
        else if(T.ranged&&dist<T.range+4&&e.cd<=0){ e.cd=T.cd; e.atk=.5; e.a.play('punch',.1,1.2); setTimeout(()=>{ if(e.dead)return; const from=e.pos.clone().setY(1.6); from.x+=Math.sin(e.face)*1.4; from.z+=Math.cos(e.face)*1.4; const to=player.pos.clone().setY(player.pos.y+2); shoot(from,to.sub(from).normalize(),26,T.dmg,true,orbMat,1.2); Sfx.plasma(); },250); }
        else if(!T.ranged&&dist<T.range+T.r&&e.cd<=0){ e.cd=T.cd; e.atk=.6; e.a.play('punch',.08,T.boss?.8:1.2); e.a.flash(0xff3000,.15);
          setTimeout(()=>{ if(e.dead)return; const fx=Math.sin(e.face),fz=Math.cos(e.face); const hx=e.pos.x+fx*T.range*.6,hz=e.pos.z+fz*T.range*.6;
            if(Math.hypot(player.pos.x-hx,player.pos.z-hz)<T.range*.6+1.5&&player.pos.y<T.hitY+2) hurtPlayer(T.dmg,e.pos);
            if(T.boss){ ring(new V3(hx,0,hz),9,0xff3020,.4); shake=Math.max(shake,.8); Sfx.boom(1.2); } },T.boss?560:300); }
        else if(dist>want||(T.ranged&&dist>want-3)) spd=T.speed;
        else if(T.ranged&&dist<want-5) spd=-T.speed*.6;
        if(T.boss){ e.stompCd-=dt; e.barCd-=dt;
          if(e.stompCd<=0){ e.stompCd=rnd(6,8); e.atk=1; e.a.play('punch',.1,.9); msg('JUMP!',1); setTimeout(()=>{ if(e.dead)return; world.waves.push({c:e.pos.clone(),r:2,hit:false}); shake=1.5; Sfx.boom(2); explode(e.pos.clone().setY(.5),1.5); },700); }
          if(e.barCd<=0){ e.barCd=rnd(9,12); for(let k=0;k<7;k++){ const p=player.pos.clone().add(new V3(rnd(-7,7),0,rnd(-7,7))); if(k===0)p.copy(player.pos); p.y=0; marker(p,1.3+k*.12);} Sfx.alarm(); }
        }
      }
    }
    if(spd){ e.pos.x+=Math.sin(e.face)*spd*dt; e.pos.z+=Math.cos(e.face)*spd*dt; }
    e.pos.addScaledVector(e.vel,dt); e.vel.multiplyScalar(Math.max(0,1-dt*6));
    // separation
    for(const o of world.enemies){ if(o===e||o.dead)continue; const ox=e.pos.x-o.pos.x,oz=e.pos.z-o.pos.z,d=Math.hypot(ox,oz),rr=T.r+o.T.r; if(d<rr&&d>1e-3){ e.pos.x+=ox/d*(rr-d)*.5; e.pos.z+=oz/d*(rr-d)*.5; } }
    const pd=Math.hypot(e.pos.x-player.pos.x,e.pos.z-player.pos.z); if(pd<T.r+1.3&&pd>1e-3&&player.pos.y<T.hitY){ const k=(T.r+1.3-pd)/pd; e.pos.x+=(e.pos.x-player.pos.x)*k*.5; e.pos.z+=(e.pos.z-player.pos.z)*k*.5; }
    const hb=collideCircle(e.pos,T.r); if(hb&&(T.boss||e.charge>0)) damageBuilding(hb,T.boss?400:120,e.pos);
    e.a.root.position.copy(e.pos); e.a.root.rotation.y=e.face+Math.PI;
    if(e.charge<=0&&e.atk<=0&&e.a.cur!=='punch'||(e.a.cur==='punch'&&!e.a.acts.punch.isRunning())||(e.a.cur==='dash'&&e.charge<=0)){ e.a.play(spd?'walk':'idle',.2,spd?T.ws*Math.sign(spd):1); }
    if(T.boss){ $('bosshp').style.width=(e.hp/e.max*100)+'%'; if(Math.random()<dt*2&&spd){ shake=Math.max(shake,.25); Sfx.stomp(); emit(e.pos.clone().setY(.3),8,{smoke:true,color:COL.dust,speed:5,life:1.4,size:4,grav:0,grow:3}); } }
  }
  return alive;
}
const lerpAng=(a,b,t)=>{ let d=((b-a+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI; return a+d*Math.min(1,t); };
const mkGeo=new THREE.RingGeometry(3.4,4,32); mkGeo.rotateX(-Math.PI/2);
function marker(p,t){ const m=new THREE.Mesh(mkGeo,new THREE.MeshBasicMaterial({color:new THREE.Color(4,.4,.2),transparent:true,opacity:.8,depthWrite:false})); m.position.copy(p).y=.12; scene.add(m); world.markers.push({m,t,max:t}); }
function updHazards(dt){
  for(let i=world.markers.length-1;i>=0;i--){ const k=world.markers[i]; k.t-=dt; k.m.scale.setScalar(.4+.6*(1-k.t/k.max)); k.m.material.opacity=.5+.5*Math.sin(k.t*30);
    if(k.t<=0){ explode(k.m.position.clone().setY(1),1.2); if(Math.hypot(player.pos.x-k.m.position.x,player.pos.z-k.m.position.z)<4.2&&player.pos.y<5) hurtPlayer(18,k.m.position);
      for(const b of world.buildings) if(b.alive&&Math.abs(k.m.position.x-b.x)<b.w+3&&Math.abs(k.m.position.z-b.z)<b.d+3) damageBuilding(b,90,k.m.position);
      scene.remove(k.m); world.markers.splice(i,1); } }
  for(let i=world.waves.length-1;i>=0;i--){ const w=world.waves[i]; w.r+=dt*20;
    if(!w.m){ w.m=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:new THREE.Color(4,.8,.3),transparent:true,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending})); w.m.position.copy(w.c).y=.5; w.m.scale.y=8; scene.add(w.m);}
    w.m.scale.set(w.r,6,w.r); w.m.material.opacity=Math.max(0,1-w.r/40);
    const pd=Math.hypot(player.pos.x-w.c.x,player.pos.z-w.c.z); if(!w.hit&&Math.abs(pd-w.r)<1.6&&player.pos.y<1.5){ w.hit=true; hurtPlayer(25,w.c); }
    if(Math.random()<.6) emit(new V3(w.c.x+Math.cos(w.r*7)*w.r,.4,w.c.z+Math.sin(w.r*7)*w.r),2,{smoke:true,color:COL.dust,speed:2,life:.8,size:3,grav:0});
    if(w.r>40){ scene.remove(w.m); world.waves.splice(i,1);} }
}

// ---------- waves ----------
function startWave(){
  wave++; $('wave').textContent='WAVE '+wave; const boss=wave%5===0; msg(boss?'BOSS WAVE':'WAVE '+wave,1.6); Sfx.alarm();
  const list=[]; const n=Math.round(3+wave*1.6);
  for(let i=0;i<n;i++){ const r=Math.random(); list.push(wave>=3&&r<.18+wave*.01?'brute':wave>=2&&r<.5?'spider':'scout'); }
  if(boss){ list.length=Math.min(list.length,4); list.unshift('titan'); }
  const hpMul=1+wave*.08; let k=0;
  const tick=()=>{ if(state!=='play'&&state!=='paused'){return;} if(state==='paused'){setTimeout(tick,300);return;} if(k<list.length){ spawnEnemy(list[k],list[k]==='titan'?1+(wave/5-1)*.6:hpMul); k++; setTimeout(tick,k===1?300:rnd(500,1100)); } else world.spawning=false; };
  world.spawning=true; tick();
}
function waveCleared(){ const bonus=20+wave*10; runScrap+=bonus; msg('WAVE CLEARED',1.8); S.gameplayStop(); bank(); state='between';
  setTimeout(()=>{ if(state!=='between')return; openHangar(true); },1700); }
function bank(){ save.scrap+=runScrap; runScrap=0; save.best=Math.max(save.best,wave); persist(); }

// ---------- UI ----------
function show(id){ for(const p of ['title','hangar','dead','paused']) $(p).classList.toggle('hide',p!==id); $('screen').classList.toggle('hide',!id); $('hud').classList.toggle('hide',!(state==='play'||state==='paused'||state==='between'||state==='dead')); $('touch').classList.toggle('hide',!(isTouch&&state==='play')); }
function renderUps(){ $('hscrap').textContent='⬢ '+save.scrap; const box=$('ups'); box.innerHTML='';
  for(const [k,n,d] of UPS){ const l=save.up[k]; const c=cost(k,l); const div=document.createElement('div'); div.className='up';
    div.innerHTML=`<b>${n}<small>${d}</small></b><span class="pips">${'■'.repeat(l)}${'□'.repeat(5-l)}</span>`; const b=document.createElement('button');
    b.textContent=l>=5?'MAX':'⬢ '+c; b.disabled=l>=5||save.scrap<c; b.onclick=()=>{ save.scrap-=c; save.up[k]++; persist(); Sfx.buy(); renderUps(); }; div.appendChild(b); box.appendChild(div); } }
function openHangar(between){ $('nextWave').classList.toggle('hide',!between); $('hangBack').classList.toggle('hide',between); $('hangTitle').textContent=between?`WAVE ${wave} CLEARED — UPGRADE`:'HANGAR'; renderUps(); show('hangar'); exitLock(); }
function titleScreen(){ state='title'; $('best').textContent=save.best?`Best: wave ${save.best} · ⬢ ${save.scrap}`:''; show('title'); }
function resetRun(){ for(const e of world.enemies) scene.remove(e.a.root); world.enemies.length=0; for(const p of world.proj)scene.remove(p.m); world.proj.length=0; for(const k of world.markers)scene.remove(k.m); world.markers.length=0; for(const w of world.waves)w.m&&scene.remove(w.m); world.waves.length=0;
  const st=stats(); Object.assign(player,{hp:st.maxHp,dead:false,vy:0,fuel:1,inv:1,atkT:0,dashT:0,heat:0}); player.pos.set(0,0,0); pa.play('idle'); wave=0; runScrap=0; revived=false; $('bosswrap').classList.add('hide'); }
async function beginPlay(){ Sfx.unlock(); resetRun(); state='play'; show(null); S.gameplayStart(); requestLock(); setTimeout(startWave,600); }
async function nextWave(){ $('nextWave').disabled=true; if(wave>0){ await S.midgame(); } $('nextWave').disabled=false; player.hp=Math.min(stats().maxHp,player.hp+stats().maxHp*.35); state='play'; show(null); S.gameplayStart(); requestLock(); startWave(); }
$('play').onclick=beginPlay; $('hangarBtn').onclick=()=>openHangar(false); $('hangBack').onclick=titleScreen; $('nextWave').onclick=nextWave;
$('revive').onclick=async()=>{ const r=await S.rewarded(); if(r==='ok'||r==='unavailable'&&!S.sdkActive()&&/[?&]freead/.test(location.search)){ revived=true; player.dead=false; player.hp=stats().maxHp*.6; player.inv=2; pa.play('idle'); for(const e of world.enemies) if(!e.dead&&!e.T.boss) hurtEnemy(e,40,tmp.copy(e.pos).sub(player.pos).setY(0).normalize().multiplyScalar(20)); ring(player.pos,15,0x40e0ff,.6); state='play'; show(null); S.gameplayStart(); requestLock(); } else msg('Ad not available',1.5); };
$('double').onclick=async()=>{ const r=await S.rewarded(); if(r==='ok'){ runScrap*=2; $('double').classList.add('hide'); $('deadInfo').innerHTML+=' <br>⬢ doubled!'; } else msg('Ad not available',1.5); };
$('collect').onclick=()=>{ bank(); resetRun(); $('double').classList.remove('hide'); titleScreen(); };
function pause(){ if(state!=='play')return; state='paused'; S.gameplayStop(); show('paused'); exitLock(); }
$('pause').onclick=pause; $('resume').onclick=()=>{ state='play'; show(null); S.gameplayStart(); requestLock(); };
$('quit').onclick=()=>{ bank(); resetRun(); titleScreen(); };
$('mute').onclick=()=>{ Sfx.setMuted(!Sfx.muted); $('mute').textContent=Sfx.muted?'🔇':'🔊'; };
S.setAdHooks({onStart:()=>Sfx.adMute(true),onEnd:()=>Sfx.adMute(false)});
if(isTouch) $('helpDesk').textContent='Left stick move · drag right side to look · PUNCH / FIRE / DASH / JET';

// ---------- input ----------
const keys={}; const inp={mx:0,mz:0,punch:false,fire:false,dash:false,jet:false};
addEventListener('keydown',e=>{ keys[e.code]=true; if(e.code==='Escape'||e.code==='KeyP')pause(); if(e.code==='ShiftLeft'||e.code==='ShiftRight')inp.dash=true; if(e.code==='KeyJ'||e.code==='KeyF')inp.punch=true; if(e.code==='Space')e.preventDefault(); });
addEventListener('keyup',e=>{ keys[e.code]=false; });
addEventListener('blur',()=>{ for(const k in keys)keys[k]=false; pause(); });
document.addEventListener('visibilitychange',()=>{ if(document.hidden) pause(); });
function requestLock(){ if(!isTouch&&canvas.requestPointerLock){ try{ const p=canvas.requestPointerLock(); p&&p.catch&&p.catch(()=>{}); }catch(e){} } }
function exitLock(){ if(document.pointerLockElement) document.exitPointerLock(); }
let mouseDown=[false,false,false], drag=null;
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('mousedown',e=>{ if(state!=='play')return; if(!document.pointerLockElement) requestLock(); mouseDown[e.button]=true; if(e.button===0)inp.punch=true; });
addEventListener('mouseup',e=>{ mouseDown[e.button]=false; });
addEventListener('mousemove',e=>{ if(state!=='play'||isTouch)return; if(document.pointerLockElement) { player.yaw-=e.movementX*.0032; cam.pitch=Math.max(-.2,Math.min(.6,cam.pitch+e.movementY*.002)); } });
// touch
const stick=$('stick'),knob=$('knob'); let stickId=null,sc={x:0,y:0};
stick.addEventListener('pointerdown',e=>{ stickId=e.pointerId; stick.setPointerCapture(e.pointerId); const r=stick.getBoundingClientRect(); sc={x:r.left+r.width/2,y:r.top+r.height/2}; moveStick(e); });
stick.addEventListener('pointermove',e=>{ if(e.pointerId===stickId)moveStick(e); });
const endStick=e=>{ if(e.pointerId!==stickId)return; stickId=null; inp.mx=inp.mz=0; knob.style.transform=''; };
stick.addEventListener('pointerup',endStick); stick.addEventListener('pointercancel',endStick);
function moveStick(e){ let dx=e.clientX-sc.x,dy=e.clientY-sc.y; const L=Math.hypot(dx,dy),M=55; if(L>M){dx*=M/L;dy*=M/L;} knob.style.transform=`translate(${dx}px,${dy}px)`; inp.mx=dx/M; inp.mz=dy/M; }
const tbtn=(id,k)=>{ const b=$(id); b.addEventListener('pointerdown',e=>{e.preventDefault(); b.setPointerCapture(e.pointerId); inp[k]=true; b.classList.add('on'); if(k==='punch')inp.punchHold=true;});
  const up=()=>{ b.classList.remove('on'); if(k!=='punch'&&k!=='dash')inp[k]=false; inp.punchHold=false; }; b.addEventListener('pointerup',up); b.addEventListener('pointercancel',up); };
tbtn('bPunch','punch'); tbtn('bFire','fire'); tbtn('bDash','dash'); tbtn('bJet','jet');
canvas.addEventListener('pointerdown',e=>{ if(e.pointerType==='mouse'||state!=='play')return; drag={id:e.pointerId,x:e.clientX,y:e.clientY}; });
canvas.addEventListener('pointermove',e=>{ if(!drag||e.pointerId!==drag.id)return; player.yaw-=(e.clientX-drag.x)*.006; cam.pitch=Math.max(-.2,Math.min(.6,cam.pitch+(e.clientY-drag.y)*.003)); drag.x=e.clientX; drag.y=e.clientY; });
canvas.addEventListener('pointerup',e=>{ if(drag&&e.pointerId===drag.id)drag=null; });

// ---------- player update ----------
const cam={pitch:.22,pos:new V3(0,8,-12)};
function updPlayer(dt){
  const st=stats(); player.maxHp=st.maxHp;
  pa.mixer.update(dt); pa.updFlash(dt);
  if(player.dead){ pa.root.position.copy(player.pos); return; }
  let mx=inp.mx,mz=inp.mz; if(keys.KeyW||keys.ArrowUp)mz-=1; if(keys.KeyS||keys.ArrowDown)mz+=1; if(keys.KeyA||keys.ArrowLeft)mx-=1; if(keys.KeyD||keys.ArrowRight)mx+=1;
  const ml=Math.hypot(mx,mz); if(ml>1){mx/=ml;mz/=ml;}
  const fy=player.yaw; const fwd=new V3(Math.sin(fy),0,Math.cos(fy)), right=new V3(-Math.cos(fy),0,Math.sin(fy));
  const mv=new V3().addScaledVector(fwd,-mz).addScaledVector(right,mx);
  player.dashCd-=dt; player.inv-=dt; player.atkT-=dt; player.comboT-=dt; player.fireCd-=dt; player.heat=Math.max(0,player.heat-dt*.35);
  if(player.hp<st.maxHp&&st.regen) player.hp=Math.min(st.maxHp,player.hp+st.regen*dt);
  if(inp.punch||inp.punchHold||mouseDown[0]){ inp.punch=false; doPunch(); }
  if(inp.fire||mouseDown[2]||keys.KeyK||keys.KeyE) doFire();
  if(inp.dash){ inp.dash=false; doDash(); }
  const jet=inp.jet||keys.Space;
  let speed=11*(player.atkT>0?.35:1);
  if(player.dashT>0){ player.dashT-=dt; const d=ml>.1?mv.clone().normalize():new V3(Math.sin(player.face),0,Math.cos(player.face)); player.pos.addScaledVector(d,(34+save.up.thrust*3)*dt); player.face=Math.atan2(d.x,d.z); emit(player.pos.clone().setY(player.pos.y+2.6).addScaledVector(d,-1),3,{color:COL.blue,speed:3,life:.3,size:1.4,grav:0}); }
  else if(ml>.1){ player.pos.addScaledVector(mv,speed*dt); if(player.atkT<=0&&player.fireCd<-.3) player.face=lerpAng(player.face,Math.atan2(mv.x,mv.z),dt*10); }
  if(mouseDown[2]||inp.fire) player.face=lerpAng(player.face,player.yaw,dt*12);
  // jets / gravity
  if(jet&&player.fuel>0&&!player.slam){ player.vy=Math.min(player.vy+42*dt,10); player.fuel-=st.fuelUse*dt; const back=player.pos.clone().add(new V3(-Math.sin(player.face)*.9,2.6,-Math.cos(player.face)*.9)); emit(back,3,{color:COL.fire,speed:4,life:.25,size:1.4,up:-1,grav:-8}); Sfx.jet(true); }
  else { player.vy-=32*dt; Sfx.jet(false); }
  player.pos.y+=player.vy*dt; player.pos.y=Math.min(player.pos.y,18);
  if(player.pos.y<=0){ if(player.air&&player.vy<-14){ landImpact(player.slam); } player.pos.y=0; player.vy=0; player.air=false; player.slam=false; player.fuel=Math.min(1,player.fuel+dt*.45); } else player.air=true;
  collideCircle(player.pos,1.4);
  pa.root.position.copy(player.pos); pa.root.rotation.y=player.face+Math.PI;
  if(player.dashT<=0&&(player.atkT<=0||!pa.acts.punch.isRunning())){ if(ml>.1&&!player.air) pa.play('walk',.15,1.5*ml); else if(player.air) pa.play('idle',.2); else pa.play('idle',.25); }
}
function landImpact(slam){ const p=player.pos.clone(); shake=Math.max(shake,slam?1.2:.4); emit(p.clone().setY(.3),slam?30:10,{smoke:true,color:COL.dust,speed:slam?12:5,life:1.2,size:4,grav:0,grow:3}); Sfx.stomp();
  if(slam){ ring(p,14,0x40e0ff,.5); explode(p.clone().setY(.5),.8); for(const e of world.enemies){ if(e.dead)continue; const d=Math.hypot(e.pos.x-p.x,e.pos.z-p.z); if(d<9+e.T.r) hurtEnemy(e,stats().punch*2,tmp.copy(e.pos).sub(p).setY(0).normalize().multiplyScalar(25)); }
    for(const b of world.buildings) if(b.alive&&Math.abs(p.x-b.x)<b.w+6&&Math.abs(p.z-b.z)<b.d+6) damageBuilding(b,120,p); hitstop(.08); } }
function updCamera(dt,raw){
  const portrait=innerWidth<innerHeight; const dist=portrait?17:14; const h=4;
  const back=new V3(-Math.sin(player.yaw)*Math.cos(cam.pitch),Math.sin(cam.pitch),-Math.cos(player.yaw)*Math.cos(cam.pitch)).multiplyScalar(dist);
  const target=player.pos.clone().setY(player.pos.y+h); const want=target.clone().add(back); want.y=Math.max(1.5,want.y);
  cam.pos.lerp(want,Math.min(1,raw*10)); camera.position.copy(cam.pos);
  if(shake>0){ camera.position.add(new V3(rnd(-1,1),rnd(-1,1),rnd(-1,1)).multiplyScalar(shake*.5)); shake=Math.max(0,shake-raw*2.5); }
  camera.lookAt(target.x+Math.sin(player.yaw)*4,target.y+1,target.z+Math.cos(player.yaw)*4);
  sun.position.set(player.pos.x-40,50,player.pos.z-30); sun.target.position.copy(player.pos);
}
// ---------- loop ----------
const clock=new THREE.Clock(); let embersT=0, fps=60, frames=0, fpsT=0;
function frame(){
  requestAnimationFrame(frame); let raw=Math.min(clock.getDelta(),.05);
  frames++; fpsT+=raw; if(fpsT>1){fps=frames/fpsT;frames=0;fpsT=0;}
  if(slowT>0){slowT-=raw; timeScale=.25;} else timeScale=1;
  let dt=raw*timeScale; if(stopT>0){stopT-=raw; dt=0;}
  const playing=state==='play'||state==='between'||(state==='dead');
  if(pa){
    if(state==='play'||state==='between'){ updPlayer(dt); const alive=updEnemies(dt); updProj(dt); updHazards(dt); updPickups(dt); if(state==='play'&&!world.spawning&&alive===0&&wave>0&&!player.dead) waveCleared(); }
    else if(state==='dead'){ pa.mixer.update(dt); updEnemies(dt*.3); }
    else if(state==='title'||state==='loading'){ player.yaw+=raw*.08; pa.mixer.update(raw); }
    updDebris(dt);
    if(state!=='paused') updCamera(dt,raw);
    embersT+=raw; if(embersT>.05){ embersT=0; emit(new V3(player.pos.x+rnd(-30,30),rnd(0,15),player.pos.z+rnd(-30,30)),1,{color:COL.ember,speed:1.5,life:3,size:.35,grav:.4,spread:0});
      for(const f of world.fires||[]) if(Math.random()<.7){ emit(f.clone().add(new V3(0,rnd(0,.5),0)),1,{color:COL.fire,speed:2,life:.8,size:1.8,up:.5,grav:4,spread:.6}); if(Math.random()<.3) emit(f.clone().setY(2.5),1,{smoke:true,color:COL.dark,speed:1,life:3,size:3,grav:2.5,grow:2}); } }
    if(world.fireLight) world.fireLight.intensity=25+Math.sin(performance.now()*.02)*6+rnd(-4,4);
  }
  updParticles(state==='paused'?0:dt);
  for(let i=rings.length-1;i>=0;i--){ const r=rings[i]; r.t-=raw; const k=1-r.t/r.max; r.m.scale.setScalar(.5+r.r*k); r.m.material.opacity=1-k; if(r.t<=0){scene.remove(r.m); r.m.material.dispose(); rings.splice(i,1);} }
  for(let i=lights.length-1;i>=0;i--){ const l=lights[i]; l.t-=raw; l.l.intensity=Math.max(0,l.int*(l.t/l.max)); if(l.t<=0){l.l.intensity=0; lights.splice(i,1);} }
  if(state==='play'||state==='between'){ $('hp').style.width=(player.hp/player.maxHp*100)+'%'; $('fuel').style.width=(player.fuel*100)+'%'; $('scrap').textContent='⬢ '+(save.scrap+runScrap); $('enemies').textContent=world.enemies.filter(e=>!e.dead).length+' HOSTILES'; }
  if(!world.enemies.some(e=>e.T.boss&&!e.dead)) $('bosswrap').classList.add('hide');
  pMat.uniforms.scale.value=sMat.uniforms.scale.value=innerHeight*.9;
  composer.render();
}
// ---------- boot ----------
(async()=>{
  await S.initSDK(); S.loadingStart();
  const btn=$('play'); show('title');
  await loadAll(p=>btn.textContent='LOADING '+Math.round(p*100)+'%');
  buildWorld(); pa=makeActor('player'); player.yaw=Math.PI*.8; cam.pos.set(0,8,-14);
  S.loadingStop(); btn.disabled=false; btn.textContent='▶ PLAY'; titleScreen(); requestAnimationFrame(frame);
  window.TF={player,world,inp,keys,get state(){return state;},beginPlay,nextWave,S,spawnEnemy,collapse,get fps(){return fps;},sdkLog:S.sdkLog,cam,startWave,
    setWave:n=>{wave=n;}};
})();
