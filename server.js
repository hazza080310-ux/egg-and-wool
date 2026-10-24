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
const away=(d,id)=>(d.ex||[]).some(e=>e.ids.includes(id));
const addXp=(d,n)=>{d.fxp=(d.fxp|0)+Math.round(n*(1+.06*G.rl(d,'scholar')))};
// ---- bond, shards, research points ----
const bond=(d,s,n)=>{if(s&&!G.isEgg(s))s.bd=Math.min(100,(s.bd|0)+n*(1+.25*G.rl(d,'bond')))};
const giveShards=(d,el,n)=>{d.sh=d.sh||{};d.sh[el]=(d.sh[el]|0)+Math.round(n*(1+.25*G.rl(d,'shards')))};
const addRp=(d,n)=>{d.rp=(d.rp|0)+n};
function postBattle(d,b){const win=b.win,els=b.u.filter(x=>x.side==1).map(x=>x.el),st=b.stage|0;
 d.team.forEach(id=>bond(d,d.sheep.find(x=>x.id==id),win?2:1));
 if(els.length)giveShards(d,pick(els),win?2:1);
 if(win&&st&&st>(d.adv|0)){if(els.length)giveShards(d,pick(els),4);addRp(d,3)}else if(win)addRp(d,1)}
const prog=(d,k,n=1)=>{const x=d.q&&d.q.l.find(y=>y.k==k);if(x)x.h+=n};
function tick(d){d.sh=d.sh||{};d.rs=d.rs||{};d.rq=d.rq||[];const tn=Date.now();d.rq=d.rq.filter(x=>{if(x.end<=tn){d.rs[x.id]=Math.max(d.rs[x.id]|0,x.to);return false}return true});
 const lcp=G.lvCap(d);for(const s of d.sheep)s.cap=lcp;
 d.dxb=G.dexInfo(d).bonus;d.ex=(d.ex||[]).filter(e=>e.rooms);const day=Math.floor(Date.now()/864e5);if(!d.q||d.q.day!=day){const ks=Object.keys(G.QUESTS).sort(()=>Math.random()-.5).slice(0,3);d.q={day,l:ks.map(k=>({k,n:pick(G.QUESTS[k][1]),h:0,r:Math.max(100,Math.round(G.rate(d)*200)),c:0}))}}
 const now=Date.now(),dt=Math.min(90,Math.max(0,(now-d.t)/1000));d.t=now;d.wool+=G.rate(d)*dt;const c=G.cap(d);
 if(d.wool>c)d.wool=c
 d.team=d.team.filter(id=>d.sheep.some(s=>s.id==id&&!G.isEgg(s)&&!away(d,s.id)));for(const s of d.sheep.filter(s=>!G.isEgg(s)&&!away(d,s.id)).sort((a,b)=>b.r-a.r))if(d.team.length<3&&!d.team.includes(s.id))d.team.push(s.id)}
function checkAch(d){for(const[id,,f,c]of G.ACH)if(!d.ach.includes(id)&&f(d)){d.ach.push(id);d.coins+=c}}
const grantSp=d=>{d.spl=d.spl||[];const out=[];for(const x of G.SPECIALS)if(!x.herd&&!d.spl.includes(x.id)&&!d.sheep.some(y=>y.sp==x.id)&&x.cond(d)){d.spl.push(x.id);const ns=G.mkSpecial(x.id);if(x.id=='duck')ns.hatchAt=Date.now()+864e5;d.sheep.push(ns);out.push(x.name)}return out};
const view=d=>({...d,calc:{rate:G.rate(d),cap:G.cap(d),price:G.price(d),slots:G.slots(d)}});
const A={};
A.state=async()=>({});
A.sell=async d=>{const c=Math.floor(d.wool*G.price(d));d.coins+=c;d.wool=0;prog(d,'sell');addXp(d,c>=25?Math.min(60,Math.floor(Math.sqrt(c)/3)):0);return{gain:c}};
A.hatch=async(d,b)=>{const ei=b.egg|0,e=G.EGG[ei],n=b.n==10?10:1;if(!e)return{err:'No such egg'};if(G.farmLv(d.fxp).lv<(e.lv|0))return{err:'Reach farm level '+e.lv+' to use this egg'};if(d.coins<e.cost*n)return{err:'Not enough coins'};
 if(d.sheep.length+n>G.slots(d))return{err:n>1?'You need '+n+' free pasture slots':'Pasture full! Release a sheep or upgrade the Pasture.'};
 d.coins-=e.cost*n;d.dex=d.dex||[];let nd=0;const out=[];for(let i=0;i<n;i++){const x=G.roll(ei);d.sheep.push(x);d.hatched++;d.best=Math.max(d.best||0,x.r);const k=(x.form|0)+'-'+x.r;if(!d.dex.includes(k)){d.dex.push(k);nd++;addRp(d,2)}out.push(x)}
 prog(d,'hatch',n);addXp(d,n*Math.round(4+Math.log10(e.cost)*4));addXp(d,nd*8);return{sheep:out[n-1],batch:out,newDex:nd}};
A.upgrade=async(d,b)=>{const x=G.B.find(y=>y[0]==b.b);if(!x)return{err:'?'};const l=d.b[x[0]];if(l>=10)return{err:'Max level'};if(l>=G.bcap(G.farmLv(d.fxp).lv))return{err:'Reach farm level '+Math.max(1,2*l)+' to upgrade this further'};
 const c=G.bcost(x,l);if(d.coins<c)return{err:'Not enough coins'};d.coins-=c;d.b[x[0]]++;addXp(d,25);return{}};
A.team=async(d,b)=>{const ids=[...new Set(b.ids||[])];if(ids.length!=3||!ids.every(i=>d.sheep.some(s=>s.id==i&&!G.isEgg(s)&&!away(d,i))))return{err:'Pick 3 different sheep'};d.team=ids;return{}};
A.release=async(d,b)=>{const i=d.sheep.findIndex(s=>s.id==b.id);if(i<0)return{err:'?'};if(d.sheep[i].sp)return{err:'Special sheep cannot be released'};if(d.sheep.length<=3)return{err:'Keep at least 3 sheep'};
 const[s]=d.sheep.splice(i,1);d.coins+=G.RAR[s.r].v;giveShards(d,s.el,G.relShards(s));d.team=d.team.filter(x=>x!=s.id);tick(d);return{}};
A.prestige=async d=>{if(d.sheep.filter(s=>s.r>=6&&!s.sp).length<3)return{err:'You need 3 hatched Celestial sheep to prestige'};const duck=d.sheep.find(s=>s.sp=='duck');d.pr=(d.pr|0)+1;
 const starters=[0,1,2].map(()=>{let s;do s=G.roll(0);while(s.r>0);return s});d.sheep=[...(duck?[duck]:[]),...starters];if(duck){duck.lv=Math.min(20,duck.lv+3);duck.xp=(duck.lv-1)*1.5;duck.hatchAt=Date.now()+864e5}
 d.coins=30;d.fxp=0;d.q=null;d.streak=0;d.w0=d.wins;d.wool=0;d.b={barn:0,shed:0,pasture:0,market:0,auto:0};d.team=[];d.adv=0;d.spl=duck?['duck']:[];d.hstash=[];d.ex=[];d.hatched=0;d.gc=0;d.best=0;d.t=Date.now();tick(d);return{prestiged:d.pr}};
const addSheep=(d,x)=>{d.sheep.push(x);d.best=Math.max(d.best||0,x.r);d.dex=d.dex||[];const k=(x.form|0)+'-'+x.r;if(!d.dex.includes(k)){d.dex.push(k);return true}return false};
// ---- races (unlimited, small rewards) ----
A.race=async(d,b)=>{const now=Date.now();if(now-(d.rcd||0)<30000)return{err:'Your sheep are catching their breath ('+Math.ceil((30000-(now-d.rcd))/1000)+'s)'};
 const s=d.sheep.find(x=>x.id==b.id);if(!s)return{err:'?'};if(G.isEgg(s)||away(d,s.id))return{err:'That sheep is unavailable'};
 const tr=G.TRACKS[(d.rt|0)%7],mod=el=>el==tr.el?1.25:G.elm(tr.el,el)>1?.85:1;
 const mk=(g,me)=>{const sc=G.stats(g).spd*mod(g.el)*(.85+Math.random()*.3);return{name:g.name,g,time:Math.max(5,Math.min(13,8*Math.sqrt(30/sc))),me}};
 const ents=[mk(s,1)];for(let i=0;i<5;i++){const g=G.roll(0,Math.random,Math.max(0,Math.min(6,s.r+Math.floor(Math.random()*3)-1)));g.lv=Math.max(1,Math.min(20,s.lv+Math.floor(Math.random()*5)-2));g.evo=Math.max(0,Math.min(2,(s.evo|0)+Math.floor(Math.random()*3)-1));ents.push(mk(g,0))}
 ents.sort((a,c)=>a.time-c.time);const place=ents.findIndex(x=>x.me)+1,xp=[8,5,4,3,2,1][place-1],coins=Math.round(Math.max(10,G.rate(d)*8)*[3,2,1.5,1,.6,.4][place-1]);
 d.rcd=now;d.rt=Math.floor(Math.random()*7);d.rn=(d.rn|0)+1;d.coins+=coins;addXp(d,xp);if(place==1)d.rw=(d.rw|0)+1;prog(d,'race');bond(d,s,2);giveShards(d,tr.el,place<=3?2:1);addRp(d,place==1?2:place<=3?1:0);
 let chest=null;if(d.rn%5==0){const cc=Math.round(Math.max(40,G.rate(d)*30));d.coins+=cc;addXp(d,15);chest={xp:15,coins:cc}}
 return{race:{track:tr,ents,place,xp,coins,chest,next:5-(d.rn%5)}}};
// ---- ruin expeditions (clear rooms of enemy sheep) ----
function mkFoes(R,depth,boss){const n=boss?3:Math.min(3,1+Math.floor(Math.random()*2)+(depth>.65&&Math.random()<.4?1:0)),out=[];for(let k=0;k<n;k++){const el=pick(R.els),ei=G.EGG.findIndex(e=>e.cat==1&&e.el==el),r=Math.min(6,R.r+(depth>.75&&Math.random()<.4?1:0)+(boss&&k==0?1:0)),g=G.roll(ei,Math.random,r);g.lv=Math.min(20,R.lvl+Math.floor(depth*2)+(boss?1:0));g.evo=g.lv>=12?2:g.lv>=5?1:0;if(boss&&k==0)g.name=R.boss;out.push(g)}return out}
function genRuin(R){const L=[[4,4,4],[6,6],[3,6,3],[5,7],[4,8],[7,5],[3,3,6],[6,3,3]],rooms=[];
 for(let f=0;f<R.floors;f++){let x=0;for(const w of pick(L)){rooms.push({f,x,w});x+=w}}
 const ord=[];for(let f=0;f<R.floors;f++)ord.push(...rooms.filter(r=>r.f==f).sort((a,b)=>f%2?b.x-a.x:a.x-b.x));
 ord.forEach((r,i)=>{const depth=i/Math.max(1,ord.length-1);r.i=i;r.c=0;const pv=i?ord[i-1].kind:'';r.kind=i==ord.length-1?'boss':i==0?'enemy':Math.random()<.13?'loot':pv!='rest'&&Math.random()<.12?'rest':Math.random()<.15?'event':Math.random()<.1?'trap':'enemy';if(r.kind=='event')r.ev=pick(['well','stray','chest']);if(r.kind=='enemy'||r.kind=='boss')r.foes=mkFoes(R,depth,r.kind=='boss')});return ord}
A.expstart=async(d,b)=>{const R=G.RUINS.find(x=>x.id==b.k);if(!R)return{err:'?'};const flv=G.farmLv(d.fxp).lv;if(flv<R.lv)return{err:'Reach farm level '+R.lv+' first'};d.ex=d.ex||[];if(d.ex.length>=1+(flv>=6?1:0)+(flv>=12?1:0))return{err:'All expedition slots are busy'};
 const ids=[...new Set(b.ids||[])];if(ids.length<1||ids.length>3||!ids.every(i=>d.sheep.some(s=>s.id==i&&!G.isEgg(s)&&!away(d,i))))return{err:'Pick 1 to 3 available sheep'};
 d.ex.push({k:R.id,ids,arrive:Date.now()+R.travel*1000,rooms:genRuin(R),hp:Object.fromEntries(ids.map(i=>[i,1])),tot:{xp:0,coins:0},sup:{hay:2,tonic:1}});d.team=d.team.filter(i=>!ids.includes(i));return{}};
A.expretreat=async(d,b)=>{const i=b.i|0;if(!d.ex||!d.ex[i])return{err:'?'};d.ex.splice(i,1);return{}};
const exOpen=(e,r)=>!r.c&&e.rooms.every(x=>x.f>=r.f||x.c)&&(r.kind!='boss'||e.rooms.every(x=>x===r||x.f!=r.f||x.c));
const exBase=(d,R,room)=>{const flv=G.farmLv(d.fxp).lv;return{flv,xpb:Math.round(R.xp*(1+room.i*.04)),cb:Math.round(R.c*10*(1+flv*.15))}};
const exParty=(d,e)=>e.ids.map(id=>d.sheep.find(s=>s.id==id)).filter(Boolean);
const exAlive=(d,e)=>exParty(d,e).filter(s=>(e.hp[s.id]??1)>0);
const exHurt=(e,ids,f)=>{for(const id of ids)if((e.hp[id]??1)>0)e.hp[id]=Math.max(.05,e.hp[id]-f)};
const exHeal=(e,ids,f)=>{for(const id of ids)if((e.hp[id]??1)>0)e.hp[id]=Math.min(1,e.hp[id]+f)};
const exSup=e=>e.sup=e.sup||{hay:1,tonic:0};
const EXASK={
 well:{t:'⛲ A glowing well',d:'Pale blue light shimmers in the water. It smells like clean laundry.',o:[['Drink from it','60% heal everyone 35%, 40% a funny tummy (-15% HP)'],['Toss in a coin','Costs some coins. Shards and bond for the whole party'],['Leave it','Walk on']]},
 stray:{t:'🐑 A lost lamb',d:'A tiny lamb is stuck behind a crate. It looks very hungry.',o:[['Share a Hay Bale','Costs 1 Hay Bale. Party bond up, and the lamb gives you a Spark Tonic'],['Follow it','60% it leads you to a stash, 40% a muddy fall (-10% HP)'],['Shoo it away','Nothing happens']]},
 chest:{t:'🧰 A suspicious chest',d:'It is breathing. Chests do not usually breathe.',o:[['Open it','65% a big haul, 35% it is a MIMIC and you must fight it for double rewards'],['Poke it carefully','A Trickster in the party makes this safe. Otherwise it is a coin flip'],['Skip it','Walk on']]},
 trap:{t:'🪤 A spike trap',d:'The floor is covered in pressure plates. One wrong step...',o:[['Disarm it','Better with Tricksters and Zoomy sheep. Success pays coins, failure hurts everyone (-15%)'],['Tank it','Your sturdiest sheep takes the hit (-12% HP). Always safe'],['Dash across','55% great coins, 45% everyone takes -18% HP']]}};
function exFight(d,e,R,room,q,foes,x){const mine=exAlive(d,e),boss=room.kind=='boss';
 const b={u:[...mine.map(s=>{const u=unit(s,0);u.hp=Math.max(1,Math.round(u.max*e.hp[s.id]));return u}),...foes.map(s=>{const u=unit(s,1);const fm=R.lv>=11?.76:.85;u.max=u.hp=Math.round(u.max*fm);u.atk=Math.round(u.atk*fm);return u})],oname:R.n+' · room '+(room.i+1)+(boss?' (boss)':x.mimic?' (MIMIC!)':''),q:[],cur:null,done:false,ev:[],dumb:false,exp:{id:e.arrive,r:room.i,mimic:!!x.mimic}};
 b.init=b.u.map(u=>u.hp);applyAura(b);
 if(e.buff){e.buff=0;b.u.forEach(u=>{if(u.side==0)u.atk=Math.round(u.atk*1.2)});E(b,'🧪 Spark Tonic! Your sheep hit 20% harder this fight.',null,[],0,'x')}
 BT.set(q.n,b);e.fight=1;e.at=room.i;advance(b);if(b.done)finish(d,b);return{bt:bv(b)}}
function finishExp(d,b){const x=b.exp,i=d.ex.findIndex(e=>e.arrive==x.id);if(i<0)return;const e=d.ex[i],R=G.RUINS.find(r=>r.id==e.k),room=e.rooms.find(r=>r.i==x.r);delete e.fight;if(!room)return;
 const{flv,xpb,cb}=exBase(d,R,room),boss=room.kind=='boss',mu=x.mimic?2:1,mine=b.u.filter(u=>u.side==0);
 for(const u of mine)e.hp[u.g.id]=u.hp>0?u.hp/u.max:0;
 if(b.win){room.c=1;const xp=xpb*(boss?3:1)*mu,c=cb*(boss?3:1)*mu;d.coins+=c;addXp(d,xp);e.tot.xp+=xp;e.tot.coins+=c;prog(d,'exp');addRp(d,boss?3:1);giveShards(d,pick(R.els),boss?4:1);
  for(const u of mine)if(e.hp[u.g.id]>0){bond(d,u.g,1);gain(u.g,.3);e.hp[u.g.id]=Math.min(1,e.hp[u.g.id]+.1)}
  let msg=x.mimic?'The mimic coughs up its loot!':'';if(!boss&&Math.random()<.25){exSup(e).hay++;msg+=(msg?' ':'')+'Found a Hay Bale 🌾'}
  if(boss){const bx=R.xp*6,bc=Math.round(R.c*60*(1+flv*.15));d.coins+=bc;addXp(d,bx);d.ec=(d.ec|0)+1;let fs='';if(Math.random()<.2&&d.sheep.length<G.slots(d)){const s=G.roll(R.egg);addSheep(d,s);fs=' · found a sheep: '+s.name}msg='Ruin cleared! Bonus +'+bx+' XP, +'+fmt0(bc)+' coins'+fs;d.ex.splice(i,1)}
  b.reward={coins:c,xp,rating:0,msg};return}
 d.ex.splice(i,1);b.reward={coins:0,xp:0,rating:0,msg:'Your party was beaten and limped home. Nobody is lost. Try a different party, element mix, or use supplies earlier!'}}
A.expclear=async(d,b,q)=>{const i=b.i|0,e=d.ex&&d.ex[i];if(!e)return{err:'?'};if(Date.now()<e.arrive)return{err:'Your party is still travelling'};
 const R=G.RUINS.find(x=>x.id==e.k);let note='';
 if(e.fight){const live=BT.get(q.n);if(live&&live.exp&&live.exp.id==e.arrive)BT.delete(q.n);delete e.fight;for(const id of e.ids)if(e.hp[id]>0)e.hp[id]=Math.max(.05,e.hp[id]*.75);note='Your party fled the last fight and lost some health.'}
 const room=e.rooms.find(r=>r.i==(b.r|0));if(!room||!exOpen(e,room))return{err:'That room is not open yet'};
 if(!exAlive(d,e).length){d.ex.splice(i,1);return{err:'Your whole party is knocked out. They limp home.'}}
 const{flv,xpb,cb}=exBase(d,R,room);e.at=room.i;e.pend=null;
 if(room.kind=='loot'){room.c=1;const c=Math.round(cb*1.5),xp=Math.round(xpb*.8);d.coins+=c;addXp(d,xp);e.tot.xp+=xp;e.tot.coins+=c;prog(d,'exp');addRp(d,1);let s='';if(Math.random()<.5){exSup(e).hay++;s=' and a Hay Bale 🌾'}else if(Math.random()<.3){exSup(e).tonic++;s=' and a Spark Tonic 🧪'}return{note,room:{kind:'loot',xp,coins:c,msg:'🎁 Found supplies: +'+xp+' XP, +'+fmt0(c)+' coins'+s}}}
 if(room.kind=='rest'){room.c=1;exHeal(e,e.ids,.4);return{note,room:{kind:'rest',msg:'💤 The party rested and recovered some health'}}}
 if(room.kind=='event'||room.kind=='trap'){e.pend=room.i;const k=room.kind=='trap'?'trap':room.ev,a=EXASK[k];return{note,ask:{r:room.i,k,t:a.t,d:a.d,o:a.o}}}
 return Object.assign(exFight(d,e,R,room,q,room.foes,{}),{note})};
A.expchoose=async(d,b,q)=>{const i=b.i|0,e=d.ex&&d.ex[i];if(!e)return{err:'?'};const room=e.rooms.find(r=>r.i==(b.r|0)),c=b.c|0;if(!room||room.c||e.pend!=room.i||!exOpen(e,room))return{err:'Nothing to decide here'};
 const R=G.RUINS.find(x=>x.id==e.k),{flv,xpb,cb}=exBase(d,R,room),k=room.kind=='trap'?'trap':room.ev,al=exAlive(d,e),ids=e.ids,rnd=Math.random();let msg='';
 const pay=(m,xpm=1)=>{const co=Math.round(cb*m),xp=Math.round(xpb*xpm);d.coins+=co;addXp(d,xp);e.tot.xp+=xp;e.tot.coins+=co;prog(d,'exp');return{co,xp}};
 const done=()=>{room.c=1;e.pend=null};
 if(k=='well'){if(c==0){if(rnd<.6){exHeal(e,ids,.35);msg='⛲ Refreshing! Everyone recovers 35% health.'}else{exHurt(e,ids,.15);msg='⛲ Bleh. Tastes like soap. Everyone loses 15% health.'}}
  else if(c==1){const cost=Math.round(cb*.6);if(d.coins<cost)return{err:'You need '+fmt0(cost)+' coins'};d.coins-=cost;giveShards(d,pick(R.els),2);for(const s of al)bond(d,s,2);addRp(d,1);msg='⛲ The water glows! +2 shards, bond up, research point.'}else msg='You walk on.';done()}
 else if(k=='stray'){if(c==0){const sp=exSup(e);if(!sp.hay)return{err:'You have no Hay Bale to share'};sp.hay--;sp.tonic++;for(const s of al)bond(d,s,3);const p=pay(.5);msg='🐑 The lamb nuzzles you and hands over a Spark Tonic 🧪! +'+p.xp+' XP.'}
  else if(c==1){if(rnd<.6){const p=pay(1.8);exSup(e).hay++;msg='🐑 It led you to a stash! +'+fmt0(p.co)+' coins and a Hay Bale 🌾.'}else{exHurt(e,ids,.1);msg='🐑 Splat! A muddy tumble costs 10% health.'}}else msg='The lamb trots away.';done()}
 else if(k=='chest'){const trick=al.some(s=>s.role==3);if(c==2){msg='You skip the chest.';done()}
  else{const safe=c==1&&trick,win=safe||rnd<(c==1?.5:.65);if(win){const p=pay(safe?1.6:2.2);if(Math.random()<.5)exSup(e).hay++;msg=(safe?'🧰 Your Trickster picked the lock safely! ':'🧰 Jackpot! ')+'+'+fmt0(p.co)+' coins.';done()}
   else{room.foes=mkFoes(R,Math.min(1,room.i/Math.max(1,e.rooms.length-1)+.15),false).slice(0,2);const r=exFight(d,e,R,room,q,room.foes,{mimic:1});r.msg='🧰 It is a MIMIC!';return r}}}
 else if(k=='trap'){if(c==0){const ch=Math.max(.2,Math.min(.9,.35+.2*al.filter(s=>s.role==3).length+.1*al.filter(s=>s.trait=='speedy').length));if(rnd<ch){const p=pay(1.3);addRp(d,1);msg='🪤 Click! Disarmed. +'+fmt0(p.co)+' coins, +1 research.'}else{exHurt(e,ids,.15);msg='🪤 Snap! Everyone loses 15% health.'}}
  else if(c==1){const tank=al.slice().sort((a,z)=>G.stats(z).def-G.stats(a).def)[0];if(tank)exHurt(e,[tank.id],.12);const p=pay(.4,.5);msg='🪤 '+(tank?tank.name:'A sheep')+' soaks the spikes (-12% HP). Safe. +'+fmt0(p.co)+' coins.'}
  else{if(rnd<.55){const p=pay(1.7);msg='🪤 Whoosh! Made it across. +'+fmt0(p.co)+' coins.'}else{exHurt(e,ids,.18);msg='🪤 Ouch! Everyone loses 18% health.'}}done()}
 return{room:{kind:'event',msg}}};
A.expuse=async(d,b)=>{const i=b.i|0,e=d.ex&&d.ex[i];if(!e)return{err:'?'};if(e.fight)return{err:'Not during a fight'};const sp=exSup(e);
 if(b.item=='hay'){if(!sp.hay)return{err:'No Hay Bales left'};if(!e.ids.includes(b.id)||(e.hp[b.id]??1)<=0)return{err:'Pick a sheep that is still up'};if(e.hp[b.id]>=1)return{err:'Already at full health'};sp.hay--;exHeal(e,[b.id],.35);return{room:{kind:'rest',msg:'🌾 Munch munch. Healed 35%.'}}}
 if(b.item=='tonic'){if(!sp.tonic)return{err:'No Spark Tonics left'};if(e.buff)return{err:'A tonic is already active'};sp.tonic--;e.buff=1;return{room:{kind:'rest',msg:'🧪 Next fight your sheep hit 20% harder.'}}}
 return{err:'?'}};
const fmt0=n=>n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e4?(n/1e3).toFixed(1)+'k':String(Math.floor(n));
// ---- sheepdex rewards ----
A.dexclaim=async(d,b)=>{const ms=G.DEXMS.find(x=>x.n==(b.n|0));if(!ms||ms.egg==null)return{err:'?'};d.dxc=d.dxc||[];if(d.dxc.includes(ms.n))return{err:'Already claimed'};if(G.dexInfo(d).n<ms.n)return{err:'Discover '+ms.n+' entries first'};
 d.dxc.push(ms.n);addXp(d,ms.xp);let sheep=null,coins=0;const x=G.roll(ms.egg);if(d.sheep.length<G.slots(d)){addSheep(d,x);sheep=x}else{coins=G.EGG[ms.egg].cost;d.coins+=coins}return{dexr:{xp:ms.xp,sheep,coins}}};
A.tutdone=async d=>{d.tut=1;return{}};
A.train=async(d,b)=>{const s=d.sheep.find(x=>x.id==b.id);if(!s)return{err:'?'};if(G.isEgg(s))return{err:'That sheep is still in its egg'};if(s.lv>=G.lvCap(d))return{err:'Max level (research Training Grounds to raise the cap)'};const c=G.trainCost(s);if(d.coins<c)return{err:'Not enough coins'};d.coins-=c;s.lv++;s.xp=G.xpOf(s.lv);bond(d,s,2);prog(d,'train');addXp(d,6);return{sheep:s}};
A.daily=async d=>{const now=Date.now();if(now-(d.daily||0)<20*36e5)return{err:'Already claimed today'};d.streak=now-(d.daily||0)<48*36e5?(d.streak|0)+1:1;const c=80+30*Math.min(d.streak,10);d.coins+=c;d.daily=now;addXp(d,15);addRp(d,2);return{gain:c}};
// ---- battles ----
const BT=new Map();
const unit=(s,side)=>{const st=G.stats(s),p=s.sp?G.SPM[s.sp].pas:null,u={side,name:s.name,role:s.role,el:s.el,g:s,hp:st.hp,max:st.hp,atk:Math.round(st.atk*(p=='mighty'?1.3:1)),def:st.def,spd:Math.round(st.spd*(p=='haste'?1.5:1)),cds:[0,0,0,0,0,0,0,0,0,0],burn:0,mv:G.moves(s),sh:0,shd:{},stun:0,imm:0,bd:s.bd|0,dg:0,fc:0,endured:0,trait:s.trait,pas:p};if(p=='bulwark')addSh(u,'Bulwark',20);return u};
const elm=G.elm;
const E=(b,m,a,to,v,k)=>b.ev.push({m,a,to:to||[],v,k,hp:b.u.map(x=>x.hp),sh:b.u.map(x=>x.sh)});
function hit(u,x,mult,b,area){const e=elm(u.el,x.el),crit=Math.random()<(u.trait=='lucky'?.2:.08);
 // Dodge stance: a sheep that spent its turn dodging evades with G.dodgeChance (and earns Focus); if it fails it still takes 20% less
 // otherwise only a small passive chance: faster targets can dodge (up to 12%)
 if(x.dg){if(Math.random()<G.dodgeChance(x,u,area)){x.fc=1;return{v:0,crit:false,e,miss:true,perfect:true}}}
 else if(Math.random()<Math.min(.12,Math.max(0,(x.spd-u.spd)/(Math.max(1,u.spd)*5))))return{v:0,crit:false,e,miss:true};
 const vuln=(x.stun||x.burn>0)?1.15:1,fld=b&&b.field!=null&&u.el==b.field?1.2:1,foc=u.fc?1.3:1,gl=x.dg?.8:1;
 const v=Math.max(1,Math.round(u.atk*mult*e*vuln*fld*foc*gl*(crit?1.5:1)*(.9+Math.random()*.2)*100/(100+x.def)));let rem=v;for(const k of Object.keys(x.shd)){const a=Math.min(x.shd[k],rem);x.shd[k]-=a;rem-=a;if(x.shd[k]<=0)delete x.shd[k]}x.sh=Object.values(x.shd).reduce((p,c)=>p+c,0);x.hp=Math.max(0,x.hp-rem);
 // bond: a close sheep refuses to go down once per battle
 let endure=false;if(x.hp<=0&&x.bd>=50&&!x.endured){x.endured=1;x.hp=1;endure=true}
 if(x.pas=='thorns'&&v>0)u.hp=Math.max(0,u.hp-Math.round(v*.2));if(u.pas=='vamp')u.hp=Math.min(u.max,u.hp+Math.round(v*.25));return{v,crit,e,vuln:vuln>1,endure,x,glance:!!x.dg,focus:foc>1}}
// stun/freeze: a unit that just lost a turn is immune to the next one (no stun-locks)
const stunIt=x=>{if(x.imm){x.imm=0;return false}x.stun=1;return true};
const applyAura=b=>{for(const sd of[0,1])if(b.u.some(x=>x.side==sd&&x.pas=='quack'))b.u.forEach(x=>{if(x.side==sd)x.atk=Math.round(x.atk*1.15)})};
const addSh=(x,n,a)=>{x.shd[n]=Math.max(x.shd[n]||0,a);const sum=()=>Object.values(x.shd).reduce((p,c)=>p+c,0);let t=sum();if(t>60){x.shd[n]=Math.max(0,x.shd[n]-(t-60));if(!x.shd[n])delete x.shd[n];t=sum()}x.sh=t};
const eff=r=>r.miss?' Dodged!':(r.focus?' ⚡ Focus!':'')+(r.glance?' (braced: -20%)':'')+(r.crit?' CRIT!':'')+(r.e>1?' Super effective!':r.e<1?' Not very effective.':'')+(r.vuln?' (it was off balance)':'')+(r.endure?' '+r.x.name+' hangs on thanks to its bond!':'');
function dodgeAct(b,i){const u=b.u[i];u.dg=1;E(b,`💨 ${u.name} braces to dodge!`,i,[i],0,'g')}
const ATKT=['dmg','stun','drain','burn','freeze','all','stunall','burnall','freezeall','drainall'];
function exec(b,i,mi,t){const u=b.u[i];if(mi<0)return dodgeAct(b,i);const atk=ATKT.includes(u.mv[mi][1]);exec0(b,i,mi,t);if(atk)u.fc=0}
function exec0(b,i,mi,t){const u=b.u[i],m=u.mv[mi],foes=b.u.filter(x=>x.side!=u.side&&x.hp>0&&!x.off),fr=b.u.filter(x=>x.side==u.side&&x.hp>0&&!x.off),tg=b.u[t],ix=x=>b.u.indexOf(x),ty=m[1];
 if(m[3])u.cds[mi]=m[3];
 if(['dmg','stun','drain','burn','freeze'].includes(ty)){const x=tg&&tg.hp>0&&tg.side!=u.side?tg:foes[0],r=hit(u,x,m[2],b);let ex='',dz=true;
  if(r.miss){E(b,`${u.name} uses ${m[0]} on ${x.name} but ${r.perfect?'it dodges perfectly! ⚡ Focus for '+x.name+'!':'it dodges!'}`,i,[ix(x)],r.perfect?1:0,'m');return}
  if(ty=='stun')dz=stunIt(x);
  if(ty=='burn'){x.burn=3;ex=` and sets ${x.name} ablaze`}
  if(ty=='freeze'&&Math.random()<.4){if(stunIt(x))ex=` and freezes ${x.name} solid`}
  if(ty=='drain'){const h=Math.round(r.v*.5);u.hp=Math.min(u.max,u.hp+h);ex=` and drains ${h} HP`}
  E(b,`${u.name} uses ${m[0]} on ${x.name} for ${r.v}${ex}.${eff(r)}${ty=='stun'?(dz?' '+x.name+' is dizzy!':' '+x.name+' shrugs it off!'):''}`,i,[ix(x)],r.v,'d')}
 else if(['all','stunall','burnall','freezeall','drainall'].includes(ty)){let v=0,tot=0;const hitT=[],dgT=[];foes.forEach(x=>{const r=hit(u,x,m[2],b,1);if(r.miss){dgT.push([x,r.perfect]);return}v=r.v;tot+=v;hitT.push(x);if(ty=='stunall')stunIt(x);if(ty=='burnall')x.burn=3;if(ty=='freezeall'&&Math.random()<.3)stunIt(x)});
  if(ty=='drainall')u.hp=Math.min(u.max,u.hp+Math.round(tot*.35));
  E(b,`${u.name} unleashes ${m[0]}!${ty=='stunall'?' Everyone is dizzy!':ty=='burnall'?' Everyone is on fire!':ty=='freezeall'?' A chilly mess!':''}`,i,hitT.map(ix),v,'d');dgT.forEach(([x,pf])=>E(b,`${x.name} dodges ${u.name}'s ${m[0]}!${pf?' ⚡ Focus!':''}`,i,[ix(x)],pf?1:0,'m'))}
 else if(ty=='heal'){const x=tg&&tg.hp>0&&tg.side==u.side?tg:fr.sort((a,c)=>a.hp/a.max-c.hp/c.max)[0],v=Math.round(u.atk*m[2]);x.hp=Math.min(x.max,x.hp+v);E(b,`${u.name} hugs ${x.name} (+${v} HP)`,i,[ix(x)],v,'h')}
 else if(ty=='healall'){const v=Math.round(u.atk*m[2]);fr.forEach(x=>x.hp=Math.min(x.max,x.hp+v));E(b,`${u.name} sings ${m[0]} (+${v} HP each)`,i,fr.map(ix),v,'h')}
 else{fr.forEach(x=>addSh(x,m[0],m[2]<1?Math.round(x.max*m[2]):m[2]));E(b,`${u.name} raises ${m[0]}!`,i,fr.map(ix),0,'s')}}
function ai(b,i){const u=b.u[i],mv=u.mv,foes=b.u.filter(x=>x.side!=u.side&&x.hp>0),fr=b.u.filter(x=>x.side==u.side&&x.hp>0),ok=[0];
 if(!b.dumb&&u.hp/u.max<.4&&!u.dg&&Math.random()<.3){exec(b,i,-1,0);return}
 for(let k=1;k<mv.length;k++)if(u.cds[k]==0)ok.push(k);const smart=!b.dumb,hurt=fr.slice().sort((a,c)=>a.hp/a.max-c.hp/c.max)[0],isH=k=>mv[k][1]=='heal'||mv[k][1]=='healall';let mi=0;
 const heals=ok.filter(isH);
 if(smart&&heals.length&&hurt.hp/hurt.max<.5)mi=pick(heals);
 else if(ok.length>1&&Math.random()<(b.dumb?.4:.7)){const pool=ok.filter(k=>k&&!(isH(k)&&hurt.hp/hurt.max>.85));mi=pool.length?pick(pool):0}
 let t;if(mv[mi][1]=='heal')t=hurt;
 else if(smart){foes.sort((a,c)=>elm(u.el,c.el)*(1.6-c.hp/c.max)-elm(u.el,a.el)*(1.6-a.hp/a.max));t=Math.random()<.7?foes[0]:pick(foes)}
 else{foes.sort((a,c)=>a.hp-c.hp);t=Math.random()<.3?foes[0]:pick(foes)}
 exec(b,i,mi,b.u.indexOf(t))}
function advance(b){for(let g=0;g<300;g++){b.u.forEach((x,k)=>{if(x.hp<=0&&x.pas=='revive'&&!x.used){x.used=1;x.hp=Math.ceil(x.max*.5);x.stun=0;x.burn=0;E(b,`🔥 ${x.name} rises from the ashes!`,k,[k],0,'h')}});const al=n=>b.u.filter(u=>u.hp>0&&u.side==n).length;
 if(!al(0)||!al(1)){b.done=true;b.win=al(0)?true:al(1)?false:Math.random()<.5;b.cur=null;return}
 if(!b.q.length){b.q=b.u.map((u,i)=>i).filter(i=>b.u[i].hp>0).sort((x,y)=>b.u[y].spd-b.u[x].spd);b.round=(b.round|0)+1;
  if(b.round>12){b.u.forEach(x=>{if(x.hp>0)x.hp=Math.max(0,x.hp-Math.ceil(x.max*.05*(b.round-12)))});E(b,'⛈ A storm rolls in and soaks everyone!',null,b.u.map((x,i)=>i),0,'d');continue}}
 const i=b.q.shift(),u=b.u[i];if(u.hp<=0)continue;u.dg=0;for(let k=0;k<10;k++)if(u.cds[k]>0)u.cds[k]--;
 if(u.burn>0){const dm=Math.max(1,Math.ceil(u.max*.06));u.burn--;u.hp=Math.max(0,u.hp-dm);E(b,`${u.name} burns for ${dm}!`,null,[i],dm,'d');if(u.hp<=0)continue}
 if(u.pas=='regen'&&u.hp<u.max){const h=Math.ceil(u.max*.06);u.hp=Math.min(u.max,u.hp+h);E(b,`${u.name} regenerates ${h} HP`,i,[i],h,'h')}
 if(u.stun){u.stun=0;u.imm=1;E(b,`${u.name} is too dizzy to move!`,i,[],0,'x');continue}else u.imm=0;
 if(b.pvp||u.side==0){b.cur=i;b.turnAt=Date.now();return}ai(b,i)}}
const vu=b=>b.u.map(({name,role,el,g,hp,max,cds,sh,stun,side,burn,bd,spd,dg,fc,off})=>({name,role,el,g,hp,max,cds,sh,stun,side,burn,bd,spd,dg,fc,off}));
const bv=b=>{const ev=b.ev;b.ev=[];return{init:b.init,u:vu(b),q:b.q.filter(i=>b.u[i].hp>0),field:b.field,cur:b.cur,done:b.done,win:b.win,oname:b.oname,reward:b.reward,ev}};
const gain=(s,x)=>{const cp=(s&&s.cap)||20;if(s&&s.lv<cp){s.xp+=x;s.lv=G.lvOf(s.xp,cp)}};
function finish(d,b){if(b.paid)return;b.paid=1;if(b.exp)return finishExp(d,b);postBattle(d,b);const st=b.stage|0;addXp(d,b.win?(st?(st>(d.adv|0)?40:10):b.war?15:12):4);
 if(b.war){const c=b.win?100:20;d.coins+=c;b.reward={coins:c,rating:0,war:1};if(b.win)prog(d,'win');d.team.forEach(id=>gain(d.sheep.find(x=>x.id==id),b.win?1:.5));return}
 if(b.win){prog(d,'win');d.team.forEach(id=>gain(d.sheep.find(x=>x.id==id),1));
  if(st){const first=st>(d.adv|0),c=Math.round(60*st*(1+st/10)*(first?1:.25));d.wins++;d.coins+=c;b.reward={coins:c,rating:0,first};prog(d,'adv');
   if(first)d.adv=st}
  else{const pw=b.u.filter(x=>x.side==1).reduce((a,x)=>a+x.max+x.atk*4,0),c=Math.round((20+pw/12)*(b.oname=='Farmer Bot'?.6:1));d.wins++;d.rating+=20;d.coins+=c;b.reward={coins:c,rating:20}}}
 else{if(st){d.coins+=5;b.reward={coins:5,rating:0}}else{d.losses++;d.rating=Math.max(0,d.rating-12);d.coins+=5;b.reward={coins:5,rating:-12}}d.team.forEach(id=>gain(d.sheep.find(x=>x.id==id),.5))}}
A.claimq=async(d,b)=>{const x=d.q&&d.q.l[b.i|0];if(!x||x.c||x.h<x.n)return{err:'Not ready yet'};x.c=1;d.coins+=x.r;addXp(d,40);addRp(d,2);return{gain:x.r}};
A.golden=async d=>{const now=Date.now();if(now-(d.gt||0)<30000)return{err:'Too soon'};d.gt=now;const c=Math.max(25,Math.round(G.rate(d)*60));d.coins+=c;d.gc=(d.gc|0)+1;prog(d,'golden');addXp(d,8);addRp(d,1);return{gain:c}};
A.evolve=async(d,b)=>{const s=d.sheep.find(x=>x.id==b.id);if(!s)return{err:'?'};if(G.isEgg(s))return{err:'That sheep is still in its egg'};const e=s.evo|0;if(e>=G.maxEvo(d))return{err:e>=3?'Already fully evolved':'Research Ascension Rites to unlock the next stage'};if(s.lv<G.evoLv[e])return{err:'Needs level '+G.evoLv[e]};
 if((s.bd|0)<G.evoBond[e])return{err:'Needs bond '+G.evoBond[e]+' (fight with it, train it, pet it)'};const path=b.path|0;if(e==1&&path!=1&&path!=2)return{err:'Choose an evolution path'};
 const c=G.evoCost(s),n=G.evoShards(s);d.sh=d.sh||{};if(d.coins<c)return{err:'Not enough coins'};if((d.sh[s.el]|0)<n)return{err:'Needs '+n+' '+G.EL[s.el]+' shards'};
 d.coins-=c;d.sh[s.el]-=n;s.evo=e+1;if(e==1)s.br=path;addXp(d,40);return{sheep:s}};
// choose a path for a sheep that was already Ascended before paths existed
A.path=async(d,b)=>{const s=d.sheep.find(x=>x.id==b.id);if(!s||G.isEgg(s))return{err:'?'};if((s.evo|0)<2||s.br)return{err:'Nothing to choose'};const path=b.path|0;if(path!=1&&path!=2)return{err:'Choose a path'};
 const o={...s,evo:1},c=Math.round(G.evoCost(o)/2),n=G.evoShards(o);d.sh=d.sh||{};if(d.coins<c)return{err:'Not enough coins'};if((d.sh[s.el]|0)<n)return{err:'Needs '+n+' '+G.EL[s.el]+' shards'};d.coins-=c;d.sh[s.el]-=n;s.br=path;addXp(d,25);return{sheep:s}};
A.awaken=async(d,b)=>{const s=d.sheep.find(x=>x.id==b.id);if(!s||G.isEgg(s))return{err:'?'};if(s.sp)return{err:'Special sheep cannot be awakened'};const mx=G.awkMax(d);if(!mx)return{err:'Research the Awakening Lab first'};if(s.r>=mx)return{err:'Research more Awakening Lab levels to go past '+G.RAR[s.r].n};
 if(s.lv<15)return{err:'Needs level 15'};if((s.bd|0)<50)return{err:'Needs bond 50'};const k=G.awkCost(s);d.sh=d.sh||{};if(d.coins<k.c)return{err:'Not enough coins'};if((d.sh[s.el]|0)<k.sh)return{err:'Needs '+k.sh+' '+G.EL[s.el]+' shards'};
 d.coins-=k.c;d.sh[s.el]-=k.sh;s.r++;s.aw=(s.aw|0)+1;s.bd=Math.round((s.bd|0)*.5);const pool=G.EX.filter(x=>x[1]<=s.r&&!s.ex.includes(x[0])).map(x=>x[0]);if(pool.length)s.ex.push(pick(pool));addXp(d,60+40*s.r);return{sheep:s}};
A.pet=async(d,b)=>{const s=d.sheep.find(x=>x.id==b.id);if(!s||G.isEgg(s))return{err:'?'};const day=Math.floor(Date.now()/864e5);if(!d.pets||d.pets.day!=day)d.pets={day,ids:[]};if(d.pets.ids.includes(s.id))return{err:'You already petted this sheep today'};if(d.pets.ids.length>=5)return{err:'You can pet 5 sheep a day'};d.pets.ids.push(s.id);bond(d,s,3);return{sheep:s}};
// ---- research lab ----
A.resstart=async(d,b)=>{const R=G.RES.find(x=>x.id==b.id);if(!R)return{err:'?'};const lv=G.rl(d,R.id),flv=G.farmLv(d.fxp).lv;if(lv>=R.max)return{err:'Fully researched'};if(flv<R.lv)return{err:'Reach farm level '+R.lv+' first'};
 if(R.req&&G.rl(d,R.req[0])<R.req[1])return{err:'Needs '+G.RES.find(x=>x.id==R.req[0]).n+' level '+R.req[1]};d.rq=d.rq||[];if(d.rq.some(x=>x.id==R.id))return{err:'Already being researched'};if(d.rq.length>=G.resSlots(flv))return{err:'All research slots are busy'};
 const rp=R.rp[lv],c=R.c[lv];if((d.rp|0)<rp)return{err:'Needs '+rp+' Research Points'};if(d.coins<c)return{err:'Not enough coins'};d.rp-=rp;d.coins-=c;d.rq.push({id:R.id,to:lv+1,end:Date.now()+R.min[lv]*6e4});addXp(d,10);return{}};
A.bstart=async(d,body,q)=>{const st=(body&&body.stage)|0,me=d.team.map(id=>d.sheep.find(s=>s.id==id)),pw=ts=>ts.reduce((a,s)=>{const t=G.stats(s);return a+t.hp+t.atk*4},0),mine=pw(me);let opp,oname,o=null,war=null;
 if(body&&body.war){const c=d.clan&&await db.cget(d.clan);if(!c||!c.warId)return{err:'Your herd is not in a war'};const w=await db.cget('war:'+c.warId);if(!w||w.done||Date.now()>w.end)return{err:'The war is over'};if(w.used[q.n]!==undefined)return{err:'You already used your war attack'};
  const oc=await db.cget(w.a==c.key?w.b:w.a),cand=[];for(const mk of oc.members){const u=await db.get(mk);if(u&&u.data.team&&u.data.team.length==3)cand.push(u.data)}if(!cand.length)return{err:'No enemy defenders available'};
  const od=pick(cand);opp=od.team.map(id=>od.sheep.find(s=>s.id==id)).filter(Boolean);if(opp.length<3)return{err:'No enemy defenders available'};oname=od.name+' ('+oc.name+')';war={id:w.id};w.used[q.n]=-1;await db.cput('war:'+w.id,w)}
 else if(st){if(st>30||st>(d.adv|0)+1)return{err:'Beat the earlier stages first'};if(G.farmLv(d.fxp).lv<G.stageLv(st))return{err:'Reach farm level '+G.stageLv(st)+' to fight this stage'};oname=G.STAGE_NAMES[st-1];
  opp=[0,1,2].map(k=>{const base=st/6.5,r=Math.min(6,Math.floor(base)+(Math.random()<base%1?1:0)+(k==2&&st%5==0?1:0)),s=G.roll(0,Math.random,r);s.lv=Math.min(20,1+Math.floor(st*.7));s.evo=s.lv>=12?2:s.lv>=5?1:0;return s})}
 else{const all=(await db.all()).filter(x=>x.name!=q.n&&x.data.team&&x.data.team.length==3).map(x=>({x,t:x.data.team.map(id=>x.data.sheep.find(s=>s.id==id)).filter(Boolean)})).filter(o=>o.t.length==3&&pw(o.t)<=mine*1.05)
   .sort((a,c)=>Math.abs(a.x.data.rating-d.rating)-Math.abs(c.x.data.rating-d.rating));
  o=all.length&&Math.random()<.7?pick(all.slice(0,4)):null;oname=o?o.x.data.name:'Farmer Bot';
  opp=o?o.t:me.map(m=>{const s=G.roll(0,Math.random,Math.max(0,m.r-(Math.random()<.6?1:0)));s.lv=Math.max(1,m.lv-1-Math.floor(Math.random()*3));s.evo=Math.max(0,Math.min((m.evo|0)-1,s.lv>=12?2:s.lv>=5?1:0));return s})}
 const b={u:[...me.map(s=>unit(s,0)),...opp.map(s=>unit(s,1))],oname,q:[],cur:null,done:false,ev:[],stage:st,war,dumb:st?st<8:(war?false:!o)};
 if(st?st<5:(war?false:!o))b.u.filter(x=>x.side==1).forEach(x=>{x.max=x.hp=Math.round(x.max*.92);x.atk=Math.round(x.atk*.92)});
 b.field=Math.random()<.7?Math.floor(Math.random()*7):null;applyAura(b);if(b.field!=null)E(b,'🌍 '+G.FIELDS[b.field]+': '+G.EL[b.field]+' sheep hit 20% harder this battle!',null,[],0,'x');BT.set(q.n,b);advance(b);if(b.done){finish(d,b);if(b.war)await warDone(d,b,q)}return{bt:bv(b)}};
A.bact=async(d,body,q)=>{const b=BT.get(q.n);if(!b||b.done||b.cur==null)return{err:'No battle in progress'};const u=b.u[b.cur],mi=body.dodge?-1:body.mi|0;
 if(mi<-1||mi>=u.mv.length||(mi>0&&u.cds[mi]>0))return{err:'Move not ready'};try{exec(b,b.cur,mi,body.t|0)}catch(e){console.error('exec',e)}b.cur=null;try{advance(b)}catch(e){console.error('advance',e);b.done=true;b.win=false;b.cur=null}if(b.done){finish(d,b);if(b.war)await warDone(d,b,q)}return{bt:bv(b)}};
// ---- live PvP (polling) ----
const LQ=new Map(),LM=new Map(),LU=new Map(),flush=b=>{b.log.push(...b.ev);b.ev=[]};
async function mkMatch(k0,k1){const us=await Promise.all([k0,k1].map(x=>db.get(x))),team=us.map(u=>{tick(u.data);return u.data.team.map(id=>u.data.sheep.find(x=>x.id==id))});
 const b={u:[...team[0].map(x=>unit(x,0)),...team[1].map(x=>unit(x,1))],q:[],cur:null,done:false,ev:[],log:[],pvp:true,turnAt:Date.now()};
 const m={b,keys:[k0,k1],names:us.map(u=>u.data.name),team:team.map(t=>t.map(x=>x.id)),seen:[Date.now(),Date.now()],t:Date.now()};
 b.field=Math.random()<.7?Math.floor(Math.random()*7):null;applyAura(b);if(b.field!=null)E(b,'🌍 '+G.FIELDS[b.field]+': '+G.EL[b.field]+' sheep hit 20% harder this battle!',null,[],0,'x');advance(b);flush(b);const id=Math.random().toString(36).slice(2);LM.set(id,m);LU.set(k0,id);LU.set(k1,id);return m}
async function finishLive(m){const b=m.b;if(b.paid)return;b.paid=1;b.reward=[null,null];
 for(const s of[0,1]){const u=await db.get(m.keys[s]);if(!u)continue;const d=u.data,win=(b.win?0:1)==s,c=win?60:15;addXp(d,win?20:6);if(win)prog(d,'win');d.wins+=win?1:0;d.losses+=win?0:1;d.rating=Math.max(0,d.rating+(win?25:-15));d.coins+=c;
  m.team[s].forEach(id=>{const sh=d.sheep.find(x=>x.id==id);gain(sh,win?1:.5);bond(d,sh,win?2:1)});addRp(d,win?1:0);b.reward[s]={coins:c,rating:win?25:-15};if(win&&d.clan){const cc=await db.cget(d.clan);if(cc){bumpWin(cc,m.keys[s]);await db.cput(cc.key,cc)}}checkAch(d);await db.put(m.keys[s],u)}}
const lview=(m,side,since)=>{const b=m.b;return{state:'match',me:side,oname:m.names[1-side],u:vu(b),q:b.q.filter(i=>b.u[i].hp>0),field:b.field,cur:b.cur,done:b.done,win:b.done?(b.win?0:1)==side:undefined,reward:b.reward&&b.reward[side],ev:b.log.slice(since),n:b.log.length}};
app.post('/api/live/:a',auth,H(async(q,s)=>{const k=q.n,a=q.params.a,now=Date.now(),since=q.body.since|0;let m=LM.get(LU.get(k));
 const forfeit=async side=>{m.b.done=true;m.b.win=side==1;m.b.cur=null;await finishLive(m)};
 if(a=='list'){for(const[x,e]of LQ)if(now-e.seen>12000)LQ.delete(x);return s.json({list:[...LQ].filter(([x])=>x!=k).map(([x,e])=>({k:x,name:e.name,rating:e.rating}))})}
 if(a=='leave'){LQ.delete(k);if(m&&!m.b.done)await forfeit(m.keys.indexOf(k));LU.delete(k);return s.json({})}
 if(!m){if(a!='join')return s.json({state:'none'});for(const[x,e]of LQ)if(now-e.seen>12000)LQ.delete(x);for(const[id,mm]of LM)if(now-mm.t>36e5)LM.delete(id);
  const tg=q.body.target,o=tg?(LQ.has(tg)&&tg!=k?tg:null):[...LQ.keys()].find(x=>x!=k);if(tg&&!o)return s.json({state:'gone'});if(o){LQ.delete(o);LQ.delete(k);m=await mkMatch(o,k)}else{LQ.set(k,{seen:now,name:q.u.data.name,rating:q.u.data.rating});return s.json({state:'wait'})}}
 const side=m.keys.indexOf(k),b=m.b;m.seen[side]=now;
 if(a=='act'){if(b.done||b.cur==null)return s.json({err:'No battle in progress'});const u=b.u[b.cur];if(u.side!=side)return s.json({err:'Not your turn'});const mi=q.body.dodge?-1:q.body.mi|0;
  if(mi<-1||mi>=u.mv.length||(mi>0&&u.cds[mi]>0))return s.json({err:'Move not ready'});exec(b,b.cur,mi,q.body.t|0);b.cur=null;advance(b);flush(b);if(b.done)await finishLive(m);return s.json(lview(m,side,since))}
 if(!b.done){if(now-m.seen[1-side]>20000)await forfeit(1-side);else if(b.cur!=null&&now-b.turnAt>30000){ai(b,b.cur);advance(b);flush(b);if(b.done)await finishLive(m)}}
 s.json(lview(m,side,since))}));
// ---- ranked PvP: live 1v1, the rest of the team waits in reserve (polling) ----
const RQ=new Map(),RM=new Map(),RU=new Map();
const TIERS=[['Bronze','🥉',0],['Silver','🥈',100],['Gold','🥇',250],['Platinum','💠',450],['Diamond','💎',700],['Champion','👑',1000]];
const tierOf=rp=>TIERS.filter(t=>rp>=t[2]).pop();
const rkSide=(b,s)=>b.u.map((x,i)=>i).filter(i=>b.u[i].side==s);
const rkAlive=(b,s)=>rkSide(b,s).filter(i=>b.u[i].hp>0);
function rkSend(m,s,i){const b=m.b,u=b.u[i];b.act[s]=i;u.off=false;u.seen=1;u.dg=0;E(b,`${m.names[s]} sends out ${u.name}!`,i,[i],0,'o')}
function rkRevive(b){b.u.forEach((x,k)=>{if(x.hp<=0&&x.pas=='revive'&&!x.used&&!x.off){x.used=1;x.hp=Math.ceil(x.max*.5);x.stun=0;x.burn=0;E(b,`🔥 ${x.name} rises from the ashes!`,k,[k],0,'h')}})}
function rkAuto(m,s){const u=m.b.u[m.b.act[s]],ok=u.mv.map((x,i)=>i).filter(i=>i>0&&!(u.cds[i]>0));return{mi:ok.length&&Math.random()<.6?ok[Math.floor(Math.random()*ok.length)]:0,dodge:false}}
async function mkRank(k0,k1){const us=await Promise.all([k0,k1].map(x=>db.get(x))),team=us.map(u=>{tick(u.data);return u.data.team.map(id=>u.data.sheep.find(x=>x.id==id)).filter(Boolean)});
 const b={u:[...team[0].map(x=>unit(x,0)),...team[1].map(x=>unit(x,1))],q:[],cur:null,done:false,ev:[],log:[],pvp:true,rk:true,round:0,act:[-1,-1]};b.u.forEach(x=>x.off=true);
 b.field=Math.random()<.7?Math.floor(Math.random()*7):null;applyAura(b);if(b.field!=null)E(b,'🌍 '+G.FIELDS[b.field]+': '+G.EL[b.field]+' sheep hit 20% harder this battle!',null,[],0,'x');
 const m={b,keys:[k0,k1],names:us.map(u=>u.data.name),rp:us.map(u=>u.data.rk|0),team:team.map(t=>t.map(x=>x.id)),seen:[Date.now(),Date.now()],t:Date.now(),phase:'lead',lead:[null,null],need:[false,false],sel:[null,null],pt:Date.now(),rt:Date.now()};
 flush(b);const id=Math.random().toString(36).slice(2);RM.set(id,m);RU.set(k0,id);RU.set(k1,id);return m}
// one round: both sides have chosen. Dodge goes first, then the faster sheep. A sheep that faints before acting loses its move.
function rkResolve(m){const b=m.b,idx=[b.act[0],b.act[1]],sel=m.sel;b.round++;m.rt=Date.now();idx.forEach(i=>{b.u[i].dg=0});
 const pri=s=>sel[s].dodge?1:0,order=[0,1].sort((x,y)=>pri(y)-pri(x)||b.u[idx[y]].spd-b.u[idx[x]].spd||Math.random()-.5);
 for(const s of order){const i=idx[s],u=b.u[i],oi=idx[1-s],o=b.u[oi];if(u.hp<=0||o.hp<=0)continue;
  if(u.burn>0){const dm=Math.max(1,Math.ceil(u.max*.06));u.burn--;u.hp=Math.max(0,u.hp-dm);E(b,`${u.name} burns for ${dm}!`,null,[i],dm,'d');if(u.hp<=0){rkRevive(b);continue}}
  if(u.pas=='regen'&&u.hp<u.max){const h=Math.ceil(u.max*.06);u.hp=Math.min(u.max,u.hp+h);E(b,`${u.name} regenerates ${h} HP`,i,[i],h,'h')}
  if(u.stun){u.stun=0;u.imm=1;E(b,`${u.name} is too dizzy to move!`,i,[],0,'x');continue}else u.imm=0;
  const was=o.hp>0;if(sel[s].dodge)exec(b,i,-1,0);else exec(b,i,sel[s].mi,oi);
  if(was&&o.hp<=0)E(b,`💥 ${o.name} fainted!`,null,[],0,'x');rkRevive(b)}
 if(b.round>15){const f=.05*(b.round-15);idx.forEach(i=>{const u=b.u[i];if(u.hp>0)u.hp=Math.max(0,u.hp-Math.ceil(u.max*f))});E(b,'⛈ A storm rolls in and soaks both sheep!',null,idx,0,'d');rkRevive(b)}
 idx.forEach(i=>{const u=b.u[i];if(u.hp>0)for(let k=0;k<10;k++)if(u.cds[k]>0)u.cds[k]--});
 m.sel=[null,null];const al=[rkAlive(b,0).length,rkAlive(b,1).length];
 if(!al[0]||!al[1])return al[0]?0:al[1]?1:(Math.random()<.5?0:1);
 m.need=[0,1].map(s=>b.u[b.act[s]].hp<=0);m.phase=m.need[0]||m.need[1]?'switch':'choose';m.pt=Date.now();return null}
async function finishRank(m){const b=m.b;if(b.paid)return;b.paid=1;b.reward=[null,null];
 for(const s of[0,1]){const u=await db.get(m.keys[s]);if(!u)continue;const d=u.data,win=(b.win?0:1)==s,me=m.rp[s],op=m.rp[1-s],ex=1/(1+Math.pow(10,(op-me)/200));
  let dr=win?Math.round(16+16*(1-ex)):-Math.round((8+10*ex)*(me<50?.5:1));if(m.forfeit===s)dr=-Math.round((12+6*ex)*(me<50?.5:1));
  const before=d.rk|0,after=Math.max(0,before+dr);d.rk=after;d.rkw=(d.rkw|0)+(win?1:0);d.rkl=(d.rkl|0)+(win?0:1);d.rkbest=Math.max(d.rkbest|0,after);
  const c=win?80:20;d.coins+=c;addXp(d,win?18:6);if(win)prog(d,'win');m.team[s].forEach(id=>{const sh=d.sheep.find(x=>x.id==id);if(sh){gain(sh,win?1:.5);bond(d,sh,win?2:1)}});
  const t0=tierOf(before),t1=tierOf(after);b.reward[s]={coins:c,rp:after-before,rpNow:after,tier:t1[0]+' '+t1[1],tierUp:t1[2]>t0[2]};checkAch(d);await db.put(m.keys[s],u)}}
const rview=(m,side,since)=>{const b=m.b,o=1-side;return{state:'rank',me:side,oname:m.names[o],orp:m.rp[o],rp:m.rp[side],phase:m.phase,act:b.act,need:m.need,lead:m.lead.map(x=>x!=null),sel:m.sel.map(x=>!!x),
 u:b.u.map(x=>x.side==side||x.seen?vu({u:[x]})[0]:{hidden:1,side:x.side,hp:x.hp,max:x.max,off:true,name:'???',role:0,el:0,g:null,cds:[],sh:0,stun:0,burn:0,bd:0,spd:0,dg:0,fc:0}),
 field:b.field,round:b.round,done:b.done,win:b.done?(b.win?0:1)==side:undefined,reward:b.reward&&b.reward[side],forfeit:m.forfeit,ev:b.log.slice(since),n:b.log.length}};
async function rkStep(m,now){const b=m.b;if(b.done)return;
 for(const s of[0,1])if(now-m.seen[s]>25000){m.forfeit=s;b.done=true;b.win=s==1;m.phase='done';b.cur=null;return finishRank(m)}
 if(m.phase=='lead'){for(const s of[0,1])if(m.lead[s]==null&&now-m.pt>25000)m.lead[s]=rkAlive(b,s)[0];
  if(m.lead[0]!=null&&m.lead[1]!=null){[0,1].sort(()=>Math.random()-.5).forEach(s=>rkSend(m,s,m.lead[s]));m.phase='choose';m.rt=now}}
 else if(m.phase=='switch'){for(const s of[0,1])if(m.need[s]&&now-m.pt>25000){rkSend(m,s,rkAlive(b,s)[0]);m.need[s]=false}if(!m.need[0]&&!m.need[1]){m.phase='choose';m.rt=now}}
 else if(m.phase=='choose'){for(const s of[0,1])if(!m.sel[s]&&now-m.rt>40000)m.sel[s]=rkAuto(m,s);
  if(m.sel[0]&&m.sel[1]){const w=rkResolve(m);if(w!=null){b.done=true;b.win=w==0;m.phase='done';b.cur=null}}}
 flush(b);if(b.done)await finishRank(m)}
app.post('/api/rank/:a',auth,H(async(q,s)=>{const k=q.n,a=q.params.a,now=Date.now(),since=q.body.since|0,d=q.u.data;
 const stale=()=>{for(const[x,e]of RQ)if(now-e.seen>10000)RQ.delete(x)};let m=RM.get(RU.get(k));
 if(a=='info'){stale();const top=(await db.all()).map(x=>x.data).filter(x=>(x.rk|0)>0||x.rkw||x.rkl).map(x=>({name:x.name,rp:x.rk|0,w:x.rkw|0,l:x.rkl|0})).sort((x,y)=>y.rp-x.rp).slice(0,15);
  return s.json({rp:d.rk|0,w:d.rkw|0,l:d.rkl|0,best:d.rkbest|0,top,queue:[...RQ].filter(([x])=>x!=k).map(([x,e])=>({k:x,name:e.name,rp:e.rp})),inMatch:!!(m&&!m.b.done)})}
 if(a=='cancel'){RQ.delete(k);return s.json({})}
 if(a=='ack'){if(m&&m.b.done)RU.delete(k);return s.json({})}
 if(a=='forfeit'){if(m&&!m.b.done){m.forfeit=m.keys.indexOf(k);m.b.done=true;m.b.win=m.forfeit==1;m.phase='done';m.b.cur=null;await finishRank(m)}return s.json(m?rview(m,m.keys.indexOf(k),since):{})}
 if(!m||(m.b.done&&a=='queue')){if(a!='queue')return s.json({state:'none'});RU.delete(k);
  const mine=d.team.map(id=>d.sheep.find(x=>x.id==id&&!G.isEgg(x))).filter(Boolean);if(mine.length<3)return s.json({err:'Ranked needs a full team of 3 sheep. Set your team in the Flock tab.'});
  stale();const rp=d.rk|0,cur=RQ.get(k),since0=cur?cur.since:now,win=t=>100+(now-t)/1000*10;let o=null;const tg=q.body.target;
  if(tg){if(RQ.has(tg)&&tg!=k)o=tg;else return s.json({state:'gone'})}
  else{let best=1e9;for(const[x,e]of RQ){if(x==k)continue;const diff=Math.abs(e.rp-rp);if(diff<=Math.max(win(e.since),win(since0))&&diff<best){best=diff;o=x}}}
  if(o){RQ.delete(o);RQ.delete(k);m=await mkRank(o,k)}else{RQ.set(k,{seen:now,since:since0,name:d.name,rp});return s.json({state:'wait',waited:Math.round((now-since0)/1000),window:Math.round(win(since0))})}}
 const side=m.keys.indexOf(k),b=m.b;m.seen[side]=now;
 if(!b.done&&a=='pick'){const i=q.body.i|0,u=b.u[i];if(!u||u.side!=side||u.hp<=0)return s.json({err:'Pick a sheep that is still up'});
  if(m.phase=='lead'&&m.lead[side]==null)m.lead[side]=i;else if(m.phase=='switch'&&m.need[side]&&i!=b.act[side]){rkSend(m,side,i);m.need[side]=false}else return s.json({err:'Not now'})}
 else if(!b.done&&a=='act'){if(m.phase!='choose'||m.sel[side])return s.json({err:'Not now'});const u=b.u[b.act[side]],dg=!!q.body.dodge,mi=dg?-1:q.body.mi|0;if(!u||u.hp<=0)return s.json({err:'?'});
  if(mi<-1||mi>=u.mv.length||(mi>0&&u.cds[mi]>0))return s.json({err:'Move not ready'});m.sel[side]={mi:Math.max(0,mi),dodge:dg}}
 await rkStep(m,now);return s.json(rview(m,side,since))}));
// ---- herds (clans) & herd wars ----
function bumpWin(c,k){const day=Math.floor(Date.now()/864e5);if(c.dday!=day){c.dday=day;c.dw=0;c.dc=[]}c.bw=(c.bw|0)+1;c.dw=(c.dw|0)+1;c.mw=c.mw||{};c.mw[k]=(c.mw[k]|0)+1;calcR(c)}
// herd sheep only stay in the flock while you are in a herd that has finished their goal
function syncHerd(d,c){const R=c?(c.reached||[]):[];d.cb=c?G.herdLv(c.pts|0).bonus:0;d.hstash=d.hstash||[];const keep=[];
 for(const x of d.sheep){const sp=x.sp&&G.SPM[x.sp];if(sp&&sp.herd){const g=G.CLAN_GOALS.find(y=>y.sp==x.sp);if(g&&!R.includes(g.id)){d.hstash.push(x);continue}}keep.push(x)}d.sheep=keep;
 const st=[];for(const x of d.hstash){const g=G.CLAN_GOALS.find(y=>y.sp==x.sp);if(g&&R.includes(g.id)){if(!d.sheep.some(y=>y.sp==x.sp))d.sheep.push(x)}else if(!st.some(y=>y.sp==x.sp))st.push(x)}d.hstash=st}
async function syncHerdFor(d,k){if(!(d.clan||d.cb||(d.hstash&&d.hstash.length)||d.sheep.some(x=>x.sp&&G.SPM[x.sp].herd)))return;let c=d.clan?await db.cget(d.clan):null;if(c&&!c.members.includes(k))c=null;syncHerd(d,c)}
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
app.post('/api/clan/:a',auth,H(async(q,s)=>{const k=q.n,d=q.u.data,a=q.params.a,b=q.body,now=Date.now(),err=m=>s.json({err:m});let cl=null,dly=0,c=d.clan?await db.cget(d.clan):null;if(d.clan&&!c)d.clan=null;
 if(c&&!c.members.includes(k)){c=null;d.clan=null}if(c&&!c.mig){c.leader=pick(c.members);c.mig=1;await db.cput(c.key,c)}if(c&&!d.cjoin)d.cjoin=now;if(c&&c.dday!=Math.floor(now/864e5)){c.dday=Math.floor(now/864e5);c.dw=0;c.dc=[]}
 if(a=='list')return s.json({list:(await db.call()).map(x=>x.data).filter(x=>x.members.length<5).map(x=>({name:x.name,n:x.members.length,wins:x.wins|0,pts:x.pts|0,motto:x.motto||'',lv:G.herdLv(x.pts|0).lv}))});
 if(a=='create'){if(c)return err('You are already in a herd');if(G.farmLv(d.fxp).lv<6)return err('Reach farm level 6 to join a herd');const nm=String(b.name||'').trim();if(!/^[A-Za-z0-9_]{3,16}$/.test(nm))return err('Herd name: 3-16 letters/numbers/_');const key=CK(nm);if(key=='warq'||await db.cget(key))return err('That herd name is taken');c={key,name:nm,leader:k,mig:1,members:[k],pts:0,wins:0,bw:0,reached:[],warId:null,srch:0};d.clan=key;d.cjoin=now;await db.cput(key,c)}
 else if(a=='join'){if(c)return err('You are already in a herd');if(G.farmLv(d.fxp).lv<6)return err('Reach farm level 6 to join a herd');const x=await db.cget(CK(b.name));if(!x||!x.members)return err('No such herd');if(x.members.length>=5)return err('That herd is full (5 max)');x.members.push(k);c=x;d.clan=x.key;d.cjoin=now;await db.cput(x.key,x)}
 else if(a=='info'){}
 else if(!c)return err('Join a herd first');
 else if(a=='leave'){c.members=c.members.filter(m=>m!=k);d.clan=null;d.cgoal=[];d.cjoin=0;if(!c.members.length)await db.cdel(c.key);else{if(c.leader==k)c.leader=pick(c.members);await db.cput(c.key,c)}c=null}
 else if(a=='donate'){const n=Math.floor(+b.amt);if(!(n>0)||n>d.coins)return err('Not enough coins');d.coins-=n;c.pts=(c.pts|0)+n;c.don=c.don||{};c.don[k]=(c.don[k]|0)+n;calcR(c);await db.cput(c.key,c)}
 else if(a=='findwar'){if(c.leader!=k)return err('Only the herd leader can search for a war');if(c.warId)return err('Your herd is already at war');if(c.members.length<2)return err('You need at least 2 members');
  const wq=await db.cget('warq'),oc=wq&&wq.clan&&wq.clan!=c.key&&now-wq.t<WAR_MS?await db.cget(wq.clan):null;
  if(oc&&!oc.warId&&oc.members.length>=2){const id=Math.random().toString(36).slice(2,9);await db.cput('war:'+id,{id,a:oc.key,b:c.key,names:[oc.name,c.name],start:now,end:now+WAR_MS,score:[0,0],used:{},done:false});oc.warId=c.warId=id;oc.srch=c.srch=0;await db.cput(oc.key,oc);await db.cput(c.key,c);await db.cput('warq',{clan:null})}
  else{await db.cput('warq',{clan:c.key,t:now});c.srch=now;await db.cput(c.key,c)}}
 else if(a=='kick'){if(c.leader!=k)return err('Only the herd leader can kick members');const tk=CK(b.key);if(tk==k||!c.members.includes(tk))return err('Pick another member');c.members=c.members.filter(m=>m!=tk);const u=await db.get(tk);if(u){u.data.clan=null;u.data.cgoal=[];u.data.cjoin=0;await db.put(tk,u)}await db.cput(c.key,c)}
 else if(a=='claim'){const g=G.CLAN_GOALS.find(x=>x.id==b.id);if(!g)return err('Unknown goal');calcR(c);if(!c.reached.includes(g.id))return err('Your herd has not reached that goal yet');const sp=G.SPM[g.sp];if(d.sheep.some(y=>y.sp==g.sp)||(d.hstash||[]).some(y=>y.sp==g.sp))return err('You already have that sheep');
  if(!d.sheep.some(y=>!y.sp&&y.r>=sp.r))return err('You need a '+G.RAR[sp.r].n+' sheep of your own first');const left=g.hrs-(now-(d.cjoin||now))/36e5;if(left>0)return err('You must be in the herd for '+g.hrs+'h first ('+Math.ceil(left)+'h left)');
  d.sheep.push(G.mkSpecial(g.sp));cl=sp.name}
 else if(a=='say'){const m=String(b.text||'').trim().slice(0,140);if(!m)return err('Type a message first');c.chat=c.chat||[];c.chat.push({n:d.name,t:now,m});if(c.chat.length>30)c.chat=c.chat.slice(-30);await db.cput(c.key,c)}
 else if(a=='motto'){if(c.leader!=k)return err('Only the leader can set the motto');c.motto=String(b.text||'').trim().slice(0,40);await db.cput(c.key,c)}
 else if(a=='promote'){if(c.leader!=k)return err('Only the leader can hand over leadership');const tk=CK(b.key);if(tk==k||!c.members.includes(tk))return err('Pick another member');c.leader=tk;await db.cput(c.key,c)}
 else if(a=='claimdaily'){if((c.dw|0)<8)return err('Your herd needs 8 battle wins today');c.dc=c.dc||[];if(c.dc.includes(k))return err('You already claimed today\'s reward');c.dc.push(k);dly=Math.max(150,Math.round(G.rate(d)*240));d.coins+=dly;addXp(d,20);await db.cput(c.key,c)}
 else return err('Unknown action');
 let w=null;if(c&&c.warId){w=await db.cget('war:'+c.warId);if(w&&!w.done){await endWar(w,{k,d});c=await db.cget(c.key);w=w.done?null:w}else w=null}
 d.cgoal=c?c.reached||[]:[];syncHerd(d,c);const newSp=grantSp(d);await db.put(k,q.u);let out=null;
 if(c){const us=await Promise.all(c.members.map(m=>db.get(m)));let war=null;if(w){const i=w.a==c.key?0:1;war={opp:w.names[1-i],my:w.score[i],their:w.score[1-i],end:w.end,mine:w.used[k]!==undefined}}
  out={name:c.name,owner:c.leader==k,lv:G.herdLv(c.pts|0),motto:c.motto||'',chat:(c.chat||[]).slice(-20),dw:c.dw|0,dc:(c.dc||[]).includes(k),bw:c.bw|0,wins:c.wins|0,pts:c.pts|0,searching:!!(!c.warId&&c.srch&&now-c.srch<WAR_MS),war,members:us.map((u,i)=>({key:c.members[i],lead:c.members[i]==c.leader,name:u?u.data.name:'?',rating:u?u.data.rating:0,sheep:u?u.data.sheep.length:0,don:(c.don||{})[c.members[i]]|0,mw:(c.mw||{})[c.members[i]]|0,atk:w?w.used[c.members[i]]:undefined}))}}
 s.json({clan:out,newSp,claimed:cl,daily:dly||undefined,d:view(d)})}));
app.post('/api/act/:a',auth,H(async(q,s)=>{const f=A[q.params.a];if(!f)return s.sendStatus(404);const d=q.u.data;await syncHerdFor(d,q.n);tick(d);const l0=G.farmLv(d.fxp).lv;const r=await f(d,q.body,q)||{};
 if(r.err)return s.json({err:r.err,d:view(d)});checkAch(d);const newSp=grantSp(d);if(r.bt&&r.bt.reward&&newSp.length)r.bt.reward.sheep=newSp.join(', ');if(d.clan&&r.bt&&r.bt.done&&r.bt.win){const cc=await db.cget(d.clan);if(cc){bumpWin(cc,q.n);await db.cput(cc.key,cc)}}
 await db.put(q.n,q.u);const l1=G.farmLv(d.fxp).lv;s.json({...r,d:view(d),newSp,flv:l1>l0?l1:undefined})}));
app.get('/api/board',H(async(q,s)=>{s.json((await db.all()).map(x=>({name:x.data.name,rating:x.data.rating,wins:x.data.wins,sheep:x.data.sheep.length,best:x.data.best||0})).sort((a,b)=>b.rating-a.rating).slice(0,25))}));
app.get('/api/farm/:n',H(async(q,s)=>{const u=await db.get(q.params.n.toLowerCase());if(!u)return s.sendStatus(404);const d=u.data;s.json({name:d.name,rating:d.rating,sheep:d.sheep.slice().sort((a,b)=>b.r-a.r).slice(0,30)})}));
app.get('/api/health',(q,s)=>s.json({storage:MODE}));
initDb().then(()=>{if(MODE=='file'&&process.env.RENDER)console.warn('WARNING: no DATABASE_URL set - saves will be WIPED when this server sleeps or redeploys!');return app.listen(process.env.PORT||3000,()=>console.log('EGG & WOOL running ('+MODE+' storage)'))}).catch(e=>{console.error(e);process.exit(1)});
