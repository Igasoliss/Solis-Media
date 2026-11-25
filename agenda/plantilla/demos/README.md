# Demos por rubro

Demos de la agenda con datos de ejemplo. Usan la misma plantilla (todas las funciones),
pero guardan todo en el navegador: no usan Supabase ni envían correos.
El botón Consultar y WhatsApp llevan al número de Solís Media.

Publicadas en `solismedia.cl/demos/` (carpeta `demos/` en la raíz del repo).

Crear o cambiar una demo: edita o copia un archivo de `rubros/` y corre

```
python3 demos/demo.py demos/rubros/barberia.json ../../demos/barberia/index.html
```

Campos: `business` (nombre, colores ink/accent/bg, `photo_file` opcional), `services`
(precio "Consultar" abre WhatsApp), `hours`, `names` y `reviews` (opiniones de ejemplo),
`gente` (pacientes_f, pacientes, clientes o clientas). Si agregas un rubro, súmalo también
a `demos/index.html`.
