/* ============================================================================
   LUX  · CONFIGURACIÓN MUNICIPAL
   ----------------------------------------------------------------------------
  

   ÍNDICE:
     1 · municipio       → identidad, centro/zoom y logos
     2 · geoserver       → URL reservada (futura migración WFS)
     3 · fuentes         → rutas de los GeoJSON / integración Google Sheets
     4 · camposGlobales  → atributos compartidos (fecha, distrito)
     5 · popupReclamos   → campos del popup + categorías automáticas de texto
     6 · simbologia      → PALETA CROMÁTICA ÚNICA (mapa + menús + leyenda)
     7 · ui              → coordenadas, búsqueda OSM, ficha lateral
     8 · capas           → definición EXACTA por capa
     9 · estadisticas    → parámetros de los cálculos del panel
   ============================================================================ */

window.LUX_CONFIG = {

  /* ── 1 · IDENTIDAD DEL MUNICIPIO ─────────────────────────────────────── */
  municipio: {
    nombre: 'Rivadavia',
    tituloAplicacion: 'Monitoreo de Activos Urbanos',
    locale: 'es-AR',
    mapaInicial: { center: [-68.468, -33.191], zoom: 15 },
    branding: {
      logoLux:       { src: 'logo_lux_byn.png', href: 'https://www.luxleasing.com.ar/' },
      logoMunicipio: { src: 'logo_riv_2.png',   href: 'https://rivadaviamendoza.gob.ar/new/' }
    }
  },

  /* ── 2 · SERVIDOR DE MAPAS (reservado para migración futura a WFS) ──── */
  geoserver: {
    base: 'http://localhost:8090/geoserver/visor_rivadavia/ows?service=WFS&version=1.0.0&request=GetFeature'
  },

  /* ── 3 · FUENTES DE DATOS ────────────────────────────────────────────── */
  fuentes: {
    luminarias:      './luminarias_riv_wgs84.geojson',
    arbolado:        './arboles_v2.geojson',
    vialidades:      './vialidad_ej_6.geojson',
    cordon:          './cordon.geojson',
    banquina_vereda: './banquina_vereda.geojson',
    cuneta:          './cuneta.geojson',
    distritos:       './distritos_riv_ide_wgs84.geojson',
    reclamos:        'https://docs.google.com/spreadsheets/d/1xrjKtepiEjcvpucty6ZAzoh_3C88Plcg/gviz/tq?tqx=out:csv'
  },

  /* ── 4 · ATRIBUTOS GLOBALES ──────────────────────────────────────────── */
  camposGlobales: {
    fechaActualizacion: ['fecha_act', 'FECHA_ACT', 'Fecha_Act'],
    distritoNombre:     ['distrito', 'DISTRITO', 'nombre', 'NOMBRE', 'name']
  },

  /* ── 5 · SOLICITUDES / RECLAMOS ──────────────────────────────────────── */
  popupReclamos: {
    descripcion:  ['Descripción del reclamo', 'Descripción del Reclamo', 'Descripcion del reclamo', 'DESCRIPCION_DEL_RECLAMO', 'descripcion'],
    tipo:         ['Tipo de reclamo', 'Tipo', 'TIPO', 'tipo', 'TIPO_RECLAMO'],
    usuario:      ['Usuario', 'USUARIO', 'usuario', 'User'],
    area:         ['Área', 'Area', 'AREA', 'area'],
    fecha:        ['Fecha', 'FECHA', 'fecha', 'Fecha Solución'],
    fechaSolucion:['Fecha Solución', 'FECHA_SOLUCION', 'fecha_solucion'],

    /* Categorización por texto libre de la descripción.
       Se evalúa en orden de aparición: el primer match gana.
       */
    categorias: {
      'Reconversión a LED': [
        'sodio a led', 'cambio a led', 'cambiar a led', 'reemplazar por led',
        'por luminaria led', 'reconvertir', 'reconversion', 'pocos led', 'por led'
      ],
      'Luminaria quemada': [
        'quemad', 'no enciende', 'no anda', 'no funciona', 'no prende',
        'sin luz', 'sin luces', 'apaga', 'intermitente', 'foco quemado',
        'rota', 'roto', 'cable cortado', 'falso contacto', 'se quemo',
        'no da luz', 'oscuridad'
      ],
      'Nuevas luminarias': [
        'solicito', 'solicita', 'solicitan', 'solicitud',
        'colocar', 'colocacion', 'instalar',
        'donacion', 'pedido de luminaria', 'pedimos luminaria',
        'faltan luminarias', 'falta luminaria', 'faltan luces',
        'falta iluminacion', 'poca iluminacion', 'poca luz',
        'no hay luminaria', 'no hay luz'
      ]
    }
  },

  /* Conexión Google Sheets -mismos datos del popup */
  reclamosCsv: {
    url: 'https://docs.google.com/spreadsheets/d/1xrjKtepiEjcvpucty6ZAzoh_3C88Plcg/gviz/tq?tqx=out:csv',
    camposCoordenadas: {
      lat: ['lat', 'Lat', 'LAT', 'latitud', 'Latitud', 'LATITUD', 'y', 'Y'],
      lng: ['lng', 'Lng', 'LNG', 'lon', 'Lon', 'LON', 'long', 'Long', 'LONGITUD', 'longitud', 'x', 'X']
    }
  },

  /* ── 6 · PALETA CROMÁTICA ÚNICA ──────────────────────────────────────── */
  simbologia: {
    luminarias:  { LED: '#22d3ee', SODIO: '#e2f916', OTROS: '#e6b290' },
    arbolado:    { BUENO: '#4f7a61', REGULAR: '#78926f', MALO: '#a5a36f', OTROS: '#8d9b8f' },
    vialidades:  { PAVIMENTADO: '#587b9b', CONSOLIDADA: '#7e9b83', TIERRA: '#b29169', 'SIN DATO': '#9aa3a8' },
    lateralVial: { CORDON: '#b8875d', BANQUINA_VEREDA: '#9a8f72', CUNETA: '#6f93a3' },
    reclamos:    { HALO: '#ff0055', TRAZO: '#ffffff', TEXTO: '#ff3366', MARKER_SIZE: 12 },

    seleccion: {
      CENTRO: '#31fff5',
      ANILLO: '#22d3ee',
      ZONA_BORDE:   '#0f172a',
      ZONA_HALO:    '#ffffff',
      ZONA_RELLENO: '#0a5864',
      ZONA_VERTICE: '#ffffff'
    },

    heatmapArbolado: [
      'rgba(79,122,97,0)', 'rgba(132,158,111,0.30)', 'rgba(166,166,105,0.48)',
      'rgba(184,135,93,0.62)', 'rgba(169,92,86,0.78)'
    ]
  },

  /* ── 7 · UI / HERRAMIENTAS ───────────────────────────────────────────── */
  ui: {
    coordenadas: { decimales: 6, mostrarProyectadas: false },
    decimales: { kmFichaLateral: 2 },

    busqueda: {
      url: 'https://nominatim.openstreetmap.org/search',
      params: { format: 'jsonv2', limit: 6, addressdetails: 0, 'accept-language': 'es' },
      debounceMs: 400,
      viewbox: '-68.75,-33.05,-68.15,-33.45',
      bounded: 1,
      zoomResultado: 17,
      reverseUrl: 'https://nominatim.openstreetmap.org/reverse',
      reverseGeocode: true
    },

    seleccionBBox: { color: '#22d3ee', relleno: 'rgba(34,211,238,0.08)' },

    filtroDistrito: {
      bufferMetros: 0,
      zoomAlFiltrar: { padding: 60, duracionMs: 900, maxZoom: 16 }
    }
  },

  /* ── 8 · DEFINICIÓN DE CAPAS ─────────────────────────────────────────── */
  capas: {

    luminarias: {
      id: 'luminarias-layer',
      source: 'luminarias-source',
      label: 'Luminarias',
      elementoFijo: 'Luminaria',
      idCampo: ['id_elemento', 'ID_ELEMENTO', 'id', 'ID'],
      simbologiaCampo: ['tecnologia', 'TECNOLOGIA', 'sap', 'SAP'],

      fichaPrimaria: [
        { etiqueta: 'ID',          campos: ['id_elemento', 'ID_ELEMENTO', 'id', 'ID'] },
        { etiqueta: 'Tecnología',  campos: ['tecnologia', 'TECNOLOGIA', 'sap', 'SAP'] },
        { etiqueta: 'Potencia',    campos: ['potencia', 'POTENCIA'] },
        { etiqueta: 'Marca',       campos: ['marca', 'MARCA'] },
        { etiqueta: 'Modelo',      campos: ['modelo', 'MODELO'] },
        { etiqueta: 'Soporte',     campos: ['soporte', 'SOPORTE'] },
        { etiqueta: 'Función',     campos: ['funcion', 'FUNCION'] },
        { etiqueta: 'Calle',       campos: ['calle', 'CALLE'] }
      ],
      fichaSecundaria: [
        { etiqueta: 'Brazo',       campos: ['brazo', 'BRAZO'] },
        { etiqueta: 'Zona',        campos: ['zona', 'ZONA'] },
        { etiqueta: 'Fecha Act.',  campos: ['fecha_act', 'FECHA_ACT'] }
      ],

      kpis: {
        tecnologia: {
          campo: ['tecnologia', 'TECNOLOGIA', 'sap', 'SAP'],
          grupos: {
            'LED':   (v) => String(v).toUpperCase().includes('LED'),
            'SODIO': (v) => String(v).toUpperCase().includes('SAP') || String(v).toUpperCase().includes('SODIO'),
            'OTROS': () => true
          }
        },
        potencia: { campo: ['potencia', 'POTENCIA'] }
      }
    },

    arbolado: {
      id: 'arbolado-layer',
      source: 'arbolado-source',
      label: 'Árboles',
      elementoFijo: 'Arbolado',
      idCampo: ['ID', 'id'],
      simbologiaCampo: ['ESTADO_S', 'Estado'],

      fichaPrimaria: [
        { etiqueta: 'ID',            campos: ['ID', 'id'] },
        { etiqueta: 'CALLE',         campos: ['CALLE', 'calle'] },
        { etiqueta: 'DIMENSIÓN',     campos: ['DIMENSION'] },
        { etiqueta: 'ESTADO_S',      campos: ['ESTADO_S', 'Estado'] },
        { etiqueta: 'ESPECIE',       campos: ['ESPECIE', 'Nombre comun', 'Nombre cientifico'] },
        { etiqueta: 'TRONCO',        campos: ['TRONCO'] },
        { etiqueta: 'BASE',          campos: ['BASE'] },
        { etiqueta: 'F. STREET',     campos: ['F_STREET_W', 'L_STREET_W'] }
      ],

      fichaSecundaria: [
        { etiqueta: 'Fecha',                campos: ['Fecha'] },
        { etiqueta: 'Numeración',           campos: ['Numeración de la calle'] },
        { etiqueta: 'Lado',                 campos: ['Lado de la calle'] },
        { etiqueta: 'Ubicación',            campos: ['Ubicación'] },
        { etiqueta: 'Coordenadas',          campos: ['Coordenadas'] },
        { etiqueta: 'Distancia entre árboles (m)', campos: ['Distancia entre arboles (m)'] },
        { etiqueta: 'Presencia de nicho',   campos: ['Presencia de nicho'] },
        { etiqueta: 'Estado vegetativo',    campos: ['Estado vegetativo'] },
        { etiqueta: 'Estado sanitario',     campos: ['Estado sanitario'] },
        { etiqueta: 'Antigüedad',           campos: ['Antigüedad'] },
        { etiqueta: 'Riego',                campos: ['Riego'] },
        { etiqueta: 'Observaciones',        campos: ['Observaciones'] },
        { etiqueta: 'Encargado',            campos: ['encargado'] },
        { etiqueta: 'Rumbo',                campos: ['rumbo'] },
        { etiqueta: 'Hoja origen',          campos: ['hoja_origen'] },
        { etiqueta: 'Nombre científico',    campos: ['Nombre cientifico'] },
        { etiqueta: 'Nombre común',         campos: ['Nombre comun'] },
        { etiqueta: 'Coord. X',             campos: ['X'] },
        { etiqueta: 'Coord. Y',             campos: ['Y'] }
      ],

      kpis: {
        estado: {
          campo: ['ESTADO_S', 'Estado'],
          grupos: {
            'BUENO':   (v) => String(v).toUpperCase() === 'BUENO',
            'REGULAR': (v) => String(v).toUpperCase() === 'REGULAR',
            'MALO':    (v) => String(v).toUpperCase() === 'MALO',
            'OTROS':   () => true
          }
        },
        especie: { campo: ['ESPECIE', 'Nombre comun', 'Nombre cientifico'] }
      }
    },

    vialidades: {
      id: 'vialidades-layer',
      source: 'vialidades-source',
      label: 'Vialidad',
      elementoFijo: 'Vialidad',
      idCampo: ['id', 'ID'],
      simbologiaCampo: ['superficie', 'SUPERFICIE'],

      fichaPrimaria: [
        { etiqueta: 'ID',           campos: ['id', 'ID'] },
        { etiqueta: 'Zona',         campos: ['zona', 'ZONA'] },
        { etiqueta: 'Superficie',   campos: ['superficie', 'SUPERFICIE'] },
        { etiqueta: 'Sentido',      campos: ['sentido', 'SENTIDO'] },
        { etiqueta: 'KM',           campos: ['km', 'KM'] },
        { etiqueta: 'Jerarquía',    campos: ['jerarquia', 'JERARQUIA'] }
      ],
      fichaSecundaria: [
        { etiqueta: 'Tipo',         campos: ['tipo', 'TIPO'] },
        { etiqueta: 'Fecha Act.',   campos: ['fecha_act', 'FECHA_ACT'] }
      ],

      kpis: {
        superficie: {
          campo: ['superficie', 'SUPERFICIE'],
          grupos: {
            'PAVIMENTADO': (v) => String(v).toUpperCase().includes('PAVIMENTAD'),
            'CONSOLIDADA': (v) => String(v).toUpperCase().includes('CONSOLIDADA'),
            'TIERRA':      (v) => String(v).toUpperCase().includes('TIERRA'),
            'SIN DATO':    () => true
          },
          campoKm: ['km', 'KM']
        },
        zona: {
          campo: ['zona', 'ZONA'],
          grupos: {
            'DPV':       (v) => String(v).toUpperCase().includes('DPV'),
            'MUNICIPAL': (v) => String(v).toUpperCase().includes('MUN'),
            'OTRO':      () => true
          },
          campoKm: ['km', 'KM']
        }
      }
    },

    cordon: {
      id: 'cordon-layer',
      source: 'cordon-source',
      label: 'Cordón',
      elementoFijo: 'Cordón',
      idCampo: ['id_tramo', 'ID_TRAMO', 'id', 'ID'],
      simbologiaCampo: ['cordon', 'CORDON'],

      fichaPrimaria: [
        { etiqueta: 'ID Tramo',    campos: ['id_tramo', 'ID_TRAMO'] },
        { etiqueta: 'Zona',        campos: ['zona', 'ZONA'] },
        { etiqueta: 'KM',          campos: ['km', 'KM'] },
        { etiqueta: 'Lado',        campos: ['lado', 'LADO'] },
        { etiqueta: 'Cordón',      campos: ['cordon', 'CORDON'] },
        { etiqueta: 'Estado',      campos: ['cord_estado', 'CORD_ESTADO'] },
        { etiqueta: 'KM Cordón',   campos: ['km_cordon', 'KM_CORDON'] },
        { etiqueta: 'Fecha',       campos: ['fecha', 'FECHA'] }
      ],
      fichaSecundaria: [],

      kpis: {
        presencia: { campo: ['cordon', 'CORDON'], campoKm: ['km_cordon', 'KM_CORDON'], valorEsperado: 'SI' }
      }
    },

    banquina_vereda: {
      id: 'banquina-vereda-layer',
      source: 'banquina-vereda-source',
      label: 'Banquina / Vereda',
      elementoFijo: 'Banquina / Vereda',
      idCampo: ['id_tramo', 'ID_TRAMO', 'id', 'ID'],
      simbologiaCampo: ['banq_vrda', 'BANQ_VRDA'],

      fichaPrimaria: [
        { etiqueta: 'ID Tramo',    campos: ['id_tramo', 'ID_TRAMO'] },
        { etiqueta: 'Zona',        campos: ['zona', 'ZONA'] },
        { etiqueta: 'KM',          campos: ['km', 'KM'] },
        { etiqueta: 'Lado',        campos: ['lado', 'LADO'] },
        { etiqueta: 'Banq/Vereda', campos: ['banq_vrda', 'BANQ_VRDA'] },
        { etiqueta: 'Estado',      campos: ['b_v_estado', 'B_V_ESTADO'] },
        { etiqueta: 'KM B/V',      campos: ['km_b_v', 'KM_B_V'] },
        { etiqueta: 'Fecha',       campos: ['fecha', 'FECHA'] }
      ],
      fichaSecundaria: [],

      kpis: {
        presencia: { campo: ['banq_vrda', 'BANQ_VRDA'], campoKm: ['km_b_v', 'KM_B_V'], valorEsperado: 'SI' }
      }
    },

    cuneta: {
      id: 'cuneta-layer',
      source: 'cuneta-source',
      label: 'Cuneta',
      elementoFijo: 'Cuneta',
      idCampo: ['id_tramo', 'ID_TRAMO', 'id', 'ID'],
      simbologiaCampo: ['cuneta', 'CUNETA'],

      fichaPrimaria: [
        { etiqueta: 'ID Tramo',    campos: ['id_tramo', 'ID_TRAMO'] },
        { etiqueta: 'Zona',        campos: ['zona', 'ZONA'] },
        { etiqueta: 'KM',          campos: ['km', 'KM'] },
        { etiqueta: 'Lado',        campos: ['lado', 'LADO'] },
        { etiqueta: 'Cuneta',      campos: ['cuneta', 'CUNETA'] },
        { etiqueta: 'Material',    campos: ['cun_mat', 'CUN_MAT'] },
        { etiqueta: 'KM Cuneta',   campos: ['km_cuneta', 'KM_CUNETA'] },
        { etiqueta: 'Fecha',       campos: ['fecha', 'FECHA'] }
      ],
      fichaSecundaria: [],

      kpis: {
        presencia: { campo: ['cuneta', 'CUNETA'], campoKm: ['km_cuneta', 'KM_CUNETA'], valorEsperado: 'SI' }
      }
    },

    reclamos: {
      id: 'reclamos-layer',
      source: 'reclamos-source',
      label: 'Solicitudes',
      elementoFijo: 'Reclamo',
      idCampo: ['Nro', 'nro', 'id', 'ID'],
      simbologiaCampo: ['tipo', 'TIPO', 'Tipo de reclamo'],

      fichaPrimaria: [
        { etiqueta: 'Código',       campos: ['Nro', 'nro', 'codigo', 'CODIGO'] },
        { etiqueta: 'Usuario',      campos: ['Usuario', 'usuario', 'USUARIO'] },
        { etiqueta: 'Área',         campos: ['Área', 'area', 'AREA'] },
        { etiqueta: 'Tipo',         campos: ['Tipo de reclamo', 'tipo', 'TIPO'] },
        { etiqueta: 'Descripción',  campos: ['Descripción del reclamo', 'descripcion', 'DESCRIPCION'] },
        { etiqueta: 'Fecha',        campos: ['Fecha', 'fecha', 'FECHA'] },
        { etiqueta: 'Solución',     campos: ['Fecha Solución', 'fecha_solucion', 'FECHA_SOLUCION'] }
      ],
      fichaSecundaria: []
    }
  },

  /* ── 9 · ESTADÍSTICAS ────────────────────────────────────────────────── */
  estadisticas: {
    economia: {
      horasLuminariaAnio: 4015,
      vidaUtilLedAnios: 5,
      anchoPromedioVia: 10,
      tarifaKwh: 85
    },
    alertas: {
      porcentajeSodioCritico: 30,
      porcentajeTierraCritico: 20,
      porcentajeArboladoMalo: 15,
      porcentajeLedPorVencer: 20
    },
    luminarias: { precioReconversionPorPunto: 85000 },
    arbolado: {
      valorMaduro: 'MADURO',
      valorJoven: 'JOVEN',
      valorNichoVacio: 'NO',
      keywordVeredaRota: 'vereda'
    }
  }
};
