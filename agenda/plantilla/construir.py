"""Construye la agenda (un solo index.html) a partir del diseño original + el módulo que la conecta a Supabase.
Uso:  python3 construir.py <supabase_url> <supabase_publishable_key> <salida/index.html>
"""
import re, json, os, sys
AQUI = os.path.dirname(os.path.abspath(__file__))
F = lambda n: os.path.join(AQUI, 'fuente', n)
SB_URL, SB_KEY, SALIDA = sys.argv[1], sys.argv[2], sys.argv[3]
SRC = F('diseno-original.html')
s=open(SRC).read()
sc=re.findall(r'<script>(.*?)</script>',s,re.S)
s2,s3=sc[2],sc[3]
def rep(txt,a,b,cnt=1):
    assert txt.count(a)==cnt,(a[:70],txt.count(a)); return txt.replace(a,b)

# --- base config literal
i=s2.index('b={business:'); j=s2.index('function q(',i)
lit=s2[i+2:j]; assert lit.endswith('}});'),lit[-10:]; lit=lit[:-3]

# --- public bundle
n2=re.sub(r'if\(window\.AGENDA_DEMO\)return\(await Promise\.resolve\(\)\.then\(\(\)=>\(\w+\(\),\w+\)\)\)\.handle\(e,','return window.AGENDA_API(e,',s2)
assert n2!=s2
n2=rep(n2,'Te enviaremos un correo para confirmar la hora.','Con estos datos te contactamos si hay algún cambio.')
n2=rep(n2,'\n      <p class="fine">Tendr\\xE1s ${p.config.holdMinutes} minutos para confirmar desde tu correo.</p>','')
a=n2.index('function Ue(e,n){'); b_=n2.index('async function Ge(')
NEW_UE=r'''function Ue(e,n){j(4);let b=p.config.business,t=String(b.whatsapp||"").replace(/\D/g,""),m=`Hola, reservé ${p.service.name} para el ${ne(p.date)} a las ${p.time} hrs. Mi nombre es ${n.name}.`;S.innerHTML=`<div class="done"><div class="icon">✓</div><h2>¡Tu hora está reservada!</h2><p>Te enviamos un correo con los detalles y un enlace por si necesitas cancelar. Un día antes te llegará un recordatorio.</p>${oe()}${t.length>=10?`<a class="btn dark" href="https://wa.me/${t}?text=${encodeURIComponent(m)}" target="_blank" rel="noopener">Avisar por WhatsApp</a>`:""}<button class="btn ghost" id="again" style="margin-top:10px">Hacer otra reserva</button></div>`;document.getElementById("again").onclick=()=>{p.service=null,p.time=null,H()}}
async function Ve(e){j(5);S.innerHTML='<div class="loading">Cargando…</div>';let i;try{i=await R("/api/review-info",{method:"POST",body:{token:e}})}catch(x){S.innerHTML=`<div class="error">${v(x.message)}</div><button class="btn ghost" id="bk">Ir a la agenda</button>`;document.getElementById("bk").onclick=()=>{try{history.replaceState(null,"",location.pathname)}catch{}H()};return}
S.innerHTML=`<div class="done"><div class="icon">★</div><h2>¿Qué te pareció mi atención${i.name?", "+v(i.name):""}?</h2><p>Tu opinión me ayuda mucho a mejorar y orienta a otras pacientes que buscan atención.</p>${i.done?'<div class="okmsg">Ya habías dejado tu reseña. Si quieres, puedes cambiarla.</div>':""}
<div class="rstars" role="radiogroup" aria-label="Calificación" style="justify-content:center">${[1,2,3,4,5].map(s=>`<button type="button" class="rs" data-n="${s}" aria-label="${s} de 5">★</button>`).join("")}</div>
<div class="field" style="margin-top:12px;text-align:left"><textarea id="rc" maxlength="1000" placeholder="Cuéntame cómo te sentiste (opcional)"></textarea></div><p class="fine" style="margin:8px 0 12px">Tu nombre de pila y tu comentario podrían aparecer en mi página de reservas.</p><div id="rerr"></div><button class="btn dark" id="rsend">Enviar reseña</button></div>`;
let t=0,a=()=>S.querySelectorAll(".rs").forEach(s=>s.classList.toggle("on",Number(s.dataset.n)<=t));S.querySelectorAll(".rs").forEach(s=>s.onclick=()=>{t=Number(s.dataset.n),a(),document.getElementById("rerr").innerHTML=""});
document.getElementById("rsend").onclick=async x=>{if(!t){document.getElementById("rerr").innerHTML='<div class="error">Elige de 1 a 5 estrellas.</div>';return}x.target.disabled=!0;try{await R("/api/review",{method:"POST",body:{token:e,rating:t,comment:document.getElementById("rc").value}})}catch(y){document.getElementById("rerr").innerHTML=`<div class="error">${v(y.message)}</div>`;x.target.disabled=!1;return}
try{history.replaceState(null,"",location.pathname)}catch{}S.innerHTML=`<div class="done"><div class="icon">♥</div><h2>¡Gracias${i.name?", "+v(i.name):""}!</h2><p>Tu opinión significa mucho para mí. Un abrazo,<br><b>${v(pn())}</b></p><button class="btn ghost" id="again5">Reservar otra hora</button></div>`;document.getElementById("again5").onclick=()=>{p.service=null,p.time=null,H()}}}
async function CancelarHora(e){j(5);S.innerHTML='<div class="loading">Cargando…</div>';let i,bk=()=>{try{history.replaceState(null,"",location.pathname)}catch{}p.service=null,p.time=null,H()};try{i=await R("/api/cancel-info",{method:"POST",body:{token:e}})}catch(x){S.innerHTML=`<div class="error">${v(x.message)}</div><button class="btn ghost" id="bk">Ir a la agenda</button>`;document.getElementById("bk").onclick=bk;return}
let sv=(p.config.services.find(s=>s.id===i.service_id)||{}).name||"Tu atención",hm=`${String(Math.floor(i.start_min/60)).padStart(2,"0")}:${String(i.start_min%60).padStart(2,"0")}`,box=`<div class="summary" style="text-align:left;background:var(--bg2,#F7F6F2);border-radius:14px;padding:12px 14px;margin:14px 0"><b>${v(sv)}</b><br>${v(ne(i.date))}, ${hm} hrs</div>`;
if(i.status==="cancelled"){S.innerHTML=`<div class="done"><div class="icon">✓</div><h2>Esta hora ya está cancelada</h2>${box}<button class="btn dark" id="bk">Reservar otra hora</button></div>`;document.getElementById("bk").onclick=bk;return}
if(!i.puede){S.innerHTML=`<div class="done"><div class="icon">!</div><h2>Esta hora ya pasó</h2>${box}<button class="btn ghost" id="bk">Ir a la agenda</button></div>`;document.getElementById("bk").onclick=bk;return}
S.innerHTML=`<div class="done"><div class="icon">?</div><h2>${i.name?v(i.name)+", ¿":"¿"}quieres cancelar tu hora?</h2>${box}<p>La hora quedará libre para otra paciente.</p><div id="cerr"></div><button class="btn dark" id="cgo">Sí, cancelar mi hora</button><button class="btn ghost" id="bk" style="margin-top:10px">No, mantenerla</button></div>`;document.getElementById("bk").onclick=bk;
document.getElementById("cgo").onclick=async x=>{x.target.disabled=!0;try{await R("/api/cancel",{method:"POST",body:{token:e}})}catch(y){document.getElementById("cerr").innerHTML=`<div class="error">${v(y.message)}</div>`;x.target.disabled=!1;return}
S.innerHTML=`<div class="done"><div class="icon">✓</div><h2>Listo, tu hora fue cancelada</h2>${box}<p>Te enviamos un correo de confirmación.</p><button class="btn dark" id="bk">Reservar otra hora</button></div>`;document.getElementById("bk").onclick=bk}}
'''
n2=n2[:a]+NEW_UE+n2[b_:]
n2=rep(n2,',H()}Ge();',',Fe.get("resena")?Ve(Fe.get("resena")):Fe.get("cancelar")?CancelarHora(Fe.get("cancelar")):H()}Ge();')

# --- panel bundle
n3=re.sub(r'if\(window\.AGENDA_DEMO\)return\(await Promise\.resolve\(\)\.then\(\(\)=>\(\w+\(\),\w+\)\)\)\.handle\(e,','return window.AGENDA_API(e,',s3)
assert n3!=s3
EM='${p((()=>{try{return localStorage.getItem("agenda-admin-email")||""}catch{return""}})())}'
n3=rep(n3,'<form id="lf"><div class="field"><label for="lpw">Clave</label>','<form id="lf"><div class="field"><label for="lem">Correo</label><input id="lem" type="email" autocomplete="username" required value="'+EM+'"></div><div class="field"><label for="lpw">Clave</label>')
n3=rep(n3,'body:{password:document.getElementById("lpw").value}','body:{email:document.getElementById("lem").value,password:document.getElementById("lpw").value}')
n3=rep(n3,'Te enviaremos un enlace al correo registrado de tu negocio para que crees una clave nueva.','Te enviaremos un enlace a tu correo para que crees una clave nueva.')
n3=rep(n3,'<div id="fmsg"></div>','<div class="field"><label for="femail">Tu correo</label><input id="femail" type="email" autocomplete="email" value="'+EM+'"></div><div id="fmsg"></div>')
n3=rep(n3,'y("/api/admin/forgot",{method:"POST"})','y("/api/admin/forgot",{method:"POST",body:{email:document.getElementById("femail").value}})')
n3=rep(n3,'let e=location.hash.match(/reset=([0-9a-f]{64})/);if(e)return Je(e[1]);','if(window.__AGENDA_RESET__)return Je("sb");')
n3=rep(n3,'rel="noopener">WhatsApp</a>`:""}\n      ${n?"":\'<button class="btn ghost small" data-c>Cancelar hora</button>\'}',
 'rel="noopener">WhatsApp</a>`:""}${n&&e.review_link?`<a class="btn ghost small" href="${p(e.review_link)}" target="_blank" rel="noopener">Pedir reseña</a>`:""}\n      ${n?"":\'<button class="btn ghost small" data-c>Cancelar hora</button>\'}')

# --- "Hoy": vista directa de la agenda del día (pestaña por defecto)
n3=rep(n3,'<div class="tabs"><button data-tab="semana">Semana</button>','<div class="tabs"><button data-tab="hoy">Hoy</button><button data-tab="semana">Semana</button>')
n3=rep(n3,'tab:"semana",form:null','tab:"hoy",form:null')
n3=rep(n3,'A.querySelectorAll("[data-tab]").forEach(e=>e.onclick=()=>{l.tab=e.dataset.tab,le()})','A.querySelectorAll("[data-tab]").forEach(e=>e.onclick=()=>{l.tab=e.dataset.tab,l.tab==="hoy"&&(l.sel=l.today,l.month=l.today.slice(0,7),l.form=null),le()})')
n3=rep(n3,'{semana:yt,cal:Tt,','{hoy:VistaHoy,semana:yt,cal:Tt,')
HOY=r"""async function VistaHoy(){l.sel||(l.sel=l.today);let e=document.getElementById("body"),g=n=>{l.sel=M(l.sel,n),l.month=l.sel.slice(0,7),l.form=null,VistaHoy()};e.innerHTML=`<div style="max-width:680px;margin:0 auto"><div class="card" style="margin-bottom:12px"><div class="mhead" style="margin:0"><button class="iconbtn" id="pd" aria-label="Día anterior">‹</button><b style="text-transform:none">${l.sel===l.today?"Hoy":p((x=>x[0].toUpperCase()+x.slice(1))(Q(l.sel)))}</b><button class="iconbtn" id="nd" aria-label="Día siguiente">›</button></div>${l.sel!==l.today?'<p style="text-align:center;margin:8px 0 0"><button class="link" id="td">Volver a hoy</button></p>':""}</div><div class="card" id="dayCard"><div class="loading">Cargando…</div></div></div>`;document.getElementById("pd").onclick=()=>g(-1);document.getElementById("nd").onclick=()=>g(1);let t=document.getElementById("td");t&&(t.onclick=()=>{l.sel=l.today,l.month=l.today.slice(0,7),l.form=null,VistaHoy()});await ue()}"""
n3=rep(n3,'function le(){',HOY+'function le(){')

# --- Consentimiento de datos al reservar
CONS='<label class="consent" style="display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.45;color:var(--muted);margin:2px 0 14px;text-align:left;cursor:pointer"><input type="checkbox" id="okdatos" name="consent" value="1" ${n.consent?"checked":""} style="margin-top:2px;width:18px;height:18px;min-height:0;flex:none;padding:0;accent-color:var(--ink)"><span>Acepto que ${v(p.config.business.name)} use mis datos, incluido lo que escriba en el comentario, para gestionar mi hora y enviarme avisos por correo. <a href="privacidad.html" target="_blank" rel="noopener" style="color:inherit">Política de privacidad</a></span></label>\n      '
n2=rep(n2,'<input class="hp" name="website"',CONS+'<input class="hp" name="website"')
n2=rep(n2,'document.getElementById("f").onsubmit=async t=>{t.preventDefault();let a=Object.fromEntries(new FormData(t.target));',
 'document.getElementById("f").onsubmit=async t=>{t.preventDefault();let a=Object.fromEntries(new FormData(t.target));if(!a.consent){p.form=a;_e("Para reservar, marca la casilla aceptando el uso de tus datos.");return}')

# --- Opiniones de pacientes en la página de reservas
OLD_SVC = '<span class="meta"><span class="dur">${n.duration} min</span>${v(n.description||"")}</span></button>`).join("")}</div>`,S.querySelectorAll(".svc")'
NEW_SVC = '<span class="meta"><span class="dur">${n.duration} min</span>${v(n.description||"")}</span></button>`).join("")}</div><div id="opiniones"></div>`,Op(),S.querySelectorAll(".svc")'
n2 = rep(n2, OLD_SVC, NEW_SVC)
OP = open(F('opiniones.js')).read()
n2 = rep(n2, 'function H(){', OP + 'function H(){')

# --- "Mi plan": suscripción con Solís Media
n3=rep(n3,'<button data-tab="perfil">Perfil y redes</button></div>','<button data-tab="perfil">Perfil y redes</button><button data-tab="plan">Mi plan</button></div>')
n3=rep(n3,'{hoy:VistaHoy,semana:yt,','{plan:VistaPlan,hoy:VistaHoy,semana:yt,')
n3=rep(n3,'function le(){',open(F('plan.js')).read()+'function le(){')

# --- Hoy en módulos (libre = blanco, agendada = verde)
n3=rep(n3,'<div class="sec"><h3>Pacientes (${n.length})</h3>','<div id="modCard"></div><div class="sec"><h3>Pacientes (${n.length})</h3>')
n3=rep(n3,'<div style="max-width:680px;margin:0 auto"><div class="card" style="margin-bottom:12px"><div class="mhead"','<div style="max-width:860px;margin:0 auto"><div class="card" style="margin-bottom:12px"><div class="mhead"')
n3=rep(n3,'function Se(){let e=l.day,a=document.getElementById("dayCard");if(!a)return;','function Se(){let e=l.day,a=document.getElementById("dayCard");if(!a)return;queueMicrotask(HoyModulos);')
n3=rep(n3,'(l.showCancelled?e.bookings:n).map(i=>`<div class="bk ${i.status==="cancelled"?"is-cancelled":""}">','(l.showCancelled?e.bookings:n).map(i=>`<div class="bk ${i.status==="cancelled"?"is-cancelled":""}" data-bkrow="${p(i.id)}">')
n3=rep(n3,'l.tab!=="semana"?(l.tab="semana",le()):U()','l.tab==="hoy"?VistaHoy():l.tab!=="semana"?(l.tab="semana",le()):U()')
n3=rep(n3,'function le(){',open(F('modulos.js')).read()+'function le(){')

# --- "Consultar" abre WhatsApp con el servicio escrito (servicios sin precio fijo)
n2=rep(n2,'<span class="price">${v(n.price||"")}</span>','${/consult/i.test(n.price||"")&&String(p.config.business.whatsapp||"").replace(/\\D/g,"")?`<span class="price" data-wa="${v(n.id)}" role="link" tabindex="0" title="Consultar por WhatsApp" style="display:inline-flex;align-items:center;gap:5px;background:#E3F4E8;color:#1E6B3A;border-radius:999px;padding:3px 11px;font-size:13.5px;white-space:nowrap;cursor:pointer"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z"/></svg>Consultar</span>`:`<span class="price">${v(n.price||"")}</span>`}')
n2=rep(n2,'S.querySelectorAll(".svc").forEach(n=>n.onclick=()=>{p.service=e.find(t=>t.id===n.dataset.id),p.time=null,ae()})','S.querySelectorAll(".svc").forEach(n=>n.onclick=()=>{p.service=e.find(t=>t.id===n.dataset.id),p.time=null,ae()}),S.querySelectorAll("[data-wa]").forEach(x=>{let go=ev=>{ev.stopPropagation(),ev.preventDefault();let sv=e.find(t=>t.id===x.dataset.wa),tel=String(p.config.business.whatsapp||"").replace(/\\D/g,"");window.open(`https://wa.me/${tel}?text=${encodeURIComponent(`Hola, quiero consultar por ${sv?sv.name:"un servicio"}.`)}`,"_blank","noopener")};x.onclick=go;x.onkeydown=ev=>{(ev.key==="Enter"||ev.key===" ")&&go(ev)}})')

out=s
out=rep(out,sc[2],n2); out=rep(out,sc[3],n3)
out=rep(out,'<nav class="demo-nav">','<nav class="demo-nav" style="display:none">')
out=rep(out,'var panel = location.hash === "#panel";','var panel = location.hash === "#panel" || !!window.__AGENDA_RESET__;')
out=rep(out,'<p class="foot" id="foot"></p>','<p class="foot" id="foot"></p>\n  <p class="foot"><a href="#panel">Acceso profesional</a> · Hecho por Solís Media</p>')
out=rep(out,'<title>Demo · Agenda online Matrona Eileen Cartes</title>','<title>Agenda online · Matrona Eileen Cartes</title>')
backend=''.join(open(F(n)).read() for n in ['head.js','helpers_a.js','mid.js','helpers_b.js','tail.js'])
inject=('<script>window.AGENDA_BASE='+lit+';\n'
 'window.AGENDA_SUPABASE='+json.dumps({"url":SB_URL,"key":SB_KEY})+';</script>\n'
 '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>\n'
 '<script>'+backend+'</script>')
out=rep(out,'<script>window.AGENDA_DEMO = true;</script>',inject)
os.makedirs(os.path.dirname(os.path.abspath(SALIDA)),exist_ok=True)
open(SALIDA,'w').write(out)
print(len(out))
