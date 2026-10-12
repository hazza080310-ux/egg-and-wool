(function(g){
const RAR=[{n:'Common',c:'#8a9a9a',w:60,m:1,r:.2,v:10},{n:'Uncommon',c:'#3fae4a',w:25,m:1.1,r:.5,v:40},{n:'Rare',c:'#3d7bff',w:10,m:1.22,r:1.2,v:150},{n:'Epic',c:'#a649ff',w:3.8,m:1.36,r:3,v:600},{n:'Legendary',c:'#ffb400',w:1.1,m:1.5,r:8,v:3000},{n:'Mythic',c:'#ff4fa3',w:.12,m:1.7,r:24,v:20000}];
const EGG=[{n:'Plain Egg',cost:40,b:[1,1,1,1,1,1]},{n:'Speckled Egg',cost:250,b:[.3,1.5,2.5,3,3,3]},{n:'Golden Egg',cost:1800,b:[0,.4,2,6,10,15]},{n:'Cosmic Egg',cost:15000,b:[0,0,.5,4,25,40]}];
const TR=[{id:'fluffy',n:'Extra Fluffy',d:'+50% wool'},{id:'mentor',n:'Mentor',d:'+4% wool for the whole flock'},{id:'golden',n:'Golden Hooves',d:'+3% coins from sales'},{id:'sturdy',n:'Sturdy',d:'+25% HP'},{id:'sparky',n:'Sparky',d:'+20% attack'},{id:'speedy',n:'Zoomy',d:'+30% speed'},{id:'lucky',n:'Lucky',d:'20% crit chance'},{id:'dozy',n:'Dozy',d:'-30% wool, +30% defence'},{id:'chonky',n:'Chonky',d:'+40% HP, slower'}];
const ROLES=[{n:'Bruiser',s:[90,22,8,10],mv:[['Headbutt','dmg',1,0],['Stampede','all',.6,3]]},{n:'Tank',s:[130,14,20,6],mv:[['Bash','dmg',.8,0],['Fluff Wall','shield',.3,3]]},{n:'Healer',s:[90,14,10,12],mv:[['Nibble','dmg',.7,0],['Warm Hug','heal',1.8,2]]},{n:'Trickster',s:[80,18,8,16],mv:[['Sneaky Kick','dmg',.9,0],['Dizzy Dance','stun',.5,3]]}];
const EL=['Fluff','Mud','Spark','Cosmic'],ELC=['#f58bbd','#a9743f','#e8c400','#7a5cff'];
const EX=[['horns',0],['bell',0],['flower',1],['glasses',1],['hat',1],['halo',2],['wings',2],['eye',2],['flame',3],['orb',3],['stars',3],['crown',4],['tentacles',4],['galaxy',5]];
const B=[['barn','Barn','Stores more wool',100],['shed','Shearing Shed','+25% wool speed',150],['pasture','Pasture','+3 sheep slots',120],['market','Market Stall','+10% sell price',200],['auto','Auto-Seller','Sells overflowing wool for you',500]];
const ACH=[['h10','Egg Enthusiast (hatch 10)',d=>d.hatched>=10,200],['h100','Egg Tycoon (hatch 100)',d=>d.hatched>=100,2500],['rare','Rare Find',d=>(d.best||0)>=2,300],['leg','Legendary Find',d=>(d.best||0)>=4,4000],['w1','First Victory',d=>d.wins>=1,100],['w20','Battle Hardened (20 wins)',d=>d.wins>=20,2000],['f20','Big Flock (20 sheep)',d=>d.sheep.length>=20,600]];
const P=['Wob','Nib','Bram','Mur','Flo','Tuf','Gor','Pip','Zan','Quo','Dag','Lum','Fen','Ozzy'],S=['bles','ington','ula','ox','ette','mo','kin','zilla','by','ton','nard'],TT=['','','the Brave','the Bizarre','the Magnificent','the Impossible'];
const pk=(a,r)=>a[Math.floor(r()*a.length)];
function roll(e,rnd){rnd=rnd||Math.random;const w=RAR.map((x,i)=>x.w*EGG[e].b[i]);let x=rnd()*w.reduce((a,b)=>a+b),r=0;for(;r<5;r++){if(x<w[r])break;x-=w[r]}
const h=1+(r>=2&&rnd()<.15*(r-1)?1:0)+(r>=4&&rnd()<.3?1:0);const pool=EX.filter(x=>x[1]<=r).map(x=>x[0]);const n=Math.min(pool.length,r?r:(rnd()<.3?1:0));const ex=[];while(ex.length<n){const k=pk(pool,rnd);if(!ex.includes(k))ex.push(k)}
return{id:Math.random().toString(36).slice(2,9),r,heads:h,ex,wool:Math.floor(rnd()*6),face:Math.floor(rnd()*4),hue:Math.floor(rnd()*360),el:Math.floor(rnd()*4),role:Math.floor(rnd()*4),trait:pk(TR,rnd).id,name:pk(P,rnd)+pk(S,rnd)+(TT[r]?' '+TT[r]:''),lv:1,xp:0}}
function stats(s){const m=RAR[s.r].m*(1+.05*(s.lv-1));let[hp,atk,def,spd]=ROLES[s.role].s.map(x=>x*m);const t=s.trait;if(t=='sturdy')hp*=1.25;if(t=='sparky')atk*=1.2;if(t=='speedy')spd*=1.3;if(t=='dozy')def*=1.3;if(t=='chonky'){hp*=1.4;spd*=.8}return{hp:Math.round(hp),atk:Math.round(atk),def:Math.round(def),spd:Math.round(spd)}}
const sheepRate=s=>RAR[s.r].r*(s.trait=='fluffy'?1.5:s.trait=='dozy'?.7:1);
function rate(d){let a=0;for(const s of d.sheep)if(s.trait=='mentor')a+=.04;let r=0;for(const s of d.sheep)r+=sheepRate(s);return r*(1+Math.min(a,1))*(1+.25*d.b.shed)}
const cap=d=>Math.floor(250*Math.pow(1.8,d.b.barn)),slots=d=>6+3*d.b.pasture,bcost=(b,l)=>Math.round(b[3]*Math.pow(1.9,l));
function price(d){let g=0;for(const s of d.sheep)if(s.trait=='golden')g+=.03;return(1+.1*d.b.market)*(1+g)}
const G={RAR,EGG,TR,ROLES,EL,ELC,EX,B,ACH,roll,stats,sheepRate,rate,cap,slots,bcost,price};
if(typeof module!='undefined')module.exports=G;else g.G=G})(this);
