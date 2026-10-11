# CNS — Stats Fútbol Sala PWA

## Qué es esto

Aplicación single-file HTML (`index.html`, ~12.000 líneas, ~580 KB) para tracking en vivo de partidos de fútbol sala. Uso propio del entrenador (Toni) del CN Sabadell 2ªB. Deployed en `https://tonimu.github.io/stats-futsal/`.

Sin build step, sin framework, JS vanilla, CSS vanilla, HTML embebido en el mismo fichero. Todo es un único `index.html`.

---

## Reglas duras

1. **Un único `index.html`**. No dividir en múltiples archivos. No introducir bundlers.
2. **Sin dependencias externas**. No npm packages en runtime, no CDNs. Todo embebido.
3. **Preservar backward compatibility del modelo de datos**. Los usuarios tienen partidos guardados en IndexedDB. Cualquier cambio al schema necesita migración silenciosa en `ensureMatchShape` / `ensurePlayerShape` / etc.
4. **Validar sintaxis antes de dar por bueno un cambio**:
```bash
   node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf-8');const s=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)];s.forEach((m,i)=>fs.writeFileSync('/tmp/s'+i+'.js',m[1]));" && for f in /tmp/s*.js; do node --check "$f" || exit 1; done && echo "Sintaxis OK"
```
5. **Prefer `str_replace` sobre reescribir bloques grandes**. Edits quirúrgicos.
6. **Comentarios de código en inglés**. Interacciones conmigo en **español**.
7. **No romper features existentes** cuando añades otras.

---

## Arquitectura

- **UI**: HTML embebido con secciones `.view` ocultas/mostradas por el sidebar (navtabs). Cada view tiene su `#view-<nombre>`.
- **Estado en memoria**: objeto global `state = { roster, staff, match, history, activities, attendanceByActivity, ... }`.
- **Persistencia**: IndexedDB (`cns-stats-db`), stores: matches, events, roster, staff, activities, attendance, subs.
- **PWA**: service worker (`sw.js`) para funcionar offline.
- **Renderizado**: funciones `render*` que leen de `state` y escriben al DOM. `renderAll()` las orquesta todas.

### Vistas (sidebar)

- **Partido** (`view-match`): pista con 5 slots, banquillo, panel de acciones, log.
- **Estadísticas** (`view-stats`): tabla por jugador + filtros globales.
- **Top Stats** (`view-chem`): rankings por categoría (positivos, negativos, penaltis, quintets).
- **Stats x Jugador** (`view-playerStats`): detalle de un jugador con rankings "Xº de N".
- **Jugadores** (`view-roster`), **Staff** (`view-staff`), **Asistencia** (`view-attendance`), **Historial** (`view-history`).

---

## Modelo de datos

### Stores de IndexedDB

- **matches**: `{id, date, opponent, competition, venue, scoreFor, scoreAgainst, onCourt, rosterSnapshot, status, timer, mvpPlayerId, juego5For, juego5Against, attackDefenseActive, attackDefensePairs, expelledPlayers, sanctions, ...}`
- **events**: `{id, matchId, type, playerId, time, period, onCourt, juego5For, juego5Against, atkDef, ...typeSpecific}`
- **roster**: `{id, name, alias, number, position, isGK, traits, birthDate, team}`
- **staff**, **activities**, **attendance** (`attendanceByActivity[activityId]`), **subs**.

### Tipos de evento

- `chance`, `opp_chance`: `result: 'gol' | 'parada' | 'fuera'`
- `penalty`: 2 filas (Provoca+Tira / Comete+Portero)
- `recovery`, `loss`, `foul`, `opp_foul`
- `yellow`, `red` (propias); `opp_card` con `{cardType, oppNumber}` para rivales (NO afecta stats)
- `assist_goal`, `assist_nogoal`
- `duel_off_won|lost`, `duel_def_won|lost`
- `sub`: `{playerId (entra), playerOutId (sale), slot}`

### Flags del evento

- `atkDef`: modo Ataque/Defensa activo
- `juego5For` / `juego5Against`: jugábamos (o rival) de 5
- `onCourt`: snapshot de los 5 en pista al momento

---

## Features clave

### Partido en vivo
- Slots: Portero (0), Cierre (1), Ala (2), Ala (3), Pívot (4). Orden importa.
- Panel de acciones. Fila 8: Amarilla/Roja rival (keypad numérico para dorsal).
- Log en vivo: últimos 50 eventos. En modo edición histórica muestra TODOS.
- Reloj: cuenta atrás (20 min/parte). `absoluteMatchTime()` cross-period.

### Modo Ataque/Defensa
- Hasta 4 parejas (`MAX_ATKDEF_PAIRS = 4`).
- Wizard 3 pasos: pista → rol → banco.
- Timer por pareja. Panel naranja encima del banquillo.

### Convocatorias
- Convocado = `convocado: true AND asistencia: true` (incluye Tarde).
- Helpers: `getConvokedPlayerIds()`, `convokedIdsForMatch(m)`, `convokedIdsForMatches(ms)`.
- Filtros de informes por equipo: `Senior A` / `Senior B` / `Juvenil Nacional`.

### Historial
- **📋 Ver log**: modal read-only con filtros + copiar al portapapeles.
- **🔓 Editar**: carga partido como `state.match` con `_editingHistorical: true`. Banner amarillo. Al terminar recomputa scoreFor/scoreAgainst desde events.
- Durante edición histórica: reloj bloqueado, "Fin de parte" bloqueado.

### Stats x Jugador
- Dropdown jugador + mismos filtros que Top Stats.
- Rankings competition ranking (empates comparten puesto).
- Divisor 0 (0 partidos/0 min) en perMatch/perTime se excluye.
- Fila estilo Estadísticas al final.

### Export / Import
- JSON completo con todo.
- CSV: informes de asistencia (detallado, mensual).
- Crónica WhatsApp con MVP picker.

---

## Convenciones

### Código
- Comentarios en inglés, breves. El POR QUÉ, no el QUÉ.
- Funciones: `render*`, `compute*`, `load*`, `save*`, `open*Modal`, `close*Modal`.
- `saveCurrentMatch()` tras modificar `state.match`. `renderAll()` tras cambio visible.

### CSS / UI
- Colores: verde #16a34a positivo, rojo #dc2626 negativo, naranja #ea580c AtqDef, morado #a855f7 J5, cyan #0891b2 secundario, ámbar #fbbf24 edición histórica.
- Botones: `.btn` + `.btn-primary|ghost|danger|tiny`.
- Chips: `.filter-chip` + `.active`. Modales: `.modal-backdrop` + `.modal`.
- Badges equipo: `.team-badge-senior-a` (verde), `-senior-b` (azul), `-juvenil-nacional` (ámbar).
- Tiempo: `formatCountdown(seconds)` → "MM:SS".

### Datos
- IDs: `'p_'`+timestamp+random (players), `'m_'` matches, `'e_'` events, `'a_'` activities.
- Fechas: ISO `YYYY-MM-DD`.

---

## Workflow de desarrollo

### Validar sintaxis
```bash
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf-8');const s=[...h.matchAll(/<script>([\s\S]*?)<\/script>/g)];s.forEach((m,i)=>fs.writeFileSync('/tmp/s'+i+'.js',m[1]));" && for f in /tmp/s*.js; do node --check "$f" || exit 1; done && echo "Sintaxis OK"
```

### Previsualizar en local
```bash
npx serve .
# abrir http://localhost:3000
```

### Deploy a producción
```bash
git add index.html
git commit -m "feat: descripción"
git push
# ~30s después en https://tonimu.github.io/stats-futsal/
```

### Backup de datos
Antes de cambios arriesgados, exportar JSON desde la app.

---

## Gotchas comunes

- **`state.match`** es el activo O el que se está editando desde historial (`_editingHistorical: true`). **`state.history[]`** son resúmenes de finalizados.
- **`_matchDataCache`**: cache en memoria. Invalidar con `invalidateMatchDataCache(matchId)` tras editar histórico.
- **`buildEventTableRow(evt, opts)`** acepta `{matchEventsOverride, readOnly}` para reutilizar en log del historial.
- **`statsFilters`** compartido entre Estadísticas / Top Stats / Stats x Jugador.
- **`opp_card`** no se cuenta en stats del equipo (agregaciones filtran por `yellow|red` puros).
- **Doble amarilla** = expulsión. Igual para dorsal rival.
- **Reloj no corre** en modo edición histórica. Play avisa y bloquea.

---

## Al añadir una feature pensar en

1. ¿Partidos ya guardados sin el nuevo campo? → migración en `ensure*Shape`.
2. ¿Invalidar cache de stats?
3. ¿Afecta al JSON export/import?
4. ¿Debe funcionar también en edición histórica?
5. ¿Algún filtro de `statsFilters` que respetar?

---

## Comunicación con Toni

- Responder en español.
- Explicar QUÉ hice y POR QUÉ brevemente al final.
- Validar sintaxis antes de decir "listo".
- Si ambiguo, preguntar con 1-3 opciones concretas antes de asumir.
- Iteraciones pequeñas: implementar → probar → refinar.
