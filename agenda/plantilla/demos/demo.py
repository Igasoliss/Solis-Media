"""Arma una DEMO de la agenda (mismo diseño y funciones que la plantilla, con datos de ejemplo
guardados en el navegador; no usa Supabase ni envía correos).
Uso:  python3 demos/demo.py demos/rubros/barberia.json ../demo/barberia/index.html
"""
import re, json, os, sys, base64
AQUI = os.path.dirname(os.path.abspath(__file__))
CFG_PATH, SALIDA = sys.argv[1], sys.argv[2]
cfg = json.load(open(CFG_PATH))

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
    'demoKey': 'demo-' + cfg['id'] + '-v1', 'demoDensity': cfg.get('density', .05), 'demoPastDensity': .3,
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
out = rep(out, '>Panel de Eileen</a>', '>Panel del profesional</a>' if cfg.get('gente') != 'pacientes_f' and cfg.get('gente') != 'clientas' else '>Panel de la profesional</a>')
out = rep(out, '>Agenda para pacientes</a>', '>Agenda para ' + {'clientes': 'clientes', 'clientas': 'clientas'}.get(cfg.get('gente'), 'pacientes') + '</a>')
out = out.replace('background:#4E2145;color:#fff', f'background:{biz["ink"]};color:#fff').replace('color:#4E2145}', f'color:{biz["ink"]}}}')
out = out.replace('.demo-nav a.on{background:#F6BDE0', f'.demo-nav a.on{{background:{biz["accent"]}')
out = out.replace(' <a href="privacidad.html" target="_blank" rel="noopener" style="color:inherit">Política de privacidad</a>', '')
out = rep(out, '<p class="foot" id="foot"></p>', '<p class="foot" id="foot"></p>\n  <p class="foot">Agenda de demostración · Hecha por <a href="https://solismedia.cl">Solís Media</a></p>')
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
