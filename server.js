const express=require('express'),crypto=require('crypto'),fs=require('fs'),path=require('path'),G=require('./public/shared.js');
const app=express();app.use(express.json());app.use(express.static(path.join(__dirname,'public')));
const SECRET=process.env.SECRET||'dev-secret-change-me';
let db;
async function initDb(){
 if(process.env.DATABASE_URL){const{Pool}=require('pg');const url=process.env.DATABASE_URL;
  const p=new Pool({connectionString:url,ssl:/\.render\.com|sslmode=require/.test(url)?{rejectUnauthorized:false}:false});
  await p.query('create table if not exists users(name text primary key,hash text,salt text,data jsonb)');
  db={get:async n=>(await p.query('select * from users where name=$1',[n])).rows[0],
   put:async(n,u)=>{await p.query('insert into users(name,hash,salt,data) values($1,$2,$3,$4) on conflict(name) do update set data=$4',[n,u.hash,u.salt,u.data])},
   all:async()=>(await p.query('select name,data from users')).rows};
 }else{
  const f=path.join(process.env.DATA_DIR||__dirname,'data.json');let m={};try{m=JSON.parse(fs.readFileSync(f))}catch{}
  let tm;const save=()=>{clearTimeout(tm);tm=setTimeout(()=>fs.writeFile(f,JSON.stringify(m),()=>{}),400)};
  db={get:async n=>m[n],put:async(n,u)=>{m[n]=u;save()},all:async()=>Object.entries(m).map(([name,u])=>({name,data:u.data}))};
 }}
const H=f=>(q,s)=>f(q,s).catch(e=>{console.error(e);s.status(500).json({err:'Server error'})});
const sign=(n,h)=>n+'.'+crypto.createHmac('sha256',SECRET).update(n+h).digest('hex');
const hashPw=(p,s)=>crypto.scryptSync(String(p),s,32).toString('hex');
const pick=a=>a[Math.floor(Math.random()*a.length)];
function newPlayer(name){const sheep=[0,1,2].map(()=>{let s;do s=G.roll(0);while(s.r>0);return s});
 return{name,coins:60,wool:0,t:Date.now(),sheep,b:{barn:0,shed:0,pasture:0,market:0,auto:0},team:sheep.map(s=>s.id),hatched:0,wins:0,losses:0,rating:1000,best:0,ach:[],dex:[],daily:0,streak:0}}
app.post('/api/register',H(async(q,s)=>{let{name,pass}=q.body;name=String(name||'').trim();
 if(!/^[A-Za-z0-9_]{3,16}$/.test(name)||String(pass||'').length<4)return s.json({err:'Name: 3-16 letters/numbers/_. Password: 4+ characters.'});
 const k=name.toLowerCase();if(await db.get(k))return s.json({err:'That name is taken'});
 const salt=crypto.randomBytes(8).toString('hex'),hash=hashPw(pass,salt);await db.put(k,{hash,salt,data:newPlayer(name)});s.json({token:sign(k,hash)})}));
app.post('/api/login',H(async(q,s)=>{const k=String(q.body.name||'').trim().toLowerCase(),u=k&&await db.get(k);
 if(!u||hashPw(q.body.pass||'',u.salt)!==u.hash)return s.json({err:'Wrong name or password'});s.json({token:sign(k,u.hash)})}));
const auth=(q,s,next)=>{(async()=>{const t=q.get('x-token')||'',n=t.split('.')[0],u=n&&await db.get(n);
 if(!u||sign(n,u.hash)!==t)return s.status(401).json({err:'Please log in again'});q.n=n;q.u=u;next()})().catch(()=>s.status(500).json({err:'Server error'}))};
const prog=(d,k,n=1)=>{const x=d.q&&d.q.l.find(y=>y.k==k);if(x)x.h+=n};
function tick(d){const day=Math.floor(Date.now()/864e5);if(!d.q||d.q.day!=day){const ks=Object.keys(G.QUESTS).sort(()=>Math.random()-.5).slice(0,3);d.q={day,l:ks.map(k=>({k,n:pick(G.QUESTS[k][1]),h:0,r:Math.max(200,Math.round(G.rate(d)*500)),c:0}))}}
 const now=Date.now(),dt=Math.max(0,(now-d.t)/1000);d.t=now;d.wool+=G.rate(d)*dt;const c=G.cap(d);
 if(d.wool>c){if(d.b.auto)d.coins+=(d.wool-c)*G.price(d)*Math.min(1,.2*d.b.auto);d.wool=c}
 d.team=d.team.filter(id=>d.sheep.some(s=>s.id==id));for(const s of[...d.sheep].sort((a,b)=>b.r-a.r))if(d.team.length<3&&!d.team.includes(s.id))d.team.push(s.id)}
function checkAch(d){for(const[id,,f,c]of G.ACH)if(!d.ach.includes(id)&&f(d)){d.ach.push(id);d.coins+=c}}
const view=d=>({...d,calc:{rate:G.rate(d),cap:G.cap(d),price:G.price(d),slots:G.slots(d)}});
const A={};
A.state=async()=>({});
A.sell=async d=>{const c=Math.floor(d.wool*G.price(d));d.coins+=c;d.wool=0;prog(d,'sell');return{gain:c}};
A.hatch=async(d,b)=>{const ei=b.egg|0,e=G.EGG[ei],n=b.n==10?10:1;if(!e)return{err:'No such egg'};if(d.coins<e.cost*n)return{err:'Not enough coins'};
 if(d.sheep.length+n>G.slots(d))return{err:n>1?'You need '+n+' free pasture slots':'Pasture full! Release a sheep or upgrade the Pasture.'};
 d.coins-=e.cost*n;d.dex=d.dex||[];const out=[];for(let i=0;i<n;i++){const x=G.roll(ei);d.sheep.push(x);d.hatched++;d.best=Math.max(d.best||0,x.r);const k=(x.form|0)+'-'+x.r;if(!d.dex.includes(k))d.dex.push(k);out.push(x)}
 prog(d,'hatch',n);return{sheep:out[n-1],batch:out}};
A.upgrade=async(d,b)=>{const x=G.B.find(y=>y[0]==b.b);if(!x)return{err:'?'};const l=d.b[x[0]];if(l>=(x[0]=='auto'?5:10))return{err:'Max level'};
 const c=G.bcost(x,l);if(d.coins<c)return{err:'Not enough coins'};d.coins-=c;d.b[x[0]]++;return{}};
A.team=async(d,b)=>{const ids=[...new Set(b.ids||[])];if(ids.length!=3||!ids.every(i=>d.sheep.some(s=>s.id==i)))return{err:'Pick 3 different sheep'};d.team=ids;return{}};
A.release=async(d,b)=>{const i=d.sheep.findIndex(s=>s.id==b.id);if(i<0)return{err:'?'};if(d.sheep.length<=3)return{err:'Keep at least 3 sheep'};
 const[s]=d.sheep.splice(i,1);d.coins+=G.RAR[s.r].v;d.team=d.team.filter(x=>x!=s.id);tick(d);return{}};
A.train=async(d,b)=>{const s=d.sheep.find(x=>x.id==b.id);if(!s)return{err:'?'};if(s.lv>=20)return{err:'Max level'};const c=G.trainCost(s);if(d.coins<c)return{err:'Not enough coins'};d.coins-=c;s.lv++;s.xp=(s.lv-1)*1.5;prog(d,'train');return{sheep:s}};
A.daily=async d=>{const now=Date.now();if(now-(d.daily||0)<20*36e5)return{err:'Already claimed today'};d.streak=now-(d.daily||0)<48*36e5?(d.streak|0)+1:1;const c=150+50*Math.min(d.streak,10);d.coins+=c;d.daily=now;return{gain:c}};
// ---- battles ----
const BT=new Map();
const unit=(s,side)=>{const st=G.stats(s);return{side,name:s.name,role:s.role,el:s.el,g:s,hp:st.hp,max:st.hp,atk:st.atk,def:st.def,spd:st.spd,cds:[0,0,0,0],sh:0,stun:0,trait:s.trait}};
const elm=(a,b)=>a==3||b==3?1:b==(a+1)%3?1.5:a==(b+1)%3?.67:1;
const E=(b,m,a,to,v,k)=>b.ev.push({m,a,to:to||[],v,k,hp:b.u.map(x=>x.hp),sh:b.u.map(x=>x.sh)});
function hit(u,x,mult){const e=elm(u.el,x.el),crit=u.trait=='lucky'&&Math.random()<.2;
 const v=Math.max(1,Math.round(u.atk*mult*e*(crit?1.5:1)*(.9+Math.random()*.2)*100/(100+x.def)));const a=Math.min(x.sh,v);x.sh-=a;x.hp=Math.max(0,x.hp-(v-a));return{v,crit,e}}
const eff=r=>(r.crit?' CRIT!':'')+(r.e>1?' Super effective!':r.e<1?' Not very effective.':'');
function exec(b,i,mi,t){const u=b.u[i],m=G.ROLES[u.role].mv[mi],foes=b.u.filter(x=>x.side!=u.side&&x.hp>0),fr=b.u.filter(x=>x.side==u.side&&x.hp>0),tg=b.u[t],ix=x=>b.u.indexOf(x),ty=m[1];
 if(m[3])u.cds[mi]=m[3];
 if(ty=='dmg'||ty=='stun'||ty=='drain'){const x=tg&&tg.hp>0&&tg.side!=u.side?tg:foes[0],r=hit(u,x,m[2]);if(ty=='stun')x.stun=1;let ex='';
  if(ty=='drain'){const h=Math.round(r.v*.5);u.hp=Math.min(u.max,u.hp+h);ex=` and drains ${h} HP`}
  E(b,`${u.name} uses ${m[0]} on ${x.name} for ${r.v}${ex}.${eff(r)}${ty=='stun'?' '+x.name+' is dizzy!':''}`,i,[ix(x)],r.v,'d')}
 else if(ty=='all'||ty=='stunall'){let v=0;foes.forEach(x=>{v=hit(u,x,m[2]).v;if(ty=='stunall')x.stun=1});E(b,`${u.name} unleashes ${m[0]}!${ty=='stunall'?' Everyone is dizzy!':''}`,i,foes.map(ix),v,'d')}
 else if(ty=='heal'){const x=tg&&tg.hp>0&&tg.side==u.side?tg:fr.sort((a,c)=>a.hp/a.max-c.hp/c.max)[0],v=Math.round(u.atk*m[2]);x.hp=Math.min(x.max,x.hp+v);E(b,`${u.name} hugs ${x.name} (+${v} HP)`,i,[ix(x)],v,'h')}
 else if(ty=='healall'){const v=Math.round(u.atk*m[2]);fr.forEach(x=>x.hp=Math.min(x.max,x.hp+v));E(b,`${u.name} sings ${m[0]} (+${v} HP each)`,i,fr.map(ix),v,'h')}
 else{fr.forEach(x=>x.sh+=Math.round(x.max*m[2]));E(b,`${u.name} raises ${m[0]}!`,i,fr.map(ix),0,'s')}}
function ai(b,i){const u=b.u[i],mv=G.ROLES[u.role].mv,foes=b.u.filter(x=>x.side!=u.side&&x.hp>0),fr=b.u.filter(x=>x.side==u.side&&x.hp>0),ok=[];
 for(let k=1;k<2+(u.g.evo|0);k++)if(u.cds[k]==0)ok.push(k);const mi=ok.length&&Math.random()<(b.dumb?.4:.65)?pick(ok):0;let t;
 if(mv[mi][1]=='heal')t=fr.sort((a,c)=>a.hp/a.max-c.hp/c.max)[0];else{foes.sort((a,c)=>a.hp-c.hp);t=Math.random()<(b.dumb?.3:.6)?foes[0]:pick(foes)}exec(b,i,mi,b.u.indexOf(t))}
function advance(b){for(let g=0;g<300;g++){const al=n=>b.u.filter(u=>u.hp>0&&u.side==n).length;
 if(!al(0)||!al(1)){b.done=true;b.win=al(0)?true:al(1)?false:Math.random()<.5;b.cur=null;return}
 if(!b.q.length){b.q=b.u.map((u,i)=>i).filter(i=>b.u[i].hp>0).sort((x,y)=>b.u[y].spd-b.u[x].spd);b.round=(b.round|0)+1;
  if(b.round>12){b.u.forEach(x=>{if(x.hp>0)x.hp=Math.max(0,x.hp-Math.ceil(x.max*.05*(b.round-12)))});E(b,'⛈ A storm rolls in and soaks everyone!',null,b.u.map((x,i)=>i),0,'d');continue}}
 const i=b.q.shift(),u=b.u[i];if(u.hp<=0)continue;for(let k=0;k<4;k++)if(u.cds[k]>0)u.cds[k]--;
 if(u.stun){u.stun=0;E(b,`${u.name} is too dizzy to move!`,i,[],0,'x');continue}
 if(b.pvp||u.side==0){b.cur=i;b.turnAt=Date.now();return}ai(b,i)}}
const vu=b=>b.u.map(({name,role,el,g,hp,max,cds,sh,stun,side})=>({name,role,el,g,hp,max,cds,sh,stun,side}));
const bv=b=>{const ev=b.ev;b.ev=[];return{u:vu(b),cur:b.cur,done:b.done,win:b.win,oname:b.oname,reward:b.reward,ev}};
const gain=(s,x)=>{if(s&&s.lv<20){s.xp+=x;s.lv=Math.min(20,1+Math.floor(s.xp/1.5))}};
function finish(d,b){if(b.paid)return;b.paid=1;const st=b.stage|0;
 if(b.win){prog(d,'win');d.team.forEach(id=>gain(d.sheep.find(x=>x.id==id),1));
  if(st){const first=st>(d.adv|0),c=Math.round(200*st*(1+st/10)*(first?1:.25));d.wins++;d.coins+=c;b.reward={coins:c,rating:0,first};prog(d,'adv');
   if(first){d.adv=st;if(st%5==0){const ei=Math.min(4,Math.floor(st/8)),x=G.roll(ei);if(d.sheep.length<G.slots(d)){d.sheep.push(x);d.best=Math.max(d.best||0,x.r);d.dex=d.dex||[];const k=(x.form|0)+'-'+x.r;if(!d.dex.includes(k))d.dex.push(k);b.reward.sheep=x.name}else d.coins+=G.EGG[ei].cost}}}
  else{const pw=b.u.filter(x=>x.side==1).reduce((a,x)=>a+x.max+x.atk*4,0),c=Math.round(40+pw/6);d.wins++;d.rating+=20;d.coins+=c;b.reward={coins:c,rating:20}}}
 else{if(st){d.coins+=10;b.reward={coins:10,rating:0}}else{d.losses++;d.rating=Math.max(0,d.rating-12);d.coins+=15;b.reward={coins:15,rating:-12}}d.team.forEach(id=>gain(d.sheep.find(x=>x.id==id),.5))}}
A.claimq=async(d,b)=>{const x=d.q&&d.q.l[b.i|0];if(!x||x.c||x.h<x.n)return{err:'Not ready yet'};x.c=1;d.coins+=x.r;return{gain:x.r}};
A.golden=async d=>{const now=Date.now();if(now-(d.gt||0)<30000)return{err:'Too soon'};d.gt=now;const c=Math.max(50,Math.round(G.rate(d)*90));d.coins+=c;prog(d,'golden');return{gain:c}};
A.evolve=async(d,b)=>{const s=d.sheep.find(x=>x.id==b.id);if(!s)return{err:'?'};const e=s.evo|0;if(e>=2)return{err:'Already fully evolved'};if(s.lv<G.evoLv[e])return{err:'Needs level '+G.evoLv[e]};
 const c=G.evoCost(s);if(d.coins<c)return{err:'Not enough coins'};d.coins-=c;s.evo=e+1;return{sheep:s}};
A.bstart=async(d,body,q)=>{const st=(body&&body.stage)|0,me=d.team.map(id=>d.sheep.find(s=>s.id==id)),pw=ts=>ts.reduce((a,s)=>{const t=G.stats(s);return a+t.hp+t.atk*4},0),mine=pw(me);let opp,oname,o=null;
 if(st){if(st>30||st>(d.adv|0)+1)return{err:'Beat the earlier stages first'};oname=G.STAGE_NAMES[st-1];
  opp=[0,1,2].map(k=>{const r=Math.min(6,Math.floor(st/5)+(k==2&&st%5==0?1:0)),s=G.roll(0,Math.random,r);s.lv=Math.min(20,1+Math.floor(st*.7));s.evo=s.lv>=12?2:s.lv>=5?1:0;return s})}
 else{const all=(await db.all()).filter(x=>x.name!=q.n&&x.data.team&&x.data.team.length==3).map(x=>({x,t:x.data.team.map(id=>x.data.sheep.find(s=>s.id==id)).filter(Boolean)})).filter(o=>o.t.length==3&&pw(o.t)<=mine*1.05)
   .sort((a,c)=>Math.abs(a.x.data.rating-d.rating)-Math.abs(c.x.data.rating-d.rating));
  o=all.length&&Math.random()<.7?pick(all.slice(0,4)):null;oname=o?o.x.data.name:'Farmer Bot';
  opp=o?o.t:me.map(m=>{const s=G.roll(0,Math.random,Math.max(0,m.r-(Math.random()<.6?1:0)));s.lv=Math.max(1,m.lv-1-Math.floor(Math.random()*3));s.evo=Math.max(0,Math.min((m.evo|0)-1,s.lv>=12?2:s.lv>=5?1:0));return s})}
 const b={u:[...me.map(s=>unit(s,0)),...opp.map(s=>unit(s,1))],oname,q:[],cur:null,done:false,ev:[],stage:st,dumb:st?st<8:!o};
 if(st?st<5:!o)b.u.filter(x=>x.side==1).forEach(x=>{x.max=x.hp=Math.round(x.max*.92);x.atk=Math.round(x.atk*.92)});
 BT.set(q.n,b);advance(b);if(b.done)finish(d,b);return{bt:bv(b)}};
A.bact=async(d,body,q)=>{const b=BT.get(q.n);if(!b||b.done||b.cur==null)return{err:'No battle in progress'};const u=b.u[b.cur],mi=body.mi|0;
 if(mi<0||mi>=2+(u.g.evo|0)||(mi>0&&u.cds[mi]>0))return{err:'Move not ready'};exec(b,b.cur,mi,body.t|0);b.cur=null;advance(b);if(b.done)finish(d,b);return{bt:bv(b)}};
// ---- live PvP (polling) ----
const LQ=new Map(),LM=new Map(),LU=new Map(),flush=b=>{b.log.push(...b.ev);b.ev=[]};
async function mkMatch(k0,k1){const us=await Promise.all([k0,k1].map(x=>db.get(x))),team=us.map(u=>{tick(u.data);return u.data.team.map(id=>u.data.sheep.find(x=>x.id==id))});
 const b={u:[...team[0].map(x=>unit(x,0)),...team[1].map(x=>unit(x,1))],q:[],cur:null,done:false,ev:[],log:[],pvp:true,turnAt:Date.now()};
 const m={b,keys:[k0,k1],names:us.map(u=>u.data.name),team:team.map(t=>t.map(x=>x.id)),seen:[Date.now(),Date.now()],t:Date.now()};
 advance(b);flush(b);const id=Math.random().toString(36).slice(2);LM.set(id,m);LU.set(k0,id);LU.set(k1,id);return m}
async function finishLive(m){const b=m.b;if(b.paid)return;b.paid=1;b.reward=[null,null];
 for(const s of[0,1]){const u=await db.get(m.keys[s]);if(!u)continue;const d=u.data,win=(b.win?0:1)==s,c=win?100:25;if(win)prog(d,'win');d.wins+=win?1:0;d.losses+=win?0:1;d.rating=Math.max(0,d.rating+(win?25:-15));d.coins+=c;
  m.team[s].forEach(id=>gain(d.sheep.find(x=>x.id==id),win?1:.5));b.reward[s]={coins:c,rating:win?25:-15};checkAch(d);await db.put(m.keys[s],u)}}
const lview=(m,side,since)=>{const b=m.b;return{state:'match',me:side,oname:m.names[1-side],u:vu(b),cur:b.cur,done:b.done,win:b.done?(b.win?0:1)==side:undefined,reward:b.reward&&b.reward[side],ev:b.log.slice(since),n:b.log.length}};
app.post('/api/live/:a',auth,H(async(q,s)=>{const k=q.n,a=q.params.a,now=Date.now(),since=q.body.since|0;let m=LM.get(LU.get(k));
 const forfeit=async side=>{m.b.done=true;m.b.win=side==1;m.b.cur=null;await finishLive(m)};
 if(a=='leave'){LQ.delete(k);if(m&&!m.b.done)await forfeit(m.keys.indexOf(k));LU.delete(k);return s.json({})}
 if(!m){if(a!='join')return s.json({state:'none'});for(const[x,e]of LQ)if(now-e.seen>12000)LQ.delete(x);for(const[id,mm]of LM)if(now-mm.t>36e5)LM.delete(id);
  const o=[...LQ.keys()].find(x=>x!=k);if(o){LQ.delete(o);LQ.delete(k);m=await mkMatch(o,k)}else{LQ.set(k,{seen:now});return s.json({state:'wait'})}}
 const side=m.keys.indexOf(k),b=m.b;m.seen[side]=now;
 if(a=='act'){if(b.done||b.cur==null)return s.json({err:'No battle in progress'});const u=b.u[b.cur];if(u.side!=side)return s.json({err:'Not your turn'});const mi=q.body.mi|0;
  if(mi<0||mi>=2+(u.g.evo|0)||(mi>0&&u.cds[mi]>0))return s.json({err:'Move not ready'});exec(b,b.cur,mi,q.body.t|0);b.cur=null;advance(b);flush(b);if(b.done)await finishLive(m);return s.json(lview(m,side,since))}
 if(!b.done){if(now-m.seen[1-side]>20000)await forfeit(1-side);else if(b.cur!=null&&now-b.turnAt>30000){ai(b,b.cur);advance(b);flush(b);if(b.done)await finishLive(m)}}
 s.json(lview(m,side,since))}));
app.post('/api/act/:a',auth,H(async(q,s)=>{const f=A[q.params.a];if(!f)return s.sendStatus(404);const d=q.u.data;tick(d);const r=await f(d,q.body,q)||{};
 if(r.err)return s.json({err:r.err,d:view(d)});checkAch(d);await db.put(q.n,q.u);s.json({...r,d:view(d)})}));
app.get('/api/board',H(async(q,s)=>{s.json((await db.all()).map(x=>({name:x.data.name,rating:x.data.rating,wins:x.data.wins,sheep:x.data.sheep.length,best:x.data.best||0})).sort((a,b)=>b.rating-a.rating).slice(0,25))}));
app.get('/api/farm/:n',H(async(q,s)=>{const u=await db.get(q.params.n.toLowerCase());if(!u)return s.sendStatus(404);const d=u.data;s.json({name:d.name,rating:d.rating,sheep:d.sheep.slice().sort((a,b)=>b.r-a.r).slice(0,30)})}));
initDb().then(()=>app.listen(process.env.PORT||3000,()=>console.log('EGG & WOOL running'))).catch(e=>{console.error(e);process.exit(1)});
