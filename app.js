import {initializeApp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {getAuth,signInWithEmailAndPassword,onAuthStateChanged,signOut} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {getFirestore,doc,getDoc,setDoc,addDoc,collection,getDocs,query,where,serverTimestamp as ts,updateDoc,deleteDoc,writeBatch} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {firebaseConfig,uploadServiceUrl} from "./firebase-config.js";
const $=id=>document.getElementById(id),app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const cash=n=>new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(Number(n)||0);
const ROLES={super_admin:"Súper administrador",recruiter:"Coordinadora",reseller:"Revendedora"};
const PAGES={home:["Resumen","⌂"],requests:["Altas","✚","Solicitudes de alta"],clients:["Clientes","👥"],transactions:["Pagos","💳","Pagos de clientes"],settlements:["Liquidación","🧾","Liquidaciones"],team:["Equipo","🤝","Equipo y roles"],reassign:["Reasignar","⇄","Reasignar cartera"],accounting:["Contable","📊","Contabilidad"],messages:["Mensajes","✉"],gallery:["Material","🖼","Galería de materiales"],help:["Ayuda","❔","Ayuda y contacto"]};
const NAV={super_admin:["home","requests","clients","transactions","settlements","team","reassign","accounting","messages","gallery","help"],recruiter:["home","clients","transactions","settlements","team","messages","gallery","help"],reseller:["home","clients","transactions","settlements","messages","gallery","help"]};
const DEF={publicPrice:12000,supplierCost:800,newReseller:5500,newRecruiter:1500,renewReseller:1000,renewRecruiter:2000};
let me,S=DEF,clients=[],team=[],tx=[],sets=[],reqs=[],msgs=[],gal=[],contact={},page="home",F={q:"",s:""};
const isA=()=>me.role==="super_admin",isR=()=>me.role==="recruiter";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const wa=p=>{let n=String(p||"").replace(/\D/g,"");if(n.startsWith("0"))n=n.slice(1);if(n&&!n.startsWith("54"))n="54"+n;return n?`https://wa.me/${n}`:""};
const by=(a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0);
const fdate=t=>t?.toDate?t.toDate().toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit"}):"—";
const today=()=>new Date().toISOString().slice(0,10);
const sum=(a,k)=>a.reduce((s,x)=>s+(+x[k]||0),0);
const nm=uid=>{const u=team.find(x=>x.uid===uid);return u?u.displayName||u.email:uid?uid.slice(0,6)+"…":"—"};
const dleft=c=>c.expiresAt?Math.round((new Date(c.expiresAt+"T00:00:00")-new Date().setHours(0,0,0,0))/864e5):null;
const soon=c=>c.status!=="inactive"&&dleft(c)!==null&&dleft(c)<=7;
const pill=(t,c="")=>`<span class="pill ${c}">${t}</span>`;
const toast=(t,bad)=>{const n=$("notice");n.textContent=t;n.className="notice"+(bad?" bad":"");clearTimeout(toast.t);toast.t=setTimeout(()=>n.classList.add("hidden"),4500)};
const run=async fn=>{try{$("busy").classList.remove("hidden");const r=await fn();if(typeof r==="string")toast(r)}catch(e){console.error(e);toast(e.message||String(e),1)}finally{$("busy").classList.add("hidden")}};
const stat=(k,v,s,g)=>`<div class="stat"${g?` data-go="${g}"`:""}><div class="k">${k}</div><div class="v">${v}</div><div class="sub">${s||""}</div></div>`;
const table=(h,rows,empty="Sin datos todavía.")=>rows.length?`<div class="tbl"><table><thead><tr>${h.map(x=>`<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((c,i)=>`<td data-l="${h[i]}">${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`:`<div class="empty">${empty}</div>`;
const fld=(n,l,o={})=>{const v=o.v??"",a=`name="${n}"${o.req?" required":""}${o.ph?` placeholder="${esc(o.ph)}"`:""}`;let i;
 if(o.opts)i=`<select ${a}>${o.opts.map(([k,t])=>`<option value="${esc(k)}"${k==v?" selected":""}>${esc(t)}</option>`).join("")}</select>`;
 else if(o.type==="textarea")i=`<textarea ${a}>${esc(v)}</textarea>`;
 else i=`<input ${a} type="${o.type||"text"}" value="${esc(v)}"${o.min!=null?` min="${o.min}"`:""}${o.accept?` accept="${o.accept}"`:""}>`;
 return `<label${o.wide||o.type==="textarea"?' class="wide"':""}>${l}${i}</label>`};
const roleChecks=(sel=["reseller","recruiter"])=>`<div class="wide chk">${Object.entries(ROLES).map(([k,t])=>`<label class="checkline"><input type="checkbox" name="roles" value="${k}"${sel.includes(k)?" checked":""}>${t}</label>`).join("")}</div>`;
let shT;
function sheet(html,cls=""){const s=$("sheet");clearTimeout(shT);$("shBox").className="sh-box "+cls;$("shBox").innerHTML=`<i class="grab"></i>${html}`;s.classList.remove("hidden");void s.offsetWidth;s.classList.add("open");document.body.classList.add("noscroll")}
function closeSheet(){const s=$("sheet");if(s.classList.contains("hidden"))return;if($("shBox").classList.contains("media-sheet")){mediaItem=null;mediaIndex=-1}s.classList.remove("open");document.body.classList.remove("noscroll");clearTimeout(shT);shT=setTimeout(()=>s.classList.add("hidden"),230)}
function sheetForm(title,inner,onsub,label="Guardar"){sheet(`<div class="sh-title">${title}<button class="x" data-a="close" type="button">✕</button></div><form>${inner}<button class="primary full lg">${label}</button></form>`);const f=$("shBox").querySelector("form");f.onsubmit=e=>{e.preventDefault();run(async()=>{const m=await onsub(new FormData(f));closeSheet();return m})};return f}
const openForm=(t,body,onsub,label)=>sheetForm(t,`<div class="form-grid">${body}</div>`,onsub,label);
const photoField=()=>`<label class="photo"><input type="file" name="proof" accept="image/*"><div class="pv"><span>📷</span>Tocá para sacar o elegir la foto</div></label>`;
const bindPhoto=f=>{const i=f.querySelector("[name=proof]"),p=f.querySelector(".pv");i.onchange=()=>{const x=i.files[0];if(x)p.innerHTML=`<img src="${URL.createObjectURL(x)}" alt=""><em>Tocá para cambiar</em>`}};
const shell=(h,fab)=>{$("content").innerHTML=h+(fab?`<button class="fab" data-a="${fab[0]}"><b>＋</b><span>${fab[1]}</span></button>`:"")};
const soft=l=>e=>{console.warn(l,e);toast(`No se pudo cargar: ${l}. Publicá las reglas de Firestore del zip.`,1);return{docs:[],exists:()=>false}};
const chips=(opts)=>`<div class="toolbar chips">${opts.map(([k,t])=>`<button class="chip${F.s===k?" on":""}" data-a="chip" data-id="${k}">${t}</button>`).join("")}</div>`;
const search=()=>`<input id="q" type="search" placeholder="Buscar…" value="${esc(F.q)}">`;

async function shrink(file){if(!file.type.startsWith("image/")||file.size<3e5)return file;try{const b=await createImageBitmap(file),k=Math.min(1,1600/Math.max(b.width,b.height)),c=document.createElement("canvas");c.width=Math.round(b.width*k);c.height=Math.round(b.height*k);c.getContext("2d").drawImage(b,0,0,c.width,c.height);const bl=await new Promise(r=>c.toBlob(r,"image/jpeg",.82));return bl&&bl.size<file.size?new File([bl],"proof.jpg",{type:"image/jpeg"}):file}catch{return file}}
async function upload(file){
 if(!file||!file.size)throw Error("Adjuntá el comprobante.");
 if(!file.type.startsWith("image/"))throw Error("El comprobante debe ser una imagen.");
 file=await shrink(file);if(file.size>8*1024*1024)throw Error("La imagen supera 8 MB.");
 const fd=new FormData();fd.append("image",file);fd.append("token",await auth.currentUser.getIdToken());
 const r=await fetch(uploadServiceUrl,{method:"POST",body:fd}),j=await r.json().catch(()=>({}));
 if(!r.ok||!j.url)throw Error(j.error||"No se pudo subir el comprobante.");return j.url}
const proof=u=>u?`<a href="${esc(u)}" target="_blank" rel="noopener"><img class="proof" loading="lazy" src="${esc(u)}" alt="Comprobante"></a>`:"—";

$("loginForm").onsubmit=e=>{e.preventDefault();$("loginError").textContent="";run(async()=>{try{await signInWithEmailAndPassword(auth,$("email").value.trim(),$("password").value)}catch{$("loginError").textContent="Correo o contraseña incorrectos."}})};
$("logoutBtn").onclick=()=>signOut(auth);
onAuthStateChanged(auth,u=>{if(!u){$("loginView").classList.remove("hidden");$("appView").classList.add("hidden");return}
 run(async()=>{const p=await getDoc(doc(db,"users",u.uid)),ok=p.exists()&&p.data().active===true;
  me=ok?{uid:u.uid,email:u.email,...p.data()}:{uid:u.uid,email:u.email,role:"none"};
  if(ok&&!ROLES[me.role])throw Error("Rol inválido.");
  $("loginView").classList.add("hidden");$("appView").classList.remove("hidden");$("appView").classList.toggle("solo",!ok);
  $("topUser").textContent=me.displayName||me.email;$("userSummary").innerHTML=ok?`<b>${esc(me.displayName||me.email)}</b><br>${ROLES[me.role]}`:"";$("roleLabel").textContent=ok?ROLES[me.role].toUpperCase():"ACCESO PENDIENTE";
  if(!ok)return accessPage();
  await load();go("home")})});

async function load(){
 const A=isA(),f=isR()?"recruiterId":"resellerId",none=Promise.resolve({docs:[]});
 const q=(n,...c)=>getDocs(c.length?query(collection(db,n),...c):collection(db,n));
 const sc=n=>A?q(n):q(n,where(f,"==",me.uid)),rc=n=>q(n);
 const [s,c,t,st,rq,u,m,g,ct]=await Promise.all([getDoc(doc(db,"config","accounting")),sc("clients"),sc("transactions"),sc("settlements"),A?q("accessRequests",where("status","==","pending")):none,A?q("users"):isR()?q("users",where("recruiterId","==",me.uid)):none,rc("contentMessages").catch(soft("mensajes")),rc("gallery").catch(soft("material")),getDoc(doc(db,"config","contact")).catch(soft("contacto"))]);
 const L=(x,k="id")=>x.docs.map(d=>({[k]:d.id,...d.data()})).sort(by);
 S={...DEF,...(s.exists()?s.data():{})};clients=L(c);tx=L(t);sets=L(st);reqs=L(rq);team=L(u,"uid");const vis=x=>A||(x.roles||[]).includes(me.role);msgs=L(m).filter(vis);gal=L(g).filter(vis);contact=ct.exists()?ct.data():{}}
const refresh=async()=>{await load();go(page,true)};

const MAIN={super_admin:["home","clients","transactions","requests"],recruiter:["home","clients","transactions","messages"],reseller:["home","clients","transactions","messages"]};
const badges=()=>({requests:reqs.length,transactions:isA()||isR()?tx.filter(x=>x.status==="pending").length:0,settlements:isA()?sets.filter(x=>x.status!=="confirmed").length:0});
function go(p,keep){page=p;if(!keep)F={q:"",s:""};
 const bd=badges(),b=(k,c)=>`<button class="${c}${k===p?" active":""}" data-go="${k}"><i>${PAGES[k][1]}</i><span>${PAGES[k][0]}</span>${bd[k]?`<b class="bd">${bd[k]}</b>`:""}</button>`,main=MAIN[me.role],mb=NAV[me.role].filter(k=>!main.includes(k)).reduce((a,k)=>a+(bd[k]||0),0);
 $("navigation").innerHTML=NAV[me.role].map(k=>b(k,"nav-btn")).join("");
 $("tabbar").innerHTML=main.map(k=>b(k,"tab")).join("")+`<button class="tab${main.includes(p)?"":" active"}" data-a="more"><i>☰</i><span>Más</span>${mb?`<b class="bd">${mb}</b>`:""}</button>`;
 $("pageTitle").textContent=PAGES[p][2]||PAGES[p][0];const c=$("content");PAGE[p]();c.classList.remove("in");void c.offsetWidth;c.classList.add("in");if(!keep)scrollTo(0,0)}
function moreSheet(){const rest=NAV[me.role].filter(k=>!MAIN[me.role].includes(k)),bd=badges();
 sheet(`<div class="sh-title">Menú<button class="x" data-a="close">✕</button></div><div class="actgrid">${rest.map(k=>`<button class="act" data-go="${k}"><i>${PAGES[k][1]}</i><span>${PAGES[k][2]||PAGES[k][0]}${bd[k]?` (${bd[k]})`:""}</span></button>`).join("")}</div><p class="help center">${esc(me.displayName||me.email)} · ${ROLES[me.role]}</p><button class="ghost full" data-a="logout">Cerrar sesión</button>`)}
const fshort=d=>d?d.slice(8,10)+"/"+d.slice(5,7):"";
const first=n=>String(n||"").trim().split(/[\s@]/)[0];
const avatar=(n,big)=>{n=String(n||"?").trim();let h=0;for(const c of n)h=(h*31+c.charCodeAt(0))%360;return `<span class="av${big?" lg":""}" style="--h:${h}">${esc(n.split(/\s+/).slice(0,2).map(w=>w[0]).join("").toUpperCase())}</span>`};
const expChip=c=>{if(c.status==="inactive")return pill("Inactivo","bad");const d=dleft(c);if(d===null)return c.status==="pending"?pill("Pendiente","pending"):pill("Sin fecha");return d<0?pill("Vencido "+-d+"d","bad"):d<=7?pill(d===0?"Vence hoy":"Vence en "+d+"d","pending"):pill("Al día · "+fshort(c.expiresAt),"ok")};
const crow=c=>`<button class="lrow" data-a="client" data-id="${c.id}">${avatar(c.fullName||c.name)}<div class="lmain"><b>${esc(c.fullName||c.name)}</b><small>${esc([c.city,c.plan].filter(Boolean).join(" · ")||c.phone||"")}</small></div><div class="lend">${expChip(c)}</div></button>`;
const renewUrl=c=>{const u=wa(c.phone);return u?`${u}?text=${encodeURIComponent(`Hola ${first(c.fullName||c.name)}, tu servicio ${dleft(c)<0?"venció":"vence"} el ${c.expiresAt}. ¿Querés renovarlo?`)}`:""};
const empty=(i,t)=>`<div class="empty"><i>${i}</i>${t}</div>`;
function home(){
 const ap=tx.filter(x=>x.status==="approved"),pend=tx.filter(x=>x.status==="pending"),A=isA(),R=isR();
 const exp=clients.filter(soon).sort((a,b)=>dleft(a)-dleft(b)),active=clients.filter(c=>c.status==="active").length;
 const mine=sum(ap,R?"recruiterCommission":"resellerCommission"),ps=sets.filter(x=>x.status!=="confirmed").length;
 const date=new Date(),dateLabel=date.toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"});
 const greeting=date.getHours()<12?"Buen día":date.getHours()<19?"Buenas tardes":"Buenas noches";
 const q=[A&&[reqs.length,"✚","Altas por revisar","requests"],[pend.length,"💳",A||R?"Pagos por verificar":"Pagos en revisión","transactions"],A&&[ps,"🧾","Liquidaciones por confirmar","settlements"]].filter(x=>x&&x[0]),qCount=q.reduce((n,x)=>n+x[0],0);
 const kpi=(icon,title,value,detail,target,tone)=>`<button class="stat dashboard-stat ${tone||""}" data-go="${target}"><span class="kpi-icon">${icon}</span><span class="stat-copy"><span class="k">${title}</span><span class="v">${value}</span><span class="sub">${detail}</span></span><span class="kpi-arrow" aria-hidden="true">↗</span></button>`;
 const recent=tx.slice().sort(by).slice(0,5);
 const action=isA()?`<button class="hero-action" data-go="requests"><span>✚</span><b>Revisar altas</b><i>›</i></button><button class="hero-action" data-go="transactions"><span>◷</span><b>Revisar pagos</b><i>›</i></button>`:
  R?`<button class="hero-action" data-go="transactions"><span>◷</span><b>Ver pagos del equipo</b><i>›</i></button><button class="hero-action" data-go="clients"><span>♙</span><b>Ir a clientes</b><i>›</i></button>`:
  `<button class="hero-action" data-a="newTx"><span>＋</span><b>Registrar un pago</b><i>›</i></button><button class="hero-action" data-go="clients"><span>♙</span><b>Ver mis clientes</b><i>›</i></button>`;
 shell(`<section class="dashboard-hero"><div class="hero-copy"><span class="hero-kicker"><i></i> ESPACIO DE TRABAJO</span><p class="hero-date">${esc(dateLabel)}</p><h2>${greeting}, ${esc(first(me.displayName||me.email))}</h2><p class="hero-subtitle">${A?"Este es el estado general de tu operación.":R?"Acá tenés un resumen de tu equipo y actividad.":"Tu actividad y próximos vencimientos, en un solo lugar."}</p><div class="hero-actions">${action}<button class="hero-action secondary" data-go="gallery"><span>▧</span><b>Material comercial</b><i>›</i></button></div></div><div class="hero-highlight"><span class="highlight-orb">✦</span><span class="highlight-label">${A?"Cobrado verificado":"Clientes activos"}</span><strong>${A?cash(sum(ap,"amount")):active}</strong><small>${A?`${ap.length} pagos aprobados`:`de ${clients.length} en cartera`}</small>${A?"":`<div class="highlight-rule"><i style="--progress:${clients.length?Math.min(100,active/clients.length*100):0}%"></i></div>`}<span class="highlight-foot">${A?"Acumulado registrado":"Estado actual de tu cartera"}</span></div></section>
 ${q.length?`<section class="attention-block"><div class="section-heading"><div><span class="section-kicker">PARA HOY</span><h2>Atención prioritaria</h2></div><span class="attention-count">${qCount} ${qCount===1?"pendiente":"pendientes"}</span></div><div class="queue">${q.map(x=>`<button class="qcard" data-go="${x[3]}"><span class="queue-icon">${x[1]}</span><span class="queue-copy"><b>${x[0]}</b><small>${x[2]}</small></span><i>›</i></button>`).join("")}</div></section>`:`<div class="all-clear"><span>✓</span><div><b>Todo al día</b><small>No hay tareas pendientes para revisar.</small></div></div>`}
 <section class="dashboard-section"><div class="section-heading"><div><span class="section-kicker">RESUMEN</span><h2>Tu actividad</h2></div><span class="section-note">${active} activos · ${clients.length} clientes</span></div><div class="grid dashboard-kpis">${kpi("♙","Clientes activos",active,`de ${clients.length} en tu cartera`,"clients","violet")}${kpi("⌁","Vencidos o por vencer",exp.length,"vencidos o con vencimiento ≤ 7 días","clients",exp.length?"amber":"cyan")}${kpi("◷","Pagos en revisión",pend.length,"pendientes de resolución","transactions","cyan")}${kpi(A?"▤":"✦",A?"Total cobrado":"Mis comisiones",A?cash(sum(ap,"amount")):cash(mine),`${ap.length} pagos aprobados`,A?"accounting":"transactions","green")}</div></section>
 <div class="dashboard-grid"><section class="panel dashboard-panel"><div class="panel-head"><div><span class="section-kicker">SEGUIMIENTO</span><h2>Vencidos o por vencer</h2></div><button class="text-action" data-go="clients">Ver clientes <span>↗</span></button></div><div class="list">${exp.slice(0,5).map(crow).join("")||empty("✓","No hay vencimientos próximos.")}</div></section><section class="panel dashboard-panel"><div class="panel-head"><div><span class="section-kicker">MOVIMIENTOS</span><h2>Actividad reciente</h2></div><button class="text-action" data-go="transactions">Ver pagos <span>↗</span></button></div><div class="list">${recent.map(txRow).join("")||empty("◷","Todavía no hay pagos registrados.")}</div></section></div>`);
}

function accessPage(){
 getDocs(query(collection(db,"accessRequests"),where("uid","==",me.uid))).then(r=>{
  if(r.docs.some(d=>d.data().status==="pending")){shell(`<section class="panel"><h2>Solicitud en revisión</h2><p class="help">El súper administrador debe aprobarla. Volvé a ingresar más tarde.</p></section>`);return}
  shell(`<section class="panel"><h2>Solicitar acceso</h2><form id="af"><div class="form-grid">${fld("name","Nombre y apellido",{req:1})}${fld("phone","WhatsApp",{req:1,type:"tel"})}${fld("requestedRole","Rol",{opts:[["reseller","Revendedora"],["recruiter","Coordinadora"]]})}${fld("recruiterId","UID de tu coordinadora (si sos revendedora)")}${fld("city","Localidad")}${fld("message","Mensaje",{type:"textarea"})}</div><div class="form-actions"><button class="primary">Enviar solicitud</button></div></form></section>`);
  $("af").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);run(async()=>{await addDoc(collection(db,"accessRequests"),{uid:me.uid,email:me.email,name:f.get("name"),phone:f.get("phone"),requestedRole:f.get("requestedRole"),recruiterId:f.get("recruiterId")||null,city:f.get("city"),message:f.get("message"),status:"pending",createdAt:ts()});accessPage();return "Solicitud enviada."})}}).catch(e=>toast(e.message,1))}

/* Clientes */
function clientsPage(){
 shell(`<div class="toolbar">${search()}</div>${chips([["","Todos"],["active","Activos"],["exp","Por vencer"],["pending","Pendientes"],["inactive","Inactivos"]])}<div id="list" class="list">${clientList()}</div>`,isR()?null:["newClient","Cliente"])}
function clientList(){
 const q=F.q.toLowerCase(),rows=clients.filter(c=>(c.fullName+" "+c.phone+" "+c.city+" "+c.email).toLowerCase().includes(q)&&(!F.s||(F.s==="exp"?soon(c):c.status===F.s)));
 return rows.map(crow).join("")||empty("👥",F.q||F.s?"Sin resultados.":"Todavía no hay clientes.")}
function clientSheet(id){
 const c=clients.find(x=>x.id===id);if(!c)return;const u=wa(c.phone),hist=tx.filter(t=>t.clientId===id).slice(0,4),rn=renewUrl(c);
 sheet(`<div class="cs-head">${avatar(c.fullName||c.name,1)}<div class="lmain"><b>${esc(c.fullName||c.name)}</b><small>${esc([c.phone,c.city].filter(Boolean).join(" · "))}</small></div>${expChip(c)}</div>
 <div class="kv"><span>Plan</span><b>${esc(c.plan||"—")}</b><span>Vence</span><b>${esc(c.expiresAt||"—")}</b>${isA()||isR()?`<span>A cargo</span><b>${esc(nm(c.resellerId))}</b>`:""}</div>${c.notes?`<p class="note">${esc(c.notes)}</p>`:""}
 <div class="actgrid">${!isA()&&!isR()?`<button class="act pri" data-a="newTx" data-id="${id}"><i>💳</i><span>Cobrar</span></button>`:""}${u?`<a class="act" target="_blank" rel="noopener" href="${u}"><i>💬</i><span>WhatsApp</span></a>`:""}<button class="act" data-a="msgClient" data-id="${id}"><i>✉</i><span>Mensaje</span></button>${rn&&soon(c)?`<a class="act" target="_blank" rel="noopener" href="${rn}"><i>⏰</i><span>Avisar venc.</span></a>`:""}<button class="act" data-a="editClient" data-id="${id}"><i>✎</i><span>Editar</span></button></div>
 ${hist.length?`<h3>Últimos pagos</h3><div class="list">${hist.map(txRow).join("")}</div>`:""}`)}
function msgClient(id){
 const c=clients.find(x=>x.id===id),ms=msgs.filter(m=>(m.dest||"both")!=="admin");
 sheet(`<div class="sh-title">Mensaje para ${esc(first(c.fullName||c.name))}<button class="x" data-a="close">✕</button></div><div class="list">${ms.map(m=>`<button class="lrow" data-a="pickMsg" data-id="${m.id}" data-c="${id}"><div class="ico">✉</div><div class="lmain"><b>${esc(m.title)}</b><small>${esc(m.body)}</small></div><i>›</i></button>`).join("")||empty("✉","No hay mensajes para clientes.")}</div>`)}
function clientForm(c){
 const rs=team.filter(u=>u.role==="reseller"&&u.active!==false);
 openForm(c?"Editar cliente":"Nuevo cliente",`${fld("fullName","Nombre y apellido",{req:1,v:c?.fullName||c?.name})}${fld("phone","WhatsApp",{req:1,type:"tel",v:c?.phone})}${fld("email","Correo (opcional)",{type:"email",v:c?.email})}${fld("city","Localidad",{v:c?.city})}${fld("plan","Plan",{v:c?.plan})}${fld("status","Estado",{v:c?.status||"pending",opts:[["pending","Pendiente"],["active","Activo"],["inactive","Inactivo"]]})}${fld("startDate","Alta",{type:"date",v:c?.startDate||today()})}${fld("expiresAt","Vencimiento",{type:"date",v:c?.expiresAt})}${isA()&&!c?fld("resellerId","Revendedora",{req:1,opts:[["","Elegir…"],...rs.map(u=>[u.uid,u.displayName||u.email])]}):""}${fld("notes","Notas (sin DNI ni datos sensibles)",{type:"textarea",v:c?.notes})}`,async f=>{
  const n=f.get("fullName").trim(),d={fullName:n,name:n,phone:f.get("phone").trim(),email:f.get("email").trim(),city:f.get("city").trim(),plan:f.get("plan"),status:f.get("status"),startDate:f.get("startDate"),expiresAt:f.get("expiresAt"),notes:f.get("notes"),updatedAt:ts()};
  if(c)await updateDoc(doc(db,"clients",c.id),d);
  else{const res=isA()?f.get("resellerId"):me.uid,rec=isA()?team.find(u=>u.uid===res)?.recruiterId:me.recruiterId;await addDoc(collection(db,"clients"),{...d,resellerId:res,recruiterId:rec||null,createdBy:me.uid,createdAt:ts()})}
  await refresh();return "Cliente guardado."})}

/* Pagos */
const txPill=t=>t.status==="approved"?pill("Verificado","ok"):t.status==="rejected"?pill("Observado","bad"):pill("En revisión","pending");
const txRow=t=>`<button class="lrow" data-a="tx" data-id="${t.id}"><div class="ico">${t.status==="approved"?"✅":"💳"}</div><div class="lmain"><b>${esc(t.clientName)}</b><small>${t.type==="new"?"Alta":"Renovación"} · ${fdate(t.createdAt)}${isA()||isR()?" · "+esc(nm(t.resellerId)):""}</small></div><div class="lend"><b>${cash(t.amount)}</b>${txPill(t)}</div></button>`;
function txPage(){
 shell(`${chips([["","Todos"],["pending","En revisión"],["approved","Verificados"]])}<div id="list" class="list">${txList()}</div>`,!isA()&&!isR()?["newTx","Registrar pago"]:null)}
const txList=()=>tx.filter(t=>!F.s||t.status===F.s).map(txRow).join("")||empty("💳","Sin pagos.");
function txSheet(id){
 const t=tx.find(x=>x.id===id);if(!t)return;const mgr=isA()||isR(),ok=t.status==="approved";
 sheet(`<div class="sh-title">Pago<button class="x" data-a="close">✕</button></div><div class="bigamt">${cash(t.amount)}</div><div class="center">${txPill(t)}</div>
 <div class="kv"><span>Cliente</span><b>${esc(t.clientName)}</b><span>Tipo</span><b>${t.type==="new"?"Alta nueva":"Renovación"}</b><span>Medio</span><b>${esc(t.method||"—")}</b><span>Fecha</span><b>${fdate(t.createdAt)}</b>${mgr?`<span>Revendedora</span><b>${esc(nm(t.resellerId))}</b>`:""}${ok&&!isA()?`<span>Tu comisión</span><b>${cash(isR()?t.recruiterCommission:t.resellerCommission)}</b>`:""}</div>
 ${t.proofUrl?`<a href="${esc(t.proofUrl)}" target="_blank" rel="noopener"><img class="proofbig" src="${esc(t.proofUrl)}" alt="Comprobante"></a>`:""}
 ${t.status==="pending"?(mgr?`<button class="primary full lg" data-a="verify" data-id="${id}">Verificar cobro</button>`:`<p class="note">⏳ Tu coordinadora está revisando este pago.</p>`):""}`)}
function txForm(cid){
 if(!clients.length)return toast("Primero cargá un cliente.",1);
 const c=clients.find(x=>x.id===cid),ty=c&&c.status==="active"?"renewal":"new";
 const f=sheetForm("Registrar pago",`<div class="step"><b>1</b>¿De qué cliente es?</div>
 <select name="clientId" required>${c?"":'<option value="">Elegir cliente…</option>'}${clients.map(x=>`<option value="${x.id}"${x.id===cid?" selected":""}>${esc(x.fullName||x.name)}</option>`).join("")}</select>
 <div class="step"><b>2</b>¿Qué cobraste?</div>
 <div class="seg"><label><input type="radio" name="type" value="new"${ty==="new"?" checked":""}><span>Alta nueva</span></label><label><input type="radio" name="type" value="renewal"${ty==="renewal"?" checked":""}><span>Renovación</span></label></div>
 <label>Importe cobrado<input class="big" name="amount" type="number" inputmode="numeric" min="1" required value="${S.publicPrice}"></label>
 <div class="seg wrap">${["Transferencia","Efectivo","Mercado Pago","Otro"].map((m,i)=>`<label><input type="radio" name="method" value="${m}"${i?"":" checked"}><span>${m}</span></label>`).join("")}</div>
 <div class="step"><b>3</b>Foto del comprobante</div>${photoField()}<div class="earn" id="earn"></div>`,async f=>{
  const cl=clients.find(x=>x.id===f.get("clientId"));if(!cl)throw Error("Elegí un cliente.");const proofUrl=await upload(f.get("proof"));
  await addDoc(collection(db,"transactions"),{clientId:cl.id,clientName:cl.fullName||cl.name,type:f.get("type"),amount:+f.get("amount"),method:f.get("method"),proofUrl,status:"pending",resellerId:me.uid,recruiterId:me.recruiterId||null,createdBy:me.uid,createdAt:ts()});
  await refresh();return "Pago enviado. Queda en revisión."},"Enviar para verificación");
 bindPhoto(f);const earn=()=>{$("earn").innerHTML=`Tu comisión por este pago: <b>${cash(f.elements.type.value==="new"?S.newReseller:S.renewReseller)}</b> (se acredita al verificarse)`};f.oninput=earn;earn()}
async function verify(id){const t=tx.find(x=>x.id===id),n=t.type==="new",rs=n?S.newReseller:S.renewReseller,rc=n?S.newRecruiter:S.renewRecruiter,tr=+t.amount-rs-rc;
 await updateDoc(doc(db,"transactions",id),{status:"approved",verifiedBy:me.uid,verifiedAt:ts(),resellerCommission:rs,recruiterCommission:rc,supplierCost:S.supplierCost,tvMargin:tr-S.supplierCost,adminTransfer:tr});await refresh();return "Cobro verificado."}

/* Liquidaciones */
const setRow=s=>`<button class="lrow" data-a="set" data-id="${s.id}"><div class="ico">🧾</div><div class="lmain"><b>${esc(s.payeeName||s.payeeType)}</b><small>${esc(s.concept||"Liquidación")} · ${fdate(s.createdAt)}</small></div><div class="lend"><b>${cash(s.amount)}</b>${s.status==="confirmed"?pill("Confirmada","ok"):pill("Pendiente","pending")}</div></button>`;
function setsPage(){shell(`<div class="list">${sets.map(setRow).join("")||empty("🧾","Sin liquidaciones.")}</div>`,isR()?["newSet","Informar transferencia"]:null)}
function setSheet(id){
 const s=sets.find(x=>x.id===id);if(!s)return;
 sheet(`<div class="sh-title">Liquidación<button class="x" data-a="close">✕</button></div><div class="bigamt">${cash(s.amount)}</div><div class="center">${s.status==="confirmed"?pill("Confirmada","ok"):pill("Pendiente","pending")}</div>
 <div class="kv"><span>Destinatario</span><b>${esc(s.payeeName||s.payeeType)}</b><span>Concepto</span><b>${esc(s.concept||"—")}</b><span>Fecha</span><b>${fdate(s.createdAt)}</b>${s.reference?`<span>Referencia</span><b>${esc(s.reference)}</b>`:""}</div>
 ${s.proofUrl?`<a href="${esc(s.proofUrl)}" target="_blank" rel="noopener"><img class="proofbig" src="${esc(s.proofUrl)}" alt="Comprobante"></a>`:""}
 ${isA()&&s.status!=="confirmed"?`<button class="primary full lg" data-a="confirm" data-id="${id}">Confirmar recepción</button>`:""}`)}
function setForm(){
 const rs=team.filter(u=>u.role==="reseller");
 const f=sheetForm("Informar transferencia",`<div class="form-grid">${fld("payee","¿A quién le transferiste?",{wide:1,opts:[["tv","TV (incluye costo proveedor)"],...rs.map(u=>[u.uid,u.displayName||u.email])]})}${fld("amount","Importe",{type:"number",min:1,req:1})}${fld("concept","Concepto",{opts:["Comisión de revendedora","Liquidación a TV","Otro ajuste"].map(x=>[x,x])})}${fld("reference","N° de operación (opcional)",{wide:1})}</div><div class="step"><b>📎</b>Comprobante</div>${photoField()}`,async f=>{
  const p=f.get("payee"),r=p!=="tv",proofUrl=await upload(f.get("proof"));
  await addDoc(collection(db,"settlements"),{payeeType:r?"reseller":"super_admin",payeeName:r?nm(p):"TV",resellerId:r?p:null,amount:+f.get("amount"),concept:f.get("concept"),reference:f.get("reference"),proofUrl,status:"pending",recruiterId:me.uid,createdBy:me.uid,createdAt:ts()});
  await refresh();return "Liquidación enviada."},"Enviar");bindPhoto(f)}

/* Altas / equipo */
function reqPage(){
 const rec=team.filter(u=>u.role==="recruiter"&&u.active!==false);
 shell(`<section class="panel"><h2>Pendientes de aprobación</h2>${table(["Solicitante","Contacto","Rol","Detalle",""],reqs.map(r=>{const u=wa(r.phone);return [`<b>${esc(r.name)}</b><br><span class="help">${esc(r.email)}</span>`,u?`<a class="link-btn" target="_blank" rel="noopener" href="${u}">${esc(r.phone)}</a>`:esc(r.phone),ROLES[r.requestedRole]||r.requestedRole,esc([r.city,r.message].filter(Boolean).join(" · ")),`<div class="toolbar">${r.requestedRole==="reseller"?`<select id="rec-${r.id}"><option value="">Coordinadora…</option>${rec.map(u=>`<option value="${u.uid}"${u.uid===r.recruiterId?" selected":""}>${esc(u.displayName||u.email)}</option>`).join("")}</select>`:""}<button class="small-btn" data-a="approve" data-id="${r.id}">Aprobar</button><button class="small-btn danger" data-a="reject" data-id="${r.id}">Rechazar</button></div>`]}),"Sin solicitudes ✓")}</section>`)}
async function approve(id){const r=reqs.find(x=>x.id===id),rid=r.requestedRole==="reseller"?$("rec-"+id)?.value||r.recruiterId:null;
 if(r.requestedRole==="reseller"&&!rid)throw Error("Elegí la coordinadora responsable.");
 await setDoc(doc(db,"users",r.uid),{displayName:r.name,email:r.email,phone:r.phone,role:r.requestedRole,active:true,recruiterId:rid||null,createdAt:ts(),approvedBy:me.uid});
 await updateDoc(doc(db,"accessRequests",id),{status:"approved",reviewedBy:me.uid,reviewedAt:ts()});await refresh();return "Usuario aprobado."}
function teamPage(){
 shell(`${isR()?`<section class="panel"><div class="panel-head"><div><b>Tu UID</b><div class="help">Pasáselo a tus revendedoras al solicitar acceso.</div></div><button class="small-btn" data-a="copy" data-id="${me.uid}">Copiar UID</button></div></section>`:""}<section class="panel"><div class="panel-head"><h2>${isA()?"Usuarios":"Mis revendedoras"}</h2>${isA()?`<button class="primary" data-a="newUser">＋ Vincular perfil</button>`:""}</div>
 ${table(["Nombre","Rol","Clientes","Estado",""],team.map(u=>[`<b>${esc(u.displayName||"—")}</b><br><span class="help">${esc(u.email||"")}</span>`,ROLES[u.role]||u.role,clients.filter(c=>c.resellerId===u.uid||(u.role==="recruiter"&&c.recruiterId===u.uid)).length,u.active===false?pill("Inactivo","bad"):pill("Activo","ok"),`<div class="toolbar"><button class="small-btn" data-a="copy" data-id="${u.uid}">UID</button>${isA()&&u.uid!==me.uid?`<button class="small-btn ${u.active===false?"":"danger"}" data-a="toggle" data-id="${u.uid}">${u.active===false?"Activar":"Desactivar"}</button>`:""}</div>`]),"Sin usuarios vinculados.")}</section>`)}
function userForm(){
 openForm("Vincular perfil",`${fld("uid","UID de Authentication",{req:1})}${fld("displayName","Nombre",{req:1})}${fld("email","Correo",{type:"email",req:1})}${fld("role","Rol",{opts:[["reseller","Revendedora"],["recruiter","Coordinadora"]]})}${fld("recruiterId","Coordinadora (si es revendedora)",{opts:[["","—"],...team.filter(u=>u.role==="recruiter").map(u=>[u.uid,u.displayName||u.email])]})}`,async f=>{
  const role=f.get("role");await setDoc(doc(db,"users",f.get("uid").trim()),{displayName:f.get("displayName"),email:f.get("email"),role,active:true,recruiterId:role==="reseller"?f.get("recruiterId")||null:null});await refresh();return "Perfil guardado."})}

function reassignPage(){
 const rs=team.filter(u=>u.role==="reseller"&&u.active!==false),o=[["","Elegir…"],...rs.map(u=>[u.uid,`${u.displayName||u.email} (${clients.filter(c=>c.resellerId===u.uid).length})`])];
 shell(`<section class="panel"><h2>Reasignar cartera completa</h2><form id="rf"><div class="form-grid">${fld("from","De",{req:1,opts:o})}${fld("to","A",{req:1,opts:o})}${fld("reason","Motivo",{type:"textarea"})}</div><div class="form-actions"><button class="primary">Reasignar</button></div></form></section>`);
 $("rf").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),from=f.get("from"),to=f.get("to");
  if(!from||!to||from===to)return toast("Elegí dos revendedoras distintas.",1);
  const a=team.find(u=>u.uid===from),b=team.find(u=>u.uid===to),sel=clients.filter(c=>c.resellerId===from);
  if(!sel.length)return toast("No tiene clientes.",1);
  if(!confirm(`¿Pasar ${sel.length} clientes de ${a.displayName||a.email} a ${b.displayName||b.email}?`))return;
  run(async()=>{for(let i=0;i<sel.length;i+=400){const w=writeBatch(db);sel.slice(i,i+400).forEach(c=>w.update(doc(db,"clients",c.id),{resellerId:to,recruiterId:b.recruiterId||null,updatedAt:ts(),reassignedAt:ts(),reassignedBy:me.uid}));await w.commit()}
   await addDoc(collection(db,"reassignmentLogs"),{fromResellerId:from,toResellerId:to,fromName:a.displayName||a.email||"",toName:b.displayName||b.email||"",clientCount:sel.length,reason:f.get("reason"),createdBy:me.uid,createdAt:ts()});
   await refresh();return `${sel.length} clientes reasignados.`})}}

/* Contabilidad */
function accPage(){
 const ap=tx.filter(x=>x.status==="approved"),n=(r,c)=>S.publicPrice-r-c,K=[["Precio público","publicPrice"],["Costo proveedor","supplierCost"],["Comisión revendedora · alta","newReseller"],["Comisión coordinadora · alta","newRecruiter"],["Comisión revendedora · renovación","renewReseller"],["Comisión coordinadora · renovación","renewRecruiter"]];
 shell(`<div class="grid">${stat("Cobrado",cash(sum(ap,"amount")),ap.length+" pagos")}${stat("Comisiones",cash(sum(ap,"resellerCommission")+sum(ap,"recruiterCommission")),"revendedoras + coordinadoras")}${stat("Margen TV",cash(sum(ap,"tvMargin")),"neto de proveedor")}${stat("Liquidado",cash(sum(sets.filter(s=>s.status==="confirmed"),"amount")),"confirmado")}</div>
 <section class="panel"><h2>Parámetros</h2><form id="pf"><div class="form-grid">${K.map(([l,k])=>fld(k,l,{type:"number",min:0,req:1,v:S[k]})).join("")}</div><div class="form-actions"><button class="primary">Guardar</button></div></form></section>
 <section class="panel"><h2>Por unidad</h2>${table(["","Neto TV","Transferir a TV"],[["Alta",cash(n(S.newReseller,S.newRecruiter)-S.supplierCost),cash(n(S.newReseller,S.newRecruiter))],["Renovación",cash(n(S.renewReseller,S.renewRecruiter)-S.supplierCost),cash(n(S.renewReseller,S.renewRecruiter))]])}</section>`);
 $("pf").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),d={};K.forEach(([,k])=>d[k]=Number(f.get(k)));if(Object.values(d).some(x=>!Number.isFinite(x)||x<0))return toast("Revisá los importes.",1);
  run(async()=>{await setDoc(doc(db,"config","accounting"),{...d,updatedAt:ts(),updatedBy:me.uid});S=d;accPage();return "Parámetros guardados."})}}

/* Mensajes y galería */
const openWa=(t,phone=contact.whatsappNumber)=>{const u=wa(phone);if(!u)return toast(phone===contact.whatsappNumber?"El administrador aún no configuró su WhatsApp.":"Este cliente no tiene WhatsApp cargado.",1);window.open(`${u}?text=${encodeURIComponent(t)}`,"_blank","noopener")};
const fill=(t,c)=>t.replace(/\{nombre\}/gi,first(c.fullName||c.name)).replace(/\{vence\}/gi,c.expiresAt||"").replace(/\{plan\}/gi,c.plan||"");
const DEST={client:["Para clientes","ok"],admin:["Para el admin","pending"],both:["Clientes y admin",""]};
function msgsPage(){
 shell(`<div class="list cards">${msgs.map(m=>{const d=DEST[m.dest||"both"];return `<article class="card"><div class="message-meta">${pill(d[0],d[1])}<b>${esc(m.title)}</b></div><p class="clamp">${esc(m.body)}</p><div class="toolbar"><button class="small-btn pri" data-a="sendMsg" data-id="${m.id}">Enviar ›</button>${isA()?`<button class="small-btn" data-a="editMsg" data-id="${m.id}">Editar</button><button class="small-btn danger" data-a="delMsg" data-id="${m.id}">Eliminar</button>`:""}</div></article>`}).join("")||empty("✉","Sin mensajes.")}</div>`,isA()?["newMsg","Mensaje"]:null)}
function sendSheet(id){
 const m=msgs.find(x=>x.id===id),d=m.dest||"both",cl=d!=="admin",ad=d!=="client"&&!isA();
 sheet(`<div class="sh-title">${esc(m.title)}<button class="x" data-a="close">✕</button></div><label>Mensaje (podés editarlo)<textarea id="mt" rows="5">${esc(m.body)}</textarea></label>
 ${cl?`<label>Enviar a un cliente<select id="mc"><option value="">Elegir cliente…</option>${clients.map(c=>`<option value="${c.id}">${esc(c.fullName||c.name)}</option>`).join("")}</select></label><button class="primary full lg" data-a="sendClient">Enviar por WhatsApp</button>`:""}
 ${ad?`<button class="primary full lg" data-a="sendAdmin">Enviar al administrador</button>`:""}
 <div class="toolbar two"><button class="small-btn" data-a="shareMsg">Compartir…</button><button class="small-btn" data-a="copyMsg">Copiar</button></div>`)}
function msgForm(m){
 openForm(m?"Editar mensaje":"Nuevo mensaje",`${fld("title","Título",{req:1,v:m?.title})}${fld("kind","Tipo",{v:m?.kind,opts:[["general","General"],["demo","Demo"],["renewal","Renovación"],["payment","Pago"],["notice","Aviso"]]})}${fld("dest","¿Para quién es?",{v:m?.dest||"client",wide:1,opts:[["client","Para enviar a clientes"],["admin","Para enviar al administrador"],["both","Ambos"]]})}${fld("body","Texto",{type:"textarea",req:1,v:m?.body})}<div class="wide help">Podés usar {nombre}, {vence} y {plan}: se completan con los datos del cliente elegido.</div><div class="wide help">Visible para:</div>${roleChecks(m?.roles)}`,async f=>{
  const roles=f.getAll("roles");if(!roles.length)throw Error("Elegí al menos un rol.");
  const d={title:f.get("title"),kind:f.get("kind"),body:f.get("body"),roles,dest:f.get("dest"),active:true,updatedBy:me.uid,updatedAt:ts()};
  if(m)await updateDoc(doc(db,"contentMessages",m.id),d);else await addDoc(collection(db,"contentMessages"),{...d,createdBy:me.uid,createdAt:ts()});
  await refresh();return "Mensaje guardado."})}
const driveFileId=u=>u.hostname==="drive.google.com"?(u.pathname.match(/\/file\/d\/([^/]+)/)?.[1]||u.searchParams.get("id")):null;
const youtubeId=u=>/^(www\.)?(youtube\.com|m\.youtube\.com|youtu\.be)$/.test(u.hostname)?(u.searchParams.get("v")||u.pathname.match(/\/(?:embed|shorts|live|v)\/([^/?]+)/)?.[1]||(u.hostname==="youtu.be"?u.pathname.match(/^\/([^/?]+)/)?.[1]:null)):null;
function mediaInfo(g){
 let u;try{u=new URL(g.url)}catch{return{type:"link",url:null}}
 if(u.protocol!=="https:")return{type:"link",url:null};
 const path=u.pathname.toLowerCase(),driveId=driveFileId(u),ytId=youtubeId(u),vimeoId=u.hostname==="vimeo.com"||u.hostname==="www.vimeo.com"?u.pathname.match(/\/(\d+)/)?.[1]:null;
 const image=/\.(?:avif|gif|jpe?g|png|webp|svg)$/.test(path),video=/\.(?:m4v|mov|mp4|ogv|webm)$/.test(path),pdf=/\.pdf$/.test(path);
 let type=image||g.kind==="flyer"?"image":pdf||g.kind==="document"?"pdf":video||ytId||vimeoId||g.kind==="video"?"video":"link";
 if(g.kind==="link"&&driveId&&!image&&!pdf)type="link";
 const preview=driveId?`https://drive.google.com/thumbnail?id=${encodeURIComponent(driveId)}&sz=w800`:ytId?`https://i.ytimg.com/vi/${encodeURIComponent(ytId)}/hqdefault.jpg`:null;
 const embed=ytId?`https://www.youtube-nocookie.com/embed/${encodeURIComponent(ytId)}?autoplay=1`:vimeoId?`https://player.vimeo.com/video/${encodeURIComponent(vimeoId)}?autoplay=1`:driveId?`https://drive.google.com/file/d/${encodeURIComponent(driveId)}/preview`:g.url;
 return{type,url:u.href,preview,driveId,ytId,vimeoId,embed};
}
const mediaImages=()=>gal.filter(g=>mediaInfo(g).type==="image");
let mediaIndex=0,mediaItem=null;
function mediaThumb(g){
 const m=mediaInfo(g),label=`Ver ${g.title||"material"}`;
 let preview=m.type==="image"&&m.preview?`<img class="media-thumb-img" src="${esc(m.preview)}" alt="" loading="lazy">`:m.type==="image"?`<img class="media-thumb-img" src="${esc(m.url)}" alt="" loading="lazy">`:
  m.type==="video"&&m.ytId?`<img class="media-thumb-img" src="${esc(m.preview)}" alt="" loading="lazy">`:
  m.type==="video"&&m.driveId?`<img class="media-thumb-img" src="${esc(m.preview)}" alt="" loading="lazy">`:
  m.type==="video"&&!m.vimeoId&&!m.driveId?`<video class="media-thumb-video" src="${esc(m.url)}" muted playsinline preload="metadata"></video>`:
  m.type==="pdf"&&m.driveId?`<img class="media-thumb-img" src="${esc(m.preview)}" alt="" loading="lazy">`:
  m.type==="pdf"?`<iframe class="media-thumb-frame" src="${esc(m.url)}#toolbar=0&navpanes=0&scrollbar=0&view=FitH" title="" loading="lazy" tabindex="-1" aria-hidden="true"></iframe>`:"";
 const icon=m.type==="image"?"▧":m.type==="video"?"▶":m.type==="pdf"?"PDF":"↗";
 return `<div class="media-thumb${preview?" has-preview":""}" role="button" tabindex="0" aria-label="${esc(label)}" data-a="openMedia" data-id="${esc(g.id)}"><span class="media-mark">${icon}</span>${preview}<span class="media-play">${m.type==="video"?"▶":"Ver"}</span></div>`;
}
function mediaViewer(){
 if(!mediaItem)return;
 const g=mediaItem,m=mediaInfo(g),images=mediaImages(),imageAt=images.findIndex(x=>x.id===g.id);
 let body=m.type==="image"?`<img class="media-view-image" src="${esc(m.driveId?m.preview:m.url)}" alt="${esc(g.title)}">`:
  m.type==="video"&&(m.ytId||m.vimeoId||m.driveId)?`<iframe class="media-view-frame" src="${esc(m.embed)}" title="${esc(g.title)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`:
  m.type==="video"?`<video class="media-view-video" src="${esc(m.url)}" controls autoplay playsinline></video>`:
  m.type==="pdf"?`<iframe class="media-view-frame pdf-viewer" src="${esc(m.driveId?m.embed:`${m.url}#toolbar=1&navpanes=0`)}" title="${esc(g.title)}" allow="fullscreen"></iframe>`:
  `<div class="media-link-message"><span>↗</span><p>${m.url?"Este material es un enlace externo.":"El enlace no es válido o no usa HTTPS."}</p>${m.url?`<a class="small-btn pri" href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">Abrir enlace ↗</a>`:""}</div>`;
 const counter=imageAt>=0&&images.length>1?`<span class="media-counter">${imageAt+1} / ${images.length}</span>`:"";
 sheet(`<div class="sh-title">${esc(g.title||"Material")}${counter}<button class="x" data-a="close" type="button" aria-label="Cerrar">✕</button></div><div class="media-stage">${body}${imageAt>=0&&images.length>1?`<button class="media-nav prev" data-a="mediaPrev" aria-label="Imagen anterior">‹</button><button class="media-nav next" data-a="mediaNext" aria-label="Imagen siguiente">›</button>`:""}</div>${g.description?`<p class="media-description">${esc(g.description)}</p>`:""}`,"media-sheet");
}
function openMedia(id){
 const g=gal.find(x=>x.id===id);if(!g)return;
 mediaItem=g;mediaIndex=mediaImages().findIndex(x=>x.id===id);mediaViewer();
}
function changeMediaImage(step){
 const images=mediaImages();if(!images.length)return;
 mediaIndex=(mediaIndex+step+images.length)%images.length;mediaItem=images[mediaIndex];mediaViewer();
}
function galPage(){
 shell(`<section class="panel"><div class="panel-head"><h2>Material comercial</h2>${isA()?`<button class="primary" data-a="newGal">＋ Material</button>`:""}</div><div class="cards two material-grid">${gal.map(g=>`<article class="card material-card">${mediaThumb(g)}<div class="ginfo"><b>${esc(g.title)}</b>${g.description?`<p>${esc(g.description)}</p>`:""}<div class="toolbar"><button class="small-btn pri" data-a="openMedia" data-id="${esc(g.id)}">Ver material</button>${isA()?`<button class="small-btn" data-a="editGal" data-id="${esc(g.id)}">Editar</button><button class="small-btn danger" data-a="delGal" data-id="${esc(g.id)}">Quitar</button>`:""}</div></div></article>`).join("")||'<div class="empty">Sin materiales.</div>'}</div></section>`)}
function galForm(g){
 openForm(g?"Editar material":"Nuevo material",`${fld("title","Nombre",{req:1,v:g?.title})}${fld("kind","Tipo",{v:g?.kind,opts:[["flyer","Flyer / imagen"],["video","Video"],["document","PDF / documento"],["link","Enlace"]]})}${fld("url","Enlace https (Drive, YouTube…)",{type:"url",req:1,v:g?.url,wide:1})}${fld("description","Descripción",{type:"textarea",v:g?.description})}<div class="wide help">Visible para:</div>${roleChecks(g?.roles)}`,async f=>{
  const roles=f.getAll("roles"),url=f.get("url").trim();if(!roles.length)throw Error("Elegí al menos un rol.");if(!/^https:\/\//i.test(url))throw Error("Usá un enlace HTTPS.");
  const d={title:f.get("title"),kind:f.get("kind"),url,description:f.get("description"),roles,active:true,updatedBy:me.uid,updatedAt:ts()};
  if(g)await updateDoc(doc(db,"gallery",g.id),d);else await addDoc(collection(db,"gallery"),{...d,createdBy:me.uid,createdAt:ts()});
  await refresh();return "Material guardado."})}

/* Ayuda */
function helpPage(){
 const tip={super_admin:"Aprobá altas, controlá pagos y liquidaciones, y ajustá parámetros en Contable.",recruiter:"Verificá los pagos de tu equipo y registrá cada transferencia con su comprobante.",reseller:"Cargá tus clientes, registrá cada pago con su foto y avisá vencimientos con un toque."}[me.role];
 shell(`<section class="panel"><h2>Cómo funciona</h2><p class="help">${tip}</p></section>
 ${isA()?`<section class="panel"><h2>Contacto oficial</h2><form id="cf"><div class="form-grid">${fld("whatsappNumber","Tu WhatsApp (solo dígitos, con 549…)",{req:1,type:"tel",v:contact.whatsappNumber,wide:1})}${fld("supportMessage","Mensaje de soporte por defecto",{type:"textarea",v:contact.supportMessage||"Hola, necesito ayuda con el panel TV."})}</div><div class="form-actions"><button class="primary">Guardar</button></div></form></section>`:`<section class="panel"><h2>Escribirle al administrador</h2><label>Mensaje<textarea id="hm" rows="3">${esc(contact.supportMessage||"Hola, necesito ayuda con el panel TV.")}</textarea></label><button class="primary full lg" data-a="support" style="margin-top:10px">Enviar por WhatsApp</button></section>`}`);
 if($("cf"))$("cf").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),n=String(f.get("whatsappNumber")).replace(/\D/g,"");if(n.length<10||n.length>15)return toast("Número inválido.",1);
  run(async()=>{contact={whatsappNumber:n,supportMessage:f.get("supportMessage")};await setDoc(doc(db,"config","contact"),{...contact,updatedAt:ts(),updatedBy:me.uid});return "Contacto guardado."})}}

const PAGE={home,requests:reqPage,clients:clientsPage,transactions:txPage,settlements:setsPage,team:teamPage,reassign:reassignPage,accounting:accPage,messages:msgsPage,gallery:galPage,help:helpPage};
const mt=()=>$("mt")?.value||"";
const ACT={
 close:closeSheet,more:moreSheet,logout:()=>signOut(auth),
 chip:s=>{F.s=s;document.querySelectorAll(".chips .chip").forEach(b=>b.classList.toggle("on",b.dataset.id===s));$("list").innerHTML=page==="clients"?clientList():txList()},
 client:clientSheet,msgClient,pickMsg:(id,b)=>{const c=clients.find(x=>x.id===b.dataset.c),m=msgs.find(x=>x.id===id);openWa(fill(m.body,c),c.phone)},
 newClient:()=>{page!=="clients"&&go("clients");clientForm()},editClient:id=>clientForm(clients.find(c=>c.id===id)),
 newTx:id=>txForm(id),tx:txSheet,verify:id=>run(async()=>{const m=await verify(id);closeSheet();return m}),
 newSet:setForm,set:setSheet,confirm:id=>run(async()=>{await updateDoc(doc(db,"settlements",id),{status:"confirmed",confirmedBy:me.uid,confirmedAt:ts()});await refresh();closeSheet();return "Recepción confirmada."}),
 approve:id=>run(()=>approve(id)),reject:id=>run(async()=>{await updateDoc(doc(db,"accessRequests",id),{status:"rejected",reviewedBy:me.uid,reviewedAt:ts()});await refresh();return "Solicitud rechazada."}),
 newUser:userForm,toggle:id=>run(async()=>{const u=team.find(x=>x.uid===id);await updateDoc(doc(db,"users",id),{active:u.active===false});await refresh();return "Usuario actualizado."}),
 copy:id=>navigator.clipboard?.writeText(id).then(()=>toast("Copiado."),()=>toast(id)),
 newMsg:()=>msgForm(),editMsg:id=>msgForm(msgs.find(m=>m.id===id)),sendMsg:sendSheet,
 sendClient:()=>{const c=clients.find(x=>x.id===$("mc").value);if(!c)return toast("Elegí un cliente.",1);openWa(fill(mt(),c),c.phone)},sendAdmin:()=>openWa(mt()),
 shareMsg:()=>navigator.share?navigator.share({text:mt()}).catch(()=>{}):ACT.copyMsg(),copyMsg:()=>navigator.clipboard?.writeText(mt()).then(()=>toast("Texto copiado.")),
 delMsg:id=>confirm("¿Eliminar mensaje?")&&run(async()=>{await deleteDoc(doc(db,"contentMessages",id));await refresh();return "Eliminado."}),
 newGal:()=>galForm(),editGal:id=>galForm(gal.find(g=>g.id===id)),
 openMedia:id=>openMedia(id),mediaPrev:()=>changeMediaImage(-1),mediaNext:()=>changeMediaImage(1),
 delGal:id=>confirm("¿Quitar material?")&&run(async()=>{await deleteDoc(doc(db,"gallery",id));await refresh();return "Quitado."}),
 support:()=>openWa($("hm")?.value||"Hola, necesito ayuda con el panel TV.")};
document.addEventListener("click",e=>{const b=e.target.closest("[data-go],[data-a]");if(!b)return;if(b.dataset.go){closeSheet();return go(b.dataset.go)}ACT[b.dataset.a]?.(b.dataset.id,b)});
document.addEventListener("input",e=>{if(e.target.id!=="q")return;F.q=e.target.value;$("list").innerHTML=clientList()});
document.addEventListener("keydown",e=>{
 if(e.key==="Escape")return closeSheet();
 if($("sheet").classList.contains("open")&&$("shBox").classList.contains("media-sheet")&&mediaIndex>=0){
  if(e.key==="ArrowLeft"){e.preventDefault();changeMediaImage(-1)}
  if(e.key==="ArrowRight"){e.preventDefault();changeMediaImage(1)}
 }
 if((e.key==="Enter"||e.key===" ")&&e.target.matches(".media-thumb[role=button]")){e.preventDefault();e.target.click()}
});
document.addEventListener("error",e=>{if(e.target.matches?.(".media-thumb-img,.media-thumb-video"))e.target.closest(".media-thumb")?.classList.add("media-fallback")},true);
$("refreshBtn").onclick=()=>me&&run(async()=>{$("refreshBtn").classList.add("spin");try{await refresh()}finally{$("refreshBtn").classList.remove("spin")}return "Actualizado."});
if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
