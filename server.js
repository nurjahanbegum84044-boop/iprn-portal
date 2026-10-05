'use strict';
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||3000,DIR=process.env.DATA_DIR||path.join(__dirname,'data'),FILE=path.join(DIR,'db.json');
const AU=process.env.ADMIN_USER,AP=process.env.ADMIN_PASS;
if(!AU||!AP){console.error('Set ADMIN_USER and ADMIN_PASS environment variables first.');process.exit(1)}
fs.mkdirSync(path.join(DIR,'img'),{recursive:true});
const DEF={users:[],tasks:[],subs:[],tx:[],wd:[],dep:[],chat:[],log:[],sessions:{},rev:0,nid:1,
 cats:['Social Media','YouTube','Website Visit','App Install','Survey'],
 set:{name:'TaskHub',cur:'₦',minWd:500,fee:10,pay:'Bank details: (set these in Admin → Settings)',maint:false}};
let DB=JSON.parse(JSON.stringify(DEF));
try{const d=JSON.parse(fs.readFileSync(FILE,'utf8'));DB=Object.assign(DB,d);DB.set=Object.assign({},DEF.set,d.set)}catch(e){}
let st=null;const save=()=>{if(st)return;st=setTimeout(()=>{st=null;fs.writeFile(FILE+'.tmp',JSON.stringify(DB),e=>{if(!e)fs.rename(FILE+'.tmp',FILE,()=>{})})},300)};
const now=()=>Date.now(),E=(m,s=400)=>{throw{s,m}};
const sha=s=>crypto.createHash('sha256').update(String(s)).digest();
const same=(a,b)=>crypto.timingSafeEqual(sha(a),sha(b));
const hash=s=>{const salt=crypto.randomBytes(16).toString('hex');return salt+':'+crypto.scryptSync(s,salt,32).toString('hex')};
const verify=(s,h)=>{const[salt,x]=h.split(':');return crypto.timingSafeEqual(Buffer.from(x,'hex'),crypto.scryptSync(s,salt,32))};
const int=(v,min,max,n='Number')=>{v=Math.floor(Number(v));if(!Number.isFinite(v)||v<min||v>max)E(n+' must be between '+min+' and '+max);return v};
const str=(v,min,max,n)=>{v=String(v==null?'':v).trim();if(v.length<min||v.length>max)E(n+' must be '+min+'-'+max+' characters');return v};
const log=m=>{DB.log.push({at:now(),m});if(DB.log.length>500)DB.log.splice(0,100)};
const tx=(u,n,a)=>DB.tx.push({id:DB.nid++,u,n,a,at:now()});
const hits={};const limit=(k,max,win)=>{const t=now();hits[k]=(hits[k]||[]).filter(x=>t-x<win);if(hits[k].length>=max)E('Too many attempts. Try again later.',429);hits[k].push(t)};
setInterval(()=>{const t=now();for(const k in hits)if(!hits[k].some(x=>t-x<3600000))delete hits[k];for(const k in DB.sessions)if(DB.sessions[k].exp<t)delete DB.sessions[k]},600000).unref();
const newKey=()=>[...Array(5)].map(()=>crypto.randomBytes(3).toString('hex').toUpperCase()).join('-');
const cookie=(res,req,v,age)=>res.setHeader('Set-Cookie',`sid=${v}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${req.headers['x-forwarded-proto']==='https'?'; Secure':''}`);
const session=(res,req,u,hrs)=>{const t=crypto.randomBytes(32).toString('hex');DB.sessions[t]={u,exp:now()+hrs*36e5};cookie(res,req,t,hrs*3600);save()};
const killSess=id=>{for(const k in DB.sessions)if(DB.sessions[k].u===id)delete DB.sessions[k]};
const ip=req=>String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0].trim();
const who=req=>{const m=(req.headers.cookie||'').match(/(?:^|;\s*)sid=([a-f0-9]{64})/);const s=m&&DB.sessions[m[1]];if(!s||s.exp<now())return{};
 if(s.u==='admin')return{adm:true,tok:m[1]};const u=DB.users.find(x=>x.id===s.u);if(!u||u.banned)return{};return{u,tok:m[1]}};
const left=t=>t.n-DB.subs.filter(s=>s.tid===t.id&&s.st!=='rejected').length;
const T=t=>({...t,left:left(t)});
const pubU=u=>({id:u.id,un:u.un,role:u.role,bal:u.bal,banned:u.banned,at:u.at});
const IMG=/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+\/=]+)$/;
function saveImg(d){if(!d)return null;const m=IMG.exec(String(d));if(!m)E('Only png, jpg, webp or gif images');const b=Buffer.from(m[2],'base64');if(b.length>1.5e6)E('Image too large (max 1.5MB)');
 const k=crypto.randomBytes(12).toString('hex')+'.'+(m[1]==='jpeg'?'jpg':m[1]);fs.writeFileSync(path.join(DIR,'img',k),b);return k}
function state(a){const o={set:{...DB.set,pay:DB.set.pay},cats:DB.cats,chat:DB.chat.slice(-150),me:null,tasks:[],subs:[],tx:[],wd:[],dep:[]};
 if(a.adm){o.me={admin:true};o.users=DB.users.map(pubU);o.tasks=DB.tasks.map(T);o.subs=DB.subs;o.wd=DB.wd;o.dep=DB.dep;o.tx=DB.tx.slice(-300);o.log=DB.log.slice(-80).reverse();
  o.stats={workers:DB.users.filter(u=>u.role==='worker').length,advertisers:DB.users.filter(u=>u.role==='advertiser').length,wbal:DB.users.filter(u=>u.role==='worker').reduce((s,u)=>s+u.bal,0),abal:DB.users.filter(u=>u.role==='advertiser').reduce((s,u)=>s+u.bal,0),rev:DB.rev,tasks:DB.tasks.length,pendS:DB.subs.filter(s=>s.st==='pending').length,pendW:DB.wd.filter(w=>w.st==='pending').length,pendD:DB.dep.filter(w=>w.st==='pending').length};return o}
 const u=a.u;if(!u)return o;o.me={id:u.id,un:u.un,role:u.role,bal:u.bal};o.tx=DB.tx.filter(x=>x.u===u.id).slice(-100).reverse();
 if(u.role==='worker'){o.tasks=DB.tasks.filter(t=>t.st==='active'&&(left(t)>0||DB.subs.some(s=>s.tid===t.id&&s.uid===u.id))).map(T);o.subs=DB.subs.filter(s=>s.uid===u.id);o.wd=DB.wd.filter(w=>w.u===u.id)}
 else{const mine=DB.tasks.filter(t=>t.uid===u.id);o.tasks=mine.map(T);o.subs=DB.subs.filter(s=>mine.some(t=>t.id===s.tid));o.dep=DB.dep.filter(d=>d.u===u.id)}
 return o}
const need=a=>{if(!a.u)E('Please log in',401);return a.u};const needA=a=>{if(!a.adm)E('Not allowed',403)};
const R={};
R['GET /api/state']=(b,a)=>state(a);
R['GET /api/chat']=()=>({chat:DB.chat.slice(-150)});
R['POST /api/signup']=(b,a,req,res)=>{if(DB.set.maint)E('Signups are paused',503);limit('su'+ip(req),10,36e5);
 const un=str(b.username,3,20,'Username').toLowerCase();if(!/^[a-z0-9_]+$/.test(un))E('Username: letters, numbers and _ only');
 if(un===String(AU).toLowerCase()||DB.users.some(x=>x.un===un))E('Username already taken');
 const pw=str(b.password,8,100,'Password'),key=newKey();const u={id:DB.nid++,un,role:b.role==='advertiser'?'advertiser':'worker',ph:hash(pw),kh:hash(key),bal:0,banned:false,at:now()};
 DB.users.push(u);log('New '+u.role+': '+un);session(res,req,u.id,720);save();return{key}};
R['POST /api/login']=(b,a,req,res)=>{const un=String(b.username||'').toLowerCase();limit('li'+ip(req)+un,8,6e5);const u=DB.users.find(x=>x.un===un);
 if(!u||!verify(String(b.password||''),u.ph))E('Wrong username or password',401);if(u.banned)E('This account is banned',403);session(res,req,u.id,720);return{ok:1}};
R['POST /api/reset']=(b,a,req,res)=>{const un=String(b.username||'').toLowerCase();limit('rs'+ip(req)+un,6,6e5);const u=DB.users.find(x=>x.un===un);
 const k=String(b.key||'').trim().toUpperCase();if(!u||!verify(k,u.kh))E('Username or secret key is wrong',401);
 u.ph=hash(str(b.password,8,100,'New password'));killSess(u.id);log('Password reset: '+un);session(res,req,u.id,720);save();return{ok:1}};
R['POST /api/logout']=(b,a,req,res)=>{if(a.tok)delete DB.sessions[a.tok];cookie(res,req,'',0);save();return{ok:1}};
R['POST /api/admin/login']=(b,a,req,res)=>{limit('ad'+ip(req),6,6e5);if(!(same(b.u,AU)&(same(b.p,AP)?1:0)))E('Wrong admin login',401);session(res,req,'admin',12);log('Admin logged in');return{ok:1}};
const cat=n=>{n=str(n,2,30,'Category');if(!DB.cats.some(c=>c.toLowerCase()===n.toLowerCase()))DB.cats.push(n);return n};
R['POST /api/cat']=(b,a)=>{need(a);cat(b.name);save();return{ok:1}};
R['POST /api/task']=(b,a)=>{const u=need(a);if(u.role!=='advertiser')E('Only advertisers can post jobs',403);if(DB.set.maint)E('Site is in maintenance',503);
 const t={id:DB.nid++,uid:u.id,un:u.un,t:str(b.t,3,80,'Title'),d:str(b.d,0,800,'Description'),c:cat(b.c),r:int(b.r,1,1e7,'Reward'),n:int(b.n,1,1e5,'Workers'),link:'',st:'active',at:now()};
 const l=String(b.link||'').trim();if(l){if(!/^https?:\/\/\S{3,300}$/.test(l))E('Link must start with http:// or https://');t.link=l}
 if(u.bal<t.r*t.n)E('Add funds first. You need '+t.r*t.n+' in your balance for this job.');DB.tasks.unshift(t);log(u.un+' posted: '+t.t);save();return{ok:1}};
R['POST /api/submit']=(b,a)=>{const u=need(a);if(u.role!=='worker')E('Only workers can submit',403);const t=DB.tasks.find(x=>x.id===b.tid);if(!t||t.st!=='active')E('Job not available');
 if(DB.subs.some(s=>s.tid===t.id&&s.uid===u.id))E('You already submitted this job');if(left(t)<1)E('No spots left');
 const text=str(b.text,0,5000,'Proof');const img=saveImg(b.img);if(!text&&!img)E('Add text or a screenshot as proof');
 DB.subs.push({id:DB.nid++,tid:t.id,tt:t.t,r:t.r,uid:u.id,un:u.un,adv:t.uid,text,img,fn:String(b.fn||'').slice(0,80),st:'pending',at:now()});save();return{ok:1}};
function decide(s,ok,why){if(s.st!=='pending')E('Already decided');const adv=DB.users.find(x=>x.id===s.adv),w=DB.users.find(x=>x.id===s.uid);
 if(ok){if(!adv||adv.bal<s.r)E('Advertiser balance is too low');const fee=Math.floor(s.r*DB.set.fee/100);adv.bal-=s.r;w.bal+=s.r-fee;DB.rev+=fee;tx(adv.id,'Paid for: '+s.tt,-s.r);tx(w.id,'Reward: '+s.tt,s.r-fee);s.st='approved'}
 else{s.st='rejected';s.why=String(why||'').slice(0,200)}s.dt=now();log((ok?'Approved':'Rejected')+' submission #'+s.id);save()}
R['POST /api/decide']=(b,a)=>{const s=DB.subs.find(x=>x.id===b.id);if(!s)E('Not found',404);if(!a.adm&&!(a.u&&a.u.id===s.adv))E('Not allowed',403);decide(s,!!b.ok,b.why);return{ok:1}};
R['POST /api/withdraw']=(b,a)=>{const u=need(a);if(u.role!=='worker')E('Only workers can withdraw',403);const n=int(b.amount,DB.set.minWd,1e9,'Amount');if(n>u.bal)E('Insufficient balance');
 u.bal-=n;DB.wd.push({id:DB.nid++,u:u.id,un:u.un,a:n,m:str(b.method,2,30,'Method'),acc:str(b.account,3,120,'Account details'),st:'pending',at:now()});tx(u.id,'Withdrawal requested',-n);log(u.un+' requested withdrawal '+n);save();return{ok:1}};
R['POST /api/deposit']=(b,a)=>{const u=need(a);if(u.role!=='advertiser')E('Only advertisers can add funds',403);DB.dep.push({id:DB.nid++,u:u.id,un:u.un,a:int(b.amount,1,1e9,'Amount'),ref:str(b.ref,3,100,'Payment reference'),st:'pending',at:now()});log(u.un+' requested deposit');save();return{ok:1}};
R['POST /api/chat']=(b,a)=>{if(!a.u&&!a.adm)E('Please log in',401);limit('ch'+(a.adm?'adm':a.u.id),20,6e4);const t=str(b.t,0,500,'Message'),img=saveImg(b.img);if(!t&&!img)E('Empty message');
 DB.chat.push({id:DB.nid++,u:a.adm?'Admin':a.u.un,adm:!!a.adm,t,img,r:{},at:now()});if(DB.chat.length>1000)DB.chat.splice(0,200);save();return{chat:DB.chat.slice(-150)}};
R['POST /api/react']=(b,a)=>{if(!a.u&&!a.adm)E('Please log in',401);const m=DB.chat.find(x=>x.id===b.id);if(!m||!['👍','❤️','😂','🔥'].includes(b.e))E('Invalid');m.r[a.adm?'Admin':a.u.un]=b.e;save();return{chat:DB.chat.slice(-150)}};
R['POST /api/admin/user']=(b,a)=>{needA(a);const u=DB.users.find(x=>x.id===b.id);if(!u)E('User not found',404);
 if(b.action==='ban'){u.banned=true;killSess(u.id)}else if(b.action==='unban')u.banned=false;
 else if(b.action==='delta'||b.action==='bal'){const n=Math.floor(Number(b.amount));if(!Number.isFinite(n))E('Invalid amount');const nb=b.action==='bal'?n:u.bal+n;if(nb<0)E('Balance cannot be negative');tx(u.id,'Admin adjustment',nb-u.bal);u.bal=nb}
 else E('Unknown action');log('Admin: '+b.action+' '+u.un);save();return{ok:1}};
R['POST /api/admin/wd']=(b,a)=>{needA(a);const w=DB.wd.find(x=>x.id===b.id);if(!w||w.st!=='pending')E('Not pending');const u=DB.users.find(x=>x.id===w.u);
 if(b.ok)w.st='paid';else{w.st='rejected';if(u){u.bal+=w.a;tx(u.id,'Withdrawal rejected (refund)',w.a)}}w.dt=now();log('Withdrawal '+w.st+' #'+w.id);save();return{ok:1}};
R['POST /api/admin/dep']=(b,a)=>{needA(a);const d=DB.dep.find(x=>x.id===b.id);if(!d||d.st!=='pending')E('Not pending');const u=DB.users.find(x=>x.id===d.u);
 if(b.ok&&u){u.bal+=d.a;tx(u.id,'Deposit approved',d.a);d.st='credited'}else d.st='rejected';d.dt=now();log('Deposit '+d.st+' #'+d.id);save();return{ok:1}};
R['POST /api/admin/task']=(b,a)=>{needA(a);const t=DB.tasks.find(x=>x.id===b.id);if(!t)E('Not found',404);
 if(b.action==='delete')DB.tasks=DB.tasks.filter(x=>x!==t);else t.st=b.action==='pause'?'paused':'active';log('Task '+b.action+' #'+t.id);save();return{ok:1}};
R['POST /api/admin/cat']=(b,a)=>{needA(a);if(b.action==='del')DB.cats=DB.cats.filter(c=>c!==b.name);else cat(b.name);save();return{ok:1}};
R['POST /api/admin/chatdel']=(b,a)=>{needA(a);DB.chat=DB.chat.filter(m=>m.id!==b.id);save();return{ok:1}};
R['POST /api/admin/settings']=(b,a)=>{needA(a);DB.set={name:str(b.name,2,30,'Name'),cur:str(b.cur,1,4,'Currency'),minWd:int(b.minWd,1,1e9,'Minimum withdrawal'),fee:int(b.fee,0,90,'Fee %'),pay:str(b.pay,0,500,'Payment info'),maint:!!b.maint};log('Settings changed');save();return{ok:1}};
const MT={png:'image/png',jpg:'image/jpeg',webp:'image/webp',gif:'image/gif'};
const HTML=fs.readFileSync(path.join(__dirname,'public','index.html'));
http.createServer((req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
 res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'");
 const url=new URL(req.url,'http://x'),a=who(req),send=(s,o,h)=>{res.writeHead(s,h||{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(typeof o==='string'||Buffer.isBuffer(o)?o:JSON.stringify(o))};
 if(req.method==='GET'&&url.pathname==='/')return send(200,HTML,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});
 if(req.method==='GET'&&url.pathname==='/api/img'){const k=url.searchParams.get('k')||'';if(!/^[a-f0-9]{24}\.(png|jpg|webp|gif)$/.test(k)||(!a.u&&!a.adm))return send(404,'');
  const s=DB.subs.find(x=>x.img===k);if(s&&!a.adm&&!(a.u&&(a.u.id===s.uid||a.u.id===s.adv)))return send(403,'');
  return fs.readFile(path.join(DIR,'img',k),(e,d)=>e?send(404,''):send(200,d,{'Content-Type':MT[k.split('.')[1]],'Cache-Control':'private, max-age=86400'}))}
 const h=R[req.method+' '+url.pathname];if(!h)return send(404,{error:'Not found'});
 const run=b=>{try{if(DB.set.maint&&!a.adm&&req.method==='POST'&&!/login|logout|reset/.test(url.pathname))E('Site is in maintenance',503);send(200,h(b,a,req,res)||{ok:1})}catch(e){if(e&&e.s)send(e.s,{error:e.m});else{console.error(e);send(500,{error:'Server error'})}}};
 if(req.method==='GET')return run({});
 if(!/application\/json/.test(req.headers['content-type']||''))return send(415,{error:'Bad request'});
 let n=0;const ch=[];req.on('data',c=>{n+=c.length;if(n>2.6e6){req.destroy()}else ch.push(c)});
 req.on('end',()=>{let b;try{b=JSON.parse(Buffer.concat(ch).toString()||'{}')}catch(e){return send(400,{error:'Bad JSON'})}run(b||{})});
}).listen(PORT,()=>console.log('TaskHub running on port '+PORT));
