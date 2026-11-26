"""Arma una DEMO de la agenda (mismo diseño y funciones que la plantilla, con datos de ejemplo
guardados en el navegador; no usa Supabase ni envía correos).
Uso:  python3 demos/demo.py demos/rubros/barberia.json ../demo/barberia/index.html
"""
import re, json, os, sys, base64
AQUI = os.path.dirname(os.path.abspath(__file__))
CFG_PATH, SALIDA = sys.argv[1], sys.argv[2]
cfg = json.load(open(CFG_PATH))
# Variante de colores opcional: demo.py cfg.json salida.html '{"ink":"#..","accent":"#..","bg":"#.."}'
if len(sys.argv) > 3: cfg['business'].update(json.loads(sys.argv[3]))

# Reutiliza construir.py tal cual (todas las mejoras de la plantilla) hasta el ensamblado final
src = open(os.path.join(AQUI, '..', 'construir.py')).read()
src = src[:src.index('\nout=s\n')]
g = {'__file__': os.path.join(AQUI, '..', 'construir.py'), '__name__': 'construir'}
sys_argv = sys.argv; sys.argv = ['x', 'https://demo.local', 'demo', '/dev/null']
exec(compile(src, 'construir.py', 'exec'), g)
sys.argv = sys_argv
s, sc, n2, n3, rep = g['s'], g['sc'], g['n2'], g['n3'], g['rep']

# Volver a usar el backend de demostración del diseño (localStorage), con rutas extra
for orig, name in ((sc[2], 'n2'), (sc[3], 'n3')):
    m = re.search(r'if\(window\.AGENDA_DEMO\)return(\(await Promise\.resolve\(\)\.then\(\(\)=>\(\w+\(\),\w+\)\)\))\.handle\(e,', orig)
    code = g[name] if name == 'n2' else n3
    new = rep(n2 if name == 'n2' else n3, 'return window.AGENDA_API(e,',
              'if(window.DEMO_EXTRA){let __x=window.DEMO_EXTRA(e);if(__x)return __x}return' + m.group(1) + '.handle(e,')
    if name == 'n2': n2 = new
    else: n3 = new

# Datos del negocio
biz = dict(cfg['business'])
foto = biz.pop('photo_file', None)
if foto:
    p = os.path.join(os.path.dirname(os.path.abspath(CFG_PATH)), foto)
    biz['photo'] = 'data:image/jpeg;base64,' + base64.b64encode(open(p, 'rb').read()).decode()
conf = {
    'business': biz,
    'demoReviewComments': cfg['reviews'], 'demoNames': cfg['names'],
    'demoKey': 'demo-' + cfg['id'] + '-v' + str(cfg.get('dataVersion', 1)), 'demoDensity': cfg.get('density', .05), 'demoPastDensity': .3,
    'timezone': 'America/Santiago', 'daysAhead': 30, 'slotStep': cfg.get('slotStep', 15),
    'minNoticeMinutes': 60, 'holdMinutes': 30, 'reminderHoursBefore': 24, 'reviewDelayHours': 3,
    'googleReviewUrl': '', 'services': cfg['services'], 'hours': cfg['hours'],
}
LIT = json.dumps(conf, ensure_ascii=False)
for name, var in (('n2', 'b'), ('n3', 'w')):
    code = n2 if name == 'n2' else n3
    i = code.index(var + '={business:'); k = i + len(var) + 1; d = 0
    for j in range(k, len(code)):
        d += {'{': 1, '}': -1}.get(code[j], 0)
        if d == 0: break
    code = code[:i] + var + '=' + LIT + code[j + 1:]
    if name == 'n2': n2 = code
    else: n3 = code

# Cómo se le dice a quien reserva (pacientes / clientes / clientas)
VOC = {
  'pacientes_f': [],
  'pacientes': [('otras pacientes', 'otros pacientes'), ('otra paciente', 'otro paciente'), ('tus pacientes', 'tus pacientes')],
  'clientes': [('otras pacientes', 'otros clientes'), ('otra paciente', 'otro cliente'), ('Pacientes', 'Clientes'), ('pacientes', 'clientes'), ('paciente', 'cliente')],
  'clientas': [('Pacientes', 'Clientas'), ('pacientes', 'clientas'), ('paciente', 'clienta')],
}[cfg.get('gente', 'pacientes_f')]
for a, b in VOC:
    n2 = n2.replace(a, b); n3 = n3.replace(a, b)
# mensajes de PlanesSM se quedan igual (hablan del producto)

out = s
out = rep(out, sc[2], n2); out = rep(out, sc[3], n3)
nom = biz['name']
out = rep(out, '<title>Demo · Agenda online Matrona Eileen Cartes</title>', f'<title>Demo · Agenda online {nom}</title>')
out = rep(out, "<span>Demo preparada por Solís Media para Matrona Eileen Cartes</span>", f"<span><a href=\"../\" style=\"color:inherit;padding:0;background:none\">‹ Demos</a> · {cfg['rubro']}</span>")
out = rep(out, '>Panel de Eileen</a>', '>' + cfg['panel'] + '</a>') if cfg.get('panel') else rep(out, '>Panel de Eileen</a>', '>Panel del profesional</a>' if cfg.get('gente') != 'pacientes_f' and cfg.get('gente') != 'clientas' else '>Panel de la profesional</a>')
out = rep(out, '>Agenda para pacientes</a>', '>Agenda para ' + {'clientes': 'clientes', 'clientas': 'clientas'}.get(cfg.get('gente'), 'pacientes') + '</a>')
out = out.replace('background:#4E2145;color:#fff', f'background:{biz["ink"]};color:#fff').replace('color:#4E2145}', f'color:{biz["ink"]}}}')
out = out.replace('.demo-nav a.on{background:#F6BDE0', f'.demo-nav a.on{{background:{biz["accent"]}')
out = out.replace(' <a href="privacidad.html" target="_blank" rel="noopener" style="color:inherit">Política de privacidad</a>', '')
out = rep(out, '<p class="foot" id="foot"></p>', '<p class="foot" id="foot"></p>\n  <p class="foot">Agenda de demostración · Desarrollada por <a href="https://solismedia.cl">www.solismedia.cl</a></p>')
# Foto más grande y nombre con tipografía más sofisticada
out = out.replace('</style>', '\n.head .mark{width:78px;height:78px;border-radius:24px;font-size:26px}.head p{margin-top:4px}\n</style>', 1)
out = rep(out, '<button class="svc" data-id="${v(n.id)}">', '<button class="svc${n.photo?" hasimg":""}" data-id="${v(n.id)}">${n.photo?`<img class="svcimg" src="${(window.GFOTO||{})[n.photo]||""}" alt="" loading="lazy">`:""}')
out = out.replace('</style>', '.svc.hasimg{grid-template-columns:72px 1fr auto;column-gap:14px}.svc .svcimg{grid-row:1/span 2;width:72px;height:72px;border-radius:14px;object-fit:cover;align-self:center;background:var(--accent)}.svc.hasimg .meta{grid-column:2/-1}\n</style>', 1)
# Si el día elegido de entrada no tiene horas (p. ej. hoy ya lleno), pasar solo al siguiente día con horas
out = rep(out, 'S.querySelector(".day.sel")?.scrollIntoView({block:"nearest",inline:"nearest"}),$e()}', 'S.querySelector(".day.sel")?.scrollIntoView({block:"nearest",inline:"nearest"}),window.__auto=20,$e()}')
out = rep(out, "if(!t.length){e.innerHTML='<div class=\"empty\">", "if(!t.length&&window.__auto>0){window.__auto--;let nx=S.querySelector(\".day.sel\")?.nextElementSibling;if(nx){nx.click();nx.scrollIntoView({block:\"nearest\",inline:\"nearest\"});return}}window.__auto=0;if(!t.length){e.innerHTML='<div class=\"empty\">")
# Galería de fotos del lugar (opcional): al lado de la agenda en computador, en fila deslizable en celular
gal = cfg.get('gallery')
if gal:
    import html as H
    carpeta = os.path.dirname(os.path.abspath(CFG_PATH))
    def uri(f):
        tipo = 'webp' if f.endswith('.webp') else 'jpeg'
        return f'data:image/{tipo};base64,' + base64.b64encode(open(os.path.join(carpeta, f), 'rb').read()).decode()
    figs = ''.join(f'<button type="button" class="gph" aria-label="Ver foto: {H.escape(p["alt"])}"><img src="{uri(p["file"])}" alt="{H.escape(p["alt"])}" loading="lazy"></button>' for p in gal['photos'])
    bloque = (f'<aside class="galeria" aria-label="{H.escape(gal["title"])}"><h2>{H.escape(gal["title"])}</h2>'
              f'<div class="gfotos">{figs}</div>' + (f'<p class="gcred">{H.escape(gal["credit"])}</p>' if gal.get('credit') else '') + '</aside>')
    out = rep(out, '<div class="socials" id="socials"></div>', '<div class="socials" id="socials"></div>\n  ' + bloque)
    # Fotos dentro de cada servicio (campo "photo" del servicio = archivo de la galería)
    usadas = {sv['photo'] for sv in cfg['services'] if sv.get('photo')}
    if usadas:
        mapa = json.dumps({f: uri(f) for f in usadas})
        out = rep(out, '<script>window.AGENDA_DEMO = true;', '<script>window.GFOTO=' + mapa + ';</script>\n<script>window.AGENDA_DEMO = true;')
    out = out.replace('</style>', '''
.galeria{margin:0 0 20px}.galeria h2{font-size:15px;margin:0 0 10px;letter-spacing:.01em}
.gfotos{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:4px;margin:0 -16px;padding-left:16px;padding-right:16px;scrollbar-width:none}
.gfotos::-webkit-scrollbar{display:none}
.gph{flex:none;width:128px;aspect-ratio:9/14;padding:0;border:0;border-radius:18px;overflow:hidden;background:var(--accent);cursor:zoom-in;scroll-snap-align:start;box-shadow:0 6px 18px rgba(0,0,0,.08)}
.gph img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s}.gph:hover img{transform:scale(1.04)}
.gcred{font-size:12.5px;opacity:.65;margin:8px 0 0}
.gbox{position:fixed;inset:0;z-index:50;background:rgba(10,20,15,.86);display:flex;align-items:center;justify-content:center;padding:20px;cursor:zoom-out}
.gbox img{max-width:100%;max-height:100%;border-radius:16px}
@media (min-width:1000px){
 .wrap{max-width:1000px;display:grid;grid-template-columns:330px minmax(0,580px);column-gap:40px;justify-content:center;align-items:start}
 .wrap>*{grid-column:2}
 .wrap>.galeria{grid-column:1;grid-row:1/span 6;position:sticky;top:24px;margin:0}
 .galeria h2{font-size:17px}
 .gfotos{display:grid;grid-template-columns:1fr 1fr;overflow:visible;margin:0;padding:0}
 .gph{width:auto}
}
</style>''', 1)
    out = out.replace('</body>', '<script>document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest(".gph");if(b){var d=document.createElement("div");d.className="gbox";d.innerHTML="<img alt=\'\'>";d.firstChild.src=b.querySelector("img").src;d.onclick=function(){d.remove()};document.body.appendChild(d)}});document.addEventListener("keydown",function(e){if(e.key==="Escape"){var d=document.querySelector(".gbox");if(d)d.remove()}})</script>\n</body>', 1)
# Instagram y web de ejemplo: se ven, pero no llevan a ninguna parte
out = out.replace('</body>', '<script>document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a.soc");if(a&&!/wa\\.me/.test(a.href))e.preventDefault()},true)</script>\n</body>', 1)
PLAN = {"plan": {"plan": "agenda", "estado": "prueba", "desde": None, "proximo_cobro": None, "monto": 24990, "link_pago": None, "nota": "Demo: así ves tu suscripción."}}
OPS = [{"nombre": n, "rating": r, "comment": c} for n, r, c in zip(cfg['names'], [5, 5, 5, 4, 5, 5], cfg['reviews'])]
prom = round(sum(o['rating'] for o in OPS) / len(OPS), 1)
extra = ('<script>window.AGENDA_DEMO = true;window.DEMO_EXTRA=function(u){u=String(u);'
         'if(u.indexOf("/api/opiniones")===0)return Promise.resolve(' + json.dumps({"total": 23, "promedio": prom, "items": OPS}, ensure_ascii=False) + ');'
         'if(u.indexOf("/api/admin/plan")===0)return Promise.resolve(' + json.dumps(PLAN) + ');return null};</script>')
out = rep(out, '<script>window.AGENDA_DEMO = true;</script>', extra)
assert 'Eileen' not in out and '74813574' not in out, 'quedaron datos de Eileen'
os.makedirs(os.path.dirname(os.path.abspath(SALIDA)), exist_ok=True)
open(SALIDA, 'w').write(out)
print(cfg['id'], len(out))
