const DATA_PATH = './js/data/';

let dbPartidos = [];
let dbEquiposMaestro = []; // Cada equipo tiene id, nombre, plantel[]

async function cargarMatrizCentral(ligaId) {
    if (dbPartidos.length > 0) return;
    const res = await fetch(`${DATA_PATH}${ligaId}_partidos.json`);
    const data = await res.json();
    dbPartidos = data.partidos;
    dbEquiposMaestro = data.equipos_maestro;
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

// ========== CÁLCULO DE GOLES POR EQUIPO DESDE EVENTOS ==========
function obtenerGolesPorEquipo() {
    let golesEquipo = {};
    dbEquiposMaestro.forEach(eq => { golesEquipo[eq.id] = 0; });
    dbPartidos.forEach(p => {
        if (!p.jugado) return;
        p.eventos.goles.forEach(gol => {
            golesEquipo[gol.equipo] = (golesEquipo[gol.equipo] || 0) + 1;
        });
    });
    return golesEquipo;
}

// ========== TABLA DE POSICIONES ==========
function calcularTablaPosiciones() {
    let tabla = {};
    dbEquiposMaestro.forEach(eq => {
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

        // Contar goles desde eventos
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
    await cargarMatrizCentral(ligaId);
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
    renderizarFixtureGeneral();
}

function renderizarFixtureGeneral() {
    const contenedor = document.getElementById('fixture-container');
    if (!contenedor) return;
    contenedor.innerHTML = '';
    let fechas = {};
    dbPartidos.forEach(p => {
        if (!fechas[p.fecha]) fechas[p.fecha] = [];
        fechas[p.fecha].push(p);
    });

    Object.keys(fechas).forEach(numFecha => {
        let htmlFecha = `<div class="fecha-bloque"><div class="fecha-titulo">Fecha ${numFecha}</div>`;
        fechas[numFecha].forEach(p => {
            const local = dbEquiposMaestro.find(e => e.id === p.equipo_local).nombre;
            const visit = dbEquiposMaestro.find(e => e.id === p.equipo_visitante).nombre;
            let golesLocal = 0, golesVisit = 0;
            if (p.jugado) {
                p.eventos.goles.forEach(gol => {
                    if (gol.equipo === p.equipo_local) golesLocal++;
                    else if (gol.equipo === p.equipo_visitante) golesVisit++;
                });
            }
            const resultado = p.jugado ? `${golesLocal} - ${golesVisit}` : "vs";
            htmlFecha += `
                <div class="partido-card">
                    <span class="partido-equipo local">${local}</span>
                    <span class="partido-resultado">${resultado}</span>
                    <span class="partido-equipo visitante">${visit}</span>
                </div>`;
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
    await cargarMatrizCentral(ligaId);

    const selectEquipo = document.getElementById('equipo-select');
    selectEquipo.innerHTML = '';
    dbEquiposMaestro.forEach(eq => {
        const option = document.createElement('option');
        option.value = eq.id;
        option.textContent = eq.nombre;
        selectEquipo.appendChild(option);
    });

    selectEquipo.addEventListener('change', (e) => renderizarFichaEquipo(e.target.value));
    if (dbEquiposMaestro.length) renderizarFichaEquipo(dbEquiposMaestro[0].id);
}

function renderizarFichaEquipo(equipoId) {
    const equipo = dbEquiposMaestro.find(e => e.id === equipoId);
    document.getElementById('nombre-equipo-header').textContent = equipo.nombre;

    // Inicializar estadísticas para todas las jugadoras del plantel
    let stats = {};
    equipo.plantel.forEach(nombre => {
        stats[nombre] = { goles: 0, amarillas: 0, rojas: 0 };
    });

    // Acumular goles y tarjetas de los partidos
    dbPartidos.forEach(p => {
        if (!p.jugado) return;
        // Goles
        p.eventos.goles.forEach(gol => {
            if (gol.equipo === equipoId && stats[gol.jugadora]) {
                stats[gol.jugadora].goles++;
            }
        });
        // Tarjetas
        if (p.eventos.tarjetas) {
            p.eventos.tarjetas.forEach(tarjeta => {
                if (tarjeta.equipo === equipoId && stats[tarjeta.jugadora]) {
                    if (tarjeta.tipo === 'amarilla') stats[tarjeta.jugadora].amarillas++;
                    if (tarjeta.tipo === 'roja') stats[tarjeta.jugadora].rojas++;
                }
            });
        }
    });

    const tbody = document.getElementById('tabla-plantel-body');
    tbody.innerHTML = '';
    if (equipo.plantel.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay jugadoras cargadas</td></tr>';
    } else {
        equipo.plantel.forEach(nombre => {
            const s = stats[nombre];
            tbody.innerHTML += `
                <tr>
                    <td class="text-left">${nombre}</td>
                    <td>${s.goles}</td>
                    <td>${s.amarillas}</td>
                    <td>${s.rojas}</td>
                </tr>`;
        });
    }

    // Historial de partidos del equipo
    const contenedorHistorial = document.getElementById('historial-equipo-container');
    if (contenedorHistorial) {
        contenedorHistorial.innerHTML = '';
        dbPartidos.forEach(p => {
            if (p.equipo_local === equipoId || p.equipo_visitante === equipoId) {
                const local = dbEquiposMaestro.find(e => e.id === p.equipo_local).nombre;
                const visit = dbEquiposMaestro.find(e => e.id === p.equipo_visitante).nombre;
                let gLocal = 0, gVisit = 0;
                if (p.jugado) {
                    p.eventos.goles.forEach(gol => {
                        if (gol.equipo === p.equipo_local) gLocal++;
                        else if (gol.equipo === p.equipo_visitante) gVisit++;
                    });
                }
                const resultado = p.jugado ? `${gLocal} - ${gVisit}` : "vs";
                contenedorHistorial.innerHTML += `
                    <div class="partido-card">
                        <span class="partido-equipo local">${local}</span>
                        <span class="partido-resultado">${resultado}</span>
                        <span class="partido-equipo visitante">${visit}</span>
                    </div>`;
            }
        });
    }
}

function renderizarTopGoleadores() {
    let goleadores = {};
    dbPartidos.forEach(p => {
        if (!p.jugado) return;
        p.eventos.goles.forEach(gol => {
            if (!goleadores[gol.jugadora]) {
                goleadores[gol.jugadora] = { nombre: gol.jugadora, equipoId: gol.equipo, goles: 0 };
            }
            goleadores[gol.jugadora].goles++;
        });
    });

    const lista = Object.values(goleadores).sort((a, b) => b.goles - a.goles).slice(0, 10);
    const tbody = document.getElementById('tabla-goleadoras-body'); // Cambiado el ID
    tbody.innerHTML = '';
    
    if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay goles registrados</td></tr>';
        return;
    }
    
    lista.forEach((jug, idx) => {
        const equipo = dbEquiposMaestro.find(e => e.id === jug.equipoId);
        tbody.innerHTML += `
            <tr>
                <td><strong>${idx + 1}</strong></td>
                <td class="text-left">${jug.nombre}</td>
                <td>${equipo ? equipo.nombre : '?'}</td>
                <td><strong>${jug.goles}</strong></td>
            </tr>`;
    });
}

// ========== PÁGINA GOLEADORAS ==========
async function initGoleadoras() {
    const ligaId = localStorage.getItem('liga_activa_id');
    const ligaNombre = localStorage.getItem('liga_activa_nombre') || 'Torneo';
    if (!ligaId) { 
        window.location.href = 'index.html'; 
        return; 
    }

    document.getElementById('torneo-titulo-goleadoras').textContent = `🏆 ${ligaNombre}`;
    await cargarMatrizCentral(ligaId);
    renderizarTopGoleadores();
}

function renderizarFichaEquipo(equipoId) {
    const equipo = dbEquiposMaestro.find(e => e.id === equipoId);
    if (!equipo) return;
    
    // Actualizar nombre
    document.getElementById('nombre-equipo-header').textContent = equipo.nombre;
    
    // Actualizar imágenes
    const fotoPerfil = document.getElementById('equipo-foto');
    const banner = document.getElementById('equipo-banner');
    
    // === FOTO DE PERFIL ===
    fotoPerfil.onerror = function() { 
        this.src = 'fotos/perfiles/default.png'; 
    };
    fotoPerfil.src = `fotos/perfiles/${equipoId}.png`;
    
    // === BANNER - SOLUCIÓN: verificar existencia primero ===
    const bannerUrl = `fotos/portadas/${equipoId}.jpg`;
    const defaultBannerUrl = 'fotos/portadas/default.jpg';
    
    // Crear una imagen temporal para probar si existe
    const testImg = new Image();
    testImg.onload = function() {
        // La imagen existe, usarla
        banner.style.backgroundImage = `url('${bannerUrl}')`;
        console.log(`✅ Banner cargado: ${bannerUrl}`);
    };
    testImg.onerror = function() {
        // La imagen no existe, usar default
        banner.style.backgroundImage = `url('${defaultBannerUrl}')`;
        console.log(`⚠️ Banner no encontrado: ${bannerUrl}, usando default`);
        
        // Verificar que el default existe
        const testDefault = new Image();
        testDefault.onerror = function() {
            console.error(`❌ Tampoco existe el default: ${defaultBannerUrl}`);
            banner.style.backgroundColor = 'var(--bg-card)';
        };
        testDefault.src = defaultBannerUrl;
    };
    testImg.src = bannerUrl;

    // Resto del código igual...
    let stats = {};
    equipo.plantel.forEach(nombre => {
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
    
    if (!equipo.plantel || equipo.plantel.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay jugadoras cargadas para este equipo</td></tr>';
    } else {
        equipo.plantel.forEach(nombre => {
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

    const contenedorHistorial = document.getElementById('historial-equipo-container');
    if (contenedorHistorial) {
        contenedorHistorial.innerHTML = '';
        dbPartidos.forEach(p => {
            if (p.equipo_local === equipoId || p.equipo_visitante === equipoId) {
                const local = dbEquiposMaestro.find(e => e.id === p.equipo_local).nombre;
                const visit = dbEquiposMaestro.find(e => e.id === p.equipo_visitante).nombre;
                let gLocal = 0, gVisit = 0;
                if (p.jugado) {
                    p.eventos.goles.forEach(gol => {
                        if (gol.equipo === p.equipo_local) gLocal++;
                        else if (gol.equipo === p.equipo_visitante) gVisit++;
                    });
                }
                const resultado = p.jugado ? `${gLocal} - ${gVisit}` : "vs";
                contenedorHistorial.innerHTML += `
                    <div class="partido-card">
                        <span class="partido-equipo local">${local}</span>
                        <span class="partido-resultado">${resultado}</span>
                        <span class="partido-equipo visitante">${visit}</span>
                    </div>`;
            }
        });
        
        if (contenedorHistorial.innerHTML === '') {
            contenedorHistorial.innerHTML = '<p class="text-center">No hay partidos registrados</p>';
        }
    }
}