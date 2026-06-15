const DATA_PATH = './js/data/';

// Variables globales para almacenar la matriz de datos cargada
let dbPartidos = [];
let dbEquiposMaestro = [];

// Función auxiliar para cargar el JSON matriz una sola vez
async function cargarMatrizCentral(ligaId) {
    if (dbPartidos.length > 0) return; // Ya está en memoria
    const res = await fetch(`${DATA_PATH}${ligaId}_partidos.json`);
    const data = await res.json();
    dbPartidos = data.partidos;
    dbEquiposMaestro = data.equipos_maestro;
}

// ==========================================
// 1. HOME (index.html) - Igual que antes
// ==========================================
async function initHome() {
    const selectLiga = document.getElementById('liga-select');
    const btnIngresar = document.getElementById('btn-ingresar');
    try {
        const res = await fetch(`${DATA_PATH}ligas.json`);
        const data = await res.json();
        selectLiga.innerHTML = '';
        data.ligas.forEach(liga => {
            const option = document.createElement('option');
            option.value = liga.id; option.textContent = liga.nombre;
            selectLiga.appendChild(option);
        });
        btnIngresar.addEventListener('click', () => {
            const id = selectLiga.value;
            const txt = selectLiga.options[selectLiga.selectedIndex].text;
            if(id) {
                localStorage.setItem('liga_activa_id', id);
                localStorage.setItem('liga_activa_nombre', txt);
                window.location.href = 'posiciones.html';
            }
        });
    } catch (e) { selectLiga.innerHTML = '<option>Error</option>'; }
}

// ==========================================
// 2. PROCESADOR AUTOMÁTICO DE ESTADÍSTICAS
// ==========================================
function calcularTablaPosiciones() {
    // Inicializar objeto de estadísticas por cada equipo
    let tabla = {};
    dbEquiposMaestro.forEach(eq => {
        tabla[eq.id] = { id: eq.id, nombre: eq.nombre, pts: 0, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0 };
    });

    // Procesar cada partido jugado
    dbPartidos.forEach(p => {
        if (!p.jugado) return;

        const loc = p.equipo_local;
        const vis = p.equipo_visitante;
        const gl = p.goles_local;
        const gv = p.goles_visitante;

        tabla[loc].pj++; tabla[vis].pj++;
        tabla[loc].gf += gl; tabla[loc].gc += gv;
        tabla[vis].gf += gv; tabla[vis].gc += gl;

        if (gl > gv) {
            tabla[loc].pts += 3; tabla[loc].pg++; tabla[vis].pp++;
        } else if (gv > gl) {
            tabla[vis].pts += 3; tabla[vis].pg++; tabla[loc].pp++;
        } else {
            tabla[loc].pts += 1; tabla[vis].pts += 1;
            tabla[loc].pe++; tabla[vis].pe++;
        }
    });

    // Calcular diferencia de gol y convertir a Array
    let tablaArray = Object.values(tabla).map(eq => {
        eq.dg = eq.gf - eq.gc;
        return eq;
    });

    // Ordenar por Puntos, luego Diferencia de Gol, luego Goles a Favor
    return tablaArray.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
}

// ==========================================
// 3. POSICIONES (posiciones.html)
// ==========================================
async function initPosiciones() {
    const ligaId = localStorage.getItem('liga_activa_id');
    const ligaNombre = localStorage.getItem('liga_activa_nombre') || 'Torneo';
    if (!ligaId) { window.location.href = 'index.html'; return; }

    document.getElementById('torneo-titulo').textContent = `🏆 ${ligaNombre}`;
    
    await cargarMatrizCentral(ligaId);
    const tablaOrdenada = calcularTablaPosiciones();

    // Renderizar Tabla
    const tbody = document.getElementById('tabla-posiciones-body');
    tbody.innerHTML = '';
    tablaOrdenada.forEach((eq, index) => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${index + 1}</strong></td>
                <td class="text-left">${eq.nombre}</td>
                <td><strong>${eq.pts}</strong></td>
                <td>${eq.pj}</td>
                <td>${eq.pg}</td>
                <td>${eq.pe}</td>
                <td>${eq.pp}</td>
                <td>${eq.gf}</td>
                <td>${eq.gc}</td>
                <td>${eq.dg > 0 ? '+' + eq.dg : eq.dg}</td>
            </tr>`;
    });

    // Renderizar Fixture General abajo
    renderizarFixtureGeneral();
}

function renderizarFixtureGeneral() {
    const contenedor = document.getElementById('fixture-container');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    // Agrupar partidos por fecha
    let fechas = {};
    dbPartidos.forEach(p => {
        if (!fechas[p.fecha]) fechas[p.fecha] = [];
        fechas[p.fecha].push(p);
    });

    Object.keys(fechas).forEach(numFecha => {
        let htmlFecha = `<div class="fecha-bloque"><div class="fecha-titulo">Fecha ${numFecha}</div>`;
        fechas[numFecha].forEach(p => {
            const nomLocal = dbEquiposMaestro.find(e => e.id === p.equipo_local).nombre;
            const nomVis = dbEquiposMaestro.find(e => e.id === p.equipo_visitante).nombre;
            const resultado = p.jugado ? `${p.goles_local} - ${p.goles_visitante}` : "vs";
            
            htmlFecha += `
                <div class="partido-card">
                    <span class="partido-equipo local">${nomLocal}</span>
                    <span class="partido-resultado">${resultado}</span>
                    <span class="partido-equipo visitante">${nomVis}</span>
                </div>`;
        });
        htmlFecha += `</div>`;
        contenedor.innerHTML += htmlFecha;
    });
}

// ==========================================
// 4. EQUIPOS Y JUGADORES (equipos.html)
// ==========================================
async function initEquipos() {
    const ligaId = localStorage.getItem('liga_activa_id');
    const ligaNombre = localStorage.getItem('liga_activa_nombre') || 'Torneo';
    if (!ligaId) { window.location.href = 'index.html'; return; }

    document.getElementById('torneo-titulo-equipos').textContent = `🏆 ${ligaNombre}`;
    
    await cargarMatrizCentral(ligaId);

    // Rellenar selector de equipos
    const selectEquipo = document.getElementById('equipo-select');
    selectEquipo.innerHTML = '';
    dbEquiposMaestro.forEach(eq => {
        const option = document.createElement('option');
        option.value = eq.id; option.textContent = eq.nombre;
        selectEquipo.appendChild(option);
    });

    selectEquipo.addEventListener('change', (e) => { renderizarFichaEquipo(e.target.value); });
    
    if(dbEquiposMaestro.length > 0) {
        renderizarFichaEquipo(dbEquiposMaestro[0].id);
    }

    renderizarTopGoleadoresYAsistencias();
}

function renderizarFichaEquipo(equipoId) {
    const equipo = dbEquiposMaestro.find(e => e.id === equipoId);
    document.getElementById('nombre-equipo-header').textContent = equipo.nombre;

    // 1. Calcular Goles y Asistencias individuales del equipo desde los eventos
    let estadisticasJugadoras = {};
    
    dbPartidos.forEach(p => {
        if (!p.jugado) return;
        // Goles
        p.eventos.goles.forEach(g => {
            if (g.equipo === equipoId) {
                if (!estadisticasJugadoras[g.jugadora]) estadisticasJugadoras[g.jugadora] = { goles: 0, asistencias: 0 };
                estadisticasJugadoras[g.jugadora].goles++;
            }
        });
    });


    const tbody = document.getElementById('tabla-plantel-body');
    tbody.innerHTML = '';
    
    const jugadorasLista = Object.keys(estadisticasJugadoras);
    if(jugadorasLista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center">Sin eventos cargados para este equipo.</td></tr>`;
    } else {
        jugadorasLista.forEach(nom => {
            tbody.innerHTML += `
                <tr>
                    <td class="text-left">${nom}</td>
                    <td>${estadisticasJugadoras[nom].goles}</td>
                </tr>`;
        });
    }

    // 2. Renderizar Historial de Partidos de este equipo en particular
    const contenedorHistorial = document.getElementById('historial-equipo-container');
    if (contenedorHistorial) {
        contenedorHistorial.innerHTML = '';
        dbPartidos.forEach(p => {
            if (p.equipo_local === equipoId || p.equipo_visitante === equipoId) {
                const nomLocal = dbEquiposMaestro.find(e => e.id === p.equipo_local).nombre;
                const nomVis = dbEquiposMaestro.find(e => e.id === p.equipo_visitante).nombre;
                const resultado = p.jugado ? `${p.goles_local} - ${p.goles_visitante}` : "vs";
                
                contenedorHistorial.innerHTML += `
                    <div class="partido-card">
                        <span class="partido-equipo local">${nomLocal}</span>
                        <span class="partido-resultado">${resultado}</span>
                        <span class="partido-equipo visitante">${nomVis}</span>
                    </div>`;
            }
        });
    }
}

function renderizarTopGoleadoresYAsistencias() {
    let globalGoleadores = {};
    
    dbPartidos.forEach(p => {
        if (!p.jugado) return;
        p.eventos.goles.forEach(g => {
            if (!globalGoleadores[g.jugadora]) globalGoleadores[g.jugadora] = { nombre: g.jugadora, equipoId: g.equipo, goles: 0 };
            globalGoleadores[g.jugadora].goles++;
        });
    });

    let listaGoleadores = Object.values(globalGoleadores).sort((a,b) => b.goles - a.goles).slice(0, 10);
    const tbody = document.getElementById('tabla-goleadores-body');
    tbody.innerHTML = '';

    if(listaGoleadores.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center">No hay goles registrados.</td></tr>`;
        return;
    }

    listaGoleadores.forEach((jug, index) => {
        const nomEquipo = dbEquiposMaestro.find(e => e.id === jug.equipoId).nombre;
        tbody.innerHTML += `
            <tr>
                <td><strong>${index + 1}</strong></td>
                <td class="text-left">${jug.nombre}</td>
                <td>${nomEquipo}</td>
                <td><strong>${jug.goles}</strong></td>
            </tr>`;
    });
}