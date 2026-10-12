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
 return{name,coins:60,wool:0,t:Date.now(),sheep,b:{barn:0,shed:0,pasture:0,market:0,auto:0},team:sheep.map(s=>s.id),hatched:0,wins:0,losses:0,rating:1000,best:0,ach:[]}}
app.post('/api/register',H(async(q,s)=>{let{name,pass}=q.body;name=String(name||'').trim();
 if(!/^[A-Za-z0-9_]{3,16}$/.test(name)||String(pass||'').length<4)return s.json({err:'Name: 3-16 letters/numbers/_. Password: 4+ characters.'});
 const k=name.toLowerCase();if(await db.get(k))return s.json({err:'That name is taken'});
 const salt=crypto.randomBytes(8).toString('hex'),hash=hashPw(pass,salt);await db.put(k,{hash,salt,data:newPlayer(name)});s.json({token:sign(k,hash)})}));
app.post('/api/login',H(async(q,s)=>{const k=String(q.body.name||'').trim().toLowerCase(),u=k&&await db.get(k);
 if(!u||hashPw(q.body.pass||'',u.salt)!==u.hash)return s.json({err:'Wrong name or password'});s.json({token:sign(k,u.hash)})}));
const auth=(q,s,next)=>{(async()=>{const t=q.get('x-token')||'',n=t.split('.')[0],u=n&&await db.get(n);
 if(!u||sign(n,u.hash)!==t)return s.status(401).json({err:'Please log in again'});q.n=n;q.u=u;next()})().catch(()=>s.status(500).json({err:'Server error'}))};
function tick(d){const now=Date.now(),dt=Math.max(0,(now-d.t)/1000);d.t=now;d.wool+=G.rate(d)*dt;const c=G.cap(d);
 if(d.wool>c){if(d.b.auto)d.coins+=(d.wool-c)*G.price(d)*Math.min(1,.2*d.b.auto);d.wool=c}
 d.team=d.team.filter(id=>d.sheep.some(s=>s.id==id));for(const s of[...d.sheep].sort((a,b)=>b.r-a.r))if(d.team.length<3&&!d.team.includes(s.id))d.team.push(s.id)}
function checkAch(d){for(const[id,,f,c]of G.ACH)if(!d.ach.includes(id)&&f(d)){d.ach.push(id);d.coins+=c}}
const view=d=>({...d,calc:{rate:G.rate(d),cap:G.cap(d),price:G.price(d),slots:G.slots(d)}});
const A={};
A.state=async()=>({});
A.sell=async d=>{const c=Math.floor(d.wool*G.price(d));d.coins+=c;d.wool=0;return{gain:c}};
A.hatch=async(d,b)=>{const e=G.EGG[b.egg|0];if(!e)return{err:'No such egg'};if(d.coins<e.cost)return{err:'Not enough coins'};
 if(d.sheep.length>=G.slots(d))return{err:'Pasture full! Release a sheep or upgrade the Pasture.'};
 d.coins-=e.cost;const s=G.roll(b.egg|0);d.sheep.push(s);d.hatched++;d.best=Math.max(d.best||0,s.r);return{sheep:s}};
A.upgrade=async(d,b)=>{const x=G.B.find(y=>y[0]==b.b);if(!x)return{err:'?'};const l=d.b[x[0]];if(l>=(x[0]=='auto'?5:10))return{err:'Max level'};
 const c=G.bcost(x,l);if(d.coins<c)return{err:'Not enough coins'};d.coins-=c;d.b[x[0]]++;return{}};
A.team=async(d,b)=>{const ids=[...new Set(b.ids||[])];if(ids.length!=3||!ids.every(i=>d.sheep.some(s=>s.id==i)))return{err:'Pick 3 different sheep'};d.team=ids;return{}};
A.release=async(d,b)=>{const i=d.sheep.findIndex(s=>s.id==b.id);if(i<0)return{err:'?'};if(d.sheep.length<=3)return{err:'Keep at least 3 sheep'};
 const[s]=d.sheep.splice(i,1);d.coins+=G.RAR[s.r].v;d.team=d.team.filter(x=>x!=s.id);tick(d);return{}};
// ---- battles ----
const BT=new Map();
const unit=(s,side)=>{const st=G.stats(s);return{side,name:s.name,role:s.role,el:s.el,g:s,hp:st.hp,max:st.hp,atk:st.atk,def:st.def,spd:st.spd,cd:0,sh:0,stun:0,trait:s.trait}};
const elm=(a,b)=>a==3||b==3?1:b==(a+1)%3?1.5:a==(b+1)%3?.67:1;
const E=(b,m,a,to,v,k)=>b.ev.push({m,a,to:to||[],v,k,hp:b.u.map(x=>x.hp),sh:b.u.map(x=>x.sh)});
function hit(u,x,mult){const e=elm(u.el,x.el),crit=u.trait=='lucky'&&Math.random()<.2;
 const v=Math.max(1,Math.round(u.atk*mult*e*(crit?1.5:1)*(.9+Math.random()*.2)*100/(100+x.def)));const a=Math.min(x.sh,v);x.sh-=a;x.hp=Math.max(0,x.hp-(v-a));return{v,crit,e}}
const eff=r=>(r.crit?' CRIT!':'')+(r.e>1?' Super effective!':r.e<1?' Not very effective.':'');
function exec(b,i,mi,t){const u=b.u[i],m=G.ROLES[u.role].mv[mi],foes=b.u.filter(x=>x.side!=u.side&&x.hp>0),fr=b.u.filter(x=>x.side==u.side&&x.hp>0),tg=b.u[t];
 if(m[3])u.cd=m[3];
 if(m[1]=='dmg'||m[1]=='stun'){const x=tg&&tg.hp>0&&tg.side!=u.side?tg:foes[0],r=hit(u,x,m[2]);if(m[1]=='stun')x.stun=1;
  E(b,`${u.name} uses ${m[0]} on ${x.name} for ${r.v}.${eff(r)}${m[1]=='stun'?' '+x.name+' is dizzy!':''}`,i,[b.u.indexOf(x)],r.v,'d')}
 else if(m[1]=='all'){const to=[];let tot=0;foes.forEach(x=>{const r=hit(u,x,m[2]);tot+=r.v;to.push(b.u.indexOf(x))});E(b,`${u.name} STAMPEDES through the whole team!`,i,to,Math.round(tot/to.length),'d')}
 else if(m[1]=='heal'){const x=tg&&tg.hp>0&&tg.side==u.side?tg:fr.sort((a,c)=>a.hp/a.max-c.hp/c.max)[0],v=Math.round(u.atk*m[2]);x.hp=Math.min(x.max,x.hp+v);E(b,`${u.name} hugs ${x.name} (+${v} HP)`,i,[b.u.indexOf(x)],v,'h')}
 else{fr.forEach(x=>x.sh+=Math.round(x.max*m[2]));E(b,`${u.name} raises a Fluff Wall for the team!`,i,fr.map(x=>b.u.indexOf(x)),0,'s')}}
function ai(b,i){const u=b.u[i],foes=b.u.filter(x=>x.side==0&&x.hp>0),fr=b.u.filter(x=>x.side==1&&x.hp>0),mi=u.cd==0&&Math.random()<.65?1:0;let t;
 if(mi==1&&u.role==2)t=fr.sort((a,c)=>a.hp/a.max-c.hp/c.max)[0];else{foes.sort((a,c)=>a.hp-c.hp);t=Math.random()<.6?foes[0]:pick(foes)}exec(b,i,mi,b.u.indexOf(t))}
function advance(b){for(let g=0;g<300;g++){const al=n=>b.u.filter(u=>u.hp>0&&u.side==n).length;
 if(!al(0)||!al(1)){b.done=true;b.win=!!al(0);b.cur=null;return}
 if(!b.q.length)b.q=b.u.map((u,i)=>i).filter(i=>b.u[i].hp>0).sort((x,y)=>b.u[y].spd-b.u[x].spd);
 const i=b.q.shift(),u=b.u[i];if(u.hp<=0)continue;if(u.cd>0)u.cd--;
 if(u.stun){u.stun=0;E(b,`${u.name} is too dizzy to move!`,i,[],0,'x');continue}
 if(u.side==0){b.cur=i;return}ai(b,i)}}
const bv=b=>{const ev=b.ev;b.ev=[];return{u:b.u.map(({name,role,el,g,hp,max,cd,sh,stun,side})=>({name,role,el,g,hp,max,cd,sh,stun,side})),cur:b.cur,done:b.done,win:b.win,oname:b.oname,reward:b.reward,ev}};
function finish(d,b){if(b.paid)return;b.paid=1;
 if(b.win){const pw=b.u.filter(x=>x.side==1).reduce((a,x)=>a+x.max+x.atk*4,0),c=Math.round(40+pw/6);d.wins++;d.rating+=20;d.coins+=c;b.reward={coins:c,rating:20};
  d.team.forEach(id=>{const s=d.sheep.find(x=>x.id==id);if(s&&s.lv<20){s.xp++;s.lv=Math.min(20,1+Math.floor(s.xp/2))}})}
 else{d.losses++;d.rating=Math.max(0,d.rating-12);d.coins+=15;b.reward={coins:15,rating:-12}}}
A.bstart=async(d,_,q)=>{const all=(await db.all()).filter(x=>x.name!=q.n&&x.data.team&&x.data.team.length==3).sort((a,c)=>Math.abs(a.data.rating-d.rating)-Math.abs(c.data.rating-d.rating)).slice(0,4);
 let opp,oname;if(all.length&&Math.random()<.85){const o=pick(all);oname=o.data.name;opp=o.data.team.map(id=>o.data.sheep.find(s=>s.id==id)).filter(Boolean)}
 if(!opp||opp.length<3){oname='Farmer Bot';const e=d.rating<1100?0:d.rating<1300?1:2;opp=[0,1,2].map(()=>{const s=G.roll(e);s.lv=Math.max(1,Math.min(20,1+Math.floor((d.rating-1000)/60)));return s})}
 const me=d.team.map(id=>d.sheep.find(s=>s.id==id)),b={u:[...me.map(s=>unit(s,0)),...opp.map(s=>unit(s,1))],oname,q:[],cur:null,done:false,ev:[]};
 BT.set(q.n,b);advance(b);if(b.done)finish(d,b);return{bt:bv(b)}};
A.bact=async(d,body,q)=>{const b=BT.get(q.n);if(!b||b.done||b.cur==null)return{err:'No battle in progress'};const u=b.u[b.cur],mi=body.mi==1?1:0;
 if(mi==1&&u.cd>0)return{err:'Still cooling down'};exec(b,b.cur,mi,body.t|0);b.cur=null;advance(b);if(b.done)finish(d,b);return{bt:bv(b)}};
app.post('/api/act/:a',auth,H(async(q,s)=>{const f=A[q.params.a];if(!f)return s.sendStatus(404);const d=q.u.data;tick(d);const r=await f(d,q.body,q)||{};
 if(r.err)return s.json({err:r.err,d:view(d)});checkAch(d);await db.put(q.n,q.u);s.json({...r,d:view(d)})}));
app.get('/api/board',H(async(q,s)=>{s.json((await db.all()).map(x=>({name:x.data.name,rating:x.data.rating,wins:x.data.wins,sheep:x.data.sheep.length,best:x.data.best||0})).sort((a,b)=>b.rating-a.rating).slice(0,25))}));
app.get('/api/farm/:n',H(async(q,s)=>{const u=await db.get(q.params.n.toLowerCase());if(!u)return s.sendStatus(404);const d=u.data;s.json({name:d.name,rating:d.rating,sheep:d.sheep.slice().sort((a,b)=>b.r-a.r).slice(0,30)})}));
initDb().then(()=>app.listen(process.env.PORT||3000,()=>console.log('EGG & WOOL running'))).catch(e=>{console.error(e);process.exit(1)});
