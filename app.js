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
function openForm(title,body,onsub,label="Guardar"){const p=$("fp");p.classList.remove("hidden");p.innerHTML=`<div class="panel-head"><h2>${title}</h2><button class="small-btn" data-a="close" type="button">✕</button></div><form><div class="form-grid">${body}</div><div class="form-actions"><button class="primary">${label}</button></div></form>`;const f=p.querySelector("form");f.onsubmit=e=>{e.preventDefault();run(()=>onsub(new FormData(f)))};p.scrollIntoView({behavior:"smooth",block:"start"})}
const shell=(h,extra="")=>{$("content").innerHTML=h+`<section class="panel hidden" id="fp"></section>`+extra};
const chips=(opts)=>`<div class="toolbar chips">${opts.map(([k,t])=>`<button class="chip${F.s===k?" on":""}" data-a="chip" data-id="${k}">${t}</button>`).join("")}</div>`;
const search=()=>`<input id="q" type="search" placeholder="Buscar…" value="${esc(F.q)}">`;

async function shrink(file){if(!file.type.startsWith("image/")||file.size<3e5)return file;try{const b=await createImageBitmap(file),k=Math.min(1,1600/Math.max(b.width,b.height)),c=document.createElement("canvas");c.width=Math.round(b.width*k);c.height=Math.round(b.height*k);c.getContext("2d").drawImage(b,0,0,c.width,c.height);const bl=await new Promise(r=>c.toBlob(r,"image/jpeg",.82));return bl&&bl.size<file.size?new File([bl],"proof.jpg",{type:"image/jpeg"}):file}catch{return file}}
async function upload(file){
 if(!file||!file.size)throw Error("Adjuntá el comprobante.");
 if(!file.type.startsWith("image/"))throw Error("El comprobante debe ser una imagen.");
 file=await shrink(file);if(file.size>8*1024*1024)throw Error("La imagen supera 8 MB.");
 const fd=new FormData();fd.append("image",file);
 const r=await fetch(uploadServiceUrl,{method:"POST",headers:{Authorization:`Bearer ${await auth.currentUser.getIdToken()}`},body:fd}),j=await r.json().catch(()=>({}));
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
 const sc=n=>A?q(n):q(n,where(f,"==",me.uid)),rc=n=>A?q(n):q(n,where("roles","array-contains",me.role));
 const [s,c,t,st,rq,u,m,g,ct]=await Promise.all([getDoc(doc(db,"config","accounting")),sc("clients"),sc("transactions"),sc("settlements"),A?q("accessRequests",where("status","==","pending")):none,A?q("users"):isR()?q("users",where("recruiterId","==",me.uid)):none,rc("contentMessages").catch(()=>({docs:[]})),rc("gallery").catch(()=>({docs:[]})),getDoc(doc(db,"config","contact")).catch(()=>({exists:()=>false}))]);
 const L=(x,k="id")=>x.docs.map(d=>({[k]:d.id,...d.data()})).sort(by);
 S={...DEF,...(s.exists()?s.data():{})};clients=L(c);tx=L(t);sets=L(st);reqs=L(rq);team=L(u,"uid");msgs=L(m);gal=L(g);contact=ct.exists()?ct.data():{}}
const refresh=async()=>{await load();go(page,true)};

function go(p,keep){page=p;if(!keep)F={q:"",s:""};
 const bd={requests:reqs.length,transactions:isA()||isR()?tx.filter(x=>x.status==="pending").length:0,settlements:isA()?sets.filter(x=>x.status!=="confirmed").length:0};
 $("navigation").innerHTML=NAV[me.role].map(k=>`<button class="nav-btn${k===p?" active":""}" data-go="${k}"><i>${PAGES[k][1]}</i><span>${PAGES[k][0]}</span>${bd[k]?`<b class="bd">${bd[k]}</b>`:""}</button>`).join("");
 $("pageTitle").textContent=PAGES[p][2]||PAGES[p][0];PAGE[p]();if(!keep)scrollTo(0,0)}

function home(){
 const ap=tx.filter(x=>x.status==="approved"),pend=tx.filter(x=>x.status==="pending"),A=isA(),R=isR(),exp=clients.filter(soon).sort((a,b)=>dleft(a)-dleft(b)),
  mine=sum(ap,R?"recruiterCommission":"resellerCommission"),ps=sets.filter(x=>x.status!=="confirmed").length;
 const acts=[A&&reqs.length&&`<button class="small-btn" data-go="requests">Solicitudes (${reqs.length})</button>`,A&&ps&&`<button class="small-btn" data-go="settlements">Confirmar liquidaciones (${ps})</button>`,(A||R)&&pend.length&&`<button class="small-btn" data-go="transactions">Verificar pagos (${pend.length})</button>`,!A&&!R&&`<button class="small-btn" data-a="newTx">＋ Informar pago</button>`,!R&&`<button class="small-btn" data-a="newClient">＋ Nuevo cliente</button>`].filter(Boolean);
 shell(`<div class="grid">${stat("Clientes",clients.length,"en tu cartera","clients")}${stat("Por vencer",exp.length,"vencidos o ≤ 7 días","clients")}${stat("Pagos pendientes",pend.length,"sin verificar","transactions")}${A?stat("Cobrado",cash(sum(ap,"amount")),ap.length+" pagos verificados","accounting"):stat("Mi comisión",cash(mine),ap.length+" pagos verificados")}</div>
 ${acts.length?`<div class="toolbar acts">${acts.join("")}</div>`:""}
 <section class="panel"><h2>Vencen pronto</h2>${table(["Cliente","Vence","WhatsApp"],exp.slice(0,8).map(c=>[`<b>${esc(c.fullName||c.name)}</b>`,expTag(c),renewBtn(c)]),"Nada por vencer ✓")}</section>`)}
const expTag=c=>{const d=dleft(c);return d===null?"—":`${esc(c.expiresAt)} ${d<0?pill("Vencido "+-d+"d","bad"):d<=7?pill(d===0?"Hoy":d+" d","pending"):""}`};
const renewBtn=c=>{const u=wa(c.phone);return u?`<a class="small-btn" target="_blank" rel="noopener" href="${u}?text=${encodeURIComponent(`Hola ${c.fullName||c.name}, tu servicio ${dleft(c)<0?"venció":"vence"} el ${c.expiresAt}. ¿Querés renovarlo?`)}">Avisar</a>`:"—"};

function accessPage(){
 getDocs(query(collection(db,"accessRequests"),where("uid","==",me.uid))).then(r=>{
  if(r.docs.some(d=>d.data().status==="pending")){shell(`<section class="panel"><h2>Solicitud en revisión</h2><p class="help">El súper administrador debe aprobarla. Volvé a ingresar más tarde.</p></section>`);return}
  shell(`<section class="panel"><h2>Solicitar acceso</h2><form id="af"><div class="form-grid">${fld("name","Nombre y apellido",{req:1})}${fld("phone","WhatsApp",{req:1,type:"tel"})}${fld("requestedRole","Rol",{opts:[["reseller","Revendedora"],["recruiter","Coordinadora"]]})}${fld("recruiterId","UID de tu coordinadora (si sos revendedora)")}${fld("city","Localidad")}${fld("message","Mensaje",{type:"textarea"})}</div><div class="form-actions"><button class="primary">Enviar solicitud</button></div></form></section>`);
  $("af").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);run(async()=>{await addDoc(collection(db,"accessRequests"),{uid:me.uid,email:me.email,name:f.get("name"),phone:f.get("phone"),requestedRole:f.get("requestedRole"),recruiterId:f.get("recruiterId")||null,city:f.get("city"),message:f.get("message"),status:"pending",createdAt:ts()});accessPage();return "Solicitud enviada."})}}).catch(e=>toast(e.message,1))}

/* Clientes */
function clientsPage(){
 shell(`<section class="panel"><div class="panel-head"><h2>${isA()?"Cartera general":isR()?"Cartera del equipo":"Mis clientes"}</h2>${isR()?"":`<button class="primary" data-a="newClient">＋ Cliente</button>`}</div>
 <div class="toolbar">${search()}</div>${chips([["","Todos"],["active","Activos"],["exp","Por vencer"],["pending","Pendientes"],["inactive","Inactivos"]])}<div id="list">${clientList()}</div></section>`)}
function clientList(){
 const q=F.q.toLowerCase(),rows=clients.filter(c=>(c.fullName+" "+c.phone+" "+c.city+" "+c.email).toLowerCase().includes(q)&&(!F.s||(F.s==="exp"?soon(c):c.status===F.s)));
 const st={active:["Activo","ok"],inactive:["Inactivo","bad"]},own=!isA()&&!isR()?0:1;
 return table(["Cliente","WhatsApp","Vence",...(own?["A cargo"]:[]),"Estado",""],rows.map(c=>{const s=st[c.status]||["Pendiente","pending"],u=wa(c.phone);
  return [`<b>${esc(c.fullName||c.name)}</b><br><span class="help">${esc([c.city,c.plan].filter(Boolean).join(" · "))}</span>`,u?`<a class="link-btn" target="_blank" rel="noopener" href="${u}">${esc(c.phone)}</a>`:"—",expTag(c),...(own?[esc(nm(c.resellerId))]:[]),pill(s[0],s[1]),`<div class="toolbar">${!isA()&&!isR()?`<button class="small-btn" data-a="newTx" data-id="${c.id}">Cobrar</button>`:""}<button class="small-btn" data-a="editClient" data-id="${c.id}">Editar</button></div>`]}),"Sin clientes.")}
function clientForm(c){
 const rs=team.filter(u=>u.role==="reseller"&&u.active!==false);
 openForm(c?"Editar cliente":"Nuevo cliente",`${fld("fullName","Nombre y apellido",{req:1,v:c?.fullName||c?.name})}${fld("phone","WhatsApp",{req:1,type:"tel",v:c?.phone})}${fld("email","Correo (opcional)",{type:"email",v:c?.email})}${fld("city","Localidad",{v:c?.city})}${fld("plan","Plan",{v:c?.plan})}${fld("status","Estado",{v:c?.status||"pending",opts:[["pending","Pendiente"],["active","Activo"],["inactive","Inactivo"]]})}${fld("startDate","Alta",{type:"date",v:c?.startDate||today()})}${fld("expiresAt","Vencimiento",{type:"date",v:c?.expiresAt})}${isA()&&!c?fld("resellerId","Revendedora",{req:1,opts:[["","Elegir…"],...rs.map(u=>[u.uid,u.displayName||u.email])]}):""}${fld("notes","Notas (sin DNI ni datos sensibles)",{type:"textarea",v:c?.notes})}`,async f=>{
  const n=f.get("fullName").trim(),d={fullName:n,name:n,phone:f.get("phone").trim(),email:f.get("email").trim(),city:f.get("city").trim(),plan:f.get("plan"),status:f.get("status"),startDate:f.get("startDate"),expiresAt:f.get("expiresAt"),notes:f.get("notes"),updatedAt:ts()};
  if(c)await updateDoc(doc(db,"clients",c.id),d);
  else{const res=isA()?f.get("resellerId"):me.uid,rec=isA()?team.find(u=>u.uid===res)?.recruiterId:me.recruiterId;await addDoc(collection(db,"clients"),{...d,resellerId:res,recruiterId:rec||null,createdBy:me.uid,createdAt:ts()})}
  await refresh();return "Cliente guardado."})}

/* Pagos */
function txPage(){
 shell(`<section class="panel"><div class="panel-head"><h2>${isA()?"Todos los pagos":isR()?"Pagos de mi equipo":"Mis pagos"}</h2>${!isA()&&!isR()?`<button class="primary" data-a="newTx">＋ Informar pago</button>`:""}</div>${chips([["","Todos"],["pending","Pendientes"],["approved","Verificados"]])}<div id="list">${txList()}</div></section>`)}
function txList(){
 const st={approved:["Verificado","ok"],rejected:["Observado","bad"]},mgr=isA()||isR();
 return table(["Fecha","Cliente","Tipo","Importe","Comprobante","Estado",...(mgr?[""]:[])],tx.filter(t=>!F.s||t.status===F.s).map(t=>{const s=st[t.status]||["Pendiente","pending"];
  return [fdate(t.createdAt),`<b>${esc(t.clientName)}</b>${mgr?`<br><span class="help">${esc(nm(t.resellerId))}</span>`:""}`,t.type==="new"?"Alta":"Renovación",`<b>${cash(t.amount)}</b>`,proof(t.proofUrl),pill(s[0],s[1]),...(mgr?[t.status==="pending"?`<button class="small-btn" data-a="verify" data-id="${t.id}">Verificar</button>`:""]:[])]}),"Sin pagos.")}
function txForm(cid){
 if(!clients.length)return toast("Primero cargá un cliente.",1);
 const c=clients.find(x=>x.id===cid);
 openForm("Informar pago",`${fld("clientId","Cliente",{v:cid,opts:clients.map(c=>[c.id,c.fullName||c.name])})}${fld("type","Tipo",{v:c?"renewal":"new",opts:[["new","Alta nueva"],["renewal","Renovación"]]})}${fld("amount","Importe",{type:"number",min:1,req:1,v:S.publicPrice})}${fld("method","Medio",{opts:["Transferencia","Efectivo","Mercado Pago","Otro"].map(x=>[x,x])})}${fld("reference","Referencia")}${fld("proof","Comprobante (captura legible)",{type:"file",accept:"image/*",req:1})}`,async f=>{
  const cl=clients.find(x=>x.id===f.get("clientId")),proofUrl=await upload(f.get("proof"));
  await addDoc(collection(db,"transactions"),{clientId:cl.id,clientName:cl.fullName||cl.name,type:f.get("type"),amount:+f.get("amount"),method:f.get("method"),reference:f.get("reference"),proofUrl,status:"pending",resellerId:me.uid,recruiterId:me.recruiterId||null,createdBy:me.uid,createdAt:ts()});
  await refresh();return "Pago enviado a verificación."},"Enviar")}
async function verify(id){const t=tx.find(x=>x.id===id),n=t.type==="new",rs=n?S.newReseller:S.renewReseller,rc=n?S.newRecruiter:S.renewRecruiter,tr=+t.amount-rs-rc;
 await updateDoc(doc(db,"transactions",id),{status:"approved",verifiedBy:me.uid,verifiedAt:ts(),resellerCommission:rs,recruiterCommission:rc,supplierCost:S.supplierCost,tvMargin:tr-S.supplierCost,adminTransfer:tr});await refresh();return "Cobro verificado."}

/* Liquidaciones */
function setsPage(){
 shell(`<section class="panel"><div class="panel-head"><h2>${isA()?"Liquidaciones recibidas":isR()?"Mis liquidaciones":"Mis comisiones"}</h2>${isR()?`<button class="primary" data-a="newSet">＋ Informar transferencia</button>`:""}</div>
 ${table(["Fecha","Destinatario","Concepto","Importe","Comprobante","Estado",...(isA()?[""]:[])],sets.map(s=>[fdate(s.createdAt),esc(s.payeeName||s.payeeType),esc(s.concept||"Liquidación"),`<b>${cash(s.amount)}</b>`,proof(s.proofUrl),s.status==="confirmed"?pill("Confirmada","ok"):pill("Pendiente","pending"),...(isA()?[s.status!=="confirmed"?`<button class="small-btn" data-a="confirm" data-id="${s.id}">Confirmar</button>`:""]:[])]),"Sin liquidaciones.")}</section>`)}
function setForm(){
 const rs=team.filter(u=>u.role==="reseller");
 openForm("Informar transferencia",`${fld("payee","Destinatario",{opts:[["tv","TV (incluye costo proveedor)"],...rs.map(u=>[u.uid,u.displayName||u.email])]})}${fld("amount","Importe",{type:"number",min:1,req:1})}${fld("concept","Concepto",{opts:["Comisión de revendedora","Liquidación a TV","Otro ajuste"].map(x=>[x,x])})}${fld("reference","Referencia")}${fld("proof","Comprobante",{type:"file",accept:"image/*",req:1})}`,async f=>{
  const p=f.get("payee"),r=p!=="tv",proofUrl=await upload(f.get("proof"));
  await addDoc(collection(db,"settlements"),{payeeType:r?"reseller":"super_admin",payeeName:r?nm(p):"TV",resellerId:r?p:null,amount:+f.get("amount"),concept:f.get("concept"),reference:f.get("reference"),proofUrl,status:"pending",recruiterId:me.uid,createdBy:me.uid,createdAt:ts()});
  await refresh();return "Liquidación enviada."},"Enviar")}

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
const openWa=t=>{const u=wa(contact.whatsappNumber);if(!u)return toast("El administrador aún no configuró el WhatsApp.",1);window.open(`${u}?text=${encodeURIComponent(t)}`,"_blank","noopener")};
function msgsPage(){
 shell(`<section class="panel"><div class="panel-head"><h2>Mensajes del equipo</h2>${isA()?`<button class="primary" data-a="newMsg">＋ Mensaje</button>`:""}</div><div class="cards">${msgs.map(m=>`<article class="card"><div class="message-meta">${pill(esc(m.kind||"general"))}<b>${esc(m.title)}</b></div><p>${esc(m.body).replace(/\n/g,"<br>")}</p><div class="toolbar">${m.action!=="none"?`<button class="small-btn" data-a="sendMsg" data-id="${m.id}">${esc(m.buttonLabel||"Enviar por WhatsApp")}</button>`:""}<button class="small-btn" data-a="copyMsg" data-id="${m.id}">Copiar</button>${isA()?`<button class="small-btn" data-a="editMsg" data-id="${m.id}">Editar</button><button class="small-btn danger" data-a="delMsg" data-id="${m.id}">Eliminar</button>`:""}</div></article>`).join("")||'<div class="empty">Sin mensajes.</div>'}</div></section>`)}
function msgForm(m){
 openForm(m?"Editar mensaje":"Nuevo mensaje",`${fld("title","Título",{req:1,v:m?.title})}${fld("kind","Tipo",{v:m?.kind,opts:[["general","General"],["demo","Demo"],["renewal","Renovación"],["payment","Pago"],["notice","Aviso"]]})}${fld("body","Texto",{type:"textarea",req:1,v:m?.body})}${fld("buttonLabel","Texto del botón (opcional)",{v:m?.buttonLabel})}${fld("action","Acción",{v:m?.action,opts:[["whatsapp","WhatsApp"],["none","Solo lectura"]]})}<div class="wide help">Visible para:</div>${roleChecks(m?.roles)}`,async f=>{
  const roles=f.getAll("roles");if(!roles.length)throw Error("Elegí al menos un rol.");
  const d={title:f.get("title"),kind:f.get("kind"),body:f.get("body"),roles,buttonLabel:f.get("buttonLabel"),action:f.get("action"),active:true,updatedBy:me.uid,updatedAt:ts()};
  if(m)await updateDoc(doc(db,"contentMessages",m.id),d);else await addDoc(collection(db,"contentMessages"),{...d,createdBy:me.uid,createdAt:ts()});
  await refresh();return "Mensaje guardado."})}
function galPage(){
 const ic={video:"▶",document:"PDF",flyer:"▧"};
 shell(`<section class="panel"><div class="panel-head"><h2>Material comercial</h2>${isA()?`<button class="primary" data-a="newGal">＋ Material</button>`:""}</div><div class="cards two">${gal.map(g=>`<article class="card row"><div class="gicon">${ic[g.kind]||"↗"}</div><div class="ginfo"><b>${esc(g.title)}</b>${g.description?`<p>${esc(g.description)}</p>`:""}<div class="toolbar"><a class="small-btn" href="${esc(g.url)}" target="_blank" rel="noopener">Abrir ↗</a>${isA()?`<button class="small-btn" data-a="editGal" data-id="${g.id}">Editar</button><button class="small-btn danger" data-a="delGal" data-id="${g.id}">Quitar</button>`:""}</div></div></article>`).join("")||'<div class="empty">Sin materiales.</div>'}</div></section>`)}
function galForm(g){
 openForm(g?"Editar material":"Nuevo material",`${fld("title","Nombre",{req:1,v:g?.title})}${fld("kind","Tipo",{v:g?.kind,opts:[["flyer","Flyer / imagen"],["video","Video"],["document","PDF / documento"],["link","Enlace"]]})}${fld("url","Enlace https (Drive, YouTube…)",{type:"url",req:1,v:g?.url,wide:1})}${fld("description","Descripción",{type:"textarea",v:g?.description})}<div class="wide help">Visible para:</div>${roleChecks(g?.roles)}`,async f=>{
  const roles=f.getAll("roles"),url=f.get("url").trim();if(!roles.length)throw Error("Elegí al menos un rol.");if(!/^https:\/\//i.test(url))throw Error("Usá un enlace HTTPS.");
  const d={title:f.get("title"),kind:f.get("kind"),url,description:f.get("description"),roles,active:true,updatedBy:me.uid,updatedAt:ts()};
  if(g)await updateDoc(doc(db,"gallery",g.id),d);else await addDoc(collection(db,"gallery"),{...d,createdBy:me.uid,createdAt:ts()});
  await refresh();return "Material guardado."})}

/* Ayuda */
function helpPage(){
 const tip={super_admin:"Aprobá altas, controlá pagos y liquidaciones, y ajustá parámetros en Contable.",recruiter:"Verificá los pagos de tu equipo y registrá cada transferencia con su comprobante.",reseller:"Cargá tus clientes, avisá vencimientos con un toque y registrá cada pago con su comprobante."}[me.role];
 shell(`<section class="panel"><h2>Soporte</h2><p class="help">${tip}</p><div class="toolbar"><button class="primary" data-a="support">WhatsApp de soporte</button></div></section>
 ${isA()?`<section class="panel"><h2>Contacto oficial</h2><form id="cf"><div class="form-grid">${fld("whatsappNumber","Número internacional (solo dígitos)",{req:1,type:"tel",v:contact.whatsappNumber,ph:"549..."})}${fld("supportMessage","Mensaje de soporte",{type:"textarea",v:contact.supportMessage||"Hola, necesito ayuda con el panel TV."})}</div><div class="form-actions"><button class="primary">Guardar</button></div></form></section>`:""}`);
 if($("cf"))$("cf").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),n=String(f.get("whatsappNumber")).replace(/\D/g,"");if(n.length<10||n.length>15)return toast("Número inválido.",1);
  run(async()=>{contact={whatsappNumber:n,supportMessage:f.get("supportMessage")};await setDoc(doc(db,"config","contact"),{...contact,updatedAt:ts(),updatedBy:me.uid});return "Contacto guardado."})}}

const PAGE={home,requests:reqPage,clients:clientsPage,transactions:txPage,settlements:setsPage,team:teamPage,reassign:reassignPage,accounting:accPage,messages:msgsPage,gallery:galPage,help:helpPage};
const ACT={
 close:()=>$("fp").classList.add("hidden"),
 chip:(s)=>{F.s=s;go(page,true)},
 newClient:()=>{go("clients");clientForm()},editClient:id=>clientForm(clients.find(c=>c.id===id)),
 newTx:id=>txForm(id),verify:id=>run(()=>verify(id)),
 newSet:setForm,confirm:id=>run(async()=>{await updateDoc(doc(db,"settlements",id),{status:"confirmed",confirmedBy:me.uid,confirmedAt:ts()});await refresh();return "Recepción confirmada."}),
 approve:id=>run(()=>approve(id)),reject:id=>run(async()=>{await updateDoc(doc(db,"accessRequests",id),{status:"rejected",reviewedBy:me.uid,reviewedAt:ts()});await refresh();return "Solicitud rechazada."}),
 newUser:userForm,toggle:id=>run(async()=>{const u=team.find(x=>x.uid===id);await updateDoc(doc(db,"users",id),{active:u.active===false});await refresh();return "Usuario actualizado."}),
 copy:id=>navigator.clipboard?.writeText(id).then(()=>toast("Copiado."),()=>toast(id)),
 newMsg:()=>msgForm(),editMsg:id=>msgForm(msgs.find(m=>m.id===id)),sendMsg:id=>openWa(msgs.find(m=>m.id===id).body),copyMsg:id=>navigator.clipboard?.writeText(msgs.find(m=>m.id===id).body).then(()=>toast("Texto copiado.")),
 delMsg:id=>confirm("¿Eliminar mensaje?")&&run(async()=>{await deleteDoc(doc(db,"contentMessages",id));await refresh();return "Eliminado."}),
 newGal:()=>galForm(),editGal:id=>galForm(gal.find(g=>g.id===id)),
 delGal:id=>confirm("¿Quitar material?")&&run(async()=>{await deleteDoc(doc(db,"gallery",id));await refresh();return "Quitado."}),
 support:()=>openWa(contact.supportMessage||"Hola, necesito ayuda con el panel TV.")};
document.addEventListener("click",e=>{const b=e.target.closest("[data-go],[data-a]");if(!b)return;if(b.dataset.go)return go(b.dataset.go);ACT[b.dataset.a]?.(b.dataset.id)});
document.addEventListener("input",e=>{if(e.target.id!=="q")return;F.q=e.target.value;$("list").innerHTML=clientList()});
