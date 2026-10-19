const express=require('express'),crypto=require('crypto'),fs=require('fs'),path=require('path'),G=require('./public/shared.js');
const app=express();app.use(express.json());app.use(express.static(path.join(__dirname,'public')));
const SECRET=process.env.SECRET||'dev-secret-change-me';
let db,MODE='file';
async function initDb(){
 if(process.env.DATABASE_URL){const{Pool}=require('pg');const url=process.env.DATABASE_URL;
  const p=new Pool({connectionString:url,ssl:/\.render\.com|sslmode=require/.test(url)?{rejectUnauthorized:false}:false});
  MODE='postgres';await p.query('create table if not exists users(name text primary key,hash text,salt text,data jsonb)');await p.query('create table if not exists clans(key text primary key,data jsonb)');
  db={cget:async k=>{const r=(await p.query('select data from clans where key=$1',[k])).rows[0];return r&&r.data},cput:async(k,v)=>{await p.query('insert into clans(key,data) values($1,$2) on conflict(key) do update set data=$2',[k,v])},cdel:async k=>{await p.query('delete from clans where key=$1',[k])},call:async()=>(await p.query("select key,data from clans where key not like 'war:%' and key<>'warq'")).rows,
   get:async n=>(await p.query('select * from users where name=$1',[n])).rows[0],
   put:async(n,u)=>{await p.query('insert into users(name,hash,salt,data) values($1,$2,$3,$4) on conflict(name) do update set data=$4',[n,u.hash,u.salt,u.data])},
   all:async()=>(await p.query('select name,data from users')).rows};
 }else{
  const f=path.join(process.env.DATA_DIR||__dirname,'data.json');let m={};try{m=JSON.parse(fs.readFileSync(f))}catch{}
  let tm;const save=()=>{clearTimeout(tm);tm=setTimeout(()=>fs.writeFile(f,JSON.stringify(m),()=>{}),400)};
  const cf=path.join(process.env.DATA_DIR||__dirname,'clans.json');let cm={};try{cm=JSON.parse(fs.readFileSync(cf))}catch{}let ct;const csave=()=>{clearTimeout(ct);ct=setTimeout(()=>fs.writeFile(cf,JSON.stringify(cm),()=>{}),400)};
  db={cget:async k=>cm[k],cput:async(k,v)=>{cm[k]=v;csave()},cdel:async k=>{delete cm[k];csave()},call:async()=>Object.entries(cm).filter(([k])=>!k.startsWith('war:')&&k!='warq').map(([key,data])=>({key,data})),get:async n=>m[n],put:async(n,u)=>{m[n]=u;save()},all:async()=>Object.entries(m).map(([name,u])=>({name,data:u.data}))};
 }}
const H=f=>(q,s)=>f(q,s).catch(e=>{console.error(e);s.status(500).json({err:'Server error'})});
const sign=(n,h)=>n+'.'+crypto.createHmac('sha256',SECRET).update(n+h).digest('hex');
const hashPw=(p,s)=>crypto.scryptSync(String(p),s,32).toString('hex');
const pick=a=>a[Math.floor(Math.random()*a.length)];
function newPlayer(name){const sheep=[0,1,2].map(()=>{let s;do s=G.roll(0);while(s.r>0);return s});
 return{name,coins:30,wool:0,t:Date.now(),sheep,b:{barn:0,shed:0,pasture:0,market:0,auto:0},team:sheep.map(s=>s.id),hatched:0,wins:0,losses:0,rating:1000,best:0,ach:[],dex:[],daily:0,streak:0,tut:0}}
app.post('/api/register',H(async(q,s)=>{let{name,pass}=q.body;name=String(name||'').trim();
 if(!/^[A-Za-z0-9_]{3,16}$/.test(name)||String(pass||'').length<4)return s.json({err:'Name: 3-16 letters/numbers/_. Password: 4+ characters.'});
 const k=name.toLowerCase();if(await db.get(k))return s.json({err:'That name is taken'});
 const salt=crypto.randomBytes(8).toString('hex'),hash=hashPw(pass,salt);await db.put(k,{hash,salt,data:newPlayer(name)});s.json({token:sign(k,hash)})}));
app.post('/api/login',H(async(q,s)=>{const k=String(q.body.name||'').trim().toLowerCase(),u=k&&await db.get(k);
 if(!u||hashPw(q.body.pass||'',u.salt)!==u.hash)return s.json({err:'Wrong name or password'});s.json({token:sign(k,u.hash)})}));
const auth=(q,s,next)=>{(async()=>{const t=q.get('x-token')||'',n=t.split('.')[0],u=n&&await db.get(n);
 if(!u||sign(n,u.hash)!==t)return s.status(401).json({err:'Please log in again'});q.n=n;q.u=u;next()})().catch(()=>s.status(500).json({err:'Server error'}))};
const addXp=(d,n)=>{d.fxp=(d.fxp|0)+Math.round(n)};
const prog=(d,k,n=1)=>{const x=d.q&&d.q.l.find(y=>y.k==k);if(x)x.h+=n};
function tick(d){const day=Math.floor(Date.now()/864e5);if(!d.q||d.q.day!=day){const ks=Object.keys(G.QUESTS).sort(()=>Math.random()-.5).slice(0,3);d.q={day,l:ks.map(k=>({k,n:pick(G.QUESTS[k][1]),h:0,r:Math.max(100,Math.round(G.rate(d)*200)),c:0}))}}
 const now=Date.now(),dt=Math.min(90,Math.max(0,(now-d.t)/1000));d.t=now;d.wool+=G.rate(d)*dt;const c=G.cap(d);
 if(d.wool>c)d.wool=c
 d.team=d.team.filter(id=>d.sheep.some(s=>s.id==id));for(const s of[...d.sheep].sort((a,b)=>b.r-a.r))if(d.team.length<3&&!d.team.includes(s.id))d.team.push(s.id)}
function checkAch(d){for(const[id,,f,c]of G.ACH)if(!d.ach.includes(id)&&f(d)){d.ach.push(id);d.coins+=c}}
const grantSp=d=>{d.spl=d.spl||[];const out=[];for(const x of G.SPECIALS)if(!x.herd&&!d.spl.includes(x.id)&&!d.sheep.some(y=>y.sp==x.id)&&x.cond(d)){d.spl.push(x.id);d.sheep.push(G.mkSpecial(x.id));out.push(x.name)}return out};
const view=d=>({...d,calc:{rate:G.rate(d),cap:G.cap(d),price:G.price(d),slots:G.slots(d)}});
const A={};
A.state=async()=>({});
A.sell=async d=>{const c=Math.floor(d.wool*G.price(d));d.coins+=c;d.wool=0;prog(d,'sell');addXp(d,Math.min(25,Math.floor(Math.sqrt(c)/4)));return{gain:c}};
A.hatch=async(d,b)=>{const ei=b.egg|0,e=G.EGG[ei],n=b.n==10?10:1;if(!e)return{err:'No such egg'};if(d.coins<e.cost*n)return{err:'Not enough coins'};
 if(d.sheep.length+n>G.slots(d))return{err:n>1?'You need '+n+' free pasture slots':'Pasture full! Release a sheep or upgrade the Pasture.'};
 d.coins-=e.cost*n;d.dex=d.dex||[];const out=[];for(let i=0;i<n;i++){const x=G.roll(ei);d.sheep.push(x);d.hatched++;d.best=Math.max(d.best||0,x.r);const k=(x.form|0)+'-'+x.r;if(!d.dex.includes(k))d.dex.push(k);out.push(x)}
 prog(d,'hatch',n);addXp(d,n*Math.round(4+Math.log10(e.cost)*4));return{sheep:out[n-1],batch:out}};
A.upgrade=async(d,b)=>{const x=G.B.find(y=>y[0]==b.b);if(!x)return{err:'?'};const l=d.b[x[0]];if(l>=(x[0]=='auto'?5:10))return{err:'Max level'};
 const c=G.bcost(x,l);if(d.coins<c)return{err:'Not enough coins'};d.coins-=c;d.b[x[0]]++;addXp(d,25);return{}};
A.team=async(d,b)=>{const ids=[...new Set(b.ids||[])];if(ids.length!=3||!ids.every(i=>d.sheep.some(s=>s.id==i)))return{err:'Pick 3 different sheep'};d.team=ids;return{}};
A.release=async(d,b)=>{const i=d.sheep.findIndex(s=>s.id==b.id);if(i<0)return{err:'?'};if(d.sheep[i].sp)return{err:'Special sheep cannot be released'};if(d.sheep.length<=3)return{err:'Keep at least 3 sheep'};
 const[s]=d.sheep.splice(i,1);d.coins+=G.RAR[s.r].v;d.team=d.team.filter(x=>x!=s.id);tick(d);return{}};
A.prestige=async d=>{if(d.sheep.filter(s=>s.r>=6&&!s.sp).length<3)return{err:'You need 3 hatched Celestial sheep to prestige'};const duck=d.sheep.find(s=>s.sp=='duck');d.pr=(d.pr|0)+1;
 const starters=[0,1,2].map(()=>{let s;do s=G.roll(0);while(s.r>0);return s});d.sheep=[...(duck?[duck]:[]),...starters];if(duck){duck.lv=Math.min(20,duck.lv+3);duck.xp=(duck.lv-1)*1.5}
 d.coins=30;d.fxp=0;d.q=null;d.streak=0;d.w0=d.wins;d.wool=0;d.b={barn:0,shed:0,pasture:0,market:0,auto:0};d.team=[];d.adv=0;d.spl=duck?['duck']:[];d.hatched=0;d.gc=0;d.best=0;d.t=Date.now();tick(d);return{prestiged:d.pr}};
A.tutdone=async d=>{d.tut=1;return{}};
A.train=async(d,b)=>{const s=d.sheep.find(x=>x.id==b.id);if(!s)return{err:'?'};if(s.lv>=20)return{err:'Max level'};const c=G.trainCost(s);if(d.coins<c)return{err:'Not enough coins'};d.coins-=c;s.lv++;s.xp=(s.lv-1)*1.5;prog(d,'train');addXp(d,6);return{sheep:s}};
A.daily=async d=>{const now=Date.now();if(now-(d.daily||0)<20*36e5)return{err:'Already claimed today'};d.streak=now-(d.daily||0)<48*36e5?(d.streak|0)+1:1;const c=80+30*Math.min(d.streak,10);d.coins+=c;d.daily=now;addXp(d,15);return{gain:c}};
// ---- battles ----
const BT=new Map();
const unit=(s,side)=>{const st=G.stats(s),p=s.sp?G.SPM[s.sp].pas:null,u={side,name:s.name,role:s.role,el:s.el,g:s,hp:st.hp,max:st.hp,atk:Math.round(st.atk*(p=='mighty'?1.3:1)),def:st.def,spd:Math.round(st.spd*(p=='haste'?1.5:1)),cds:[0,0,0,0,0,0,0,0],burn:0,mv:G.moves(s),sh:0,shd:{},stun:0,trait:s.trait,pas:p};if(p=='bulwark')addSh(u,'Bulwark',20);return u};
const elm=G.elm;
const E=(b,m,a,to,v,k)=>b.ev.push({m,a,to:to||[],v,k,hp:b.u.map(x=>x.hp),sh:b.u.map(x=>x.sh)});
function hit(u,x,mult){const e=elm(u.el,x.el),crit=u.trait=='lucky'&&Math.random()<.2;
 const v=Math.max(1,Math.round(u.atk*mult*e*(crit?1.5:1)*(.9+Math.random()*.2)*100/(100+x.def)));let rem=v;for(const k of Object.keys(x.shd)){const a=Math.min(x.shd[k],rem);x.shd[k]-=a;rem-=a;if(x.shd[k]<=0)delete x.shd[k]}x.sh=Object.values(x.shd).reduce((p,c)=>p+c,0);x.hp=Math.max(0,x.hp-rem);if(x.pas=='thorns'&&v>0)u.hp=Math.max(0,u.hp-Math.round(v*.2));if(u.pas=='vamp')u.hp=Math.min(u.max,u.hp+Math.round(v*.25));return{v,crit,e}}
const applyAura=b=>{for(const sd of[0,1])if(b.u.some(x=>x.side==sd&&x.pas=='quack'))b.u.forEach(x=>{if(x.side==sd)x.atk=Math.round(x.atk*1.15)})};
const addSh=(x,n,a)=>{x.shd[n]=Math.max(x.shd[n]||0,a);const sum=()=>Object.values(x.shd).reduce((p,c)=>p+c,0);let t=sum();if(t>60){x.shd[n]=Math.max(0,x.shd[n]-(t-60));if(!x.shd[n])delete x.shd[n];t=sum()}x.sh=t};
const eff=r=>(r.crit?' CRIT!':'')+(r.e>1?' Super effective!':r.e<1?' Not very effective.':'');
function exec(b,i,mi,t){const u=b.u[i],m=u.mv[mi],foes=b.u.filter(x=>x.side!=u.side&&x.hp>0),fr=b.u.filter(x=>x.side==u.side&&x.hp>0),tg=b.u[t],ix=x=>b.u.indexOf(x),ty=m[1];
 if(m[3])u.cds[mi]=m[3];
 if(['dmg','stun','drain','burn','freeze'].includes(ty)){const x=tg&&tg.hp>0&&tg.side!=u.side?tg:foes[0],r=hit(u,x,m[2]);let ex='';
  if(ty=='stun')x.stun=1;
  if(ty=='burn'){x.burn=3;ex=` and sets ${x.name} ablaze`}
  if(ty=='freeze'&&Math.random()<.4){x.stun=1;ex=` and freezes ${x.name} solid`}
  if(ty=='drain'){const h=Math.round(r.v*.5);u.hp=Math.min(u.max,u.hp+h);ex=` and drains ${h} HP`}
  E(b,`${u.name} uses ${m[0]} on ${x.name} for ${r.v}${ex}.${eff(r)}${ty=='stun'?' '+x.name+' is dizzy!':''}`,i,[ix(x)],r.v,'d')}
 else if(['all','stunall','burnall','freezeall','drainall'].includes(ty)){let v=0,tot=0;foes.forEach(x=>{v=hit(u,x,m[2]).v;tot+=v;if(ty=='stunall')x.stun=1;if(ty=='burnall')x.burn=3;if(ty=='freezeall'&&Math.random()<.3)x.stun=1});
  if(ty=='drainall')u.hp=Math.min(u.max,u.hp+Math.round(tot*.35));
  E(b,`${u.name} unleashes ${m[0]}!${ty=='stunall'?' Everyone is dizzy!':ty=='burnall'?' Everyone is on fire!':ty=='freezeall'?' A chilly mess!':''}`,i,foes.map(ix),v,'d')}
 else if(ty=='heal'){const x=tg&&tg.hp>0&&tg.side==u.side?tg:fr.sort((a,c)=>a.hp/a.max-c.hp/c.max)[0],v=Math.round(u.atk*m[2]);x.hp=Math.min(x.max,x.hp+v);E(b,`${u.name} hugs ${x.name} (+${v} HP)`,i,[ix(x)],v,'h')}
 else if(ty=='healall'){const v=Math.round(u.atk*m[2]);fr.forEach(x=>x.hp=Math.min(x.max,x.hp+v));E(b,`${u.name} sings ${m[0]} (+${v} HP each)`,i,fr.map(ix),v,'h')}
 else{fr.forEach(x=>addSh(x,m[0],m[2]<1?Math.round(x.max*m[2]):m[2]));E(b,`${u.name} raises ${m[0]}!`,i,fr.map(ix),0,'s')}}
function ai(b,i){const u=b.u[i],mv=u.mv,foes=b.u.filter(x=>x.side!=u.side&&x.hp>0),fr=b.u.filter(x=>x.side==u.side&&x.hp>0),ok=[];
 for(let k=1;k<u.mv.length;k++)if(u.cds[k]==0)ok.push(k);const mi=ok.length&&Math.random()<(b.dumb?.4:.65)?pick(ok):0;let t;
 if(mv[mi][1]=='heal')t=fr.sort((a,c)=>a.hp/a.max-c.hp/c.max)[0];else{foes.sort((a,c)=>a.hp-c.hp);t=Math.random()<(b.dumb?.3:.6)?foes[0]:pick(foes)}exec(b,i,mi,b.u.indexOf(t))}
function advance(b){for(let g=0;g<300;g++){b.u.forEach((x,k)=>{if(x.hp<=0&&x.pas=='revive'&&!x.used){x.used=1;x.hp=Math.ceil(x.max*.5);x.stun=0;x.burn=0;E(b,`🔥 ${x.name} rises from the ashes!`,k,[k],0,'h')}});const al=n=>b.u.filter(u=>u.hp>0&&u.side==n).length;
 if(!al(0)||!al(1)){b.done=true;b.win=al(0)?true:al(1)?false:Math.random()<.5;b.cur=null;return}
 if(!b.q.length){b.q=b.u.map((u,i)=>i).filter(i=>b.u[i].hp>0).sort((x,y)=>b.u[y].spd-b.u[x].spd);b.round=(b.round|0)+1;
  if(b.round>12){b.u.forEach(x=>{if(x.hp>0)x.hp=Math.max(0,x.hp-Math.ceil(x.max*.05*(b.round-12)))});E(b,'⛈ A storm rolls in and soaks everyone!',null,b.u.map((x,i)=>i),0,'d');continue}}
 const i=b.q.shift(),u=b.u[i];if(u.hp<=0)continue;for(let k=0;k<8;k++)if(u.cds[k]>0)u.cds[k]--;
 if(u.burn>0){const dm=Math.max(1,Math.ceil(u.max*.06));u.burn--;u.hp=Math.max(0,u.hp-dm);E(b,`${u.name} burns for ${dm}!`,null,[i],dm,'d');if(u.hp<=0)continue}
 if(u.pas=='regen'&&u.hp<u.max){const h=Math.ceil(u.max*.06);u.hp=Math.min(u.max,u.hp+h);E(b,`${u.name} regenerates ${h} HP`,i,[i],h,'h')}
 if(u.stun){u.stun=0;E(b,`${u.name} is too dizzy to move!`,i,[],0,'x');continue}
 if(b.pvp||u.side==0){b.cur=i;b.turnAt=Date.now();return}ai(b,i)}}
const vu=b=>b.u.map(({name,role,el,g,hp,max,cds,sh,stun,side,burn})=>({name,role,el,g,hp,max,cds,sh,stun,side,burn}));
const bv=b=>{const ev=b.ev;b.ev=[];return{u:vu(b),cur:b.cur,done:b.done,win:b.win,oname:b.oname,reward:b.reward,ev}};
const gain=(s,x)=>{if(s&&s.lv<20){s.xp+=x;s.lv=Math.min(20,1+Math.floor(s.xp/1.5))}};
function finish(d,b){if(b.paid)return;b.paid=1;const st=b.stage|0;addXp(d,b.win?(st?(st>(d.adv|0)?40:10):b.war?15:12):4);
 if(b.war){const c=b.win?100:20;d.coins+=c;b.reward={coins:c,rating:0,war:1};if(b.win)prog(d,'win');d.team.forEach(id=>gain(d.sheep.find(x=>x.id==id),b.win?1:.5));return}
 if(b.win){prog(d,'win');d.team.forEach(id=>gain(d.sheep.find(x=>x.id==id),1));
  if(st){const first=st>(d.adv|0),c=Math.round(60*st*(1+st/10)*(first?1:.25));d.wins++;d.coins+=c;b.reward={coins:c,rating:0,first};prog(d,'adv');
   if(first)d.adv=st}
  else{const pw=b.u.filter(x=>x.side==1).reduce((a,x)=>a+x.max+x.atk*4,0),c=Math.round(20+pw/12);d.wins++;d.rating+=20;d.coins+=c;b.reward={coins:c,rating:20}}}
 else{if(st){d.coins+=5;b.reward={coins:5,rating:0}}else{d.losses++;d.rating=Math.max(0,d.rating-12);d.coins+=5;b.reward={coins:5,rating:-12}}d.team.forEach(id=>gain(d.sheep.find(x=>x.id==id),.5))}}
A.claimq=async(d,b)=>{const x=d.q&&d.q.l[b.i|0];if(!x||x.c||x.h<x.n)return{err:'Not ready yet'};x.c=1;d.coins+=x.r;addXp(d,40);return{gain:x.r}};
A.golden=async d=>{const now=Date.now();if(now-(d.gt||0)<30000)return{err:'Too soon'};d.gt=now;const c=Math.max(25,Math.round(G.rate(d)*60));d.coins+=c;d.gc=(d.gc|0)+1;prog(d,'golden');addXp(d,8);return{gain:c}};
A.evolve=async(d,b)=>{const s=d.sheep.find(x=>x.id==b.id);if(!s)return{err:'?'};const e=s.evo|0;if(e>=2)return{err:'Already fully evolved'};if(s.lv<G.evoLv[e])return{err:'Needs level '+G.evoLv[e]};
 const c=G.evoCost(s);if(d.coins<c)return{err:'Not enough coins'};d.coins-=c;s.evo=e+1;addXp(d,40);return{sheep:s}};
A.bstart=async(d,body,q)=>{const st=(body&&body.stage)|0,me=d.team.map(id=>d.sheep.find(s=>s.id==id)),pw=ts=>ts.reduce((a,s)=>{const t=G.stats(s);return a+t.hp+t.atk*4},0),mine=pw(me);let opp,oname,o=null,war=null;
 if(body&&body.war){const c=d.clan&&await db.cget(d.clan);if(!c||!c.warId)return{err:'Your herd is not in a war'};const w=await db.cget('war:'+c.warId);if(!w||w.done||Date.now()>w.end)return{err:'The war is over'};if(w.used[q.n]!==undefined)return{err:'You already used your war attack'};
  const oc=await db.cget(w.a==c.key?w.b:w.a),cand=[];for(const mk of oc.members){const u=await db.get(mk);if(u&&u.data.team&&u.data.team.length==3)cand.push(u.data)}if(!cand.length)return{err:'No enemy defenders available'};
  const od=pick(cand);opp=od.team.map(id=>od.sheep.find(s=>s.id==id)).filter(Boolean);if(opp.length<3)return{err:'No enemy defenders available'};oname=od.name+' ('+oc.name+')';war={id:w.id};w.used[q.n]=-1;await db.cput('war:'+w.id,w)}
 else if(st){if(st>30||st>(d.adv|0)+1)return{err:'Beat the earlier stages first'};oname=G.STAGE_NAMES[st-1];
  opp=[0,1,2].map(k=>{const r=Math.min(6,Math.floor(st/5)+(k==2&&st%5==0?1:0)),s=G.roll(0,Math.random,r);s.lv=Math.min(20,1+Math.floor(st*.7));s.evo=s.lv>=12?2:s.lv>=5?1:0;return s})}
 else{const all=(await db.all()).filter(x=>x.name!=q.n&&x.data.team&&x.data.team.length==3).map(x=>({x,t:x.data.team.map(id=>x.data.sheep.find(s=>s.id==id)).filter(Boolean)})).filter(o=>o.t.length==3&&pw(o.t)<=mine*1.05)
   .sort((a,c)=>Math.abs(a.x.data.rating-d.rating)-Math.abs(c.x.data.rating-d.rating));
  o=all.length&&Math.random()<.7?pick(all.slice(0,4)):null;oname=o?o.x.data.name:'Farmer Bot';
  opp=o?o.t:me.map(m=>{const s=G.roll(0,Math.random,Math.max(0,m.r-(Math.random()<.6?1:0)));s.lv=Math.max(1,m.lv-1-Math.floor(Math.random()*3));s.evo=Math.max(0,Math.min((m.evo|0)-1,s.lv>=12?2:s.lv>=5?1:0));return s})}
 const b={u:[...me.map(s=>unit(s,0)),...opp.map(s=>unit(s,1))],oname,q:[],cur:null,done:false,ev:[],stage:st,war,dumb:st?st<8:(war?false:!o)};
 if(st?st<5:(war?false:!o))b.u.filter(x=>x.side==1).forEach(x=>{x.max=x.hp=Math.round(x.max*.92);x.atk=Math.round(x.atk*.92)});
 applyAura(b);BT.set(q.n,b);advance(b);if(b.done){finish(d,b);if(b.war)await warDone(d,b,q)}return{bt:bv(b)}};
A.bact=async(d,body,q)=>{const b=BT.get(q.n);if(!b||b.done||b.cur==null)return{err:'No battle in progress'};const u=b.u[b.cur],mi=body.mi|0;
 if(mi<0||mi>=u.mv.length||(mi>0&&u.cds[mi]>0))return{err:'Move not ready'};try{exec(b,b.cur,mi,body.t|0)}catch(e){console.error('exec',e)}b.cur=null;try{advance(b)}catch(e){console.error('advance',e);b.done=true;b.win=false;b.cur=null}if(b.done){finish(d,b);if(b.war)await warDone(d,b,q)}return{bt:bv(b)}};
// ---- live PvP (polling) ----
const LQ=new Map(),LM=new Map(),LU=new Map(),flush=b=>{b.log.push(...b.ev);b.ev=[]};
async function mkMatch(k0,k1){const us=await Promise.all([k0,k1].map(x=>db.get(x))),team=us.map(u=>{tick(u.data);return u.data.team.map(id=>u.data.sheep.find(x=>x.id==id))});
 const b={u:[...team[0].map(x=>unit(x,0)),...team[1].map(x=>unit(x,1))],q:[],cur:null,done:false,ev:[],log:[],pvp:true,turnAt:Date.now()};
 const m={b,keys:[k0,k1],names:us.map(u=>u.data.name),team:team.map(t=>t.map(x=>x.id)),seen:[Date.now(),Date.now()],t:Date.now()};
 applyAura(b);advance(b);flush(b);const id=Math.random().toString(36).slice(2);LM.set(id,m);LU.set(k0,id);LU.set(k1,id);return m}
async function finishLive(m){const b=m.b;if(b.paid)return;b.paid=1;b.reward=[null,null];
 for(const s of[0,1]){const u=await db.get(m.keys[s]);if(!u)continue;const d=u.data,win=(b.win?0:1)==s,c=win?60:15;addXp(d,win?20:6);if(win)prog(d,'win');d.wins+=win?1:0;d.losses+=win?0:1;d.rating=Math.max(0,d.rating+(win?25:-15));d.coins+=c;
  m.team[s].forEach(id=>gain(d.sheep.find(x=>x.id==id),win?1:.5));b.reward[s]={coins:c,rating:win?25:-15};if(win&&d.clan){const cc=await db.cget(d.clan);if(cc){cc.bw=(cc.bw|0)+1;calcR(cc);await db.cput(cc.key,cc)}}checkAch(d);await db.put(m.keys[s],u)}}
const lview=(m,side,since)=>{const b=m.b;return{state:'match',me:side,oname:m.names[1-side],u:vu(b),cur:b.cur,done:b.done,win:b.done?(b.win?0:1)==side:undefined,reward:b.reward&&b.reward[side],ev:b.log.slice(since),n:b.log.length}};
app.post('/api/live/:a',auth,H(async(q,s)=>{const k=q.n,a=q.params.a,now=Date.now(),since=q.body.since|0;let m=LM.get(LU.get(k));
 const forfeit=async side=>{m.b.done=true;m.b.win=side==1;m.b.cur=null;await finishLive(m)};
 if(a=='list'){for(const[x,e]of LQ)if(now-e.seen>12000)LQ.delete(x);return s.json({list:[...LQ].filter(([x])=>x!=k).map(([x,e])=>({k:x,name:e.name,rating:e.rating}))})}
 if(a=='leave'){LQ.delete(k);if(m&&!m.b.done)await forfeit(m.keys.indexOf(k));LU.delete(k);return s.json({})}
 if(!m){if(a!='join')return s.json({state:'none'});for(const[x,e]of LQ)if(now-e.seen>12000)LQ.delete(x);for(const[id,mm]of LM)if(now-mm.t>36e5)LM.delete(id);
  const tg=q.body.target,o=tg?(LQ.has(tg)&&tg!=k?tg:null):[...LQ.keys()].find(x=>x!=k);if(tg&&!o)return s.json({state:'gone'});if(o){LQ.delete(o);LQ.delete(k);m=await mkMatch(o,k)}else{LQ.set(k,{seen:now,name:q.u.data.name,rating:q.u.data.rating});return s.json({state:'wait'})}}
 const side=m.keys.indexOf(k),b=m.b;m.seen[side]=now;
 if(a=='act'){if(b.done||b.cur==null)return s.json({err:'No battle in progress'});const u=b.u[b.cur];if(u.side!=side)return s.json({err:'Not your turn'});const mi=q.body.mi|0;
  if(mi<0||mi>=u.mv.length||(mi>0&&u.cds[mi]>0))return s.json({err:'Move not ready'});exec(b,b.cur,mi,q.body.t|0);b.cur=null;advance(b);flush(b);if(b.done)await finishLive(m);return s.json(lview(m,side,since))}
 if(!b.done){if(now-m.seen[1-side]>20000)await forfeit(1-side);else if(b.cur!=null&&now-b.turnAt>30000){ai(b,b.cur);advance(b);flush(b);if(b.done)await finishLive(m)}}
 s.json(lview(m,side,since))}));
// ---- herds (clans) & herd wars ----
const CK=n=>String(n||'').trim().toLowerCase(),WAR_MS=864e5;
const calcR=c=>{c.reached=G.CLAN_GOALS.filter(g=>g.pts?(c.pts|0)>=g.pts:g.wars?(c.wins|0)>=g.wars:(c.bw|0)>=g.bw).map(g=>g.id)};
const fullW=(c,w)=>c.members.every(m=>w.used[m]!==undefined&&w.used[m]!==-1);
async function endWar(w,cur){if(w.done)return;const ca=await db.cget(w.a),cb=await db.cget(w.b);if(!ca||!cb){w.done=true;await db.cput('war:'+w.id,w);return}
 if(!(Date.now()>w.end||(fullW(ca,w)&&fullW(cb,w))))return;const sc=[...w.score];if(fullW(ca,w))sc[0]++;if(fullW(cb,w))sc[1]++;const res=sc[0]>sc[1]?0:sc[1]>sc[0]?1:-1;w.done=true;w.final=sc;w.res=res;
 for(const[c,i]of[[ca,0],[cb,1]]){const amt=res<0?1500:res==i?3000:600;if(res==i)c.wins=(c.wins|0)+1;c.warId=null;calcR(c);
  for(const mk of c.members){if(cur&&mk==cur.k)cur.d.coins+=amt;else{const u=await db.get(mk);if(u){u.data.coins+=amt;await db.put(mk,u)}}}await db.cput(c.key,c)}
 await db.cput('war:'+w.id,w)}
async function warDone(d,b,q){const c=d.clan&&await db.cget(d.clan);if(!c||c.warId!=b.war.id)return;const w=await db.cget('war:'+b.war.id);if(!w||w.done||w.used[q.n]!==-1)return;
 w.used[q.n]=b.win?1:0;if(b.win)w.score[w.a==c.key?0:1]++;await db.cput('war:'+w.id,w);await endWar(w,{k:q.n,d})}
app.post('/api/clan/:a',auth,H(async(q,s)=>{const k=q.n,d=q.u.data,a=q.params.a,b=q.body,now=Date.now(),err=m=>s.json({err:m});let cl=null,c=d.clan?await db.cget(d.clan):null;if(d.clan&&!c)d.clan=null;
 if(c&&!c.members.includes(k)){c=null;d.clan=null}if(c&&!c.mig){c.leader=pick(c.members);c.mig=1;await db.cput(c.key,c)}if(c&&!d.cjoin)d.cjoin=now;
 if(a=='list')return s.json({list:(await db.call()).map(x=>x.data).filter(x=>x.members.length<5).map(x=>({name:x.name,n:x.members.length,wins:x.wins|0,pts:x.pts|0}))});
 if(a=='create'){if(c)return err('You are already in a herd');if(G.farmLv(d.fxp).lv<6)return err('Reach farm level 6 to join a herd');const nm=String(b.name||'').trim();if(!/^[A-Za-z0-9_]{3,16}$/.test(nm))return err('Herd name: 3-16 letters/numbers/_');const key=CK(nm);if(key=='warq'||await db.cget(key))return err('That herd name is taken');c={key,name:nm,leader:k,mig:1,members:[k],pts:0,wins:0,bw:0,reached:[],warId:null,srch:0};d.clan=key;d.cjoin=now;await db.cput(key,c)}
 else if(a=='join'){if(c)return err('You are already in a herd');if(G.farmLv(d.fxp).lv<6)return err('Reach farm level 6 to join a herd');const x=await db.cget(CK(b.name));if(!x||!x.members)return err('No such herd');if(x.members.length>=5)return err('That herd is full (5 max)');x.members.push(k);c=x;d.clan=x.key;d.cjoin=now;await db.cput(x.key,x)}
 else if(a=='info'){}
 else if(!c)return err('Join a herd first');
 else if(a=='leave'){c.members=c.members.filter(m=>m!=k);d.clan=null;d.cgoal=[];d.cjoin=0;if(!c.members.length)await db.cdel(c.key);else{if(c.leader==k)c.leader=pick(c.members);await db.cput(c.key,c)}c=null}
 else if(a=='donate'){const n=Math.floor(+b.amt);if(!(n>0)||n>d.coins)return err('Not enough coins');d.coins-=n;c.pts=(c.pts|0)+n;calcR(c);await db.cput(c.key,c)}
 else if(a=='findwar'){if(c.leader!=k)return err('Only the herd leader can search for a war');if(c.warId)return err('Your herd is already at war');if(c.members.length<2)return err('You need at least 2 members');
  const wq=await db.cget('warq'),oc=wq&&wq.clan&&wq.clan!=c.key&&now-wq.t<WAR_MS?await db.cget(wq.clan):null;
  if(oc&&!oc.warId&&oc.members.length>=2){const id=Math.random().toString(36).slice(2,9);await db.cput('war:'+id,{id,a:oc.key,b:c.key,names:[oc.name,c.name],start:now,end:now+WAR_MS,score:[0,0],used:{},done:false});oc.warId=c.warId=id;oc.srch=c.srch=0;await db.cput(oc.key,oc);await db.cput(c.key,c);await db.cput('warq',{clan:null})}
  else{await db.cput('warq',{clan:c.key,t:now});c.srch=now;await db.cput(c.key,c)}}
 else if(a=='kick'){if(c.leader!=k)return err('Only the herd leader can kick members');const tk=CK(b.key);if(tk==k||!c.members.includes(tk))return err('Pick another member');c.members=c.members.filter(m=>m!=tk);const u=await db.get(tk);if(u){u.data.clan=null;u.data.cgoal=[];u.data.cjoin=0;await db.put(tk,u)}await db.cput(c.key,c)}
 else if(a=='claim'){const g=G.CLAN_GOALS.find(x=>x.id==b.id);if(!g)return err('Unknown goal');calcR(c);if(!c.reached.includes(g.id))return err('Your herd has not reached that goal yet');const sp=G.SPM[g.sp];if(d.sheep.some(y=>y.sp==g.sp))return err('You already have that sheep');
  if(!d.sheep.some(y=>!y.sp&&y.r>=sp.r))return err('You need a '+G.RAR[sp.r].n+' sheep of your own first');const left=g.hrs-(now-(d.cjoin||now))/36e5;if(left>0)return err('You must be in the herd for '+g.hrs+'h first ('+Math.ceil(left)+'h left)');
  d.sheep.push(G.mkSpecial(g.sp));cl=sp.name}
 else return err('Unknown action');
 let w=null;if(c&&c.warId){w=await db.cget('war:'+c.warId);if(w&&!w.done){await endWar(w,{k,d});c=await db.cget(c.key);w=w.done?null:w}else w=null}
 d.cgoal=c?c.reached||[]:[];const newSp=grantSp(d);await db.put(k,q.u);let out=null;
 if(c){const us=await Promise.all(c.members.map(m=>db.get(m)));let war=null;if(w){const i=w.a==c.key?0:1;war={opp:w.names[1-i],my:w.score[i],their:w.score[1-i],end:w.end,mine:w.used[k]!==undefined}}
  out={name:c.name,owner:c.leader==k,bw:c.bw|0,wins:c.wins|0,pts:c.pts|0,searching:!!(!c.warId&&c.srch&&now-c.srch<WAR_MS),war,members:us.map((u,i)=>({key:c.members[i],lead:c.members[i]==c.leader,name:u?u.data.name:'?',rating:u?u.data.rating:0,sheep:u?u.data.sheep.length:0,atk:w?w.used[c.members[i]]:undefined}))}}
 s.json({clan:out,newSp,claimed:cl,d:view(d)})}));
app.post('/api/act/:a',auth,H(async(q,s)=>{const f=A[q.params.a];if(!f)return s.sendStatus(404);const d=q.u.data;tick(d);const l0=G.farmLv(d.fxp).lv;const r=await f(d,q.body,q)||{};
 if(r.err)return s.json({err:r.err,d:view(d)});checkAch(d);const newSp=grantSp(d);if(r.bt&&r.bt.reward&&newSp.length)r.bt.reward.sheep=newSp.join(', ');if(d.clan&&r.bt&&r.bt.done&&r.bt.win){const cc=await db.cget(d.clan);if(cc){cc.bw=(cc.bw|0)+1;calcR(cc);await db.cput(cc.key,cc)}}
 await db.put(q.n,q.u);const l1=G.farmLv(d.fxp).lv;s.json({...r,d:view(d),newSp,flv:l1>l0?l1:undefined})}));
app.get('/api/board',H(async(q,s)=>{s.json((await db.all()).map(x=>({name:x.data.name,rating:x.data.rating,wins:x.data.wins,sheep:x.data.sheep.length,best:x.data.best||0})).sort((a,b)=>b.rating-a.rating).slice(0,25))}));
app.get('/api/farm/:n',H(async(q,s)=>{const u=await db.get(q.params.n.toLowerCase());if(!u)return s.sendStatus(404);const d=u.data;s.json({name:d.name,rating:d.rating,sheep:d.sheep.slice().sort((a,b)=>b.r-a.r).slice(0,30)})}));
app.get('/api/health',(q,s)=>s.json({storage:MODE}));
initDb().then(()=>{if(MODE=='file'&&process.env.RENDER)console.warn('WARNING: no DATABASE_URL set - saves will be WIPED when this server sleeps or redeploys!');return app.listen(process.env.PORT||3000,()=>console.log('EGG & WOOL running ('+MODE+' storage)'))}).catch(e=>{console.error(e);process.exit(1)});
