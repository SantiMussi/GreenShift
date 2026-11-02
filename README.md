# GreenShift

**Planificador de cómputo consciente del carbono sobre la red eléctrica argentina.**
Demo en vivo para el seminario *Tecnología aplicada a una problemática ambiental* (UADE, Ingeniería Informática).

GreenShift reprograma los trabajos batch de **Nubeo**, una fintech/e-commerce argentina ficticia, para que corran en las horas y regiones con menor intensidad de carbono, sin violar deadlines ni capacidad. Compara contra dos estrategias de referencia y muestra el resultado en una sala de control 3D.

> ⚠️ **Datos simulados.** Los perfiles de intensidad, tarifas, cargas y trabajos son ilustrativos: tienen forma realista pero **no son mediciones**. La interfaz lo indica con la etiqueta "Datos simulados".

---

## Cómo correrlo

Requisitos: **Node.js 20+** y **Python 3.10+** (probado con Node 24 y Python 3.12 en Windows 10). No hace falta internet una vez instaladas las dependencias.

```bash
npm run dev
```

Eso solo, desde la raíz. La primera vez crea el entorno de Python (`backend/.venv`), instala dependencias, siembra la base SQLite y levanta:

| Servicio | URL |
|---|---|
| Interfaz (Next.js) | http://localhost:3000 |
| API (FastAPI) + docs | http://127.0.0.1:8000/docs |

En **Windows** alcanza con hacer doble clic en `iniciar.bat` (en la raíz del proyecto). Chequea Node, Python y los puertos, muestra una barra de progreso mientras compila y arranca, abre http://localhost:3000 cuando está todo listo y deja un menú: `N` abre el navegador, `C` lo abre en modo claro, `L` muestra el registro y `Q` apaga todo. No cierres su ventana mientras uses la demo. Con `GREENSHIFT_NO_BROWSER=1` no abre el navegador solo.

Para **proyectar**, usá el build optimizado (más fluido que el modo desarrollo):

```bash
npm run demo
```

Otros comandos:

| Comando | Qué hace |
|---|---|
| `npm run setup` | Sólo instala y siembra (útil para dejar la notebook lista con internet antes de la expo). |
| `npm test` | Tests del planificador (pytest) + test de humo de la interfaz (vitest). |
| `docker compose up --build` | Alternativa con contenedores (la primera construcción necesita internet). |
| `make dev` / `make demo` / `make test` | Atajos equivalentes para quien tenga `make`. |

Variables opcionales: `API_PORT`, `WEB_PORT`, `GREENSHIFT_SOLVER_LIMIT_S` (límite de CP-SAT, 2,5 s por defecto), `GREENSHIFT_DATA_SOURCE` (`snapshot` | `cammesa_csv`).

### Checklist para el día de la exposición

1. Con internet, una vez: `npm run setup` y `cd frontend && npm run build`.
2. Sin internet, en la sala: `npm run demo` y abrir http://localhost:3000.
3. `F` para pantalla completa. La app arranca en la **intro** (→ avanza); al entrar al centro de control el día simulado arranca de cero. `C` muestra el cierre.
4. Si hay que recargar en plena demo, usá `http://localhost:3000/?intro=0` para no volver a la intro.
5. Si el proyector anda con GPU integrada floja, la escena se degrada sola (menos resolución, sin bloom). Se puede forzar con `?gpu=low`, o la vista 2D con `?gpu=none`.

---

## Pantallas

0. **Intro y cierre** (reemplazan a las slides): tres pantallas antes de entrar — *El problema* (curva de un día en el AMBA con pico y madrugada calculados de los datos), *La idea* (un trabajo que se mueve de las 19 h en AMBA al mejor bloque limpio antes de su deadline, con el % de CO₂ calculado) y *Cómo funciona* (el flujo de la materia). La tecla `C` abre el cierre con los resultados en vivo. Los nombres del grupo se completan en `frontend/lib/team.ts`.
1. **Centro de control**: mapa 3D de Argentina en matriz de puntos teñida por la intensidad de cada región; tres data centers como torres de racks (LEDs grises = carga fija, lima = carga flexible); columnas de partículas cuya **altura** sigue a las emisiones (kg/h) y cuyo **tamaño y color** siguen a la intensidad (g/kWh); **arcos luminosos** con cometas para los trabajos migrados (más intensos cuando se replanifica); **medidores 3D** de CO₂ acumulado "de inmediato" vs "plan verde".
2. **Línea de tiempo**: curvas de intensidad por región alineadas con un Gantt. Barra sólida = plan verde (color de la región donde corre); contorno punteado = dónde habría corrido sin planificar (seleccionable: "de inmediato" o "primera región"). Las barras se reacomodan con animación al replanificar.
3. **Indicadores**: ambientales (CO₂ evitado, % de reducción, huella total), sociales (km de auto y árboles·año equivalentes), económicos (costo, ahorro) y de servicio (deadlines cumplidos, demora de inicio, latencia de red añadida).
4. **Escenarios en vivo** (dock inferior o teclas 1–4): cambian los datos desde la hora actual y CP-SAT replanifica con un aviso visible.
5. **Lado B**: consumo energético del propio planificador, efecto rebote (slider de reinversión del ahorro) y trabajos que no se pudieron mover.
6. **Modo presentación**: pantalla completa, atajos y guion automático.

### Atajos de teclado

| Tecla | Acción |
|---|---|
| `Espacio` | Pausa / reanuda |
| `M` | Cambia de vista (control → línea de tiempo → indicadores → lado B) |
| `1` `2` `3` `4` | Ola de calor · Falla de región · Mucha eólica · Deadlines ajustados |
| `0` | Operación normal |
| `Shift`+`1` / `2` / `4` | Velocidad 1x / 2x / 4x (`V` alterna) |
| `→` `Enter` `Espacio` / `←` | En la intro: siguiente / anterior (también funcionan los controles remotos de presentación); `Esc` la saltea |
| `I` | Volver a la intro |
| `C` | Pantalla de cierre (`Esc` vuelve) |
| `T` | Modo claro / oscuro (se recuerda en el navegador; `?theme=light` o `?theme=dark` lo fuerza). El mapa 3D también cambia (fondo, mapa y servidores en tres tonos bien separados) |
| `D` | Mapa con GreenShift ↔ sin GreenShift ("de inmediato": cada trabajo en su región, sin arcos) |
| `P` | Guion automático de 3 minutos |
| `O` | Objetivo: mínimo CO₂ → CO₂ + costo → mínimo costo |
| `F` | Pantalla completa |
| `R` | Reinicia el ciclo de 48 h |
| `H` | Ayuda de atajos |

---

## Arquitectura: Problema → Datos → Adquisición → Procesamiento → Información → Decisión

```
 PROBLEMA        El cómputo batch corre "cuando llega", muchas veces en el pico nocturno
                 de demanda, cuando la red usa más térmica: más CO₂ por kWh.
     │
 DATOS           Intensidad horaria (g CO₂/kWh), tarifa (USD/kWh), capacidad (kW) y
                 carga fija por región; trabajos con potencia, duración, llegada y deadline.
     │           backend/app/seed.py  →  backend/data/greenshift.db (SQLite)
     │
 ADQUISICIÓN     Capa de datos reemplazable: adaptadores con un contrato común.
                 · SnapshotSource   (SQLite local, siempre disponible, por defecto)
                 · CammesaCsvSource (despacho por tecnología → intensidad; cae al snapshot si falla)
     │           backend/app/adapters/
     │
 PROCESAMIENTO   Motor de simulación (reloj, escenarios, congelamiento del pasado) y
                 planificador CP-SAT + baselines.  backend/app/engine.py, scheduler/
     │
 INFORMACIÓN     Métricas por estrategia y snapshot JSON; tiempo real por SSE
                 (/api/stream: eventos `clock` ~10 Hz y `snapshot` en cada replanificación).
     │
 DECISIÓN        Plan de ejecución (cuándo y dónde corre cada trabajo) + interfaz para
                 que operaciones entienda el trade-off y pruebe escenarios.  frontend/
```

**Stack**: FastAPI + OR-Tools CP-SAT + SQLite en el backend; Next.js 16 (App Router) + TypeScript + Tailwind 4 + componentes estilo shadcn/ui (Radix) + Framer Motion + React Three Fiber/drei/postprocessing + visx + Zustand en el frontend. Tipografías empaquetadas localmente (Archivo y JetBrains Mono vía Fontsource): **cero recursos externos en tiempo de ejecución**.

```
backend/
  app/domain.py          modelo (slots de 30 min, horizonte 48 h)
  app/seed.py            dataset ilustrativo determinístico
  app/db.py              SQLite (siembra y lectura)
  app/adapters/          snapshot local y adaptador CAMMESA (CSV)
  app/scheduler/cpsat.py planificador verde (CP-SAT)
  app/scheduler/baselines.py  "de inmediato" y "primera región disponible"
  app/scheduler/metrics.py    KPIs
  app/scenarios.py       escenarios en vivo
  app/engine.py          reloj, replanificación, SSE
  app/main.py            API
  tests/                 invariantes del planificador + API
frontend/
  components/scene/      escena 3D (mapa, torres, partículas, arcos, medidores) y fallback 2D
  components/charts/     curvas + Gantt (visx)
  components/views/      centro de control, línea de tiempo, indicadores, lado B
  components/presentation/  atajos, guion, subtítulos
  lib/                   store (Zustand), reloj interpolado, formato, geografía
  tests/                 test de humo (vitest + Testing Library)
scripts/dev.mjs          lanzador de un solo comando (multiplataforma)
```

### Modelo de optimización (CP-SAT)

Tiempo discretizado en slots de 30 min (96 en 48 h). Para cada trabajo *j*, región permitida *r* e inicio válido *s* ∈ [llegada, deadline − duración]:

- `x[j,r,s] ∈ {0,1}`: el trabajo arranca en *s* en la región *r*; `skip[j]`: no entra (se reporta, nunca se fuerza).
- **Una sola vez**: Σ x + skip = 1.
- **Capacidad**: Σ potencia·x que cubre el slot *t* ≤ capacidad(r,t) − carga fija(r,t) − lo ya comprometido.
- **Paralelismo**: cantidad de trabajos simultáneos ≤ máximo por región.
- **Deadlines**: se cumplen por construcción (sólo existen variables para inicios válidos).
- **Objetivo**: min Σ c·x + M·Σ skip, con c = α·CO₂/CO₂_ref + (1−α)·costo/costo_ref (α = 0,97 / 0,5 / 0,03 según el objetivo elegido), más un término mínimo de demora y de migración para desempatar. El CO₂ incluye el PUE de cada sitio y la energía de mover los datos de una región a otra.

Al cambiar un escenario se **congela el pasado** (lo que ya arrancó no se mueve) y se replanifica el resto desde la hora actual, para las tres estrategias.

**Baselines**: *de inmediato* (arranca apenas llega en su región de origen; si no hay lugar, espera aunque pierda el deadline) y *primera región disponible* (lo antes posible en la primera región con lugar, en orden AMBA → Córdoba → Neuquén).

### Escenarios

| Escenario | Qué cambia (desde la hora actual) |
|---|---|
| Ola de calor y pico de demanda | +12–26 % de intensidad en AMBA y Córdoba, tarifas ×1,25 (×1,55 en pico), +35 % de tráfico (carga fija), −8 % de capacidad en AMBA por refrigeración y 3 trabajos urgentes. |
| Falla de una región | La región con más carga planificada en las próximas 10 h queda fuera de servicio; su API hace failover a las otras dos y los trabajos en curso se reanudan desde checkpoint. |
| Semana con mucha eólica | Neuquén −45 % de noche y −26 % de día; Córdoba −14 %; AMBA −9 %. |
| Deadlines ajustados | La holgura de los trabajos que todavía no arrancaron cae al 25 %. |

### Capa de datos reemplazable

`GREENSHIFT_DATA_SOURCE=cammesa_csv` lee `backend/data/cammesa/despacho.csv` con columnas `hora,region,tecnologia,mwh` (ver `ejemplo_formato.csv`) y calcula la intensidad horaria como Σ(MWh × factor) / Σ MWh con factores por tecnología. Si el archivo falta o es inválido, **cae al snapshot local** y lo anota. Para conectar otra fuente (un servicio de intensidad de carbono, por ejemplo) alcanza con implementar `load() -> Dataset` en `backend/app/adapters/`.

---

## Tests

```bash
npm test
```

- **Planificador** (`backend/tests/test_scheduler.py`, 26 casos): instancias aleatorias con regiones caídas y deadlines ajustados verifican que el plan verde **nunca** viola deadlines, capacidad (kW), paralelismo ni regiones permitidas, y que cada trabajo se planifica a lo sumo una vez; los baselines respetan capacidad; los trabajos imposibles se reportan en vez de forzarse; y en cada escenario del motor el plan sigue siendo factible y emite menos que "de inmediato".
- **API** (`backend/tests/test_api.py`): estado, escenarios y control.
- **Interfaz** (`frontend/tests/smoke.test.tsx`): carga, centro de control con etiqueta "Datos simulados", fallback 2D sin WebGL, recorrido de las cuatro vistas con `M` y atajos de escenarios y velocidad.

---

## Limitaciones del modelo

- **Intensidades ilustrativas y regionales.** El SADI está interconectado: en la realidad la intensidad que "ve" un data center depende del despacho nacional y de las restricciones de transmisión. Además usamos intensidad **promedio**; para decidir cargas adicionales sería más correcto usar la intensidad **marginal**.
- **Pronóstico perfecto.** El planificador conoce las próximas 48 h de intensidad y tarifas. En la práctica hay que trabajar con pronósticos y replanificar (el motor ya replanifica cuando cambian los datos).
- **Trabajos simplificados**: potencia constante, interrumpibles con checkpoint sin costo, sin dependencias entre trabajos.
- **Transferencia de datos** estimada en 0,02 kWh/GB, sin costo de egreso ni congestión de red. La latencia es un valor fijo por par de regiones.
- **Equivalencias sociales** (0,12 kg CO₂/km de auto, 21 kg CO₂/año por árbol) son aproximadas y sólo sirven para dar escala.
- **Consumo del planificador** estimado (65 W mientras resuelve, 12 W en reposo), no medido.
- **El efecto rebote** se modela con una elasticidad simple (fracción del ahorro reinvertida en más cómputo a la intensidad media del plan).
- Mover cómputo **no reduce el consumo de energía**: reduce el carbono por kWh. La medida más verde sigue siendo no correr lo innecesario.

---

## Decisiones tomadas ante ambigüedades

- **Teclas 1/2/4 vs 1–4.** El pedido asigna los números tanto a velocidad como a escenarios. Elegimos **números = escenarios** (es lo que más se usa en vivo) y **Shift + número = velocidad** (además `V` alterna). Se lee por `KeyboardEvent.code`, así funciona igual con teclado en español.
- **"M cambia modo"** se interpretó como **cambiar de vista** (control → línea de tiempo → indicadores → lado B). El objetivo del optimizador (CO₂ / mixto / costo) quedó en la tecla `O`.
- **Tiempo de simulación**: 48 h en slots de 30 min; a 1x, 1 h simulada = 3,75 s, así el ciclo completo dura exactamente los 3 minutos del guion. Al terminar el ciclo vuelve a empezar en operación normal.
- **Escenarios exclusivos**: elegir uno reemplaza al anterior hacia adelante; lo ya ocurrido queda congelado.
- **Falla de región**: cae la región con más carga planificada en las próximas 10 h (así la falla siempre "duele"), en lugar de una fija.
- **Reloj del lado del servidor**: el backend es la fuente de verdad del tiempo (SSE); el cliente interpola a 60 fps. El reloj se detiene mientras CP-SAT replanifica (máx. 2,5 s), y eso se muestra como "Replanificando".
- **CP-SAT con límite de tiempo**: si no prueba optimalidad en 2,5 s devuelve la mejor solución factible y la interfaz lo dice ("factible" en vez de "óptimo"). El plan inicial se cachea porque es determinístico.
- **Etiquetas 3D como DOM proyectado** en vez de `<Html>` de drei: menos raíces de React, sin errores de desmontaje y mejor rendimiento.
- **three 0.186** (no 0.187) por compatibilidad de *peer dependencies* con `postprocessing`; **TypeScript 5.9** porque TS 7 todavía no es compatible con el chequeo de tipos de Next.
- **shadcn/ui**: los componentes se escribieron con el patrón de shadcn (Radix + CVA + `cn`) en `components/ui/`, sin el CLI, para no depender de internet ni de prompts interactivos.
- **Malvinas** incluidas en el mapa, como en la cartografía oficial argentina. El contorno es simplificado y no es cartografía oficial.
