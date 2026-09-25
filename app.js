/* ============================================================================
   LUX  · Núcleo del visor
   ----------------------------------------------------------------------------
   Todo lo municipal en `config.js`. 

   ÍNDICE DE MÓDULOS:
     01 · Configuración y constantes
     02 · Estado global
     03 · Helpers (acceso a campos + estadísticas)
     04 · Mapa (inicialización, tema, mapas base)
     05 · Widget de coordenadas
     06 · Buscador OSM + geocodificación inversa
     07 · Carga de datos GeoJSON + Google Sheets
     08 · Construcción de capas
     09 · Leyenda dinámica
     10 · Interacción con el mapa
     11 · Ficha lateral dinámica
     12 · Popup de solicitudes
     13 · Branding y fecha de actualización
     14 · Botones de capas del encabezado
     15 · KPIs + categorización de solicitudes
     16 · Filtros por distrito
     17 · Selección espacial por polígono
     18 · Panel de estadísticas ejecutivo
     19 · Utilidades de UI
     20 · Exportación PDF
     21 · Inicio
   ============================================================================ */


/* ══════════════════════════════════════════════════════════════════════
   01 · CONFIGURACIÓN Y CONSTANTES
   ══════════════════════════════════════════════════════════════════════ */

const APP_CONFIG = window.LUX_CONFIG;
if (!APP_CONFIG) throw new Error('[LUX] Falta config.js o window.LUX_CONFIG no está definido.');

const FUENTES_DATA = APP_CONFIG.fuentes;
const CONFIG_CAPAS = APP_CONFIG.capas;
const PALETA       = APP_CONFIG.simbologia;
const CONFIG_UI    = APP_CONFIG.ui;

const geojsonVacio = { type: 'FeatureCollection', features: [] };

/** Mapas base disponibles en el selector del encabezado. */
const ESTILOS_MAPA = {
    dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    light: {
        version: 8,
        sources: { 'osm-tiles': { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors' } },
        layers: [{ id: 'osm-layer', type: 'raster', source: 'osm-tiles', minzoom: 0, maxzoom: 19 }]
    },
    satellite: {
        version: 8,
        sources: { 'satellite-tiles': { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, attribution: 'Tiles © Esri' } },
        layers: [{ id: 'satellite-layer', type: 'raster', source: 'satellite-tiles', minzoom: 0, maxzoom: 24 }]
    }
};

/** IDs de las capas con ficha técnica (todas las de config). */
const capasInteractivas = () => Object.values(CONFIG_CAPAS).map(c => c.id);


/* ══════════════════════════════════════════════════════════════════════
   02 · ESTADO GLOBAL
   ══════════════════════════════════════════════════════════════════════ */

let estiloActual = localStorage.getItem('map-style') || 'light';
let modoCalorArbolado = false;
let filtroCategoriaLuminarias = null;

let capasData = {
    luminarias: geojsonVacio,
    arbolado: geojsonVacio,
    vialidades: geojsonVacio,
    reclamos: geojsonVacio,
    cordon: geojsonVacio,
    banquina_vereda: geojsonVacio,
    cuneta: geojsonVacio
};

let distritosData = geojsonVacio;

const visibilidadCapas = {
    luminarias: true, arbolado: true, vialidades: true,
    reclamos: true, cordon: true, banquina_vereda: true, cuneta: true
};

/** Datos que se visualizan AHORA (cambian con filtros). */
window.datosActualesParaKPI = capasData;

let filtroActivo = { tipo: 'todos', nombre: null, geometria: null };


/* ══════════════════════════════════════════════════════════════════════
   03 · HELPERS
   ══════════════════════════════════════════════════════════════════════ */

/** Devuelve el primer atributo presente entre las variantes indicadas. */
function getCampo(props, camposAlt, def = null) {
    if (!props || !Array.isArray(camposAlt)) return def;
    for (const c of camposAlt) {
        if (props[c] !== undefined && props[c] !== null && props[c] !== '') return props[c];
    }
    return def;
}

function getCampoUpper(props, campos, def = '') {
    return String(getCampo(props, campos, def)).trim().toUpperCase();
}

function getCampoNumero(props, campos, def = 0) {
    const val = getCampo(props, campos, null);
    if (val === null) return def;
    const num = parseFloat(val);
    return isNaN(num) ? def : num;
}

function getConfigPorCapaId(layerId) {
    for (const key of Object.keys(CONFIG_CAPAS)) {
        if (CONFIG_CAPAS[key].id === layerId) return { key, config: CONFIG_CAPAS[key] };
    }
    return null;
}

function datosActuales() {
    return window.datosActualesParaKPI || capasData;
}

function setTexto(id, valor) {
    const el = document.getElementById(id);
    if (el) el.innerText = valor;
}


/**
 * Anima el texto de un elemento desde 0 hasta el valor numérico final.
 */
function animarContador(id, valorFinal, opciones = {}) {
    const el = document.getElementById(id);
    if (!el) return;

    const {
        duracion = 900,
        decimales = 0,
        sufijo = '',
        prefijo = '',
        formato = null
    } = opciones;

    const num = parseFloat(valorFinal);
    if (isNaN(num)) {
        el.innerText = valorFinal;
        return;
    }

    //  accesibilidad
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        el.innerText = formatear(num);
        return;
    }

    const inicio = performance.now();

    function formatear(n) {
        if (formato) return formato(n);
        return prefijo + n.toLocaleString('es-AR', {
            minimumFractionDigits: decimales,
            maximumFractionDigits: decimales
        }) + sufijo;
    }

    // Cancela animación
    if (el._animacionRAF) cancelAnimationFrame(el._animacionRAF);

    function frame(ahora) {
        const transcurrido = ahora - inicio;
        const progreso = Math.min(transcurrido / duracion, 1);
        // easeOutCubic
        const suavizado = 1 - Math.pow(1 - progreso, 3);
        const valorActual = num * suavizado;

        el.innerText = formatear(valorActual);

        if (progreso < 1) {
            el._animacionRAF = requestAnimationFrame(frame);
        } else {
            el.innerText = formatear(num);
            el._animacionRAF = null;
        }
    }

    el._animacionRAF = requestAnimationFrame(frame);
}

/** Aplica un conjunto de features filtrado a todas las fuentes del mapa. */
function aplicarDatosFiltrados(filtradas) {
    Object.keys(capasData).forEach(key => {
        const sourceId = `${key}-source`;
        if (map.getSource(sourceId)) map.getSource(sourceId).setData(filtradas[key]);
    });
    window.datosActualesParaKPI = filtradas;
    filtroCategoriaLuminarias = null;
    calcularKPIs();
    refrescarStatsSiAbierto();
}

function restaurarDatosCompletos() {
    filtroActivo = { tipo: 'todos', nombre: null, geometria: null };
    aplicarDatosFiltrados(capasData);
}

/* ── Helpers de estadísticas ───────────────────────────────────────── */

/**  fechas en múltiples formatos (dd/mm/yyyy, ISO, etc.). */
function parsearFechaFlexible(valor) {
    if (!valor || valor === 'null' || valor === 'None') return null;
    const s = String(valor).trim();

    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m) {
        const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
        return isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(s);
    return (isNaN(d.getTime()) || d.getFullYear() < 2000) ? null : d;
}

/**
 * Categoriza un reclamo según el texto de su descripción.
 */
function categorizarReclamo(texto) {
    const cats = APP_CONFIG.popupReclamos?.categorias;
    if (!cats) return 'Otros';

    const t = String(texto || '').toLowerCase().trim();
    if (!t) return 'Otros';

    for (const [categoria, palabras] of Object.entries(cats)) {
        for (const kw of palabras) {
            if (t.includes(kw.toLowerCase())) return categoria;
        }
    }
    return 'Otros';
}

/** features por un campo. Nulos/vacíos agrupados bajo `labelVacio`. */
function contarPorCampo(features, campos, labelVacio = 'Sin dato') {
    const acc = {};
    features.forEach(f => {
        let v = getCampo(f.properties || {}, campos, null);
        if (v === null || v === '') v = labelVacio;
        else v = String(v).trim();
        acc[v] = (acc[v] || 0) + 1;
    });
    return acc;
}

/** Convierte {label: valor} en array ordenado desc por valor. */
function toRanking(obj) {
    return Object.entries(obj)
        .map(([label, valor]) => ({ label, valor }))
        .sort((a, b) => b.valor - a.valor);
}

/** Suma km TOTALES de una capa. */
function sumarKmTotal(datos, capaKey) {
    return (datos[capaKey]?.features || []).reduce((acc, f) =>
        acc + getCampoNumero(f.properties || {}, ['km', 'KM'], 0), 0);
}

/** Ranking de estado/material sumando el km declarado. */
function rankingPorKm(features, campos, camposKm, color) {
    if (!features.length) return '';
    const acc = {};
    features.forEach(f => {
        const p = f.properties || {};
        const k = getCampo(p, campos, 'Sin dato');
        const km = getCampoNumero(p, camposKm, 0);
        acc[k] = (acc[k] || 0) + km;
    });
    const items = toRanking(acc).map(it => ({ label: it.label, valor: +it.valor.toFixed(2) }));
    return ranking(items, color);
}


/* ══════════════════════════════════════════════════════════════════════
   04 · MAPA
   ══════════════════════════════════════════════════════════════════════ */

const map = new maplibregl.Map({
    container: 'map',
    style: ESTILOS_MAPA[estiloActual],
    center: APP_CONFIG.municipio.mapaInicial.center,
    zoom: APP_CONFIG.municipio.mapaInicial.zoom,
    preserveDrawingBuffer: true
});

const styleSelect = document.getElementById('map-style-select');
const themeToggleBtn = document.getElementById('theme-toggle');
let modoVisual = localStorage.getItem('theme-mode') || 'light';

function cambiarEstiloMapa(nuevoEstilo) {
    if (!ESTILOS_MAPA[nuevoEstilo]) return;
    estiloActual = nuevoEstilo;
    localStorage.setItem('map-style', nuevoEstilo);
    if (styleSelect.value !== nuevoEstilo) styleSelect.value = nuevoEstilo;
    map.setStyle(ESTILOS_MAPA[estiloActual]);
    map.once('idle', () => inyectarFuentesYCapas());
}

function aplicarModoVisual(modo) {
    modoVisual = modo;
    const esOscuro = modo === 'dark';
    document.documentElement.classList.toggle('dark', esOscuro);
    document.documentElement.dataset.theme = esOscuro ? 'dark' : 'light';
    if (themeToggleBtn) {
        themeToggleBtn.setAttribute('aria-pressed', String(esOscuro));
        themeToggleBtn.title = esOscuro ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
    }
    localStorage.setItem('theme-mode', modo);
}
aplicarModoVisual(modoVisual);

styleSelect.addEventListener('change', (e) => {
    const estilo = e.target.value;
    if (estilo === 'dark' || estilo === 'light') aplicarModoVisual(estilo);
    cambiarEstiloMapa(estilo);
});

themeToggleBtn.addEventListener('click', () => {
    const nuevoModo = modoVisual === 'dark' ? 'light' : 'dark';
    aplicarModoVisual(nuevoModo);
    if (nuevoModo === 'dark') cambiarEstiloMapa('dark');
    if (nuevoModo === 'light' && estiloActual === 'dark') cambiarEstiloMapa('light');
});

function aplicarModoCalorArbolado(activo) {
    modoCalorArbolado = Boolean(activo);
    if (map.getLayer('arbolado-heatmap-layer')) {
        map.setLayoutProperty('arbolado-heatmap-layer', 'visibility', activo ? 'visible' : 'none');
    }
    if (map.getLayer('arbolado-layer')) {
        map.setPaintProperty('arbolado-layer', 'circle-opacity', activo ? 0.22 : 0.85);
    }
    const btn = document.getElementById('btn-heatmap-arbolado');
    if (btn) btn.classList.toggle('is-active', activo);
}


/* ══════════════════════════════════════════════════════════════════════
   05 · WIDGET DE COORDENADAS EN VIVO
   ══════════════════════════════════════════════════════════════════════ */

function inicializarWidgetCoordenadas() {
    const el = document.getElementById('coords-value');
    if (!el) return;
    const dec = CONFIG_UI.coordenadas.decimales;
    const formatear = (lngLat) => `Lat ${lngLat.lat.toFixed(dec)} · Lon ${lngLat.lng.toFixed(dec)}`;

    map.on('mousemove', (e) => { el.textContent = formatear(e.lngLat); });
    map.on('mouseout',  () => { el.textContent = '— · —'; });
    map.on('click', (e) => { el.textContent = formatear(e.lngLat); });
}


/* ══════════════════════════════════════════════════════════════════════
   06 · BUSCADOR OSM + GEOCODIFICACIÓN INVERSA
   ══════════════════════════════════════════════════════════════════════ */

function inicializarBuscadorOSM() {
    const input   = document.getElementById('osm-search-input');
    const resultados = document.getElementById('osm-search-results');
    if (!input || !resultados) return;

    let temporizador = null;
    let marcadorBusqueda = null;

    const construirUrl = (q) => {
        const p = new URLSearchParams({ ...CONFIG_UI.busqueda.params, q });
        if (CONFIG_UI.busqueda.viewbox) p.set('viewbox', CONFIG_UI.busqueda.viewbox);
        if (CONFIG_UI.busqueda.bounded) p.set('bounded', CONFIG_UI.busqueda.bounded);
        return `${CONFIG_UI.busqueda.url}?${p.toString()}`;
    };

    const limpiarResultados = () => { resultados.innerHTML = ''; resultados.classList.add('hidden'); };

    const irALugar = (item) => {
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        map.flyTo({ center: [lon, lat], zoom: CONFIG_UI.busqueda.zoomResultado });

        if (marcadorBusqueda) marcadorBusqueda.remove();
        marcadorBusqueda = new maplibregl.Marker({ color: PALETA.seleccion.ANILLO })
            .setLngLat([lon, lat])
            .setPopup(new maplibregl.Popup().setText(item.display_name))
            .addTo(map);

        input.value = item.display_name;
        limpiarResultados();
    };

    const renderResultados = (items) => {
        resultados.innerHTML = '';
        if (!items.length) { limpiarResultados(); return; }
        items.forEach(item => {
            const li = document.createElement('button');
            li.type = 'button';
            li.className = 'osm-result-item';
            li.textContent = item.display_name;
            li.addEventListener('click', () => irALugar(item));
            resultados.appendChild(li);
        });
        resultados.classList.remove('hidden');
    };

    input.addEventListener('input', () => {
        clearTimeout(temporizador);
        const q = input.value.trim();
        if (q.length < 3) { limpiarResultados(); return; }

        temporizador = setTimeout(async () => {
            try {
                const res = await fetch(construirUrl(q));
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                renderResultados(await res.json());
            } catch (err) {
                console.error('[LUX] Error en búsqueda Nominatim', err);
                limpiarResultados();
            }
        }, CONFIG_UI.busqueda.debounceMs);
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#osm-search-box')) limpiarResultados();
    });
}

let consultaInversaEnCurso = false;

function mostrarClicEnFicha(lngLat) {
    const el = document.getElementById('coords-click-value');
    if (el) {
        const dec = CONFIG_UI.coordenadas.decimales;
        el.textContent = `Lat ${lngLat.lat.toFixed(dec)} · Lon ${lngLat.lng.toFixed(dec)}`;
    }
    consultaInversaNominatim(lngLat);
}

function consultaInversaNominatim(lngLat) {
    if (!CONFIG_UI.busqueda.reverseGeocode || consultaInversaEnCurso) return;
    const cont = document.getElementById('info-ubicacion');
    if (!cont) return;

    consultaInversaEnCurso = true;
    const p = new URLSearchParams({
        format: 'jsonv2', lat: lngLat.lat, lon: lngLat.lng,
        'accept-language': 'es', zoom: 18
    });

    fetch(`${CONFIG_UI.busqueda.reverseUrl}?${p.toString()}`)
        .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
        .then(json => {
            const direccion = json?.display_name;
            if (direccion) { cont.textContent = direccion; cont.classList.remove('hidden'); }
            else cont.classList.add('hidden');
        })
        .catch(err => { console.warn('[LUX] Reverse geocoding no disponible', err); cont.classList.add('hidden'); })
        .finally(() => { consultaInversaEnCurso = false; });
}


/* ══════════════════════════════════════════════════════════════════════
   07 · CARGA DE DATOS GEOJSON + GOOGLE SHEETS
   ══════════════════════════════════════════════════════════════════════ */

function normalizarGeoJSON(data, key) {
    if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
        console.error(`[LUX] GeoJSON inválido en la fuente "${key}"`, data);
        return geojsonVacio;
    }
    return data;
}

/*  CSV tolerante: comillas dobles, comas internas y saltos CRLF. */
function parsearCSV(texto) {
    const filas = [];
    let fila = [], campo = '', entreComillas = false;
    for (let i = 0; i < texto.length; i++) {
        const ch = texto[i];
        if (entreComillas) {
            if (ch === '"') {
                if (texto[i + 1] === '"') { campo += '"'; i++; }
                else entreComillas = false;
            } else campo += ch;
        } else if (ch === '"') entreComillas = true;
        else if (ch === ',') { fila.push(campo); campo = ''; }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && texto[i + 1] === '\n') i++;
            fila.push(campo); campo = '';
            if (fila.length > 1 || fila[0] !== '') filas.push(fila);
            fila = [];
        } else campo += ch;
    }
    if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
    return filas;
}

function csvReclamosAGeoJSON(texto) {
    const cfgCsv = APP_CONFIG.reclamosCsv || {};
    const filas = parsearCSV(texto);
    if (filas.length < 2) return geojsonVacio;

    const cabeceras = filas[0].map(h => h.trim());
    const idxDe = (variantes) => {
        for (const v of variantes || []) {
            const i = cabeceras.findIndex(h => h.toLowerCase() === String(v).toLowerCase());
            if (i >= 0) return i;
        }
        return -1;
    };

    const iLat = idxDe(cfgCsv.camposCoordenadas?.lat);
    const iLng = idxDe(cfgCsv.camposCoordenadas?.lng);
    const iNro  = idxDe(['Nro', 'nro', 'codigo', 'CODIGO']);
    const iUsr  = idxDe(APP_CONFIG.popupReclamos.usuario);
    const iArea = idxDe(APP_CONFIG.popupReclamos.area);
    const iTipo = idxDe(APP_CONFIG.popupReclamos.tipo);
    const iDesc = idxDe(APP_CONFIG.popupReclamos.descripcion);
    const iFec  = idxDe(APP_CONFIG.popupReclamos.fecha);
    const iSol  = idxDe(APP_CONFIG.popupReclamos.fechaSolucion);

    if (iLat < 0 || iLng < 0) {
        console.warn('[LUX] El CSV de reclamos no expone columnas de coordenadas reconocibles.');
        return geojsonVacio;
    }

    const val = (fila, i) => (i >= 0 ? String(fila[i] ?? '').trim() : '');
    const features = [];
    filas.slice(1).forEach(fila => {
        const lat = parseFloat(val(fila, iLat).replace(',', '.'));
        const lng = parseFloat(val(fila, iLng).replace(',', '.'));
        if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;
        features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lng, lat] },
            properties: {
                nro: val(fila, iNro), usuario: val(fila, iUsr), area: val(fila, iArea),
                tipo: val(fila, iTipo), descripcion: val(fila, iDesc),
                fecha: val(fila, iFec), fecha_solucion: val(fila, iSol)
            }
        });
    });

    console.info(`[LUX] Reclamos integrados desde Google Sheets: ${features.length} registros.`);
    return { type: 'FeatureCollection', features };
}

function cargarReclamosDesdeSheets() {
    const url = APP_CONFIG.reclamosCsv?.url || FUENTES_DATA.reclamos;
    return fetch(url, { cache: 'no-store' })
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const ct = res.headers.get('content-type') || '';
            return (ct.includes('json') && !url.includes('out:csv')) ? res.json() : res.text();
        })
        .then(payload => {
            const data = (typeof payload === 'string')
                ? csvReclamosAGeoJSON(payload)
                : normalizarGeoJSON(payload, 'reclamos');
            return { key: 'reclamos', data };
        })
        .catch(error => {
            console.error('[LUX] No se pudo integrar Google Sheets (reclamos)', error);
            return { key: 'reclamos', data: geojsonVacio };
        });
}

function cargarTodosLosGeoJSON() {
    const peticiones = Object.keys(FUENTES_DATA).map(key =>
        key === 'reclamos'
            ? cargarReclamosDesdeSheets()
            : fetch(FUENTES_DATA[key], { cache: 'no-store' })
                .then(res => { if (!res.ok) throw new Error(`${res.status}`); return res.json(); })
                .then(json => ({ key, data: normalizarGeoJSON(json, key) }))
                .catch(error => {
                    console.error(`[LUX] No se pudo cargar la fuente "${key}"`, error);
                    return { key, data: geojsonVacio };
                })
    );

    Promise.all(peticiones).then(resultados => {
        resultados.forEach(res => {
            if (res.key === 'distritos') distritosData = res.data;
            else capasData[res.key] = res.data;
        });

        window.datosActualesParaKPI = capasData;
        inyectarFuentesYCapas();
        registrarInteraccionMapa();
        configurarBotonesPrenderApagar();
        calcularKPIs();
        inicializarFiltroDistritos();
        actualizarFechaDesdeCapas();
        renderizarLeyenda();
        sincronizarColoresDesplegables();
    });
}


/* ══════════════════════════════════════════════════════════════════════
   08 · CONSTRUCCIÓN DE CAPAS
   ══════════════════════════════════════════════════════════════════════ */

function colorPorTecnologiaLuminaria() {
    const campos = CONFIG_CAPAS.luminarias.simbologiaCampo;
    const valor = ['upcase', ['to-string', ['coalesce', ...campos.map(c => ['get', c]), '']]];
    return ['case',
        ['in', 'LED', valor], PALETA.luminarias.LED,
        ['any', ['in', 'SAP', valor], ['in', 'SODIO', valor]], PALETA.luminarias.SODIO,
        PALETA.luminarias.OTROS];
}

function colorPorEstadoArbolado() {
    const campo = CONFIG_CAPAS.arbolado.simbologiaCampo;
    return ['match', ['upcase', ['coalesce', ...campo.map(c => ['get', c]), 'OTROS']],
        'BUENO',   PALETA.arbolado.BUENO,
        'REGULAR', PALETA.arbolado.REGULAR,
        'MALO',    PALETA.arbolado.MALO,
        PALETA.arbolado.OTROS];
}

function colorPorSuperficieVialidad() {
    const campo = CONFIG_CAPAS.vialidades.simbologiaCampo;
    return ['match', ['upcase', ['coalesce', ...campo.map(c => ['get', c]), 'SIN DATO']],
        'PAVIMENTADO', PALETA.vialidades.PAVIMENTADO,
        'PAVIMENTADA', PALETA.vialidades.PAVIMENTADO,
        'CONSOLIDADA', PALETA.vialidades.CONSOLIDADA,
        'TIERRA',      PALETA.vialidades.TIERRA,
        PALETA.vialidades['SIN DATO']];
}

function inyectarFuentesYCapas() {
    const vis = key => visibilidadCapas[key] ? 'visible' : 'none';
    const datos = datosActuales();

    // Lateral vial
    agregarCapaLinea('cordon', 'cordon-source', 'cordon-layer',
        { color: PALETA.lateralVial.CORDON, ancho: 1.8, opacidad: 0.82 });
    agregarCapaLinea('banquina_vereda', 'banquina-vereda-source', 'banquina-vereda-layer',
        { color: PALETA.lateralVial.BANQUINA_VEREDA, ancho: 1.6, opacidad: 0.78 });
    agregarCapaLinea('cuneta', 'cuneta-source', 'cuneta-layer',
        { color: PALETA.lateralVial.CUNETA, ancho: 1.5, opacidad: 0.78 });

    // Vialidades
    if (!map.getSource('vialidades-source')) {
        map.addSource('vialidades-source', { type: 'geojson', data: datos.vialidades });
        map.addLayer({
            id: 'vialidades-layer', type: 'line', source: 'vialidades-source',
            paint: { 'line-width': 3.5, 'line-color': colorPorSuperficieVialidad() },
            layout: { visibility: vis('vialidades'), 'line-cap': 'round', 'line-join': 'round' }
        });
    }

    // Arbolado
    if (!map.getSource('arbolado-source')) {
        map.addSource('arbolado-source', { type: 'geojson', data: datos.arbolado });
        const hm = PALETA.heatmapArbolado;
        map.addLayer({
            id: 'arbolado-heatmap-layer', type: 'heatmap', source: 'arbolado-source', maxzoom: 18,
            paint: {
                'heatmap-weight': 1,
                'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 0.7, 17, 1.5],
                'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 10, 12, 17, 28],
                'heatmap-opacity': 0.72,
                'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
                    0, hm[0], 0.25, hm[1], 0.5, hm[2], 0.75, hm[3], 1, hm[4]]
            },
            layout: { visibility: modoCalorArbolado ? 'visible' : 'none' }
        });
        map.addLayer({
            id: 'arbolado-layer', type: 'circle', source: 'arbolado-source',
            paint: {
                'circle-radius': 4, 'circle-opacity': 0.85, 'circle-stroke-width': 0.5,
                'circle-stroke-color': 'rgba(15, 23, 42, 0.4)',
                'circle-color': colorPorEstadoArbolado()
            },
            layout: { visibility: vis('arbolado') }
        });
    }

    // Luminarias
    if (!map.getSource('luminarias-source')) {
        map.addSource('luminarias-source', { type: 'geojson', data: datos.luminarias });
        map.addLayer({
            id: 'luminarias-layer', type: 'circle', source: 'luminarias-source',
            paint: {
                'circle-color': colorPorTecnologiaLuminaria(),
                'circle-radius': 4, 'circle-stroke-width': 0.8, 'circle-stroke-color': '#0f172a'
            },
            layout: { visibility: vis('luminarias') }
        });
    }

    // Solicitudes
    if (!map.getSource('reclamos-source')) {
        map.addSource('reclamos-source', { type: 'geojson', data: datos.reclamos });
        map.addLayer({
            id: 'reclamos-layer', type: 'circle', source: 'reclamos-source',
            paint: {
                'circle-color': PALETA.reclamos.HALO, 'circle-radius': 10,
                'circle-opacity': 0.38, 'circle-blur': 0.35,
                'circle-stroke-width': 1.8, 'circle-stroke-color': PALETA.reclamos.TRAZO,
                'circle-stroke-opacity': 0.90
            },
            layout: { visibility: vis('reclamos') }
        });
        map.addLayer({
            id: 'reclamos-punteado-layer', type: 'symbol', source: 'reclamos-source',
            layout: { 'text-field': '···', 'text-size': 12, 'text-allow-overlap': true, visibility: vis('reclamos') },
            paint: {
                'text-color': PALETA.reclamos.TEXTO, 'text-opacity': 0.95,
                'text-halo-color': PALETA.reclamos.TRAZO, 'text-halo-width': 0.6
            }
        });
    }

    // Capas de dibujo / zona filtrada
    if (!map.getSource('source-poligono-dibujo')) {
        map.addSource('source-poligono-dibujo', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    }

    if (!map.getLayer('capa-poligono-halo')) {
        map.addLayer({
            id: 'capa-poligono-halo', type: 'line', source: 'source-poligono-dibujo',
            filter: ['in', ['geometry-type'], 'Polygon', 'LineString'],
            paint: {
                'line-color': PALETA.seleccion.ZONA_HALO,
                'line-width': ['interpolate', ['linear'], ['zoom'], 8, 6, 12, 9, 16, 12],
                'line-opacity': 0.18, 'line-blur': 3
            }
        });
    }

    if (!map.getLayer('capa-poligono-fill')) {
        map.addLayer({
            id: 'capa-poligono-fill', type: 'fill', source: 'source-poligono-dibujo',
            filter: ['==', ['geometry-type'], 'Polygon'],
            paint: { 'fill-color': PALETA.seleccion.ZONA_RELLENO, 'fill-opacity': 0.3 }
        });
    }

    if (!map.getLayer('capa-poligono-line')) {
        map.addLayer({
            id: 'capa-poligono-line', type: 'line', source: 'source-poligono-dibujo',
            filter: ['in', ['geometry-type'], 'Polygon', 'LineString'],
            paint: {
                'line-color': PALETA.seleccion.ZONA_BORDE,
                'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.8, 12, 2.2, 16, 2.8],
                'line-opacity': 0.3, 'line-dasharray': [3, 1.5]
            }
        });
    }

    if (!map.getLayer('capa-poligono-vertices')) {
        map.addLayer({
            id: 'capa-poligono-vertices', type: 'circle', source: 'source-poligono-dibujo',
            filter: ['==', ['geometry-type'], 'Point'],
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4, 16, 7],
                'circle-color': PALETA.seleccion.ZONA_VERTICE,
                'circle-stroke-width': 2,
                'circle-stroke-color': PALETA.seleccion.ZONA_BORDE,
                'circle-opacity': 0.95
            }
        });
    }
}

/** Helper: fuente + capa lineal genérica. */
function agregarCapaLinea(dataKey, sourceId, layerId, estilo) {
    if (map.getSource(sourceId)) return;
    map.addSource(sourceId, { type: 'geojson', data: datosActuales()[dataKey] });
    map.addLayer({
        id: layerId, type: 'line', source: sourceId,
        paint: { 'line-color': estilo.color, 'line-width': estilo.ancho, 'line-opacity': estilo.opacidad },
        layout: { visibility: visibilidadCapas[dataKey] ? 'visible' : 'none', 'line-cap': 'round', 'line-join': 'round' }
    });
}


/* ══════════════════════════════════════════════════════════════════════
   09 · LEYENDA DINÁMICA
   ══════════════════════════════════════════════════════════════════════ */

function renderizarLeyenda() {
    const cont = document.getElementById('legend-body');
    if (!cont) return;
    const S = PALETA;

    const filaPunto = (color, texto) =>
        `<div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full border border-slate-500" style="background:${color}"></span>${texto}</div>`;
    const filaLinea = (color, texto, alto = 3) =>
        `<div class="flex items-center gap-2"><span class="w-7 rounded" style="height:${alto}px;background:${color}"></span>${texto}</div>`;

    cont.innerHTML = `
        <div class="legend-group-title">Luminarias</div>
        ${filaPunto(S.luminarias.LED, 'LED')}
        ${filaPunto(S.luminarias.SODIO, 'Sodio / SAP')}
        ${filaPunto(S.luminarias.OTROS, 'Otros')}
        <div class="legend-group-title">Arbolado</div>
        ${filaPunto(S.arbolado.BUENO, 'Bueno')}
        ${filaPunto(S.arbolado.REGULAR, 'Regular')}
        ${filaPunto(S.arbolado.MALO, 'Malo')}
        <div class="legend-group-title">Vialidad</div>
        ${filaLinea(S.vialidades.PAVIMENTADO, 'PAVIMENTADO')}
        ${filaLinea(S.lateralVial.CORDON, 'Cordón', 2)}
        ${filaLinea(S.lateralVial.BANQUINA_VEREDA, 'Banquina / Vereda', 2)}
        ${filaLinea(S.lateralVial.CUNETA, 'Cuneta', 2)}
        <div class="legend-group-title">Solicitudes</div>
        <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full blur-[1px] border" style="background:${S.reclamos.HALO}33;border-color:${S.reclamos.TRAZO}"></span>
            Solicitud
        </div>`;
}

/** Sincroniza los puntos de color de los desplegables KPI con PALETA. */
function sincronizarColoresDesplegables() {
    document.querySelectorAll('[data-sym]').forEach(el => {
        const [grupo, categoria] = el.dataset.sym.split(':');
        const color = PALETA[grupo]?.[categoria];
        if (color) {
            el.style.background = color;
            el.classList.remove('bg-cyan-400', 'bg-orange-400', 'bg-slate-400',
                               'bg-slate-700', 'bg-slate-500', 'bg-slate-300',
                               'bg-slate-800', 'bg-slate-600');
        }
    });
}


/* ══════════════════════════════════════════════════════════════════════
   10 · INTERACCIÓN CON EL MAPA
   ══════════════════════════════════════════════════════════════════════ */

let interaccionRegistrada = false;
function registrarInteraccionMapa() {
    if (interaccionRegistrada) return;
    interaccionRegistrada = true;

    map.on('click', (e) => {
        if (dibujoPoligono.activo) {
            dibujoPoligono.coordenadas.push([e.lngLat.lng, e.lngLat.lat]);
            actualizarGeometriaVisualNativa();
            actualizarBarraPoligono();
            return;
        }

        mostrarClicEnFicha(e.lngLat);

        const features = map.queryRenderedFeatures(e.point, { layers: capasInteractivas() });
        if (!features || features.length === 0) { limpiarSeleccion(); return; }
        const feature = features[0];

        if (feature.layer.id === CONFIG_CAPAS.reclamos.id) {
            abrirPopupReclamo(feature);
        }
        mostrarFicha(feature);
    });

    map.on('mousemove', (e) => {
        if (dibujoPoligono.activo) return;
        const features = map.queryRenderedFeatures(e.point, { layers: capasInteractivas() });
        map.getCanvas().style.cursor = (features && features.length) ? 'pointer' : '';
    });
}

/** Formatea valores KM en la ficha lateral según configuración. */
function formatearValorFicha(etiqueta, valor) {
    if (valor === null || valor === undefined || valor === '') return '-';
    const esKm = /^\s*km\b/i.test(String(etiqueta));
    if (!esKm) return valor;

    const num = parseFloat(String(valor).replace(',', '.'));
    if (isNaN(num)) return valor;

    const dec = CONFIG_UI.decimales?.kmFichaLateral ?? 2;
    return num.toFixed(dec);
}


/* ══════════════════════════════════════════════════════════════════════
   11 · FICHA LATERAL DINÁMICA
   ----------------------------------------------------------------------
   Renderiza la ficha técnica del activo seleccionado a partir de
   `config.capas.*.fichaPrimaria` + `fichaSecundaria`.


   ══════════════════════════════════════════════════════════════════════ */

/**
 * Si se pasa `acumulador`, guarda cada para uso posterior (PDF).
 */
function renderCeldasFicha(containerId, items, props, acumulador = null) {
    const cont = document.getElementById(containerId);
    if (!cont) return;
    cont.innerHTML = '';
    if (!items || items.length === 0) return;

    items.forEach((item, idx) => {
        const valor = getCampo(props, item.campos, null);
        const valorFmt = formatearValorFicha(item.etiqueta, valor);

        const celda = document.createElement('div');
        celda.className = 'ficha-celda';
        if (idx % 2 === 0) celda.classList.add('border-r');
        celda.innerHTML = `
            <span class="ficha-label">${item.etiqueta}</span>
            <span class="ficha-valor">${valorFmt}</span>
        `;
        cont.appendChild(celda);

        // Acumula para reuso (ej: exportación PDF)
        if (acumulador) acumulador.push({ etiqueta: item.etiqueta, valor: valorFmt });
    });
}

/** Completa la ficha técnica con los atributos del feature seleccionado. */
function mostrarFicha(feature) {
    const props = feature.properties || {};
    const configInfo = getConfigPorCapaId(feature.layer.id);
    if (!configInfo) return;
    const { config } = configInfo;

    // Encabezado: ID + Elemento
    setTexto('info-id', getCampo(props, config.idCampo, 'N/A'));
    setTexto('info-elemento', config.elementoFijo || '-');

    // Recolecta todos los {etiqueta, valor} para reuso en el PDF
    const valoresFicha = [];

    renderCeldasFicha('ficha-primaria',   config.fichaPrimaria   || [], props, valoresFicha);
    renderCeldasFicha('ficha-secundaria', config.fichaSecundaria || [], props, valoresFicha);

    // Guarda el estado actual del activo seleccionado
    window.activoSeleccionadoConfig = { config, valores: valoresFicha };

    // Reset del acordeón al cambiar de feature
    const sec = document.getElementById('ficha-secundaria');
    if (sec) sec.classList.add('hidden');
    const chevron = document.getElementById('chevron-ver-mas');
    if (chevron) chevron.style.transform = 'rotate(0deg)';
    const label = document.getElementById('label-ver-mas');
    if (label) label.textContent = 'Ver más campos';

    actualizarStreetView(feature);
}

function coordsDelFeature(feature) {
    const geom = feature.geometry;
    if (!geom) return null;
    if (geom.type === 'Point') return geom.coordinates;
    if (geom.type === 'LineString' && geom.coordinates.length) {
        return geom.coordinates[Math.floor(geom.coordinates.length / 2)];
    }
    return null;
}

function actualizarStreetView(feature) {
    const coords = coordsDelFeature(feature);
    if (!coords) return;

    const [lon, lat] = coords;
    const strLat = lat.toString();
    const strLon = lon.toString();

    window.activoSeleccionadoLat = strLat;
    window.activoSeleccionadoLon = strLon;
    destacarPuntoEnMapa(lon, lat);

    const iframe = document.getElementById('street-view-frame');
    const placeholder = document.getElementById('sv-placeholder');

    if (placeholder) placeholder.classList.add('hidden');
    if (iframe) {
        iframe.classList.remove('hidden');
        iframe.src = `https://maps.google.com/maps?q=${strLat},${strLon}&cbll=${strLat},${strLon}&layer=c&panoid=&cbp=12,0,0,0,0&source=embed&output=svembed`;
    }

    const btn = document.getElementById('btn-sv-external');
    if (btn) {
        btn.href = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${strLat},${strLon}`;
        btn.classList.remove('pointer-events-none', 'opacity-50');
    }
}

function destacarPuntoEnMapa(lng, lat) {
    const sourceId = 'source-seleccion-activo';
    const punto = {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] } }]
    };

    if (map.getSource(sourceId)) {
        map.getSource(sourceId).setData(punto);
        return;
    }

    map.addSource(sourceId, { type: 'geojson', data: punto });
    map.addLayer({
        id: 'layer-seleccion-glow', type: 'circle', source: sourceId,
        paint: { 'circle-radius': 22, 'circle-color': PALETA.seleccion.ANILLO, 'circle-opacity': 0.15 }
    });
    map.addLayer({
        id: 'layer-seleccion-ring', type: 'circle', source: sourceId,
        paint: {
            'circle-radius': 16, 'circle-color': 'transparent',
            'circle-stroke-width': 2, 'circle-stroke-color': PALETA.seleccion.ANILLO,
            'circle-stroke-opacity': 0.6
        }
    });
    map.addLayer({
        id: 'layer-seleccion-activo', type: 'circle', source: sourceId,
        paint: {
            'circle-radius': 8, 'circle-color': PALETA.seleccion.CENTRO,
            'circle-stroke-width': 3, 'circle-stroke-color': PALETA.seleccion.ANILLO
        }
    });
}

function limpiarSeleccion() {
    const sourceId = 'source-seleccion-activo';
    if (map.getSource(sourceId)) {
        map.getSource(sourceId).setData({ type: 'FeatureCollection', features: [] });
    }
    // Borrar la config guardada para que el PDF no tome datos viejos
    window.activoSeleccionadoConfig = null;
}

/* ══════════════════════════════════════════════════════════════════════
   12 · POPUP DE SOLICITUDES
   ══════════════════════════════════════════════════════════════════════ */

function abrirPopupReclamo(feature) {
    const props = feature.properties || {};
    const coords = coordsDelFeature(feature) || [];
    const P = APP_CONFIG.popupReclamos;

    const descripcion   = getCampo(props, P.descripcion, 'Sin descripción');
    const tipo          = getCampo(props, P.tipo, 'No especificado');
    const usuario       = getCampo(props, P.usuario, 'No especificado');
    const area          = getCampo(props, P.area, 'Sin área');
    const fecha         = getCampo(props, P.fecha, 'Sin dato');
    const fechaSolucion = getCampo(props, P.fechaSolucion, 'Pendiente');

    const html = `
        <div style="font-family: var(--font-ui, sans-serif); padding: 12px; max-width: 300px; color: #0f172a;">
            <div style="display:flex; justify-content:space-between; border-bottom:1px solid #e2e8f0; padding-bottom:8px; margin-bottom:10px;">
                <span style="font-size:11px; font-weight:700; text-transform:uppercase; color:#dc2626; letter-spacing:0.05em;">Detalle del Reclamo</span>
                <span style="font-size:9.5px; font-weight:700; background:#fee2e2; color:#991b1b; padding:2px 6px; border-radius:4px;">${tipo}</span>
            </div>
            <p style="font-size:11.5px; margin:0 0 10px 0; background:#f8fafc; padding:8px; border-radius:6px; border:1px solid #f1f5f9;">${descripcion}</p>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                <div style="background:#f8fafc; padding:6px 8px; border-radius:6px;"><small style="font-size:8.5px; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Área</small><br><b style="font-size:10.5px;">${area}</b></div>
                <div style="background:#f8fafc; padding:6px 8px; border-radius:6px;"><small style="font-size:8.5px; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Usuario</small><br><b style="font-size:10.5px;">${usuario}</b></div>
                <div style="background:#f1f5f9; padding:6px 8px; border-radius:6px;"><small style="font-size:8.5px; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Fecha</small><br><b style="font-size:10.5px;">${fecha}</b></div>
                <div style="background:#f1f5f9; padding:6px 8px; border-radius:6px;"><small style="font-size:8.5px; color:#64748b; text-transform:uppercase; letter-spacing:0.05em;">Solución</small><br><b style="font-size:10.5px; color:#059669;">${fechaSolucion}</b></div>
            </div>
        </div>
    `;

    new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: '310px' })
        .setLngLat(coords)
        .setHTML(html)
        .addTo(map);
}


/* ══════════════════════════════════════════════════════════════════════
   13 · BRANDING Y FECHA DE ACTUALIZACIÓN
   ══════════════════════════════════════════════════════════════════════ */

function aplicarConfiguracionMunicipal() {
    const { municipio } = APP_CONFIG;

    // El título  desde config.js → municipio.tituloAplicacion + municipio.nombre
   
    document.title = `Lux Leasing — ${municipio.tituloAplicacion}`;

    const h1 = document.querySelector('header h1');
    if (h1) {
        h1.innerHTML = `${municipio.tituloAplicacion} <span class="text-slate-500 mx-1.5">•</span> Municipio de ${municipio.nombre}`;
    }

    const enlaces = document.querySelectorAll('header a');
    const imagenes = document.querySelectorAll('header a img');
    if (enlaces[0]) enlaces[0].href = municipio.branding.logoLux.href;
    if (imagenes[0]) imagenes[0].src = municipio.branding.logoLux.src;
    if (enlaces[1]) enlaces[1].href = municipio.branding.logoMunicipio.href;
    if (imagenes[1]) imagenes[1].src = municipio.branding.logoMunicipio.src;
}

function actualizarFechaDesdeCapas() {
    const camposFecha = APP_CONFIG.camposGlobales.fechaActualizacion;
    let fechaMax = null;

    (capasData.luminarias.features || []).forEach(f => {
        const fecha = parsearFechaFlexible(getCampo(f.properties || {}, camposFecha, null));
        if (fecha && fecha.getFullYear() >= 2020) {
            if (!fechaMax || fecha > fechaMax) fechaMax = fecha;
        }
    });

    const el = document.getElementById('fecha-ultima-actualizacion');
    if (!el) return;
    el.innerText = fechaMax
        ? fechaMax.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : 'Sin dato';
}


/* ══════════════════════════════════════════════════════════════════════
   14 · BOTONES DE CAPAS DEL ENCABEZADO
   ══════════════════════════════════════════════════════════════════════ */

function configurarBotonesPrenderApagar() {
    const definiciones = {
        luminarias:  { btn: 'btn-mod-luminarias', layers: ['luminarias-layer'] },
        arbolado:    { btn: 'btn-mod-arbolado',   layers: ['arbolado-layer'] },
        vialidades:  { btn: 'btn-mod-vialidades', layers: ['vialidades-layer'] },
        cordon:      { btn: 'btn-mod-cordon',     layers: ['cordon-layer', 'banquina-vereda-layer', 'cuneta-layer'], keys: ['cordon', 'banquina_vereda', 'cuneta'] },
        reclamos:    { btn: 'btn-mod-reclamos',   layers: ['reclamos-layer', 'reclamos-punteado-layer'] }
    };

    const setEstadoVisual = (btn, activo) => {
        if (!btn) return;
        btn.classList.toggle('layer-button-off', !activo);
        btn.classList.toggle('layer-button-on', activo);
        btn.setAttribute('aria-pressed', String(activo));
    };

    const aplicarVisibilidad = (key, activo) => {
        const def = definiciones[key];
        (def.keys || [key]).forEach(k => { visibilidadCapas[k] = activo; });
        def.layers.forEach(layerId => {
            if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', activo ? 'visible' : 'none');
        });
        setEstadoVisual(document.getElementById(def.btn), activo);
    };

    const estanTodosActivos = () => Object.keys(definiciones).every(key =>
        (definiciones[key].keys || [key]).every(k => visibilidadCapas[k]));

    Object.entries(definiciones).forEach(([key, def]) => {
        const btn = document.getElementById(def.btn);
        if (!btn || btn.dataset.ready === '1') return;
        btn.dataset.ready = '1';

        const keys = def.keys || [key];
        setEstadoVisual(btn, keys.some(k => visibilidadCapas[k]));
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            aplicarVisibilidad(key, !keys.some(k => visibilidadCapas[k]));
            actualizarBotonTodos();
        });
    });

    const btnTodos = document.getElementById('btn-mod-todos');
    const actualizarBotonTodos = () => {
        if (!btnTodos) return;
        btnTodos.classList.toggle('opacity-50', !estanTodosActivos());
        btnTodos.setAttribute('aria-pressed', String(estanTodosActivos()));
    };

    if (btnTodos && btnTodos.dataset.ready !== '1') {
        btnTodos.dataset.ready = '1';
        btnTodos.addEventListener('click', (e) => {
            e.preventDefault();
            const encender = !estanTodosActivos();
            Object.keys(definiciones).forEach(key => aplicarVisibilidad(key, encender));
            actualizarBotonTodos();
        });
    }
    actualizarBotonTodos();
}

/* ══════════════════════════════════════════════════════════════════════
   15 · KPIs
   ══════════════════════════════════════════════════════════════════════ */

function pct(parte, total) {
    return total ? ((parte / total) * 100).toFixed(1) + '%' : '0%';
}

function sumarKmPresencia(datos, capaKey) {
    const cfg = CONFIG_CAPAS[capaKey]?.kpis?.presencia;
    if (!cfg) return 0;
    return (datos[capaKey]?.features || []).reduce((acc, f) => {
        const props = f.properties || {};
        const presente = getCampoUpper(props, cfg.campo, '') === String(cfg.valorEsperado || 'SI').toUpperCase();
        return acc + (presente ? getCampoNumero(props, cfg.campoKm, 0) : 0);
    }, 0);
}

function calcularKPIs() {
    const datos = datosActuales();

    // ── Luminarias ──
    const luminarias = datos.luminarias?.features || [];
    const totalLum = luminarias.length;
    const camposTec = CONFIG_CAPAS.luminarias?.kpis?.tecnologia?.campo || ['sap', 'SAP'];

    let led = 0, sodio = 0, otrosLum = 0;
    luminarias.forEach(f => {
        const tipo = getCampoUpper(f.properties || {}, camposTec, '');
        if (tipo.includes('LED')) led++;
        else if (tipo.includes('SAP') || tipo.includes('SODIO')) sodio++;
        else otrosLum++;
    });
    animarContador('kpi-total', totalLum);
    setTexto('kpi-led', `${led.toLocaleString()} (${pct(led, totalLum)})`);
    setTexto('kpi-sodio', `${sodio.toLocaleString()} (${pct(sodio, totalLum)})`);
    setTexto('kpi-lum-otros', `${otrosLum.toLocaleString()} (${pct(otrosLum, totalLum)})`);

    // ── Arbolado ──
    const arbolado = datos.arbolado?.features || [];
    const campoEstado = CONFIG_CAPAS.arbolado?.kpis?.estado?.campo || ['estado_s', 'ESTADO_S'];
    const estados = { BUENO: 0, REGULAR: 0, MALO: 0, OTROS: 0 };
    arbolado.forEach(f => {
        const v = getCampoUpper(f.properties || {}, campoEstado, '');
        if (v === 'BUENO') estados.BUENO++;
        else if (v === 'REGULAR') estados.REGULAR++;
        else if (v === 'MALO') estados.MALO++;
        else estados.OTROS++;
    });
    animarContador('kpi-arb-total', arbolado.length);
    const idsEstado = { BUENO: 'kpi-arb-bueno', REGULAR: 'kpi-arb-regular', MALO: 'kpi-arb-malo', OTROS: 'kpi-arb-otros' };
    Object.entries(idsEstado).forEach(([k, id]) => {
        setTexto(id, `${estados[k].toLocaleString()} (${pct(estados[k], arbolado.length)})`);
    });

    // ── Vialidades ──
    const viales = datos.vialidades?.features || [];
    const cfgVial = CONFIG_CAPAS.vialidades?.kpis?.superficie || {};
    const kmVial = { PAVIMENTADO: 0, CONSOLIDADA: 0, TIERRA: 0, 'SIN DATO': 0 };
    viales.forEach(f => {
        const props = f.properties || {};
        const sup = getCampoUpper(props, cfgVial.campo || ['superficie'], 'SIN DATO');
        const km = getCampoNumero(props, cfgVial.campoKm || ['km', 'KM'], 0);
        if (sup.includes('PAVIMENTAD')) kmVial.PAVIMENTADO += km;
        else if (sup.includes('CONSOLIDADA')) kmVial.CONSOLIDADA += km;
        else if (sup.includes('TIERRA')) kmVial.TIERRA += km;
        else kmVial['SIN DATO'] += km;
    });
    const totalKm = Object.values(kmVial).reduce((a, b) => a + b, 0);
    setTexto('kpi-vial-total', `${totalKm.toFixed(1)} km`);
    setTexto('kpi-vial-pav', `${kmVial.PAVIMENTADO.toFixed(1)} km`);
    setTexto('kpi-vial-cons', `${kmVial.CONSOLIDADA.toFixed(1)} km`);
    setTexto('kpi-vial-tierra', `${kmVial.TIERRA.toFixed(1)} km`);
    setTexto('kpi-vial-sd', `${kmVial['SIN DATO'].toFixed(1)} km`);

    const cfgZonaVial = CONFIG_CAPAS.vialidades?.kpis?.zona;
    if (cfgZonaVial) {
        const kmZona = { DPV: 0, MUNICIPAL: 0, OTRO: 0 };
        viales.forEach(f => {
            const props = f.properties || {};
            const z = getCampoUpper(props, cfgZonaVial.campo, '');
            const km = getCampoNumero(props, cfgZonaVial.campoKm || ['km', 'KM'], 0);
            if (z.includes('DPV')) kmZona.DPV += km;
            else if (z.includes('MUN')) kmZona.MUNICIPAL += km;
            else kmZona.OTRO += km;
        });
        setTexto('kpi-vial-dpv', `${kmZona.DPV.toFixed(1)} km`);
        setTexto('kpi-vial-mun', `${kmZona.MUNICIPAL.toFixed(1)} km`);
        setTexto('kpi-vial-otro', `${kmZona.OTRO.toFixed(1)} km`);
    }

    // ── Lateral vial ──
    const kmCordon = sumarKmPresencia(datos, 'cordon');
    const kmBanq = sumarKmPresencia(datos, 'banquina_vereda');
    const kmCuneta = sumarKmPresencia(datos, 'cuneta');
    setTexto('kpi-cordon-total', `${(kmCordon + kmBanq + kmCuneta).toFixed(1)} km`);
    setTexto('kpi-cordon-con', `${kmCordon.toFixed(1)} km`);
    setTexto('kpi-banquina-con', `${kmBanq.toFixed(1)} km`);
    setTexto('kpi-cuneta-con', `${kmCuneta.toFixed(1)} km`);

    // ── Solicitudes ──
    // Total + categorización automática según el texto de la descripción.
    const reclamos = datos.reclamos?.features || [];
    const campoDescRec = APP_CONFIG.popupReclamos.descripcion || ['descripcion', 'Descripción'];

    animarContador('kpi-rec-total', reclamos.length);

    const porCategoria = {};
    reclamos.forEach(f => {
        const texto = getCampo(f.properties || {}, campoDescRec, '');
        const cat = categorizarReclamo(texto);
        porCategoria[cat] = (porCategoria[cat] || 0) + 1;
    });

    const contCat = document.getElementById('drop-reclamos-categorias');
    if (contCat) {
        const items = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]);
        contCat.innerHTML = items.length
            ? items.map(([label, n]) => `
                <div class="dropdown-row">
                    <span class="text-slate-300 truncate">${label}</span>
                    <span class="font-bold text-slate-300">${n.toLocaleString()}</span>
                </div>`).join('')
            : '<div class="text-[11px] text-slate-500 py-1">Sin datos.</div>';
    }
}

/* ══════════════════════════════════════════════════════════════════════
   16 · FILTROS POR DISTRITO
   ══════════════════════════════════════════════════════════════════════ */

const norm = s => String(s || '').trim().toUpperCase();

function geometriaConsultaDistrito(distritoFeature) {
    const metros = CONFIG_UI.filtroDistrito.bufferMetros || 0;
    if (metros > 0 && typeof turf !== 'undefined') {
        try {
            return turf.buffer(distritoFeature, metros / 1000, { units: 'kilometers' });
        } catch (err) {
            console.warn('[LUX] turf.buffer falló; se usa el polígono sin buffer', err);
        }
    }
    return distritoFeature;
}

function featureIntersectaGeometria(feature, geometriaConsulta) {
    try {
        if (typeof turf === 'undefined') throw new Error('[LUX] Turf.js no cargado');
        const geom = feature.geometry;
        if (!geom) return false;
        if (geom.type === 'Point') return turf.booleanPointInPolygon(feature, geometriaConsulta);
        return turf.booleanIntersects(feature, geometriaConsulta);
    } catch (err) {
        const pt = coordsRepresentativas(feature);
        const polys = (geometriaConsulta.geometry?.type === 'FeatureCollection')
            ? geometriaConsulta.features : [geometriaConsulta];
        return pt ? polys.some(p => puntoEnPoligono(pt, p.geometry)) : false;
    }
}

function puntoEnPoligono(pt, geom) {
    const [x, y] = pt;
    const rings = geom.type === 'Polygon' ? [geom.coordinates[0]]
        : geom.type === 'MultiPolygon' ? geom.coordinates.map(r => r[0])
        : [];
    let inside = false;
    for (const ring of rings) {
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const [xi, yi] = ring[i];
            const [xj, yj] = ring[j];
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
    }
    return inside;
}

function coordsRepresentativas(feature) {
    const g = feature.geometry;
    if (!g) return null;
    if (g.type === 'Point') return g.coordinates;
    if (g.type === 'LineString') return g.coordinates[Math.floor(g.coordinates.length / 2)];
    if (g.type === 'Polygon') return g.coordinates[0][0];
    if (g.type === 'MultiPolygon') return g.coordinates[0][0][0];
    return null;
}

function aplicarFiltroGeometrico(geometriaConsulta, nombreFiltro) {
    const filtradas = {};
    Object.keys(capasData).forEach(key => {
        filtradas[key] = {
            type: 'FeatureCollection',
            features: (capasData[key].features || []).filter(f => featureIntersectaGeometria(f, geometriaConsulta))
        };
    });
    filtroActivo = { tipo: 'distrito', nombre: nombreFiltro, geometria: geometriaConsulta };
    aplicarDatosFiltrados(filtradas);
    pintarGeometriaDeConsulta(geometriaConsulta);
    dibujoPoligono.aplicado = true;
    actualizarBarraPoligono();
    encuadrarZona(geometriaConsulta);
}

function encuadrarZona(zonaFeature) {
    if (!zonaFeature?.geometry) return;

    let bbox;
    try {
        bbox = (typeof turf !== 'undefined' && turf.bbox)
            ? turf.bbox(zonaFeature)
            : bboxManual(zonaFeature.geometry);
    } catch (err) {
        console.warn('[LUX] No se pudo calcular el bbox de la zona', err);
        return;
    }
    if (!bbox || bbox.length !== 4 || bbox.some(v => !isFinite(v))) return;

    const cfg = CONFIG_UI.filtroDistrito?.zoomAlFiltrar || {};
    map.fitBounds(
        [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
        { padding: cfg.padding ?? 60, duration: cfg.duracionMs ?? 900, maxZoom: cfg.maxZoom ?? 16 }
    );
}

function bboxManual(geom) {
    const coords = [];
    const recorrer = (arr) => {
        if (typeof arr[0] === 'number') coords.push(arr);
        else arr.forEach(recorrer);
    };
    recorrer(geom.coordinates);
    if (!coords.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    coords.forEach(([x, y]) => {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    });
    return [minX, minY, maxX, maxY];
}

function pintarGeometriaDeConsulta(geometria) {
    const source = map.getSource('source-poligono-dibujo');
    if (!source || !geometria) return;

    const feat = (geometria.type === 'Feature')
        ? geometria
        : { type: 'Feature', geometry: geometria, properties: {} };

    source.setData({ type: 'FeatureCollection', features: [feat] });
}

function aplicarFiltroDistrito(nombreDistrito) {
    if (!nombreDistrito || norm(nombreDistrito) === norm('Todos')) {
        restaurarDatosCompletos();
        return;
    }
    const campoNombre = APP_CONFIG.camposGlobales.distritoNombre;
    const distritoFeat = (distritosData.features || []).find(f =>
        norm(getCampo(f.properties || {}, campoNombre, '')) === norm(nombreDistrito)
    );
    if (!distritoFeat) {
        console.warn(`[LUX] Distrito no encontrado en los datos: "${nombreDistrito}"`);
        return;
    }
    aplicarFiltroGeometrico(geometriaConsultaDistrito(distritoFeat), nombreDistrito);
}

function inicializarFiltroDistritos() {
    const select = document.getElementById('filtro-distrito');
    if (!select) return;

    const campoNombre = APP_CONFIG.camposGlobales.distritoNombre;
    const nombres = [...new Set(
        (distritosData.features || [])
            .map(f => getCampo(f.properties || {}, campoNombre, ''))
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b));

    nombres.forEach(nombre => {
        const op = document.createElement('option');
        op.value = nombre;
        op.innerText = nombre;
        select.appendChild(op);
    });

    select.addEventListener('change', (e) => aplicarFiltroDistrito(e.target.value));
}


/* ══════════════════════════════════════════════════════════════════════
   17 · SELECCIÓN ESPACIAL POR POLÍGONO DIBUJADO
   ══════════════════════════════════════════════════════════════════════ */

const dibujoPoligono = {
    activo: false,
    aplicado: false,
    coordenadas: []
};

function alternarDibujoPoligono() {
    if (dibujoPoligono.activo) finalizarDibujoPoligono();
    else iniciarDibujoPoligono();
}

function iniciarDibujoPoligono() {
    dibujoPoligono.activo = true;
    dibujoPoligono.aplicado = false;
    dibujoPoligono.coordenadas = [];
    map.getCanvas().style.cursor = 'crosshair';

    const btn = document.getElementById('btn-bbox-select');
    if (btn) {
        btn.classList.add('tool-active');
        btn.title = 'Dibujando… clic para marcar vértices.';
    }

    actualizarGeometriaVisualNativa();
    actualizarBarraPoligono();
}

function finalizarDibujoPoligono() {
    dibujoPoligono.activo = false;
    map.getCanvas().style.cursor = '';
    const btn = document.getElementById('btn-bbox-select');
    if (btn) {
        btn.classList.remove('tool-active');
        btn.title = 'Dibujar zona de selección (clic para marcar vértices)';
    }
}

function actualizarGeometriaVisualNativa() {
    const source = map.getSource('source-poligono-dibujo');
    if (!source) return;

    const coords = dibujoPoligono.coordenadas;
    const features = [];

    if (coords.length >= 3) {
        features.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [[...coords, coords[0]]] },
            properties: {}
        });
    } else if (coords.length === 2) {
        features.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: coords },
            properties: {}
        });
    }

    coords.forEach(c => {
        features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: c },
            properties: {}
        });
    });

    source.setData({ type: 'FeatureCollection', features });
}

function actualizarBarraPoligono() {
    const barra = document.getElementById('bbox-toolbar');
    if (!barra) return;
    const visible = dibujoPoligono.activo || dibujoPoligono.aplicado;
    barra.classList.toggle('hidden', !visible);
}

function aplicarFiltroPoligono() {
    const coords = dibujoPoligono.coordenadas;

    if (coords.length < 3) {
        alert('Debes marcar al menos 3 puntos para formar un polígono.');
        return;
    }
    if (typeof turf === 'undefined') {
        console.error('[LUX] Turf.js no está cargado.');
        return;
    }

    const anillo = [...coords, coords[0]];
    const poligonoFeature = turf.polygon([anillo]);
    const geometriaPoligono = poligonoFeature.geometry;

    const filtradas = {};
    Object.keys(capasData).forEach(key => {
        const originales = capasData[key]?.features || [];
        const dentro = originales.filter(f => featureIntersectaGeometria(f, geometriaPoligono));
        filtradas[key] = { type: 'FeatureCollection', features: dentro };
    });

    filtroActivo = { tipo: 'poligono', nombre: 'Selección por polígono', geometria: poligonoFeature };
    aplicarDatosFiltrados(filtradas);

    dibujoPoligono.aplicado = true;
    dibujoPoligono.activo = false;
    map.getCanvas().style.cursor = '';
    const btn = document.getElementById('btn-bbox-select');
    if (btn) {
        btn.classList.remove('tool-active');
        btn.title = 'Dibujar zona de selección (clic para marcar vértices)';
    }
    actualizarBarraPoligono();
}

function restaurarFiltroPoligono() {
    dibujoPoligono.aplicado = false;
    dibujoPoligono.activo = false;
    dibujoPoligono.coordenadas = [];
    actualizarGeometriaVisualNativa();

    const source = map.getSource('source-poligono-dibujo');
    if (source) source.setData({ type: 'FeatureCollection', features: [] });

    restaurarDatosCompletos();

    const select = document.getElementById('filtro-distrito');
    if (select) select.value = 'Todos';

    actualizarBarraPoligono();
}

function inicializarHerramientaBbox() {
    const btnDibujar = document.getElementById('btn-bbox-select');
    if (btnDibujar && btnDibujar.dataset.ready !== '1') {
        btnDibujar.dataset.ready = '1';
        btnDibujar.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            alternarDibujoPoligono();
        });
    }

    const btnAplicar = document.getElementById('btn-bbox-apply');
    if (btnAplicar && btnAplicar.dataset.ready !== '1') {
        btnAplicar.dataset.ready = '1';
        btnAplicar.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            aplicarFiltroPoligono();
        });
    }

    const btnRestaurar = document.getElementById('btn-bbox-reset');
    if (btnRestaurar && btnRestaurar.dataset.ready !== '1') {
        btnRestaurar.dataset.ready = '1';
        btnRestaurar.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            restaurarFiltroPoligono();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && dibujoPoligono.activo) finalizarDibujoPoligono();
    });
}


/* ══════════════════════════════════════════════════════════════════════
   18 · PANEL DE ESTADÍSTICAS EJECUTIVO
   ══════════════════════════════════════════════════════════════════════ */

const statsChartInstances = {};
let seccionStatsAbierta = sessionStorage.getItem('stats-open') || 'luminarias';

function destruirChartsStats() {
    Object.keys(statsChartInstances).forEach(k => {
        statsChartInstances[k]?.destroy();
        delete statsChartInstances[k];
    });
}

function refrescarStatsSiAbierto() {
    const panel = document.getElementById('stats-panel');
    if (panel && !panel.classList.contains('translate-x-full')) {
        renderizarEstadisticas();
    }
}

/* ── Helpers de presentación ───────────────────────────────────────── */

function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
}

function kpi(label, valor, sub, tooltip, acento) {
    const info = tooltip
        ? `<span title="${esc(tooltip)}" style="color:var(--stats-sub);cursor:help;margin-left:4px;font-size:11px;">?</span>`
        : '';
    return `
        <div class="rounded-md px-3 py-2.5"
             style="background:var(--stats-celda-bg);border:1px solid var(--stats-celda-border);">
            <div class="flex items-center text-[11px] font-medium mb-1"
                 style="color:var(--stats-label);">
                <span>${esc(label)}</span>${info}
            </div>
            <div class="text-[16px] font-semibold tabular-nums leading-tight"
                 style="color:${acento || 'var(--stats-valor)'};">${valor}</div>
            ${sub ? `<div class="text-[11px] mt-0.5" style="color:var(--stats-sub);">${sub}</div>` : ''}
        </div>`;
}

function nota(texto, nivel) {
    const colores = { danger: '#dc2626', warn: '#d97706', ok: '#16a34a' };
    return `
        <div class="pl-2.5 border-l-2 text-[12px] leading-snug"
             style="border-color:${colores[nivel] || '#a1a1aa'};color:var(--stats-label);">
            ${texto}
        </div>`;
}

function barraApilada(items, alto = 6) {
    const total = items.reduce((a, b) => a + b.valor, 0) || 1;
    const segs = items.map(it => {
        const w = (it.valor / total) * 100;
        return w > 0 ? `<div style="width:${w}%;background:${it.color};" title="${esc(it.label)}: ${it.valor.toLocaleString('es-AR')}"></div>` : '';
    }).join('');
    const leyenda = items.map(it => `
        <div class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full" style="background:${it.color};"></span>
            <span class="text-[11px]" style="color:var(--stats-label);">${esc(it.label)}</span>
            <span class="text-[11px] font-medium tabular-nums" style="color:var(--stats-valor);">${it.valor.toLocaleString('es-AR')}</span>
        </div>`).join('');
    return `
        <div class="flex overflow-hidden rounded-sm" style="height:${alto}px;background:var(--stats-celda-border);">
            ${segs}
        </div>
        <div class="flex flex-wrap gap-x-3.5 gap-y-1 mt-2">${leyenda}</div>`;
}

function ranking(items, color = '#52525b', max = 8) {
    if (!items.length) {
        return `<div class="text-[11px] py-1.5" style="color:var(--stats-sub);">Sin datos.</div>`;
    }
    const top = items.slice(0, max);
    const maxVal = Math.max(...top.map(i => i.valor), 1);
    return top.map((it, i) => `
        <div class="flex items-center gap-2 py-[3px]">
            <span class="text-[11px] tabular-nums w-4 text-right flex-shrink-0" style="color:var(--stats-sub);">${i + 1}</span>
            <span class="text-[12px] truncate flex-1" style="color:var(--stats-valor);" title="${esc(it.label)}">${esc(it.label)}</span>
            <span class="text-[11px] font-medium tabular-nums flex-shrink-0" style="color:var(--stats-label);">${it.valor.toLocaleString('es-AR')}</span>
            <div class="w-12 rounded-sm h-[3px] overflow-hidden flex-shrink-0" style="background:var(--stats-celda-border);">
                <div style="width:${(it.valor / maxVal) * 100}%;background:${color};height:3px;"></div>
            </div>
        </div>`).join('');
}

function fila(label, valor, tooltip) {
    const info = tooltip
        ? `<span title="${esc(tooltip)}" style="color:var(--stats-sub);cursor:help;margin-left:4px;font-size:11px;">?</span>`
        : '';
    return `
        <div class="flex justify-between items-baseline py-[5px]" style="border-bottom:1px solid var(--stats-celda-border);">
            <span class="text-[12px]" style="color:var(--stats-label);">${esc(label)}${info}</span>
            <span class="text-[12px] font-medium tabular-nums" style="color:var(--stats-valor);">${valor}</span>
        </div>`;
}

function sub(texto) {
    return `<div class="text-[11px] font-medium mb-1.5 mt-3 first:mt-0" style="color:var(--stats-sub);">${esc(texto)}</div>`;
}

function fmtNum(v, dec = 0) {
    return v.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function getDistritoDeFeature(feature) {
    if (!distritosData.features?.length || !feature?.geometry) return null;
    const campo = APP_CONFIG.camposGlobales.distritoNombre;
    const pt = coordsRepresentativas(feature);
    if (!pt) return null;
    for (const d of distritosData.features) {
        try {
            if (turf.booleanPointInPolygon(turf.point(pt), d)) {
                return getCampo(d.properties, campo, null);
            }
        } catch (e) {}
    }
    return null;
}

/* ── LUMINARIAS ────────────────────────────────────────────────────── */

function renderStatsLuminarias() {
    const datos = datosActuales().luminarias?.features || [];
    const eco   = APP_CONFIG.estadisticas?.economia || {};
    const alertCfg = APP_CONFIG.estadisticas?.alertas || {};

    const campoPot       = CONFIG_CAPAS.luminarias.kpis.potencia.campo;
    const campoSoporte   = ['soporte', 'SOPORTE'];
    const campoFuncion   = ['funcion', 'FUNCION'];
    const campoZona      = ['zona', 'ZONA'];
    const campoFechaAct  = APP_CONFIG.camposGlobales.fechaActualizacion;

    const acento = PALETA.luminarias.LED;

    let led = 0, sodio = 0, otros = 0;
    let wLed = 0, wSodio = 0, wOtros = 0;
    let sinPotencia = 0;
    let ledConFecha = 0, ledVencidos = 0, ledPorVencer = 0;

    const hoy = new Date();
    const aniosVida = eco.vidaUtilLedAnios || 5;
    const umbralVencer = 0.8;

    const porZona = {};

    datos.forEach(f => {
        const p = f.properties || {};
        const t = clasificarTecnologiaLuminaria(f);

        const potRaw = getCampo(p, campoPot, null);
        const pot = potRaw != null ? parseFloat(String(potRaw).replace(',', '.')) : NaN;
        const tienePot = !isNaN(pot) && pot > 0;

        if (t === 'LED') {
            led++;
            if (tienePot) wLed += pot; else sinPotencia++;

            const fv = parsearFechaFlexible(getCampo(p, campoFechaAct, null));
            if (fv) {
                ledConFecha++;
                const edadAnios = (hoy - fv) / (1000 * 60 * 60 * 24 * 365.25);
                if (edadAnios >= aniosVida) ledVencidos++;
                else if (edadAnios >= aniosVida * umbralVencer) ledPorVencer++;
            }
        } else if (t === 'SODIO') {
            sodio++;
            if (tienePot) wSodio += pot; else sinPotencia++;
        } else {
            otros++;
            if (tienePot) wOtros += pot; else sinPotencia++;
        }

        const zona = getCampoUpper(p, campoZona, '') || 'SIN DATO';
        if (!porZona[zona]) porZona[zona] = { total: 0, led: 0, sodio: 0, otros: 0 };
        porZona[zona].total++;
        if (t === 'LED')        porZona[zona].led++;
        else if (t === 'SODIO') porZona[zona].sodio++;
        else                    porZona[zona].otros++;
    });

    const total      = datos.length;
    const pctLed     = total ? (led / total) * 100 : 0;
    const pctSodio   = total ? (sodio / total) * 100 : 0;
    const pctConPot  = total ? ((total - sinPotencia) / total) * 100 : 0;
    const kwTotal    = (wLed + wSodio + wOtros) / 1000;
    const kwhMes     = kwTotal * 11 * 30;   // 11 hs/día · 30 días

    const pctLedVenc = ledConFecha ? (ledVencidos / ledConFecha) * 100 : 0;
    const pctPorVencer = ledConFecha ? (ledPorVencer / ledConFecha) * 100 : 0;
    const pctDentroVida = ledConFecha ? (100 - pctLedVenc - pctPorVencer) : 0;

    const porSoporte = contarPorCampo(datos, campoSoporte, 'Sin dato');
    const porFuncion = contarPorCampo(datos, campoFuncion, 'Sin dato');

    const porDistritoSodio = {};
    datos.forEach(f => {
        if (clasificarTecnologiaLuminaria(f) !== 'SODIO') return;
        const d = getDistritoDeFeature(f);
        if (d) porDistritoSodio[d] = (porDistritoSodio[d] || 0) + 1;
    });
    const topDistritosSodio = toRanking(porDistritoSodio);

    return `
        <div class="p-4 space-y-3">
            <div class="grid grid-cols-2 gap-2">
                ${kpi('Potencia instalada',
                     fmtNum(kwTotal, 1) + ' kW',
                     `Cobertura: ${fmtNum(pctConPot, 0)}% del parque`)}
                ${kpi('Consumo estimado',
                     fmtNum(kwhMes, 0) + ' kWh/mes',
                     '11 hs/día · 30 días')}
                ${kpi('% LED',
                     fmtNum(pctLed, 1) + '%',
                     `${fmtNum(led)} de ${fmtNum(total)}`, null, acento)}
                ${kpi('% Sodio',
                     fmtNum(pctSodio, 1) + '%',
                     `${fmtNum(sodio)} luminarias`)}
            </div>

            ${sub('Composición del parque')}
            ${barraApilada([
                { label: 'LED',   valor: led,   color: PALETA.luminarias.LED },
                { label: 'Sodio', valor: sodio, color: PALETA.luminarias.SODIO },
                { label: 'Otros', valor: otros, color: PALETA.luminarias.OTROS }
            ])}
            ${pctSodio > (alertCfg.porcentajeSodioCritico || 30)
                ? nota(`${fmtNum(pctSodio, 1)}% del parque continúa en sodio.`, 'warn')
                : nota(`${fmtNum(pctLed, 1)}% del parque ya reconvertido a LED.`, 'ok')}

            ${ledConFecha > 0 ? `
                ${sub('Vida útil del parque LED')}
                <div class="rounded-md px-3 py-2" style="background:var(--stats-celda-bg);border:1px solid var(--stats-celda-border);">
                    ${fila('Porcentaje en rango de vida útil',
                           fmtNum(pctDentroVida, 1) + '%',
                           `${fmtNum(led - ledVencidos - ledPorVencer)} de ${fmtNum(ledConFecha)} LED con fecha válida`)}
                    ${fila('Próximos a recambiar',
                           fmtNum(pctPorVencer, 1) + '%',
                           `${fmtNum(ledPorVencer)} LED · ≥ ${Math.round(aniosVida * 0.8)} años`)}
                    ${fila('Fuera de vida útil',
                           fmtNum(pctLedVenc, 1) + '%',
                           `${fmtNum(ledVencidos)} LED · ≥ ${aniosVida} años`)}
                </div>
            ` : `
                ${sub('Vida útil del parque LED')}
                ${nota('Sin fechas de instalación válidas. Se recomienda incorporar fecha_inst al inventario.', 'warn')}
            `}

            ${sub('Parque por zona')}
            <div class="rounded-md px-3 py-2" style="background:var(--stats-celda-bg);border:1px solid var(--stats-celda-border);">
                ${toRanking(Object.fromEntries(Object.entries(porZona).map(([k,v]) => [k, v.total])))
                    .map(z => {
                        const zz = porZona[z.label];
                        const pLed = zz.total ? (zz.led / zz.total) * 100 : 0;
                        return fila(z.label, `${fmtNum(zz.total)} lum · ${fmtNum(pLed, 0)}% LED`);
                    }).join('')}
            </div>

            ${sub('Tipo de soporte predominante')}
            <div>${ranking(toRanking(porSoporte), '#52525b', 6)}</div>

            ${sub('Cantidad por función')}
            <div>${ranking(toRanking(porFuncion), '#52525b', 6)}</div>

            ${topDistritosSodio.length ? `
                ${sub('Distritos con más luminarias de sodio')}
                <div>${ranking(topDistritosSodio, '#d97706')}</div>
            ` : ''}
        </div>
    `;
}

/* ── ÁRBOLES ───────────────────────────────────────────────────────── */

function renderStatsArbolado() {
    const datos = datosActuales().arbolado?.features || [];
    const alertCfg = APP_CONFIG.estadisticas?.alertas || {};
    const cfgArb   = APP_CONFIG.estadisticas?.arbolado || {};

    const campoEstadoSan  = CONFIG_CAPAS.arbolado.kpis.estado.campo;
    const campoEstadoVeg  = ['Estado vegetativo', 'ESTADO_VEGETATIVO'];
    const campoEspecie    = CONFIG_CAPAS.arbolado.kpis.especie.campo;
    const campoCalle      = ['calle', 'CALLE', 'CALLE_1'];
    const campoNicho      = ['Presencia de nicho', 'Presencia', 'presencia'];
    const campoRiego      = ['Riego', 'RIEGO'];
    const campoObs        = ['Observaciones', 'OBSERVACIONES'];

    const acento = PALETA.arbolado.BUENO;

    let bueno = 0, regular = 0, malo = 0, otros = 0;
    let vegMalo = 0;
    let nichosVacios = 0;
    let sinRiego = 0;

    const especies         = {};
    const callesMalas      = {};
    const callesVacias     = {};
    const callesVeredaRota = {};

    datos.forEach(f => {
        const p = f.properties || {};

        const v = getCampoUpper(p, campoEstadoSan, '');
        if (v === 'BUENO') bueno++;
        else if (v === 'REGULAR') regular++;
        else if (v === 'MALO') malo++;
        else otros++;

        const veg = getCampoUpper(p, campoEstadoVeg, '');
        if (veg === 'MALO') vegMalo++;

        const nicho = getCampoUpper(p, campoNicho, '');
        const esVacio = nicho === (cfgArb.valorNichoVacio || 'NO');
        if (esVacio) nichosVacios++;

        const riego = getCampoUpper(p, campoRiego, '');
        if (riego === 'NO' || riego === 'SIN RIEGO' || riego === '') sinRiego++;

        const esp = getCampo(p, campoEspecie, 'Sin especie');
        const kEsp = (esp === '' || esp === 'NULL') ? 'Sin especie' : String(esp).trim();
        especies[kEsp] = (especies[kEsp] || 0) + 1;

        const calle = getCampo(p, campoCalle, null);
        const numeracion = getCampo(p, ['Numeración de la calle','numeracion','NUMERACION'], '');
        if (calle) {
            const kCalle = String(calle).trim();
            const kNr    = String(numeracion).trim();
            const clave  = kNr ? `${kCalle} (${kNr})` : kCalle;

            if (v === 'MALO') callesMalas[clave] = (callesMalas[clave] || 0) + 1;
            if (esVacio)      callesVacias[kCalle] = (callesVacias[kCalle] || 0) + 1;

            const obs = String(getCampo(p, campoObs, '')).toLowerCase();
            const mencionaVereda = obs.includes('vereda') || obs.includes('acera');
            const mencionaDanio  = obs.includes('rota') || obs.includes('rot') ||
                                   obs.includes('dañ') || obs.includes('deterior') ||
                                   obs.includes('roto') || obs.includes('quebrad');
            if (mencionaVereda && mencionaDanio) {
                callesVeredaRota[clave] = (callesVeredaRota[clave] || 0) + 1;
            }
        }
    });

    const total = datos.length;
    const indice = total ? ((malo * 3) + (vegMalo * 3) + (regular * 1)) / total : 0;
    const nivel = indice < 0.5 ? 'ok' : indice < 1.2 ? 'warn' : 'danger';

    const topEspecies = toRanking(especies).slice(0, 10);
    const topMalas    = toRanking(callesMalas);
    const topVacias   = toRanking(callesVacias);
    const topVereda   = toRanking(callesVeredaRota);

    return `
        <div class="p-4 space-y-3">
            <div class="grid grid-cols-2 gap-2">
                ${kpi('Total', fmtNum(total), 'árboles inventariados')}
                ${kpi('Índice de riesgo', indice.toFixed(2),
                     '0 óptimo · 3 crítico · sanitario+vegetativo')}
                ${kpi('Nichos vacíos', fmtNum(nichosVacios),
                     total ? fmtNum((nichosVacios / total) * 100, 1) + '%' : null)}
                ${kpi('Sin riego', fmtNum(sinRiego),
                     total ? fmtNum((sinRiego / total) * 100, 1) + '%' : null)}
            </div>

            ${sub('Estado sanitario')}
            ${barraApilada([
                { label: 'Bueno',   valor: bueno,   color: PALETA.arbolado.BUENO },
                { label: 'Regular', valor: regular, color: PALETA.arbolado.REGULAR },
                { label: 'Malo',    valor: malo,    color: PALETA.arbolado.MALO },
                { label: 'Otros',   valor: otros,   color: PALETA.arbolado.OTROS }
            ])}
            ${nota(
                nivel === 'ok'
                    ? 'Arbolado en buen estado general.'
                    : `${fmtNum((malo / total) * 100, 1)}% sanitario malo · ${fmtNum(vegMalo)} vegetativos malos · índice ${indice.toFixed(2)}.`,
                nivel
            )}

            ${topEspecies.length ? `
                ${sub('Especies más frecuentes (top 10)')}
                <div>${ranking(topEspecies, acento, 10)}</div>
            ` : ''}

            ${topMalas.length ? `
                ${sub('Calles con más árboles en mal estado (calle + numeración)')}
                <div>${ranking(topMalas, PALETA.arbolado.MALO)}</div>
            ` : ''}

            ${topVacias.length ? `
                ${sub('Calles con más nichos vacíos')}
                <div>${ranking(topVacias, '#a1a1aa')}</div>
            ` : ''}

            ${topVereda.length ? `
                ${sub('Calles con afectación en vereda (según Observaciones)')}
                <div>${ranking(topVereda, '#a16207')}</div>
            ` : ''}
        </div>
    `;
}

/* ── VIALIDADES ────────────────────────────────────────────────────── */

function renderStatsVialidades() {
    const datos = datosActuales().vialidades?.features || [];
    const eco = APP_CONFIG.estadisticas?.economia || {};
    const alertCfg = APP_CONFIG.estadisticas?.alertas || {};
    const cfgSup = CONFIG_CAPAS.vialidades.kpis.superficie;
    const cfgZona = CONFIG_CAPAS.vialidades.kpis.zona;
    const campoMaterial = ['tipo', 'TIPO', 'material', 'MATERIAL', 'superficie', 'SUPERFICIE'];
    const acento = PALETA.vialidades.PAVIMENTADO;

    let kmPav = 0, kmCons = 0, kmTierra = 0, kmSD = 0;
    let kmTierraMunicipal = 0;
    const porDistritoTierra = {};
    const porZona = {};
    const porMaterial = {};

    datos.forEach(f => {
        const p = f.properties || {};
        const sup = getCampoUpper(p, cfgSup.campo, 'SIN DATO');
        const km = getCampoNumero(p, cfgSup.campoKm || ['km', 'KM'], 0);

        let zonaKey = 'Otro';
        if (cfgZona) {
            const z = getCampoUpper(p, cfgZona.campo, 'OTRO');
            if (z.includes('DPV')) zonaKey = 'DPV';
            else if (z.includes('MUN')) zonaKey = 'Municipal';
        }

        if (sup.includes('PAVIMENTAD')) kmPav += km;
        else if (sup.includes('CONSOLIDADA')) kmCons += km;
        else if (sup.includes('TIERRA')) {
            kmTierra += km;
            if (zonaKey === 'Municipal') kmTierraMunicipal += km;
            const d = getDistritoDeFeature(f);
            if (d) porDistritoTierra[d] = (porDistritoTierra[d] || 0) + km;
        } else kmSD += km;

        porZona[zonaKey] = (porZona[zonaKey] || 0) + km;

        const mat = getCampo(p, campoMaterial, null);
        if (mat) {
            const k = String(mat).trim();
            porMaterial[k] = (porMaterial[k] || 0) + km;
        }
    });

    const kmTotal   = kmPav + kmCons + kmTierra + kmSD;
    const pctPav    = kmTotal ? (kmPav / kmTotal) * 100 : 0;
    const pctCons   = kmTotal ? (kmCons / kmTotal) * 100 : 0;
    const pctTierra = kmTotal ? (kmTierra / kmTotal) * 100 : 0;
    const m2TierraMun = kmTierraMunicipal * 1000 * (eco.anchoPromedioVia || 10);

    const topTierra = Object.entries(porDistritoTierra)
        .map(([k, v]) => ({ label: k, valor: parseFloat(v.toFixed(1)) }))
        .sort((a, b) => b.valor - a.valor);
    const topZonas = Object.entries(porZona)
        .map(([k, v]) => ({ label: k, valor: parseFloat(v.toFixed(1)) }))
        .sort((a, b) => b.valor - a.valor);
    const topMat = Object.entries(porMaterial)
        .map(([k, v]) => ({ label: k, valor: parseFloat(v.toFixed(1)) }))
        .sort((a, b) => b.valor - a.valor);

    return `
        <div class="p-4 space-y-3">
            <div class="grid grid-cols-2 gap-2">
                ${kpi('Km totales', fmtNum(kmTotal, 1))}
                ${kpi('Pavimentado', fmtNum(pctPav, 1) + '%', fmtNum(kmPav, 1) + ' km', null, acento)}
                ${kpi('Consolidada', fmtNum(pctCons, 1) + '%', fmtNum(kmCons, 1) + ' km')}
                ${kpi('Tierra', fmtNum(pctTierra, 1) + '%', fmtNum(kmTierra, 1) + ' km')}
            </div>
            ${sub('Distribución por superficie')}
            ${barraApilada([
                { label: 'Pavimentado', valor: parseFloat(kmPav.toFixed(1)),    color: PALETA.vialidades.PAVIMENTADO },
                { label: 'Consolidada', valor: parseFloat(kmCons.toFixed(1)),   color: PALETA.vialidades.CONSOLIDADA },
                { label: 'Tierra',      valor: parseFloat(kmTierra.toFixed(1)), color: PALETA.vialidades.TIERRA },
                { label: 'Sin dato',    valor: parseFloat(kmSD.toFixed(1)),     color: PALETA.vialidades['SIN DATO'] }
            ])}
            ${nota(
                pctTierra > (alertCfg.porcentajeTierraCritico || 20)
                    ? `${fmtNum(pctTierra, 1)}% de la red sin pavimentar.`
                    : `Red vial con buen nivel de pavimentación.`,
                pctTierra > (alertCfg.porcentajeTierraCritico || 20) ? 'warn' : 'ok'
            )}
            ${m2TierraMun > 0 ? `
                <div class="rounded-md px-3 py-2" style="background:var(--stats-celda-bg);border:1px solid var(--stats-celda-border);">
                    ${fila('Superficie estimada a pavimentar (vialidades urbanas)',
                           fmtNum(m2TierraMun / 10000, 1) + ' ha',
                           'sólo zona municipal · 10 m de ancho supuesto')}
                </div>
            ` : ''}
            ${topTierra.length ? `${sub('Distritos con más tierra')}<div>${ranking(topTierra, PALETA.vialidades.TIERRA)}</div>` : ''}
            ${topZonas.length ? `${sub('Km por zona')}<div>${ranking(topZonas, '#52525b')}</div>` : ''}
            ${topMat.length > 1 ? `${sub('Km por tipo de vialidad')}<div>${ranking(topMat, PALETA.vialidades.CONSOLIDADA)}</div>` : ''}
        </div>
    `;
}

/* ── LATERAL VIAL ──────────────────────────────────────────────────── */

function renderStatsLateral() {
    const datos = datosActuales();
    const acento = PALETA.lateralVial.CORDON;

    function kmSiYNo(capaKey) {
        const cfg = CONFIG_CAPAS[capaKey]?.kpis?.presencia;
        if (!cfg) return { si: 0, no: 0, total: 0 };
        const features = datos[capaKey]?.features || [];
        let si = 0, no = 0;
        features.forEach(f => {
            const p = f.properties || {};
            const km = getCampoNumero(p, cfg.campoKm, 0);
            const val = getCampoUpper(p, cfg.campo, '');
            const esSi = val === String(cfg.valorEsperado || 'SI').toUpperCase();
            if (esSi) si += km;
            else      no += km;
        });
        return { si, no, total: si + no };
    }

    const cordonKms = kmSiYNo('cordon');
    const banqKms   = kmSiYNo('banquina_vereda');
    const cunetaKms = kmSiYNo('cuneta');

    const kmCordon = cordonKms.si;
    const kmBanq   = banqKms.si;
    const kmCuneta = cunetaKms.si;

    const pctCordon = cordonKms.total ? (kmCordon / cordonKms.total) * 100 : 0;
    const pctBanq   = banqKms.total   ? (kmBanq   / banqKms.total)   * 100 : 0;
    const pctCuneta = cunetaKms.total ? (kmCuneta / cunetaKms.total) * 100 : 0;

    const rankEstadoCordon = rankingPorKm(
        datos.cordon?.features || [],
        ['cord_estado', 'CORD_ESTADO'],
        ['km_cordon', 'KM_CORDON'],
        PALETA.lateralVial.CORDON
    );
    const rankEstadoBanq = rankingPorKm(
        datos.banquina_vereda?.features || [],
        ['b_v_estado', 'B_V_ESTADO'],
        ['km_b_v', 'KM_B_V'],
        PALETA.lateralVial.BANQUINA_VEREDA
    );
    const rankMaterialCuneta = rankingPorKm(
        datos.cuneta?.features || [],
        ['cun_mat', 'CUN_MAT', 'material', 'MATERIAL'],
        ['km_cuneta', 'KM_CUNETA'],
        PALETA.lateralVial.CUNETA
    );

    return `
        <div class="p-4 space-y-3">
            <div class="text-[11px] italic" style="color:var(--stats-sub);">
                Valores aproximados según existencia declarada del elemento por tramo.
            </div>

            <div class="grid grid-cols-2 gap-2">
                ${kpi('Cordón', `${fmtNum(kmCordon, 1)} km`,
                     `${fmtNum(pctCordon, 0)}% de cobertura`,
                     null, PALETA.lateralVial.CORDON)}
                ${kpi('Banquina / Vereda', `${fmtNum(kmBanq, 1)} km`,
                     `${fmtNum(pctBanq, 0)}% de cobertura`,
                     null, PALETA.lateralVial.BANQUINA_VEREDA)}
                ${kpi('Cuneta', `${fmtNum(kmCuneta, 1)} km`,
                     `${fmtNum(pctCuneta, 0)}% de cobertura`,
                     null, PALETA.lateralVial.CUNETA)}
                ${kpi('Total lateral', `${fmtNum(kmCordon + kmBanq + kmCuneta, 1)} km`,
                     'suma de los tres', null, acento)}
            </div>

            ${sub('Distribución')}
            ${barraApilada([
                { label: 'Cordón',          valor: +kmCordon.toFixed(1), color: PALETA.lateralVial.CORDON },
                { label: 'Banquina/Vereda', valor: +kmBanq.toFixed(1),   color: PALETA.lateralVial.BANQUINA_VEREDA },
                { label: 'Cuneta',          valor: +kmCuneta.toFixed(1), color: PALETA.lateralVial.CUNETA }
            ])}

            ${(cordonKms.no > 0 || banqKms.no > 0 || cunetaKms.no > 0) ? `
                ${sub('Faltante declarado por tramo')}
                <div class="rounded-md px-3 py-2" style="background:var(--stats-celda-bg);border:1px solid var(--stats-celda-border);">
                    ${cordonKms.no > 0 ? fila('Cordón sin presencia', fmtNum(cordonKms.no, 1) + ' km', 'tramos declarados con NO') : ''}
                    ${banqKms.no > 0   ? fila('Banquina/Vereda sin presencia', fmtNum(banqKms.no, 1) + ' km') : ''}
                    ${cunetaKms.no > 0 ? fila('Cuneta sin presencia', fmtNum(cunetaKms.no, 1) + ' km') : ''}
                </div>
            ` : ''}

            ${rankEstadoCordon   ? `${sub('Estado del cordón (km)')}<div>${rankEstadoCordon}</div>` : ''}
            ${rankEstadoBanq     ? `${sub('Estado de banquina / vereda (km)')}<div>${rankEstadoBanq}</div>` : ''}
            ${rankMaterialCuneta ? `${sub('Material de cuneta (km)')}<div>${rankMaterialCuneta}</div>` : ''}
        </div>
    `;
}

/* ── Acordeón maestro ──────────────────────────────────────────────── */

function seccionHTML(id, titulo, resumen, contenido) {
    const abierto = seccionStatsAbierta === id;
    return `
        <div style="border-bottom:1px solid var(--stats-border);">
            <button class="stats-section-header w-full flex items-center justify-between px-4 py-2.5 transition-colors cursor-pointer"
                    data-section="${id}" aria-expanded="${abierto}"
                    style="background:transparent;"
                    onmouseover="this.style.background='var(--stats-hover)'"
                    onmouseout="this.style.background='transparent'">
                <div class="flex items-center gap-2">
                    <span class="stats-chevron text-[10px] transition-transform duration-200"
                          style="color:var(--stats-sub);transform:rotate(${abierto ? 90 : 0}deg);">▶</span>
                    <span class="text-[12px] font-medium" style="color:var(--stats-valor);">${titulo}</span>
                </div>
                <span class="text-[11px] tabular-nums" style="color:var(--stats-sub);">${resumen}</span>
            </button>
            <div class="stats-section-body ${abierto ? '' : 'hidden'}" data-body="${id}">${contenido}</div>
        </div>
    `;
}

function renderizarEstadisticas() {
    const cont = document.getElementById('stats-content');
    if (!cont) return;
    destruirChartsStats();

    const datos = datosActuales();
    const lumCount  = datos.luminarias?.features?.length || 0;
    const arbCount  = datos.arbolado?.features?.length || 0;
    const kmVial    = (datos.vialidades?.features || []).reduce((a, f) => a + getCampoNumero(f.properties || {}, ['km', 'KM'], 0), 0);
    const kmLat     = sumarKmPresencia(datos, 'cordon') + sumarKmPresencia(datos, 'banquina_vereda') + sumarKmPresencia(datos, 'cuneta');

    cont.innerHTML = `
        ${seccionHTML('luminarias', 'Luminarias', fmtNum(lumCount), renderStatsLuminarias())}
        ${seccionHTML('arbolado',   'Árboles',    fmtNum(arbCount), renderStatsArbolado())}
        ${seccionHTML('vialidades', 'Vialidades', fmtNum(kmVial, 1) + ' km', renderStatsVialidades())}
        ${seccionHTML('lateral',    'Lateral vial', fmtNum(kmLat, 1) + ' km', renderStatsLateral())}
    `;

    cont.querySelectorAll('.stats-section-header').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.section;
            const yaAbierto = seccionStatsAbierta === id;

            cont.querySelectorAll('.stats-section-body').forEach(b => b.classList.add('hidden'));
            cont.querySelectorAll('.stats-chevron').forEach(c => c.style.transform = 'rotate(0deg)');
            cont.querySelectorAll('.stats-section-header').forEach(h => h.setAttribute('aria-expanded', 'false'));

            if (!yaAbierto) {
                cont.querySelector(`[data-body="${id}"]`)?.classList.remove('hidden');
                btn.querySelector('.stats-chevron').style.transform = 'rotate(90deg)';
                btn.setAttribute('aria-expanded', 'true');
                seccionStatsAbierta = id;
            } else {
                seccionStatsAbierta = null;
            }
            sessionStorage.setItem('stats-open', seccionStatsAbierta || '');
        });
    });
}

function inicializarPanelEstadisticas() {
    const btn = document.getElementById('btn-stats');
    const btnClose = document.getElementById('btn-close-stats');
    const panel = document.getElementById('stats-panel');
    if (!btn || !btnClose || !panel) return;

    btn.addEventListener('click', () => {
        renderizarEstadisticas();
        panel.classList.remove('translate-x-full');
    });
    btnClose.addEventListener('click', () => {
        panel.classList.add('translate-x-full');
        destruirChartsStats();
    });
}


/* ══════════════════════════════════════════════════════════════════════
   19 · UTILIDADES DE UI
   ══════════════════════════════════════════════════════════════════════ */

function inicializarLeyenda() {
    const btn = document.getElementById('legend-toggle');
    const panel = document.getElementById('legend-panel');
    const chevron = document.getElementById('legend-chevron');
    if (!btn || !panel || btn.dataset.ready === '1') return;
    btn.dataset.ready = '1';
    panel.classList.add('hidden');

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const abrir = panel.classList.contains('hidden');
        panel.classList.toggle('hidden', !abrir);
        if (chevron) chevron.textContent = abrir ? '▴' : '▾';
    });
}

function inicializarAcordeonFicha() {
    const btn = document.getElementById('btn-ver-mas-campos');
    const panelSec = document.getElementById('ficha-secundaria');
    const chevron = document.getElementById('chevron-ver-mas');
    const label = document.getElementById('label-ver-mas');
    if (!btn || btn.dataset.ready === '1') return;
    btn.dataset.ready = '1';

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!panelSec) return;
        const abrir = panelSec.classList.contains('hidden');
        panelSec.classList.toggle('hidden', !abrir);
        if (chevron) chevron.style.transform = abrir ? 'rotate(180deg)' : 'rotate(0deg)';
        if (label) label.textContent = abrir ? 'Ver menos campos' : 'Ver más campos';
    });
}

function inicializarFiltroCategoriasLuminarias() {
    document.querySelectorAll('[data-lum-category]').forEach(el => {
        if (el.dataset.ready === '1') return;
        el.dataset.ready = '1';
        el.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            aplicarFiltroCategoriaLuminarias(el.dataset.lumCategory);
        });
    });
}

function inicializarHeatmapArbolado() {
    const btn = document.getElementById('btn-heatmap-arbolado');
    if (!btn || btn.dataset.ready === '1') return;
    btn.dataset.ready = '1';
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        aplicarModoCalorArbolado(!modoCalorArbolado);
    });
}

function clasificarTecnologiaLuminaria(feature) {
    const cfg = CONFIG_CAPAS.luminarias.kpis.tecnologia;
    const valor = getCampoUpper(feature?.properties || {}, cfg.campo, '');
    if (valor.includes('LED')) return 'LED';
    if (valor.includes('SAP') || valor.includes('SODIO')) return 'SODIO';
    return 'OTROS';
}

function aplicarFiltroCategoriaLuminarias(categoria) {
    filtroCategoriaLuminarias = (filtroCategoriaLuminarias === categoria) ? null : categoria;

    const base = datosActuales().luminarias || capasData.luminarias;
    const features = filtroCategoriaLuminarias
        ? (base.features || []).filter(f => clasificarTecnologiaLuminaria(f) === filtroCategoriaLuminarias)
        : (base.features || []);

    const source = map.getSource(CONFIG_CAPAS.luminarias.source);
    if (source) source.setData({ type: 'FeatureCollection', features });

    document.querySelectorAll('[data-lum-category]').forEach(el => {
        el.classList.toggle('is-active', el.dataset.lumCategory === filtroCategoriaLuminarias);
    });

    const counts = { LED: 0, SODIO: 0, OTROS: 0 };
    features.forEach(f => counts[clasificarTecnologiaLuminaria(f)]++);
    setTexto('kpi-total', features.length.toLocaleString());
    setTexto('kpi-led', `${counts.LED.toLocaleString()} (${pct(counts.LED, features.length)})`);
    setTexto('kpi-sodio', `${counts.SODIO.toLocaleString()} (${pct(counts.SODIO, features.length)})`);
    setTexto('kpi-lum-otros', `${counts.OTROS.toLocaleString()} (${pct(counts.OTROS, features.length)})`);
}


/* ══════════════════════════════════════════════════════════════════════
   20 · EXPORTACIÓN PDF
   ----------------------------------------------------------------------
   Si hay un activo seleccionado, adjunta la ficha completa (todos los
   campos configurados en `config.capas.*.fichaPrimaria` + `fichaSecundaria`).
   Si no hay selección, genera un reporte general con el mapa y los KPIs.
   ══════════════════════════════════════════════════════════════════════ */

function inicializarExportacionPDF() {
    const btnPdf = document.getElementById('btn-export-pdf');
    if (!btnPdf || btnPdf.dataset.ready === '1') return;
    btnPdf.dataset.ready = '1';

    btnPdf.addEventListener('click', () => {
        const { municipio } = APP_CONFIG;

        // ── Capturamos el mapa como imagen (dataURL) ──
        let mapaBase64 = null;
        let aspectHeight = 220;
        try {
            mapaBase64 = map.getCanvas().toDataURL('image/png');
            const mapaDom = document.getElementById('map');
            if (mapaDom && mapaDom.clientWidth > 0) {
                aspectHeight = Math.round(714 * (mapaDom.clientHeight / mapaDom.clientWidth));
            }
        } catch (err) {
            console.error('[LUX] No se pudo capturar el mapa', err);
        }

        // ── Datos del activo seleccionado ──
        const kpi = id => document.getElementById(id)?.innerText || '0';
        const infoId = document.getElementById('info-id')?.innerText || '-';
        const haySeleccion = infoId && infoId !== '-' && infoId.trim() !== '';

        let tablaFichaHtml = '';
        let enlaceGeoHtml = '';

        if (haySeleccion) {
            const g = id => document.getElementById(id)?.innerText || '-';
            const mapUrl = `https://www.google.com/maps/search/?api=1&query=${window.activoSeleccionadoLat},${window.activoSeleccionadoLon}`;
            enlaceGeoHtml = `
                <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px; padding:12px 15px; margin-bottom:20px; font-size:11px;">
                    <div style="font-weight:bold; color:#0369a1; margin-bottom:4px;">Geolocalización:</div>
                    <a href="${mapUrl}" target="_blank" style="color:#0284c7; word-break:break-all; font-weight:bold;">${mapUrl}</a>
                </div>`;

         
            const valoresFicha = window.activoSeleccionadoConfig?.valores || [];

      
            const filasHtml = valoresFicha.map((f, i) => {
                const bg = i % 2 === 0 ? '#ffffff' : '#fafaf9';
                return `
                    <tr style="border-bottom:1px solid #f1f5f9; background:${bg};">
                        <td style="padding:8px 12px; color:#64748b; width:40%; font-size:11px;">${f.etiqueta}</td>
                        <td style="padding:8px 12px; font-weight:500; font-size:11px; color:#0f172a;">${f.valor}</td>
                    </tr>`;
            }).join('');

            tablaFichaHtml = `
                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; margin-bottom:25px;">
                    <div style="background:#f8fafc; padding:10px 15px; border-bottom:1px solid #e2e8f0;">
                        <span style="font-size:11px; font-weight:bold; color:#475569; text-transform:uppercase; letter-spacing:0.05em;">Parámetros del Componente</span>
                        <span style="float:right; font-size:10px; background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:4px;">ID: ${infoId}</span>
                    </div>
                    <table style="width:100%; border-collapse:collapse; font-size:11px;">
                        <tbody>
                            <tr style="border-bottom:1px solid #f1f5f9; background:#ffffff;">
                                <td style="padding:8px 12px; color:#64748b; width:40%; font-size:11px;">Elemento</td>
                                <td style="padding:8px 12px; font-weight:600; font-size:11px; color:#0f172a;">${g('info-elemento')}</td>
                            </tr>
                            ${filasHtml}
                        </tbody>
                    </table>
                </div>`;
        } else {
            tablaFichaHtml = `<div style="padding:20px; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:8px; text-align:center; color:#64748b; font-size:11.5px; margin-bottom:25px;">Reporte general. Haga clic sobre un activo para incluir su ficha técnica.</div>`;
        }

        const printContainer = document.createElement('div');
        Object.assign(printContainer.style, {
            position: 'absolute', left: '-9999px', top: '-9999px',
            width: '794px', backgroundColor: '#fff', padding: '40px',
            fontFamily: 'Archivo, Inter, sans-serif', color: '#1e293b'
        });

        printContainer.innerHTML = `
            <div style="background:#040d3d; color:#fff; margin:-40px -40px 25px -40px; padding:25px 40px; border-bottom:4px solid #5a9cf2;">
                <h1 style="font-size:20px; margin:0 0 5px 0; text-transform:uppercase; letter-spacing:0.03em;">Reporte de Activos Urbanos</h1>
                <p style="font-size:11px; margin:0; color:#94a3b8;">Municipio de ${municipio.nombre} &bull; ${municipio.tituloAplicacion}</p>
            </div>

            <h2 style="font-size:13px; color:#040d3d; border-left:4px solid #5a9cf2; padding-left:8px; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:12px;">Total de Activos Urbanos</h2>
            <div style="display:flex; gap:10px; margin-bottom:25px;">
                <div style="flex:1; background:#ecfeff; border:1px solid #06b6d4; border-radius:6px; padding:10px; text-align:center;"><div style="font-size:9px; color:#0891b2; font-weight:bold; letter-spacing:0.05em; text-transform:uppercase;">Luminarias</div><div style="font-size:16px; font-weight:bold; color:#0891b2;">${kpi('kpi-total')}</div></div>
                <div style="flex:1; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px; text-align:center;"><div style="font-size:9px; color:#64748b; font-weight:bold; letter-spacing:0.05em; text-transform:uppercase;">Arbolado</div><div style="font-size:16px; font-weight:bold;">${kpi('kpi-arb-total')}</div></div>
                <div style="flex:1; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px; text-align:center;"><div style="font-size:9px; color:#64748b; font-weight:bold; letter-spacing:0.05em; text-transform:uppercase;">Vialidades</div><div style="font-size:16px; font-weight:bold;">${kpi('kpi-vial-total')}</div></div>
                <div style="flex:1; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:10px; text-align:center;"><div style="font-size:9px; color:#64748b; font-weight:bold; letter-spacing:0.05em; text-transform:uppercase;">Lateral Vial</div><div style="font-size:16px; font-weight:bold;">${kpi('kpi-cordon-total')}</div></div>
                <div style="flex:1; background:#fff5f5; border:1px solid #feb2b2; border-radius:6px; padding:10px; text-align:center;"><div style="font-size:9px; color:#c53030; font-weight:bold; letter-spacing:0.05em; text-transform:uppercase;">Solicitudes</div><div style="font-size:16px; font-weight:bold; color:#c53030;">${kpi('kpi-rec-total')}</div></div>
            </div>

            <h2 style="font-size:13px; color:#040d3d; border-left:4px solid #5a9cf2; padding-left:8px; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:12px;">Vista del Mapa</h2>
            <div style="width:100%; height:${aspectHeight}px; border:1px solid #cbd5e1; border-radius:8px; overflow:hidden; margin-bottom:25px; background:#f1f5f9;">
                ${mapaBase64
                    ? `<img src="${mapaBase64}" style="width:100%; height:100%; object-fit:contain; background:#0f172a;" />`
                    : `<div style="padding-top:80px; text-align:center; color:#64748b;">Mapa no disponible</div>`}
            </div>

            <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
                <h2 style="font-size:13px; color:#040d3d; border-left:4px solid #5a9cf2; padding-left:8px; text-transform:uppercase; letter-spacing:0.05em; margin:0;">Ficha del Elemento</h2>
                ${enlaceGeoHtml}
            </div>

            ${tablaFichaHtml}

            <div style="padding:12px; background:#f8fafc; border-radius:6px; border-left:4px solid #cbd5e1; font-size:10px; color:#64748b;">
                <strong>Nota:</strong> Generado el ${new Date().toLocaleString('es-AR')}.
            </div>
        `;

         document.body.appendChild(printContainer);

        html2canvas(printContainer, { scale: 2, useCORS: true, logging: false })
            .then(canvas => {
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF('p', 'mm', 'a4');

                // Dimensiones de la página A4 (en mm)
                const pageWidth  = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();

                // Imagen completa en píxeles (canvas)
                const imgWidthPx  = canvas.width;
                const imgHeightPx = canvas.height;

                // Escalamos: la imagen ocupa todo el ancho útil de la página
               
                const imgWidthMm = pageWidth;
                const imgHeightMm = (imgHeightPx * imgWidthMm) / imgWidthPx;

                //  páginas 
                const totalPaginas = Math.ceil(imgHeightMm / pageHeight);

         
                const imgData = canvas.toDataURL('image/jpeg', 0.95);

                // Altura (en px del canvas) que entra en cada página:
                //   pageHeight (mm) → px
                const pxPorMm = imgHeightPx / imgHeightMm;
                const altoPaginaPx = pageHeight * pxPorMm;

                for (let pagina = 0; pagina < totalPaginas; pagina++) {
                    const esPrimera = pagina === 0;
                    const offsetYEnMm = pagina * pageHeight;   // desplazamiento vertical acumulado

                    if (!esPrimera) pdf.addPage();

                    // imagen completa
                    // jsPDF recorta automáticamente lo que sale de la página.
                    pdf.addImage(
                        imgData,
                        'JPEG',
                        0,                          // x
                        -offsetYEnMm,               // y (negativo = sube la imagen)
                        imgWidthMm,                 // ancho visible
                        imgHeightMm                 // alto total de la imagen
                    );
                }

                const nombreArchivo = `Reporte_Activos_${haySeleccion ? infoId.replace(/\s+/g, '_') : 'General'}.pdf`;
                pdf.save(nombreArchivo);
                document.body.removeChild(printContainer);
            })
            .catch(err => {
                console.error('[LUX] Error al generar el PDF', err);
                document.body.removeChild(printContainer);
            });
    });
}
/* ══════════════════════════════════════════════════════════════════════
   21 · Inicio
   ══════════════════════════════════════════════════════════════════════ */

aplicarConfiguracionMunicipal();

map.on('load', () => cargarTodosLosGeoJSON());

document.addEventListener('DOMContentLoaded', () => {
    inicializarWidgetCoordenadas();
    inicializarBuscadorOSM();
    inicializarFiltroCategoriasLuminarias();
    inicializarHeatmapArbolado();
    inicializarHerramientaBbox();
    inicializarPanelEstadisticas();
    inicializarLeyenda();
    inicializarAcordeonFicha();
    inicializarExportacionPDF();
   inicializarToggleSidebarMobile(); 
});

window.LUX = {
    map,
    get datos() { return datosActuales(); },
    get capas() { return capasData; },
    get filtro() { return filtroActivo; },
    aplicarFiltroDistrito,
    aplicarFiltroPoligono,
    restaurarFiltroPoligono,
    restaurarDatosCompletos,
    calcularKPIs
};



/**
 * ficha técnica para mobile.
 * El botón ☰ solo aparece cuando la pantalla es ≤ 900px (ver styles.css).
 */
function inicializarToggleSidebarMobile() {
    const btn = document.getElementById('btn-toggle-sidebar');
    const sidebar = document.getElementById('technical-sidebar');
    if (!btn || !sidebar) return;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('is-open');
    });

    // Cerrar al hacer clic fuera (solo en mobile)
    document.addEventListener('click', (e) => {
        if (window.innerWidth > 900) return;
        if (!sidebar.classList.contains('is-open')) return;
        if (sidebar.contains(e.target) || btn.contains(e.target)) return;
        sidebar.classList.remove('is-open');
    });

    // Cerrar al agrandar la pantalla
    window.addEventListener('resize', () => {
        if (window.innerWidth > 900) sidebar.classList.remove('is-open');
    });
}
