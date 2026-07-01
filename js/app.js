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

    // Separar partidos en próximos y jugados
    let partidosProximos = [];
    let partidosJugados = [];

    dbFixture.forEach(fecha => {
        fecha.partidos.forEach(p => {
            if (p.jugado) {
                // Buscar los detalles del partido jugado (goles)
                const partidoDetalle = dbPartidos.find(part => 
                    part.equipo_local === p.equipo_local && 
                    part.equipo_visitante === p.equipo_visitante &&
                    part.jugado === true
                );
                partidosJugados.push({
                    ...p,
                    numeroFecha: fecha.numero,
                    fechaObj: crearFechaLocal(p.fecha),
                    detalle: partidoDetalle
                });
            } else {
                partidosProximos.push({
                    ...p,
                    numeroFecha: fecha.numero,
                    fechaObj: crearFechaLocal(p.fecha)
                });
            }
        });
    });

    // Ordenar próximos por fecha (más cercano primero)
    partidosProximos.sort((a, b) => a.fechaObj - b.fechaObj);
    
    // Ordenar jugados por fecha (más antiguo primero)
    partidosJugados.sort((a, b) => a.fechaObj - b.fechaObj);

    let htmlTotal = '';

    // ========== SECCIÓN: PRÓXIMOS PARTIDOS ==========
    htmlTotal += `
        <div class="seccion-fixture">
            <div class="seccion-titulo proximos-titulo">
                ⏳ PRÓXIMA FECHA
            </div>
    `;

    if (partidosProximos.length > 0) {
        // Agrupar próximos por fecha
        const fechasProximas = {};
        partidosProximos.forEach(p => {
            const key = p.fechaObj.toISOString().split('T')[0];
            if (!fechasProximas[key]) {
                fechasProximas[key] = {
                    fechaObj: p.fechaObj,
                    partidos: []
                };
            }
            fechasProximas[key].partidos.push(p);
        });

        // Mostrar solo la primera fecha próxima
        const primeraFecha = Object.values(fechasProximas)[0];
        const fechaFormateada = primeraFecha.fechaObj.toLocaleDateString('es-AR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        htmlTotal += `
            <div class="fecha-bloque proximo">
                <div class="fecha-titulo">📅 ${fechaFormateada}</div>
        `;

        primeraFecha.partidos.forEach(p => {
            const localNombre = obtenerNombreEquipo(p.equipo_local);
            const visitNombre = obtenerNombreEquipo(p.equipo_visitante);
            
            // Generar el HTML de la ubicación (con o sin enlace)
            let ubicacionHTML = '';
            if (p.ubicacion) {
                ubicacionHTML = `
                    <a href="${p.ubicacion}" target="_blank" class="ubicacion-link" title="Ver en Google Maps">
                        📍 ${p.cancha || 'Por definir'}
                    </a>
                `;
            } else {
                ubicacionHTML = `<span class="partido-cancha">📍 ${p.cancha || 'Por definir'}</span>`;
            }
            
            htmlTotal += `
                <div class="partido-card proximo">
                    <span class="partido-equipo local">${localNombre}</span>
                    <div class="partido-info-future">
                        <span class="partido-hora">🕐 ${p.hora || '--:--'}</span>
                        ${ubicacionHTML}
                    </div>
                    <span class="partido-equipo visitante">${visitNombre}</span>
                </div>
            `;
        });

        htmlTotal += `</div>`;
    } else {
        htmlTotal += `<p class="text-center">No hay partidos próximos programados</p>`;
    }

    htmlTotal += `</div>`;

    // ========== SECCIÓN: PARTIDOS JUGADOS ==========
    htmlTotal += `
        <div class="seccion-fixture mt-3">
            <div class="seccion-titulo jugados-titulo">
                📊 PARTIDOS JUGADOS
            </div>
    `;

    if (partidosJugados.length > 0) {
        // Agrupar jugados por fecha
        const fechasJugadas = {};
        partidosJugados.forEach(p => {
            const key = p.fechaObj.toISOString().split('T')[0];
            if (!fechasJugadas[key]) {
                fechasJugadas[key] = {
                    fechaObj: p.fechaObj,
                    partidos: []
                };
            }
            fechasJugadas[key].partidos.push(p);
        });

        // Mostrar todas las fechas jugadas (más antiguas primero)
        const fechasOrdenadas = Object.values(fechasJugadas).sort((a, b) => a.fechaObj - b.fechaObj);

        fechasOrdenadas.forEach(fecha => {
            const fechaFormateada = fecha.fechaObj.toLocaleDateString('es-AR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });

            htmlTotal += `
                <div class="fecha-bloque jugado">
                    <div class="fecha-titulo">📅 ${fechaFormateada}</div>
            `;

            fecha.partidos.forEach(p => {
                const localNombre = obtenerNombreEquipo(p.equipo_local);
                const visitNombre = obtenerNombreEquipo(p.equipo_visitante);
                
                let golesLocal = 0, golesVisit = 0;
                if (p.detalle) {
                    p.detalle.eventos.goles.forEach(gol => {
                        if (gol.equipo === p.equipo_local) golesLocal++;
                        else if (gol.equipo === p.equipo_visitante) golesVisit++;
                    });
                }

                htmlTotal += `
                    <div class="partido-card jugado">
                        <span class="partido-equipo local">${localNombre}</span>
                        <span class="partido-resultado">${golesLocal} - ${golesVisit}</span>
                        <span class="partido-equipo visitante">${visitNombre}</span>
                    </div>
                `;
            });

            htmlTotal += `</div>`;
        });
    } else {
        htmlTotal += `<p class="text-center">No hay partidos jugados aún</p>`;
    }

    htmlTotal += `</div>`;

    // Insertar todo
    contenedor.innerHTML = htmlTotal;
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
    // ==========================================
    // 1. VALIDACIÓN Y DATOS BÁSICOS DEL EQUIPO
    // ==========================================
    // Busca el equipo en la base de datos por su ID
    const equipo = dbEquipos.find(e => e.id === equipoId);
    // Si no existe el equipo, corta la ejecución de la función de inmediato
    if (!equipo) return;
    
    // Inserta el nombre del equipo en el encabezado de la interfaz
    document.getElementById('nombre-equipo-header').textContent = equipo.nombre;
    
    // ==========================================
    // 2. CARGA DE IMÁGENES (FOTO Y BANNER)
    // ==========================================
    const fotoPerfil = document.getElementById('equipo-foto');
    const banner = document.getElementById('equipo-banner');
    
    // Control de error para la foto de perfil: si falla la ruta, pone una por defecto
    fotoPerfil.onerror = function() { 
        this.src = 'fotos/perfiles/default.png'; 
    };
    // Intenta cargar la foto dinámica usando el ID del equipo
    fotoPerfil.src = `fotos/perfiles/${equipoId}.png`;
    
    // Definición de rutas para el banner de fondo
    const bannerUrl = `fotos/portadas/${equipoId}.jpg`;
    const defaultBannerUrl = 'fotos/portadas/default.jpg';
    
    // Precarga asíncrona de la imagen del banner para evitar parpadeos o "imágenes rotas"
    const testImg = new Image();
    testImg.onload = function() {
        // Si la imagen existe y carga bien, la aplica como fondo
        banner.style.backgroundImage = `url('${bannerUrl}')`;
    };
    testImg.onerror = function() {
        // Si la imagen no se encuentra, aplica el banner por defecto
        banner.style.backgroundImage = `url('${defaultBannerUrl}')`;
    };
    testImg.src = bannerUrl;

    // ==========================================
    // 3. PROCESAMIENTO DE ESTADÍSTICAS DEL PLANTEL
    // ==========================================
    // Obtiene el array con los nombres de las jugadoras pertenecientes al equipo
    const plantel = obtenerPlantel(equipoId);
    
    // Inicializa un objeto vacío para acumular goles y tarjetas de cada jugadora
    let stats = {};
    plantel.forEach(nombre => {
        // Estructura base a poner en 0 para cada jugadora del plantel
        stats[nombre] = { goles: 0, amarillas: 0, rojas: 0 };
    });

    // Recorre el histórico global de partidos para calcular las estadísticas en tiempo real
    dbPartidos.forEach(p => {
        // Si el partido aún no se jugó, lo ignora y salta al siguiente
        if (!p.jugado) return;
        
        // Conteo de Goles
        p.eventos.goles.forEach(gol => {
            // Verifica que el gol sea del equipo consultado y que la jugadora pertenezca al plantel
            if (gol.equipo === equipoId && stats[gol.jugadora] !== undefined) {
                stats[gol.jugadora].goles++;
            }
        });
        
        // Conteo de Tarjetas (Amarillas y Rojas)
        if (p.eventos.tarjetas) {
            p.eventos.tarjetas.forEach(tarjeta => {
                // Verifica pertenencia de equipo y jugadora registrada antes de sumar
                if (tarjeta.equipo === equipoId && stats[tarjeta.jugadora] !== undefined) {
                    if (tarjeta.tipo === 'amarilla') stats[tarjeta.jugadora].amarillas++;
                    if (tarjeta.tipo === 'roja') stats[tarjeta.jugadora].rojas++;
                }
            });
        }
    });

    // ==========================================
    // 4. RENDERIZADO DE LA TABLA DE JUGADORAS
    // ==========================================
    const tbody = document.getElementById('tabla-plantel-body');
    tbody.innerHTML = ''; // Limpia filas previas de la tabla
    
    // Caso: No hay datos cargados en el plantel
    if (!plantel || plantel.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">No hay jugadoras cargadas</td></tr>';
    } else {
        // Caso: Renderizado de filas por cada jugadora mapeando sus estadísticas calculadas arriba
        plantel.forEach(nombre => {
            // Si por alguna razón la jugadora no tiene stats asignadas, usa un objeto en 0 por defecto
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

    // ==========================================
    // 5. SECCIÓN HISTORIAL (HISTÓRICO + PRÓXIMOS)
    // ==========================================
    const contenedorHistorial = document.getElementById('historial-equipo-container');
    if (contenedorHistorial) {
        contenedorHistorial.innerHTML = ''; // Limpia el contenedor de historial
        // 5.2. Filtrado y mapeo de Próximos Partidos (desde dbFixture)
        let partidosProximos = [];
        dbFixture.forEach(fecha => {
            fecha.partidos.forEach(p => {
                // Filtra partidos del equipo que NO estén jugados aún
                if ((p.equipo_local === equipoId || p.equipo_visitante === equipoId) && !p.jugado) {
                    // Guarda el partido agregando el número de la fecha del torneo
                    partidosProximos.push({ ...p, fechaNumero: fecha.numero });
                }
            });
        });

        if (partidosProximos.length > 0) {
            contenedorHistorial.innerHTML += `<div class="historial-subtitulo">📅 Próximos Partidos</div>`;
            partidosProximos.forEach(p => {
                const localNombre = obtenerNombreEquipo(p.equipo_local);
                const visitNombre = obtenerNombreEquipo(p.equipo_visitante);
                
                // Formatea la fecha usando la configuración regional de Argentina (ej: "15 de mayo")
                const fechaObj = crearFechaLocal(p.fecha);
                const fechaFormateada = fechaObj.toLocaleDateString('es-AR', {
                    day: 'numeric',
                    month: 'long'
                });
                
                // Inyecta la tarjeta de próximo partido con fecha y hora
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
        // 5.1. Filtrado y renderizado de Partidos Jugados (desde dbPartidos)
        let partidosJugados = dbPartidos.filter(p => 
            (p.equipo_local === equipoId || p.equipo_visitante === equipoId) && p.jugado
        );
        
        if (partidosJugados.length > 0) {
            contenedorHistorial.innerHTML += `<div class="historial-subtitulo">📊 Partidos Jugados</div>`;
            partidosJugados.forEach(p => {
                // Convierte IDs de equipos a strings de nombres legibles
                const localNombre = obtenerNombreEquipo(p.equipo_local);
                const visitNombre = obtenerNombreEquipo(p.equipo_visitante);
                
                // Recalcula el resultado final sumando los goles del evento de ese partido
                let gLocal = 0, gVisit = 0;
                p.eventos.goles.forEach(gol => {
                    if (gol.equipo === p.equipo_local) gLocal++;
                    else if (gol.equipo === p.equipo_visitante) gVisit++;
                });
                
                // Inyecta la tarjeta del partido con su resultado final
                contenedorHistorial.innerHTML += `
                    <div class="partido-card jugado">
                        <span class="partido-equipo local">${localNombre}</span>
                        <span class="partido-resultado">${gLocal} - ${gVisit}</span>
                        <span class="partido-equipo visitante">${visitNombre}</span>
                    </div>`;
            });
        }
        
        // 5.3. Estado vacío si el equipo no registra ningún partido de ningún tipo
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

//Crea fecha con hora local.
function crearFechaLocal(fechaStr) {
    const partes = fechaStr.split('-');
    // año, mes (0-indexado), día
    return new Date(partes[0], partes[1] - 1, partes[2]);
}