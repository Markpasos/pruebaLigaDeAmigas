const DATA_PATH = './js/data/';

let dbEquipos = [];
let dbPlanteles = {};
let dbPartidos = [];
let dbFixture = [];

// Cargar equipos (solo ids y nombres)
async function cargarEquipos(ligaId) {
    try {
        const res = await fetch(`${DATA_PATH}${ligaId}_equipos.json`);
        const data = await res.json();
        dbEquipos = data.equipos;
        return true;
    } catch (e) {
        console.error('Error cargando equipos:', e);
        return false;
    }
}

// Cargar planteles
async function cargarPlanteles(ligaId) {
    try {
        const res = await fetch(`${DATA_PATH}${ligaId}_planteles.json`);
        const data = await res.json();
        dbPlanteles = data.planteles;
        return true;
    } catch (e) {
        console.error('Error cargando planteles:', e);
        return false;
    }
}

// Cargar partidos jugados (con eventos)
async function cargarPartidos(ligaId) {
    try {
        const res = await fetch(`${DATA_PATH}${ligaId}_partidos.json`);
        const data = await res.json();
        dbPartidos = data.partidos;
        return true;
    } catch (e) {
        console.error('Error cargando partidos:', e);
        return false;
    }
}

// Cargar fixture (solo fechas y horarios)
async function cargarFixture(ligaId) {
    try {
        const res = await fetch(`${DATA_PATH}${ligaId}_fixture.json`);
        const data = await res.json();
        dbFixture = data.fechas;
        return true;
    } catch (e) {
        console.error('Error cargando fixture:', e);
        dbFixture = [];
        return false;
    }
}

// Cargar todos los datos necesarios
async function cargarTodosLosDatos(ligaId) {
    await cargarEquipos(ligaId);
    await cargarPlanteles(ligaId);
    await cargarPartidos(ligaId);
    await cargarFixture(ligaId);
}

// Obtener el plantel de un equipo
function obtenerPlantel(equipoId) {
    return dbPlanteles[equipoId] || [];
}

// Obtener nombre de un equipo
function obtenerNombreEquipo(equipoId) {
    const equipo = dbEquipos.find(e => e.id === equipoId);
    return equipo ? equipo.nombre : '?';
}

// ==================== HOME ====================
async function initHome() {
    const selectLiga = document.getElementById('liga-select');
    const btnIngresar = document.getElementById('btn-ingresar');
    try {
        const res = await fetch(`${DATA_PATH}ligas.json`);
        const data = await res.json();
        selectLiga.innerHTML = '';
        data.ligas.forEach(liga => {
            const option = document.createElement('option');
            option.value = liga.id;
            option.textContent = liga.nombre;
            selectLiga.appendChild(option);
        });
        btnIngresar.addEventListener('click', () => {
            const id = selectLiga.value;
            const txt = selectLiga.options[selectLiga.selectedIndex].text;
            if (id) {
                localStorage.setItem('liga_activa_id', id);
                localStorage.setItem('liga_activa_nombre', txt);
                window.location.href = 'posiciones.html';
            }
        });
    } catch (e) {
        selectLiga.innerHTML = '<option>Error</option>';
    }
}

// ========== CÁLCULO DE TABLA DE POSICIONES ==========
function calcularTablaPosiciones() {
    let tabla = {};
    dbEquipos.forEach(eq => {
        tabla[eq.id] = {
            id: eq.id, nombre: eq.nombre,
            pts: 0, pj: 0, pg: 0, pe: 0, pp: 0,
            gf: 0, gc: 0, dg: 0
        };
    });

    dbPartidos.forEach(p => {
        if (!p.jugado) return;
        const local = p.equipo_local;
        const visit = p.equipo_visitante;

        let golesLocal = 0, golesVisit = 0;
        p.eventos.goles.forEach(gol => {
            if (gol.equipo === local) golesLocal++;
            else if (gol.equipo === visit) golesVisit++;
        });

        tabla[local].gf += golesLocal;
        tabla[local].gc += golesVisit;
        tabla[visit].gf += golesVisit;
        tabla[visit].gc += golesLocal;
        tabla[local].pj++;
        tabla[visit].pj++;

        if (golesLocal > golesVisit) {
            tabla[local].pts += 3;
            tabla[local].pg++;
            tabla[visit].pp++;
        } else if (golesVisit > golesLocal) {
            tabla[visit].pts += 3;
            tabla[visit].pg++;
            tabla[local].pp++;
        } else {
            tabla[local].pts += 1;
            tabla[visit].pts += 1;
            tabla[local].pe++;
            tabla[visit].pe++;
        }
    });

    let tablaArray = Object.values(tabla).map(eq => {
        eq.dg = eq.gf - eq.gc;
        return eq;
    });
    return tablaArray.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
}

// ========== PÁGINA POSICIONES ==========
async function initPosiciones() {
    const ligaId = localStorage.getItem('liga_activa_id');
    const ligaNombre = localStorage.getItem('liga_activa_nombre') || 'Torneo';
    if (!ligaId) { window.location.href = 'index.html'; return; }

    document.getElementById('torneo-titulo').textContent = `🏆 ${ligaNombre}`;
    
    await cargarTodosLosDatos(ligaId);
    
    const tablaOrdenada = calcularTablaPosiciones();

    const tbody = document.getElementById('tabla-posiciones-body');
    tbody.innerHTML = '';
    tablaOrdenada.forEach((eq, idx) => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${idx + 1}</strong></td>
                <td class="text-left">${eq.nombre}</td>
                <td><strong>${eq.pts}</strong></td>
                <td>${eq.pj}</td><td>${eq.pg}</td><td>${eq.pe}</td><td>${eq.pp}</td>
                <td>${eq.gf}</td><td>${eq.gc}</td><td>${eq.dg > 0 ? '+' + eq.dg : eq.dg}</td>
            </tr>`;
    });
    
    renderizarFixtureCompleto();
}

function renderizarFixtureCompleto() {
    const contenedor = document.getElementById('fixture-container');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    if (dbFixture.length === 0) {
        contenedor.innerHTML = '<p class="text-center">No hay fixture cargado</p>';
        return;
    }

    dbFixture.forEach(fecha => {
        const fechaObj = new Date(fecha.partidos[0].fecha);
        const fechaFormateada = fechaObj.toLocaleDateString('es-AR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });
        
        let htmlFecha = `
            <div class="fecha-bloque">
                <div class="fecha-titulo">📅 Fecha ${fecha.numero} - ${fechaFormateada}</div>
        `;
        
        fecha.partidos.forEach(p => {
            const localNombre = obtenerNombreEquipo(p.equipo_local);
            const visitNombre = obtenerNombreEquipo(p.equipo_visitante);
            
            let resultadoHTML = '';
            
            if (p.jugado) {
                const partido = dbPartidos.find(part => 
                    part.equipo_local === p.equipo_local && 
                    part.equipo_visitante === p.equipo_visitante &&
                    part.jugado === true
                );
                
                if (partido) {
                    let golesLocal = 0, golesVisit = 0;
                    partido.eventos.goles.forEach(gol => {
                        if (gol.equipo === p.equipo_local) golesLocal++;
                        else if (gol.equipo === p.equipo_visitante) golesVisit++;
                    });
                    resultadoHTML = `<span class="partido-resultado">${golesLocal} - ${golesVisit}</span>`;
                } else {
                    resultadoHTML = `<span class="partido-resultado">vs</span>`;
                }
            } else {
                // Crear enlace a Google Maps si existe ubicacion
                let ubicacionHTML = '';
                if (p.ubicacion) {
                    ubicacionHTML = `
                        <a href="${p.ubicacion}" target="_blank" class="ubicacion-link" title="Ver en Google Maps">📍
                             ${p.cancha || 'Por definir'}
                        </a>
                    `;
                } else {
                    ubicacionHTML = `<span class="partido-cancha"> ${p.cancha || 'Por definir'}</span>`;
                }
                
                resultadoHTML = `
                    <div class="partido-info">
                        <span class="partido-hora">🕐 ${p.hora || '--:--'}</span>
                        ${ubicacionHTML}
                    </div>
                `;
            }
            
            htmlFecha += `
                <div class="partido-card ${p.jugado ? 'jugado' : 'proximo'}">
                    <span class="partido-equipo local">${localNombre}</span>
                    ${resultadoHTML}
                    <span class="partido-equipo visitante">${visitNombre}</span>
                </div>
            `;
        });
        
        htmlFecha += `</div>`;
        contenedor.innerHTML += htmlFecha;
    });
}

// ========== PÁGINA EQUIPOS ==========
async function initEquipos() {
    const ligaId = localStorage.getItem('liga_activa_id');
    const ligaNombre = localStorage.getItem('liga_activa_nombre') || 'Torneo';
    if (!ligaId) { window.location.href = 'index.html'; return; }

    document.getElementById('torneo-titulo-equipos').textContent = `🏆 ${ligaNombre}`;
    
    await cargarTodosLosDatos(ligaId);

    const selectEquipo = document.getElementById('equipo-select');
    selectEquipo.innerHTML = '';
    dbEquipos.forEach(eq => {
        const option = document.createElement('option');
        option.value = eq.id;
        option.textContent = eq.nombre;
        selectEquipo.appendChild(option);
    });

    selectEquipo.addEventListener('change', (e) => renderizarFichaEquipo(e.target.value));
    if (dbEquipos.length) renderizarFichaEquipo(dbEquipos[0].id);
}

function renderizarFichaEquipo(equipoId) {
    const equipo = dbEquipos.find(e => e.id === equipoId);
    if (!equipo) return;
    
    document.getElementById('nombre-equipo-header').textContent = equipo.nombre;
    
    // Imágenes
    const fotoPerfil = document.getElementById('equipo-foto');
    const banner = document.getElementById('equipo-banner');
    
    fotoPerfil.onerror = function() { 
        this.src = 'fotos/perfiles/default.png'; 
    };
    fotoPerfil.src = `fotos/perfiles/${equipoId}.png`;
    
    const bannerUrl = `fotos/portadas/${equipoId}.jpg`;
    const defaultBannerUrl = 'fotos/portadas/default.jpg';
    
    const testImg = new Image();
    testImg.onload = function() {
        banner.style.backgroundImage = `url('${bannerUrl}')`;
    };
    testImg.onerror = function() {
        banner.style.backgroundImage = `url('${defaultBannerUrl}')`;
    };
    testImg.src = bannerUrl;

    // Obtener plantel del equipo
    const plantel = obtenerPlantel(equipoId);
    
    // Estadísticas de jugadoras
    let stats = {};
    plantel.forEach(nombre => {
        stats[nombre] = { goles: 0, amarillas: 0, rojas: 0 };
    });

    dbPartidos.forEach(p => {
        if (!p.jugado) return;
        p.eventos.goles.forEach(gol => {
            if (gol.equipo === equipoId && stats[gol.jugadora] !== undefined) {
                stats[gol.jugadora].goles++;
            }
        });
        if (p.eventos.tarjetas) {
            p.eventos.tarjetas.forEach(tarjeta => {
                if (tarjeta.equipo === equipoId && stats[tarjeta.jugadora] !== undefined) {
                    if (tarjeta.tipo === 'amarilla') stats[tarjeta.jugadora].amarillas++;
                    if (tarjeta.tipo === 'roja') stats[tarjeta.jugadora].rojas++;
                }
            });
        }
    });

    const tbody = document.getElementById('tabla-plantel-body');
    tbody.innerHTML = '';
    
    if (!plantel || plantel.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay jugadoras cargadas</td></tr>';
    } else {
        plantel.forEach(nombre => {
            const s = stats[nombre] || { goles: 0, amarillas: 0, rojas: 0 };
            tbody.innerHTML += `
                <tr>
                    <td class="text-left">${nombre}</td>
                    <td class="text-center">${s.goles}</td>
                    <td class="text-center">${s.amarillas}</td>
                    <td class="text-center">${s.rojas}</td>
                </tr>`;
        });
    }

    // Historial: Partidos jugados + Próximos
    const contenedorHistorial = document.getElementById('historial-equipo-container');
    if (contenedorHistorial) {
        contenedorHistorial.innerHTML = '';
        
        // 1. Partidos jugados (desde dbPartidos)
        let partidosJugados = dbPartidos.filter(p => 
            (p.equipo_local === equipoId || p.equipo_visitante === equipoId) && p.jugado
        );
        
        if (partidosJugados.length > 0) {
            contenedorHistorial.innerHTML += `<div class="historial-subtitulo">📊 Partidos Jugados</div>`;
            partidosJugados.forEach(p => {
                const localNombre = obtenerNombreEquipo(p.equipo_local);
                const visitNombre = obtenerNombreEquipo(p.equipo_visitante);
                let gLocal = 0, gVisit = 0;
                p.eventos.goles.forEach(gol => {
                    if (gol.equipo === p.equipo_local) gLocal++;
                    else if (gol.equipo === p.equipo_visitante) gVisit++;
                });
                contenedorHistorial.innerHTML += `
                    <div class="partido-card jugado">
                        <span class="partido-equipo local">${localNombre}</span>
                        <span class="partido-resultado">${gLocal} - ${gVisit}</span>
                        <span class="partido-equipo visitante">${visitNombre}</span>
                    </div>`;
            });
        }

        // 2. Próximos partidos (desde fixture)
        let partidosProximos = [];
        dbFixture.forEach(fecha => {
            fecha.partidos.forEach(p => {
                if ((p.equipo_local === equipoId || p.equipo_visitante === equipoId) && !p.jugado) {
                    partidosProximos.push({ ...p, fechaNumero: fecha.numero });
                }
            });
        });

        if (partidosProximos.length > 0) {
            contenedorHistorial.innerHTML += `<div class="historial-subtitulo">📅 Próximos Partidos</div>`;
            partidosProximos.forEach(p => {
                const localNombre = obtenerNombreEquipo(p.equipo_local);
                const visitNombre = obtenerNombreEquipo(p.equipo_visitante);
                const fechaObj = new Date(p.fecha);
                const fechaFormateada = fechaObj.toLocaleDateString('es-AR', {
                    day: 'numeric',
                    month: 'long'
                });
                contenedorHistorial.innerHTML += `
                    <div class="partido-card proximo">
                        <span class="partido-equipo local">${localNombre}</span>
                        <div class="partido-info-future">
                            <span class="partido-fecha">📅 ${fechaFormateada}</span>
                            <span class="partido-hora">🕐 ${p.hora || '--:--'}</span>
                        </div>
                        <span class="partido-equipo visitante">${visitNombre}</span>
                    </div>`;
            });
        }
        
        if (partidosJugados.length === 0 && partidosProximos.length === 0) {
            contenedorHistorial.innerHTML = '<p class="text-center">No hay partidos registrados para este equipo</p>';
        }
    }
}

// ========== GOLEADORAS ==========
function renderizarTopGoleadores() {
    let goleadores = {};
    dbPartidos.forEach(p => {
        if (!p.jugado) return;
        p.eventos.goles.forEach(gol => {
            if (!goleadores[gol.jugadora]) {
                goleadores[gol.jugadora] = { 
                    nombre: gol.jugadora, 
                    equipoId: gol.equipo, 
                    goles: 0 
                };
            }
            goleadores[gol.jugadora].goles++;
        });
    });

    const lista = Object.values(goleadores).sort((a, b) => b.goles - a.goles).slice(0, 10);
    const tbody = document.getElementById('tabla-goleadoras-body');
    tbody.innerHTML = '';
    
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay goles registrados</td></tr>';
        return;
    }
    
    lista.forEach((jug, idx) => {
        const equipoNombre = obtenerNombreEquipo(jug.equipoId);
        tbody.innerHTML += `
            <tr>
                <td><strong>${idx + 1}</strong></td>
                <td class="text-left">${jug.nombre}</td>
                <td>${equipoNombre}</td>
                <td><strong>${jug.goles}</strong></td>
            </tr>`;
    });
}

async function initGoleadoras() {
    const ligaId = localStorage.getItem('liga_activa_id');
    const ligaNombre = localStorage.getItem('liga_activa_nombre') || 'Torneo';
    if (!ligaId) { 
        window.location.href = 'index.html'; 
        return; 
    }

    document.getElementById('torneo-titulo-goleadoras').textContent = `🏆 ${ligaNombre}`;
    await cargarEquipos(ligaId);
    await cargarPartidos(ligaId);
    renderizarTopGoleadores();
}