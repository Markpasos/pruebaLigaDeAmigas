// Ruta base hacia los archivos de datos
const DATA_PATH = './js/data/';

// ==========================================
// 1. FUNCIONES PARA INDEX.HTML (HOME)
// ==========================================
async function initHome() {
    const selectLiga = document.getElementById('liga-select');
    const btnIngresar = document.getElementById('btn-ingresar');

    try {
        const res = await fetch(`${DATA_PATH}ligas.json`);
        const data = await res.json();
        
        selectLiga.innerHTML = ''; // Limpiar loader
        data.ligas.forEach(liga => {
            const option = document.createElement('option');
            option.value = liga.id;
            option.textContent = liga.nombre;
            selectLiga.appendChild(option);
        });

        // Configurar botón de entrada
        btnIngresar.addEventListener('click', () => {
            const ligaSeleccionada = selectLiga.value;
            const ligaNombre = selectLiga.options[selectLiga.selectedIndex].text;
            
            if(ligaSeleccionada) {
                localStorage.setItem('liga_activa_id', ligaSeleccionada);
                localStorage.setItem('liga_activa_nombre', ligaNombre);
                window.location.href = 'posiciones.html'; // Redirección
            }
        });

    } catch (error) {
        console.error("Error cargando ligas maestros:", error);
        selectLiga.innerHTML = '<option>Error al cargar ligas</option>';
    }
}

// ==========================================
// 2. FUNCIONES PARA POSICIONES.HTML
// ==========================================
async function initPosiciones() {
    const ligaId = localStorage.getItem('liga_activa_id');
    const ligaNombre = localStorage.getItem('liga_activa_nombre') || 'Torneo';
    
    if (!ligaId) { window.location.href = 'index.html'; return; }

    document.getElementById('torneo-titulo').textContent = `🏆 ${ligaNombre}`;
    const tbody = document.getElementById('tabla-posiciones-body');

    try {
        const res = await fetch(`${DATA_PATH}${ligaId}_tabla.json`);
        const tablaData = await res.json();

        tbody.innerHTML = '';
        tablaData.forEach(eq => {
            tbody.innerHTML += `
                <tr>
                    <td><strong>${eq.posicion}</strong></td>
                    <td class="text-left">${eq.nombre}</td>
                    <td><strong>${eq.pts}</strong></td>
                    <td>${eq.pj}</td>
                    <td>${eq.pg}</td>
                    <td>${eq.pe}</td>
                    <td>${eq.pp}</td>
                    <td>${eq.gf}</td>
                    <td>${eq.gc}</td>
                    <td>${eq.dg > 0 ? '+' + eq.dg : eq.dg}</td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("Error cargando tabla:", error);
        tbody.innerHTML = `<tr><td colspan="10" class="text-center">No se encontraron datos para esta liga. Asegurate de exportar ${ligaId}_tabla.json</td></tr>`;
    }
}

// ==========================================
// 3. FUNCIONES PARA EQUIPOS.HTML
// ==========================================
let datosEquiposGlobal = []; // Almacén en caché para no volver a leer el archivo al cambiar de select

async function initEquipos() {
    const ligaId = localStorage.getItem('liga_activa_id');
    const ligaNombre = localStorage.getItem('liga_activa_nombre') || 'Torneo';
    
    if (!ligaId) { window.location.href = 'index.html'; return; }

    document.getElementById('torneo-titulo-equipos').textContent = `🏆 ${ligaNombre}`;
    const selectEquipo = document.getElementById('equipo-select');

    try {
        // Carga el json detallado de equipos y jugadores
        const res = await fetch(`${DATA_PATH}${ligaId}_equipos.json`);
        const data = await res.json();
        datosEquiposGlobal = data.equipos;

        // 1. Rellenar el selector de equipos
        selectEquipo.innerHTML = '';
        datosEquiposGlobal.forEach(eq => {
            const option = document.createElement('option');
            option.value = eq.id;
            option.textContent = eq.nombre;
            selectEquipo.appendChild(option);
        });

        // Escuchar el cambio en el select
        selectEquipo.addEventListener('change', (e) => {
            renderizarPlantel(e.target.value);
        });

        // Renderizar el primero por defecto
        if(datosEquiposGlobal.length > 0) {
            renderizarPlantel(datosEquiposGlobal[0].id);
        }

        // 2. Calcular y renderizar el Top Goleadores en base a los datos cargados
        renderizarGoleadores();

    } catch (error) {
        console.error("Error cargando equipos:", error);
        document.getElementById('tabla-plantel-body').innerHTML = `<tr><td colspan="3" class="text-center">Falta configurar el archivo ${ligaId}_equipos.json</td></tr>`;
    }
}

function renderizarPlantel(equipoId) {
    const equipo = datosEquiposGlobal.find(e => e.id === equipoId);
    const tbody = document.getElementById('tabla-plantel-body');
    document.getElementById('nombre-equipo-header').textContent = equipo.nombre;

    tbody.innerHTML = '';
    if(!equipo.plantel || equipo.plantel.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center">No hay jugadores registrados.</td></tr>`;
        return;
    }

    equipo.plantel.forEach(jugador => {
        tbody.innerHTML += `
            <tr>
                <td class="text-left">${jugador.nombre}</td>
                <td>${jugador.goles}</td>
                <td>${jugador.asistencias}</td>
            </tr>
        `;
    });
}

function renderizarGoleadores() {
    const tbodyGoleadores = document.getElementById('tabla-goleadores-body');
    let todosLosJugadores = [];

    // Desarmamos la estructura de equipos para meter todos los jugadores en una lista plana
    datosEquiposGlobal.forEach(eq => {
        if(eq.plantel) {
            eq.plantel.forEach(jug => {
                todosLosJugadores.push({
                    nombre: jug.nombre,
                    equipo: eq.nombre,
                    goles: jug.goles
                });
            });
        }
    });

    // Ordenar de mayor a menor por goles
    todosLosJugadores.sort((a, b) => b.goles - a.goles);

    // Tomar solo los mejores 10 (o los que haya)
    const top10 = todosLosJugadores.slice(0, 10);

    tbodyGoleadores.innerHTML = '';
    if(top10.length === 0) {
        tbodyGoleadores.innerHTML = `<tr><td colspan="4" class="text-center">No hay datos de goles registrados.</td></tr>`;
        return;
    }

    top10.forEach((jug, index) => {
        tbodyGoleadores.innerHTML += `
            <tr>
                <td><strong>${index + 1}</strong></td>
                <td class="text-left">${jug.nombre}</td>
                <td>${jug.equipo}</td>
                <td><strong>${jug.goles}</strong></td>
            </tr>
        `;
    });
}
