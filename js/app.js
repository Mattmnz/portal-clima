'use strict';

/* =========================================================
   Cielo: portal del tiempo que consume la API de Open-Meteo

   1. Configuración y estado
   2. Utilidades (DOM, formato, almacenamiento)
   3. Registro de peticiones
   4. Capa de datos: fetch con .then() y con async/await
   5. Buscador con autocompletado
   6. Carga de un lugar: peticiones en paralelo
   7. Pintado de la interfaz
   8. Eventos y arranque
   ========================================================= */


/* 1. Configuración y estado ------------------------------------------------ */

const API = {
    geocoding: 'https://geocoding-api.open-meteo.com/v1/search',
    pronostico: 'https://api.open-meteo.com/v1/forecast',
    aire: 'https://air-quality-api.open-meteo.com/v1/air-quality',
};

const LUGAR_INICIAL = { id: 3617763, nombre: 'Managua', region: 'Managua', pais: 'Nicaragua', lat: 12.13282, lon: -86.2504 };

const CLAVES = { recientes: 'cielo:recientes', unidad: 'cielo:unidad' };

// Única fuente de verdad: la interfaz se dibuja siempre a partir de este objeto.
// Los datos se guardan en °C; la conversión a °F ocurre solo al mostrarlos.
const estado = {
    unidad: leerAlmacen(CLAVES.unidad, 'c'),
    recientes: leerAlmacen(CLAVES.recientes, []),
    lugar: null,
    pronostico: null,
    aire: null,
    dia: 0,   // día elegido en la lista semanal (0 = hoy)
    hora: 0,  // hora resaltada dentro del gráfico
};

const el = {
    cielo: $('#cielo'),
    colorTema: $('#color-tema'),
    formulario: $('#buscador'),
    campo: $('#campo-busqueda'),
    sugerencias: $('#sugerencias'),
    btnUbicacion: $('#btn-ubicacion'),
    unidades: $('#unidades'),
    boletin: $('#boletin'),
    lugar: $('#lugar'),
    titular: $('#titular'),
    detalle: $('#detalle'),
    datos: $('#datos'),
    recientes: $('#recientes'),
    hoja: $('#hoja'),
    tituloHoras: $('#t-horas'),
    lectura: $('#lectura'),
    grafico: $('#grafico'),
    semana: $('#semana'),
    aire: $('#aire'),
    contador: $('#contador'),
    filas: $('#filas'),
    jsonUrl: $('#json-url'),
    json: $('#json'),
    aviso: $('#aviso'),
};

// Códigos WMO que devuelve la API (weather_code), traducidos y agrupados
const CLIMA = {
    0: { grupo: 'despejado', corto: 'Despejado', frase: 'el cielo está despejado' },
    1: { grupo: 'despejado', corto: 'Mayormente despejado', frase: 'el cielo está casi despejado' },
    2: { grupo: 'parcial', corto: 'Parcialmente nublado', frase: 'está parcialmente nublado' },
    3: { grupo: 'cubierto', corto: 'Nublado', frase: 'está nublado' },
    45: { grupo: 'niebla', corto: 'Niebla', frase: 'hay niebla' },
    48: { grupo: 'niebla', corto: 'Niebla con escarcha', frase: 'hay niebla con escarcha' },
    51: { grupo: 'lluvia', corto: 'Llovizna ligera', frase: 'cae una llovizna ligera' },
    53: { grupo: 'lluvia', corto: 'Llovizna', frase: 'cae llovizna' },
    55: { grupo: 'lluvia', corto: 'Llovizna densa', frase: 'cae una llovizna densa' },
    56: { grupo: 'lluvia', corto: 'Llovizna helada', frase: 'cae llovizna helada' },
    57: { grupo: 'lluvia', corto: 'Llovizna helada densa', frase: 'cae llovizna helada densa' },
    61: { grupo: 'lluvia', corto: 'Lluvia ligera', frase: 'llueve ligeramente' },
    63: { grupo: 'lluvia', corto: 'Lluvia', frase: 'llueve' },
    65: { grupo: 'lluvia', corto: 'Lluvia intensa', frase: 'llueve con fuerza' },
    66: { grupo: 'lluvia', corto: 'Lluvia helada', frase: 'cae lluvia helada' },
    67: { grupo: 'lluvia', corto: 'Lluvia helada intensa', frase: 'cae lluvia helada intensa' },
    71: { grupo: 'nieve', corto: 'Nevada ligera', frase: 'nieva ligeramente' },
    73: { grupo: 'nieve', corto: 'Nevada', frase: 'nieva' },
    75: { grupo: 'nieve', corto: 'Nevada intensa', frase: 'nieva con fuerza' },
    77: { grupo: 'nieve', corto: 'Granos de nieve', frase: 'caen granos de nieve' },
    80: { grupo: 'lluvia', corto: 'Chubascos ligeros', frase: 'hay chubascos ligeros' },
    81: { grupo: 'lluvia', corto: 'Chubascos', frase: 'hay chubascos' },
    82: { grupo: 'lluvia', corto: 'Chubascos violentos', frase: 'hay chubascos violentos' },
    85: { grupo: 'nieve', corto: 'Chubascos de nieve', frase: 'hay chubascos de nieve' },
    86: { grupo: 'nieve', corto: 'Chubascos de nieve fuertes', frase: 'hay chubascos de nieve fuertes' },
    95: { grupo: 'tormenta', corto: 'Tormenta', frase: 'hay tormenta eléctrica' },
    96: { grupo: 'tormenta', corto: 'Tormenta con granizo', frase: 'hay tormenta con granizo leve' },
    97: { grupo: 'tormenta', corto: 'Tormenta fuerte', frase: 'hay una tormenta eléctrica fuerte' },
    99: { grupo: 'tormenta', corto: 'Tormenta con granizo fuerte', frase: 'hay tormenta con granizo fuerte' },
};

// Colores del cielo [arriba, abajo, tono del fondo] según momento del día y condición
const PALETAS = {
    dia: {
        despejado: ['#6FB2EC', '#D4EAFA', 'claro'],
        parcial: ['#8AB7DE', '#DCE8F2', 'claro'],
        cubierto: ['#A9B4BF', '#E1E5E9', 'claro'],
        niebla: ['#C3C8CC', '#ECEDEE', 'claro'],
        lluvia: ['#93A1AE', '#CAD2D9', 'claro'],
        tormenta: ['#3D4656', '#6B7486', 'oscuro'],
        nieve: ['#C9D6E2', '#F1F5F8', 'claro'],
    },
    noche: {
        despejado: ['#0B1633', '#1E3263', 'oscuro'],
        parcial: ['#141E36', '#2B3A5C', 'oscuro'],
        cubierto: ['#1B2029', '#353C49', 'oscuro'],
        niebla: ['#252A31', '#40464F', 'oscuro'],
        lluvia: ['#141B26', '#2C3747', 'oscuro'],
        tormenta: ['#0D1017', '#262B38', 'oscuro'],
        nieve: ['#1E2635', '#3E4A5E', 'oscuro'],
    },
    crepusculo: {
        despejado: ['#2B3566', '#7E5A72', 'oscuro'],
        parcial: ['#2F3762', '#6E5670', 'oscuro'],
        cubierto: ['#2E3343', '#5E5662', 'oscuro'],
        niebla: ['#383C48', '#625E66', 'oscuro'],
        lluvia: ['#262C3B', '#4F4E5C', 'oscuro'],
        tormenta: ['#171A24', '#3A3644', 'oscuro'],
        nieve: ['#3A4256', '#6C6878', 'oscuro'],
    },
};

// Índice de calidad del aire de EE. UU. (EPA): límite superior de cada banda
const BANDAS_AQI = [
    { hasta: 50, nombre: 'Buena', color: '#5BB85D', consejo: 'Calidad satisfactoria: no hay riesgo para actividades al aire libre.' },
    { hasta: 100, nombre: 'Moderada', color: '#E8C547', consejo: 'Aceptable. Las personas especialmente sensibles podrían notar molestias.' },
    { hasta: 150, nombre: 'Dañina para grupos sensibles', color: '#F08A3C', consejo: 'Personas con asma, niños y adultos mayores deberían reducir el esfuerzo prolongado al aire libre.' },
    { hasta: 200, nombre: 'Dañina', color: '#D9483B', consejo: 'Cualquier persona puede empezar a sentir efectos. Conviene reducir la actividad al aire libre.' },
    { hasta: 300, nombre: 'Muy dañina', color: '#8E4C9A', consejo: 'Alerta sanitaria: evitá el esfuerzo al aire libre.' },
    { hasta: Infinity, nombre: 'Peligrosa', color: '#7A2335', consejo: 'Emergencia sanitaria: permanecé en interiores.' },
];

const MENSAJES_GEO = {
    1: 'Bloqueaste el acceso a la ubicación. Habilitalo desde el candado de la barra de direcciones o buscá la ciudad por nombre.',
    2: 'El dispositivo no pudo determinar tu ubicación. Buscá la ciudad por nombre.',
    3: 'La ubicación tardó demasiado en llegar. Intentá de nuevo o buscá la ciudad por nombre.',
};


/* 2. Utilidades ------------------------------------------------------------ */

function $(selector) {
    return document.querySelector(selector);
}

// Crea elementos sin pasar texto por innerHTML: los strings se agregan como nodos de texto,
// así que un nombre de ciudad con "<" o ">" nunca se interpreta como HTML.
function crear(etiqueta, props = {}, ...hijos) {
    const nodo = document.createElement(etiqueta);
    for (const [clave, valor] of Object.entries(props)) {
        if (valor == null) continue;
        if (clave === 'class') nodo.className = valor;
        else if (clave === 'text') nodo.textContent = valor;
        else if (clave === 'style') Object.assign(nodo.style, valor);
        else if (clave in nodo && !clave.includes('-')) nodo[clave] = valor;
        else nodo.setAttribute(clave, valor);
    }
    nodo.append(...hijos.filter((h) => h != null));
    return nodo;
}

const NS_SVG = 'http://www.w3.org/2000/svg';
function crearSvg(etiqueta, atributos = {}, ...hijos) {
    const nodo = document.createElementNS(NS_SVG, etiqueta);
    for (const [clave, valor] of Object.entries(atributos)) nodo.setAttribute(clave, valor);
    if (etiqueta === 'text') nodo.textContent = hijos.join('');
    else nodo.append(...hijos);
    return nodo;
}

function leerAlmacen(clave, porDefecto) {
    try {
        const valor = localStorage.getItem(clave);
        return valor === null ? porDefecto : JSON.parse(valor);
    } catch {
        return porDefecto; // modo privado o almacenamiento bloqueado: la app sigue funcionando sin persistir
    }
}

function guardarAlmacen(clave, valor) {
    try {
        localStorage.setItem(clave, JSON.stringify(valor));
    } catch {
        /* sin persistencia, sin error visible */
    }
}

function grados(celsius) {
    if (celsius == null || Number.isNaN(celsius)) return '–';
    const valor = estado.unidad === 'f' ? celsius * 9 / 5 + 32 : celsius;
    return `${Math.round(valor)}°`;
}

// La API devuelve hora local sin zona ("2026-10-23T14:00"): se recorta el texto,
// porque convertirlo con new Date() lo reinterpretaría en la zona horaria del navegador.
const horaMinuto = (iso) => iso.slice(11, 16);
const minutosDelDia = (iso) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));

function nombreDia(fecha, indice, largo = false) {
    if (indice === 0) return 'Hoy';
    if (indice === 1 && largo) return 'Mañana';
    const dia = new Date(`${fecha}T12:00`);
    const semana = new Intl.DateTimeFormat('es', { weekday: largo ? 'long' : 'short' }).format(dia).replace('.', '');
    return `${semana.charAt(0).toUpperCase()}${semana.slice(1)} ${dia.getDate()}`;
}

function puntoCardinal(gradosDireccion) {
    const puntos = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste'];
    return puntos[Math.round(gradosDireccion / 45) % 8];
}

const climaDe = (codigo) => CLIMA[codigo] ?? { grupo: 'cubierto', corto: 'Sin dato', frase: 'no hay descripción del cielo' };

function etiquetaLugar(lugar) {
    const partes = [lugar.nombre];
    if (lugar.region && lugar.region !== lugar.nombre) partes.push(lugar.region);
    if (lugar.pais) partes.push(lugar.pais);
    return partes.join(', ');
}

function horaActual() {
    return new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

let temporizadorAviso = null;
function avisar(mensaje) {
    el.aviso.textContent = mensaje;
    el.aviso.hidden = false;
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => { el.aviso.hidden = true; }, 6000);
}

// Íconos: SVG estáticos escritos en el código, sin datos externos (por eso es seguro usar template)
const NUBE = '<path d="M7.5 17h9.5a4 4 0 0 0 .6-7.95 5.5 5.5 0 0 0-10.6 1.2A3.4 3.4 0 0 0 7.5 17z"/>';
const NUBE_ALTA = `<g transform="translate(0 -2.5)">${NUBE}</g>`;
const ICONOS = {
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    luna: '<path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1z"/>',
    parcialDia: `<circle cx="7.5" cy="7.5" r="2.8"/><path d="M7.5 2v1.3M2 7.5h1.3M3.6 3.6l.9.9M11.4 3.6l-.9.9"/><g transform="translate(2.5 3.5) scale(.85)">${NUBE}</g>`,
    parcialNoche: `<path d="M10.2 8.6A4 4 0 0 1 5.6 3.4a4.2 4.2 0 1 0 4.6 5.2z"/><g transform="translate(2.5 3.5) scale(.85)">${NUBE}</g>`,
    cubierto: NUBE,
    niebla: '<path d="M4 9h16M6 13h14M4 17h12"/>',
    lluvia: `${NUBE_ALTA}<path d="M8.5 18l-1 3M12.5 18l-1 3M16.5 18l-1 3"/>`,
    tormenta: `${NUBE_ALTA}<path d="M13 15.5l-2.2 3.3h3l-2.2 3.4"/>`,
    nieve: `${NUBE_ALTA}<path d="M8 19.5v.01M12 21v.01M16 19.5v.01M10 22.5v.01M14 22.5v.01"/>`,
};

function icono(grupo, esDia = true) {
    const clave = {
        despejado: esDia ? 'sol' : 'luna',
        parcial: esDia ? 'parcialDia' : 'parcialNoche',
    }[grupo] ?? grupo;
    const plantilla = document.createElement('template');
    plantilla.innerHTML = `<svg class="icono" viewBox="0 0 24 24" aria-hidden="true">${ICONOS[clave] ?? ICONOS.cubierto}</svg>`;
    return plantilla.content.firstElementChild;
}


/* 3. Registro de peticiones ------------------------------------------------ */

const registro = [];

// Anota cada petición: con respuesta HTTP (ok o error) o sin ella (red caída, CORS, cancelación)
function anotar(servicio, url, sintaxis, inicio, { res, json, error }) {
    let textoEstado;
    let tipo = 'neutro';
    if (res) {
        textoEstado = `${res.status} ${res.ok ? 'OK' : res.statusText || 'Error'}`.trim();
        tipo = res.ok ? 'ok' : 'fallo';
    } else if (error?.name === 'AbortError') {
        textoEstado = 'Cancelada';
    } else {
        textoEstado = 'Sin respuesta';
        tipo = 'fallo';
    }

    registro.unshift({
        hora: horaActual(),
        servicio,
        url: url.toString(),
        sintaxis,
        estado: textoEstado,
        tipo,
        ms: Math.round(performance.now() - inicio),
        json: json ?? null,
    });
    if (registro.length > 40) registro.pop();
    pintarRegistro();
}


/* 4. Capa de datos --------------------------------------------------------- */

// Error con estado HTTP: fetch NO rechaza ante 404 o 500, así que hay que crearlo a mano
class ErrorApi extends Error {
    constructor(estadoHttp, motivo) {
        super(motivo ? `${motivo} (HTTP ${estadoHttp})` : `El servicio respondió con HTTP ${estadoHttp}`);
        this.name = 'ErrorApi';
        this.estadoHttp = estadoHttp;
    }
}

// Lee el cuerpo como JSON. Si no es JSON válido devuelve {}, salvo que la petición
// se haya cancelado mientras se descargaba: en ese caso el AbortError se propaga.
function leerJSON(res) {
    return res.json().catch((error) => {
        if (error.name === 'AbortError') throw error;
        return {};
    });
}

function normalizarLugar(r) {
    return { id: r.id, nombre: r.name, region: r.admin1 ?? '', pais: r.country ?? '', lat: r.latitude, lon: r.longitude };
}

/* SINTAXIS 1: cadena de promesas con .then() / .catch()
   Usada en el autocompletado. Cada .then() recibe lo que devolvió el anterior. */
function buscarCiudades(texto, signal) {
    const url = new URL(API.geocoding);
    url.search = new URLSearchParams({ name: texto, count: '6', language: 'es', format: 'json' });
    const inicio = performance.now();

    return fetch(url, { signal })                                // fase 1: resuelve al llegar status y cabeceras
        .then((res) => leerJSON(res).then((json) => ({ res, json }))) // fase 2: descarga y parsea el cuerpo
        .then(({ res, json }) => {
            anotar('Geocoding', url, '.then()', inicio, { res, json });
            if (!res.ok) throw new ErrorApi(res.status, json.reason);
            return (json.results ?? []).map(normalizarLugar);   // sin coincidencias, la API omite "results"
        })
        .catch((error) => {
            if (!(error instanceof ErrorApi)) anotar('Geocoding', url, '.then()', inicio, { error });
            throw error;                                         // se propaga: la interfaz decide qué mostrar
        });
}

/* SINTAXIS 2: async / await
   Misma lógica que buscarCiudades, escrita en forma secuencial. Usada por pronóstico y calidad del aire. */
async function pedirJSON(servicio, url, signal) {
    const inicio = performance.now();
    try {
        const res = await fetch(url, { signal });  // fase 1
        const json = await leerJSON(res);          // fase 2
        anotar(servicio, url, 'async/await', inicio, { res, json });
        if (!res.ok) throw new ErrorApi(res.status, json.reason);
        return json;
    } catch (error) {
        if (!(error instanceof ErrorApi)) anotar(servicio, url, 'async/await', inicio, { error });
        throw error;
    }
}

function urlPronostico(lugar) {
    const url = new URL(API.pronostico);
    url.search = new URLSearchParams({
        latitude: lugar.lat,
        longitude: lugar.lon,
        timezone: 'auto',
        forecast_days: '7',
        current: 'temperature_2m,apparent_temperature,relative_humidity_2m,is_day,weather_code,wind_speed_10m,wind_direction_10m',
        hourly: 'temperature_2m,precipitation_probability,weather_code,is_day',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max',
    });
    return url;
}

function urlAire(lugar) {
    const url = new URL(API.aire);
    url.search = new URLSearchParams({
        latitude: lugar.lat,
        longitude: lugar.lon,
        timezone: 'auto',
        current: 'us_aqi,pm2_5,pm10',
    });
    return url;
}

/* SINTAXIS 3: envolver una API de callbacks en una Promise
   La geolocalización del navegador no devuelve promesas; new Promise la adapta
   para poder usarla con await como cualquier otra operación asíncrona. */
function obtenerUbicacion() {
    return new Promise((resolve, reject) => {
        if (!('geolocation' in navigator)) {
            reject(new Error('Este navegador no permite obtener la ubicación.'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (posicion) => resolve({ lat: posicion.coords.latitude, lon: posicion.coords.longitude }),
            (fallo) => reject(new Error(MENSAJES_GEO[fallo.code] ?? 'No se pudo obtener la ubicación.')),
            { timeout: 10000, maximumAge: 600000 }
        );
    });
}

function mensajeDeError(error) {
    if (error instanceof ErrorApi) return `El servicio respondió con un error: ${error.message}.`;
    if (error instanceof TypeError) return 'No hubo respuesta del servidor. Revisá tu conexión a internet e intentá de nuevo.';
    return error.message;
}


/* 5. Buscador con autocompletado ------------------------------------------- */

let temporizadorBusqueda = null;
let controladorBusqueda = null;
let resultados = [];
let consultaDeResultados = '';
let activo = -1;

// Debounce: se espera a que la persona deje de escribir 300 ms antes de pedir.
// AbortController: si llega una búsqueda nueva, la anterior se cancela y su respuesta
// nunca puede pisar a la más reciente.
function programarBusqueda() {
    clearTimeout(temporizadorBusqueda);
    const texto = el.campo.value.trim();
    if (texto.length < 2) {
        controladorBusqueda?.abort();
        cerrarSugerencias();
        return;
    }
    temporizadorBusqueda = setTimeout(() => ejecutarBusqueda(texto), 300);
}

function ejecutarBusqueda(texto) {
    controladorBusqueda?.abort();
    controladorBusqueda = new AbortController();
    pintarSugerencias({ estado: 'cargando' });

    return buscarCiudades(texto, controladorBusqueda.signal)
        .then((lista) => {
            resultados = lista;
            consultaDeResultados = texto;
            activo = lista.length ? 0 : -1;
            pintarSugerencias({ estado: lista.length ? 'listo' : 'vacio', texto });
            return lista;
        })
        .catch((error) => {
            if (error.name === 'AbortError') return null; // la reemplazó una búsqueda más nueva
            resultados = [];
            pintarSugerencias({ estado: 'error', mensaje: mensajeDeError(error) });
            return null;
        });
}

function pintarSugerencias({ estado: fase, texto, mensaje }) {
    let items;
    if (fase === 'cargando') {
        items = [crear('li', { class: 'sugerencias__estado', text: 'Buscando…' })];
    } else if (fase === 'vacio') {
        items = [crear('li', { class: 'sugerencias__estado', text: `No hay ciudades que empiecen con «${texto}». Probá agregando el país, por ejemplo «León, Nicaragua».` })];
    } else if (fase === 'error') {
        items = [crear('li', { class: 'sugerencias__estado', text: mensaje })];
    } else {
        items = resultados.map((lugar, i) => {
            const zona = [lugar.region, lugar.pais].filter(Boolean).join(', ');
            const opcion = crear('li', { id: `opcion-${i}`, role: 'option', 'aria-selected': String(i === activo) },
                crear('span', { class: 'sugerencia__nombre', text: lugar.nombre }),
                zona ? crear('span', { class: 'sugerencia__zona', text: zona }) : null);
            // pointerdown + preventDefault: el campo no pierde el foco antes de registrar la elección
            opcion.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                elegirLugar(lugar);
            });
            return opcion;
        });
    }
    el.sugerencias.replaceChildren(...items);
    el.sugerencias.hidden = false;
    el.campo.setAttribute('aria-expanded', 'true');
    actualizarActivo();
}

function actualizarActivo() {
    [...el.sugerencias.querySelectorAll('[role="option"]')].forEach((opcion, i) => {
        opcion.setAttribute('aria-selected', String(i === activo));
        if (i === activo) opcion.scrollIntoView({ block: 'nearest' });
    });
    if (activo >= 0 && resultados.length) el.campo.setAttribute('aria-activedescendant', `opcion-${activo}`);
    else el.campo.removeAttribute('aria-activedescendant');
}

function cerrarSugerencias() {
    el.sugerencias.hidden = true;
    el.campo.setAttribute('aria-expanded', 'false');
    el.campo.removeAttribute('aria-activedescendant');
}

function elegirLugar(lugar) {
    el.campo.value = '';
    resultados = [];
    cerrarSugerencias();
    el.campo.blur();
    seleccionarLugar(lugar);
}


/* 6. Carga de un lugar ----------------------------------------------------- */

let controladorClima = null;

async function seleccionarLugar(lugar) {
    controladorClima?.abort();                 // si había otra ciudad cargando, se descarta
    controladorClima = new AbortController();
    const { signal } = controladorClima;

    mostrarCargando(lugar);

    // Pronóstico y calidad del aire no dependen entre sí: se piden en paralelo.
    // La espera total es la de la más lenta, no la suma de ambas.
    // allSettled (y no all) porque si falla la calidad del aire el pronóstico igual debe mostrarse.
    const [pronostico, aire] = await Promise.allSettled([
        pedirJSON('Pronóstico', urlPronostico(lugar), signal),
        pedirJSON('Calidad del aire', urlAire(lugar), signal),
    ]);

    if (signal.aborted) return;                // otra ciudad tomó su lugar mientras esperábamos

    el.hoja.removeAttribute('aria-busy');
    el.boletin.setAttribute('aria-busy', 'false');

    if (pronostico.status === 'rejected') {
        mostrarError(lugar, pronostico.reason);
        return;
    }

    Object.assign(estado, {
        lugar,
        pronostico: pronostico.value,
        aire: aire.status === 'fulfilled' ? aire.value : null,
        dia: 0,
        hora: 0,
    });
    recordarLugar(lugar);
    try {
        pintarTodo();
    } catch (error) {
        console.error(error);
        mostrarError(lugar, new Error('La respuesta llegó con un formato inesperado'));
    }
}

async function usarMiUbicacion() {
    el.btnUbicacion.disabled = true;
    try {
        const { lat, lon } = await obtenerUbicacion();
        await seleccionarLugar({ id: null, nombre: 'Tu ubicación', region: '', pais: '', lat, lon });
    } catch (error) {
        avisar(error.message);
    } finally {
        el.btnUbicacion.disabled = false;
    }
}

function recordarLugar(lugar) {
    const mismo = (a, b) => (a.id && a.id === b.id) || (a.lat.toFixed(2) === b.lat.toFixed(2) && a.lon.toFixed(2) === b.lon.toFixed(2));
    estado.recientes = [lugar, ...estado.recientes.filter((r) => !mismo(r, lugar))].slice(0, 5);
    guardarAlmacen(CLAVES.recientes, estado.recientes);
}


/* 7. Pintado de la interfaz ------------------------------------------------ */

function pintarTodo() {
    pintarCielo();
    pintarBoletin();
    pintarGrafico();
    pintarSemana();
    pintarAire();
    pintarRecientes();
    pintarUnidades();
}

function mostrarCargando(lugar) {
    el.boletin.setAttribute('aria-busy', 'true');
    el.hoja.setAttribute('aria-busy', 'true');
    el.lugar.textContent = `Consultando el tiempo en ${etiquetaLugar(lugar)}…`;
    el.titular.replaceChildren(crear('span', { class: 'esqueleto esqueleto--titular' }));
    el.detalle.replaceChildren(crear('span', { class: 'esqueleto esqueleto--linea' }));
    el.datos.replaceChildren();
}

function mostrarError(lugar, error) {
    el.lugar.textContent = etiquetaLugar(lugar);
    el.titular.textContent = 'No se pudo cargar el tiempo.';
    const reintentar = crear('button', { type: 'button', class: 'boton-texto', text: 'Reintentar' });
    reintentar.addEventListener('click', () => seleccionarLugar(lugar));
    el.detalle.replaceChildren(crear('span', { text: mensajeDeError(error) }), crear('br'), reintentar);
    el.datos.replaceChildren();
}

// El color del cielo se calcula con la condición actual y la posición del sol en esa ciudad
function pintarCielo() {
    const { current: actual, daily: diario } = estado.pronostico;
    const ahora = minutosDelDia(actual.time);
    const cercaDe = (iso) => Math.abs(ahora - minutosDelDia(iso)) <= 40;
    const momento = cercaDe(diario.sunrise[0]) || cercaDe(diario.sunset[0])
        ? 'crepusculo'
        : actual.is_day ? 'dia' : 'noche';

    const [arriba, abajo, fondo] = PALETAS[momento][climaDe(actual.weather_code).grupo];
    el.cielo.style.setProperty('--cielo-arriba', arriba);
    el.cielo.style.setProperty('--cielo-abajo', abajo);
    el.cielo.dataset.fondo = fondo;
    el.colorTema.setAttribute('content', arriba);
}

function pintarBoletin() {
    const { current: actual, daily: diario } = estado.pronostico;
    const clima = climaDe(actual.weather_code);

    el.lugar.textContent = `Ahora en ${etiquetaLugar(estado.lugar)}`;
    el.titular.textContent = `${grados(actual.temperature_2m)} y ${clima.frase}`;
    el.detalle.textContent = `Se siente como ${grados(actual.apparent_temperature)}. Hoy la temperatura va de ${grados(diario.temperature_2m_min[0])} a ${grados(diario.temperature_2m_max[0])}.`;

    const datos = [
        ['Hora local', horaMinuto(actual.time)],
        ['Viento', `${Math.round(actual.wind_speed_10m)} km/h del ${puntoCardinal(actual.wind_direction_10m)}`],
        ['Humedad', `${actual.relative_humidity_2m} %`],
        ['Lluvia hoy', `${diario.precipitation_probability_max[0] ?? 0} % de probabilidad`],
        ['Índice UV máximo', diario.uv_index_max[0] != null ? String(Math.round(diario.uv_index_max[0])) : '–'],
        ['Sol', `sale ${horaMinuto(diario.sunrise[0])}, se pone ${horaMinuto(diario.sunset[0])}`],
    ];
    el.datos.replaceChildren(...datos.flatMap(([termino, valor]) => [
        crear('div', {}, crear('dt', { text: termino }), crear('dd', { text: valor })),
    ]));
}

// --- Gráfico por hora (SVG dibujado a mano) ---

let geometria = null; // posiciones del último dibujo, para ubicar el marcador sin redibujar todo

function serieHoras() {
    const { hourly: h, current: actual } = estado.pronostico;
    // hourly arranca a las 00:00 de hoy: el día d empieza en el índice 24·d
    const inicio = estado.dia === 0
        ? Math.max(0, h.time.findIndex((t) => t.slice(0, 13) === actual.time.slice(0, 13)))
        : estado.dia * 24;
    const fin = Math.min(inicio + 24, h.time.length);

    const serie = [];
    for (let i = inicio; i < fin; i++) {
        serie.push({
            hora: horaMinuto(h.time[i]),
            temp: h.temperature_2m[i],
            lluvia: h.precipitation_probability?.[i] ?? 0,
            codigo: h.weather_code[i],
            esDia: h.is_day[i] === 1,
        });
    }
    return serie;
}

function pintarGrafico() {
    if (!estado.pronostico) return;
    const serie = serieHoras();
    const fecha = estado.pronostico.daily.time[estado.dia];
    el.tituloHoras.textContent = estado.dia === 0 ? 'Próximas 24 horas' : `${nombreDia(fecha, estado.dia, true)}, hora por hora`;

    const ancho = Math.max(el.grafico.clientWidth, 280);
    const alto = 250;
    const m = { izq: 14, der: 14 };
    const zonaTemp = { arriba: 34, abajo: 150 };
    const zonaLluvia = { arriba: 170, abajo: 206 };
    const n = serie.length;
    const paso = (ancho - m.izq - m.der) / Math.max(n - 1, 1);

    const temps = serie.map((p) => p.temp);
    const tMin = Math.min(...temps);
    const tMax = Math.max(...temps);
    const x = (i) => m.izq + i * paso;
    const y = (t) => zonaTemp.abajo - ((t - tMin) / (tMax - tMin || 1)) * (zonaTemp.abajo - zonaTemp.arriba);

    const cadaEtiqueta = paso < 16 ? 6 : 3;
    const capas = [];

    // Franjas de noche: muestran dónde cae la oscuridad dentro del período
    serie.forEach((p, i) => {
        if (!p.esDia) capas.push(crearSvg('rect', { class: 'noche', x: x(i) - paso / 2, y: 0, width: paso, height: zonaLluvia.abajo }));
    });

    capas.push(crearSvg('line', { class: 'eje', x1: m.izq - paso / 2, x2: ancho - m.der + paso / 2, y1: zonaLluvia.abajo, y2: zonaLluvia.abajo }));

    // Probabilidad de lluvia como barras en la franja inferior
    const anchoBarra = Math.max(2, paso * 0.45);
    serie.forEach((p, i) => {
        const h = (p.lluvia / 100) * (zonaLluvia.abajo - zonaLluvia.arriba);
        if (h > 0) capas.push(crearSvg('rect', { class: 'barra', x: x(i) - anchoBarra / 2, y: zonaLluvia.abajo - h, width: anchoBarra, height: h, rx: 1 }));
    });

    // Línea de temperatura
    const d = serie.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.temp).toFixed(1)}`).join(' ');
    capas.push(crearSvg('path', { class: 'linea', d }));

    serie.forEach((p, i) => {
        if (i % cadaEtiqueta !== 0) return;
        capas.push(crearSvg('circle', { class: 'punto', cx: x(i), cy: y(p.temp), r: 3 }));
        capas.push(crearSvg('text', { class: 'etiqueta-temp', x: x(i), y: y(p.temp) - 12, 'text-anchor': 'middle' }, grados(p.temp)));
        capas.push(crearSvg('text', { x: x(i), y: alto - 18, 'text-anchor': 'middle' }, p.hora));
    });

    // Marcador de la hora elegida (se mueve sin redibujar el resto)
    const marcadorLinea = crearSvg('line', { class: 'marcador-linea', y1: 14, y2: zonaLluvia.abajo });
    const marcadorPunto = crearSvg('circle', { class: 'marcador-punto', r: 5.5 });
    capas.push(marcadorLinea, marcadorPunto);

    const lienzo = crearSvg('svg', { viewBox: `0 0 ${ancho} ${alto}`, height: alto, 'aria-hidden': 'true' }, ...capas);
    el.grafico.replaceChildren(lienzo);

    geometria = { serie, x, y, paso, m, n, lienzo, marcadorLinea, marcadorPunto };
    estado.hora = Math.min(estado.hora, n - 1);
    moverMarcador(estado.hora);
}

function moverMarcador(i) {
    if (!geometria) return;
    const { serie, x, y, marcadorLinea, marcadorPunto } = geometria;
    const p = serie[i];
    estado.hora = i;
    marcadorLinea.setAttribute('x1', x(i));
    marcadorLinea.setAttribute('x2', x(i));
    marcadorPunto.setAttribute('cx', x(i));
    marcadorPunto.setAttribute('cy', y(p.temp));
    el.lectura.replaceChildren(
        crear('strong', { text: p.hora }),
        ` ${grados(p.temp)}, ${climaDe(p.codigo).corto.toLowerCase()}, ${p.lluvia} % de probabilidad de lluvia`
    );
}

function indiceDesdePuntero(evento) {
    const { m, paso, n, lienzo } = geometria;
    const caja = lienzo.getBoundingClientRect();
    const xLocal = evento.clientX - caja.left;
    return Math.min(n - 1, Math.max(0, Math.round((xLocal - m.izq) / paso)));
}

// --- Semana ---

function pintarSemana() {
    const d = estado.pronostico.daily;
    const minSemana = Math.min(...d.temperature_2m_min);
    const maxSemana = Math.max(...d.temperature_2m_max);
    const posicion = (t) => ((t - minSemana) / (maxSemana - minSemana || 1)) * 100;

    const filas = d.time.map((fecha, i) => {
        const clima = climaDe(d.weather_code[i]);
        const lluvia = d.precipitation_probability_max[i] ?? 0;
        const tMin = d.temperature_2m_min[i];
        const tMax = d.temperature_2m_max[i];

        const rango = crear('span', { class: 'dia__rango' },
            crear('span', { class: 'dia__tramo', style: { left: `${posicion(tMin)}%`, right: `${100 - posicion(tMax)}%` } }));
        if (i === 0) {
            rango.append(crear('span', { class: 'dia__ahora', style: { left: `${posicion(estado.pronostico.current.temperature_2m)}%` } }));
        }

        const boton = crear('button', {
            type: 'button',
            class: 'dia',
            'aria-pressed': String(i === estado.dia),
            'aria-label': `${nombreDia(fecha, i, true)}: ${clima.corto.toLowerCase()}, mínima ${grados(tMin)}, máxima ${grados(tMax)}, ${lluvia} % de probabilidad de lluvia`,
        },
            crear('span', { class: 'dia__nombre', text: nombreDia(fecha, i) }),
            icono(clima.grupo, true),
            crear('span', { class: 'dia__lluvia', text: lluvia >= 10 ? `${lluvia} %` : '' }),
            crear('span', { class: 'dia__min', text: grados(tMin) }),
            rango,
            crear('span', { class: 'dia__max', text: grados(tMax) }));

        boton.addEventListener('click', () => {
            estado.dia = i;
            estado.hora = 0;
            pintarSemana();
            pintarGrafico();
        });
        return crear('li', {}, boton);
    });
    el.semana.replaceChildren(...filas);
}

// --- Calidad del aire ---

function pintarAire() {
    const actual = estado.aire?.current;
    if (!actual || actual.us_aqi == null) {
        el.aire.replaceChildren(crear('p', { class: 'nota', text: 'No hay datos de calidad del aire para esta ubicación en este momento.' }));
        return;
    }

    const valor = Math.round(actual.us_aqi);
    const indiceBanda = BANDAS_AQI.findIndex((b) => valor <= b.hasta);
    const banda = BANDAS_AQI[indiceBanda];
    const piso = indiceBanda === 0 ? 0 : BANDAS_AQI[indiceBanda - 1].hasta;
    const techo = Number.isFinite(banda.hasta) ? banda.hasta : 500;
    // Cada banda ocupa el mismo ancho; el marcador se interpola dentro de la suya
    const fraccion = Math.min(1, (valor - piso) / (techo - piso));
    const izquierda = ((indiceBanda + fraccion) / BANDAS_AQI.length) * 100;

    el.aire.replaceChildren(
        crear('p', { class: 'aire__frase', text: `Índice ${valor}: ${banda.nombre.toLowerCase()}` }),
        crear('p', { class: 'aire__consejo nota', text: banda.consejo }),
        crear('div', { class: 'escala', role: 'img', 'aria-label': `Escala de 0 a 500; el valor actual, ${valor}, está en la banda ${banda.nombre.toLowerCase()}` },
            ...BANDAS_AQI.map((b) => crear('span', { style: { background: b.color }, title: b.nombre })),
            crear('span', { class: 'escala__marca', style: { left: `${izquierda}%` } })),
        crear('div', { class: 'escala__extremos' }, crear('span', { text: 'Buena' }), crear('span', { text: 'Peligrosa' })),
        crear('dl', { class: 'aire__datos' },
            crear('div', {}, crear('dt', { text: 'PM2.5' }), crear('dd', { text: `${Math.round(actual.pm2_5)} µg/m³` })),
            crear('div', {}, crear('dt', { text: 'PM10' }), crear('dd', { text: `${Math.round(actual.pm10)} µg/m³` })),
            crear('div', {}, crear('dt', { text: 'Escala' }), crear('dd', { text: 'AQI de la EPA' })))
    );
}

// --- Recientes, unidades y registro ---

function pintarRecientes() {
    const actual = estado.lugar;
    el.recientes.replaceChildren(...estado.recientes.map((lugar) => {
        const esActual = actual && lugar.lat === actual.lat && lugar.lon === actual.lon;
        const boton = crear('button', { type: 'button', text: lugar.nombre, 'aria-current': esActual ? 'true' : null, title: etiquetaLugar(lugar) });
        boton.addEventListener('click', () => seleccionarLugar(lugar));
        return crear('li', {}, boton);
    }));
}

function pintarUnidades() {
    el.unidades.querySelectorAll('button').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.unidad === estado.unidad));
    });
}

function pintarRegistro() {
    el.contador.textContent = String(registro.length);
    el.filas.replaceChildren(...registro.map((r) => {
        const ver = crear('button', { type: 'button', class: 'enlace', text: r.servicio, disabled: !r.json });
        ver.addEventListener('click', () => mostrarJSON(r));
        return crear('tr', {},
            crear('td', { text: r.hora }),
            crear('td', {}, ver),
            crear('td', { class: `estado--${r.tipo}`, text: r.estado }),
            crear('td', { text: `${r.ms} ms` }),
            crear('td', {}, crear('code', { text: r.sintaxis })));
    }));
    // Si todavía no se eligió ninguna respuesta, se muestra la más reciente con contenido
    if (!el.json.textContent) {
        const ultima = registro.find((r) => r.json);
        if (ultima) mostrarJSON(ultima);
    }
}

function mostrarJSON(r) {
    el.jsonUrl.textContent = `GET ${r.url}`;
    el.json.textContent = JSON.stringify(r.json, null, 2);
}


/* 8. Eventos y arranque ---------------------------------------------------- */

el.campo.addEventListener('input', programarBusqueda);

el.campo.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        cerrarSugerencias();
        return;
    }
    if (el.sugerencias.hidden || !resultados.length) return;
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        activo = (activo + 1) % resultados.length;
        actualizarActivo();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activo = (activo - 1 + resultados.length) % resultados.length;
        actualizarActivo();
    }
});

el.formulario.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = el.campo.value.trim();
    if (texto.length < 2) return;
    // Si ya hay resultados para exactamente este texto, se usa el resaltado
    if (resultados.length && consultaDeResultados === texto && activo >= 0) {
        elegirLugar(resultados[activo]);
        return;
    }
    clearTimeout(temporizadorBusqueda);
    const lista = await ejecutarBusqueda(texto);
    if (lista?.length) elegirLugar(lista[0]);
});

el.formulario.addEventListener('focusout', (e) => {
    if (!el.formulario.contains(e.relatedTarget)) cerrarSugerencias();
});

el.btnUbicacion.addEventListener('click', usarMiUbicacion);

el.unidades.addEventListener('click', (e) => {
    const boton = e.target.closest('button[data-unidad]');
    if (!boton || boton.dataset.unidad === estado.unidad) return;
    estado.unidad = boton.dataset.unidad;
    guardarAlmacen(CLAVES.unidad, estado.unidad);
    if (estado.pronostico) pintarTodo(); // sin pedir nada nuevo: solo cambia la presentación
    else pintarUnidades();
});

// Gráfico: puntero (mouse o dedo) y teclado
el.grafico.addEventListener('pointermove', (e) => {
    if (geometria) moverMarcador(indiceDesdePuntero(e));
});
el.grafico.addEventListener('pointerdown', (e) => {
    if (geometria) moverMarcador(indiceDesdePuntero(e));
});
el.grafico.addEventListener('keydown', (e) => {
    if (!geometria) return;
    const ultimo = geometria.n - 1;
    const destino = { ArrowRight: estado.hora + 1, ArrowLeft: estado.hora - 1, Home: 0, End: ultimo }[e.key];
    if (destino === undefined) return;
    e.preventDefault();
    moverMarcador(Math.min(ultimo, Math.max(0, destino)));
});

// Al cambiar el ancho disponible se redibuja: el SVG se calcula en píxeles reales, no se estira
let anchoPrevio = 0;
new ResizeObserver(([entrada]) => {
    const ancho = Math.round(entrada.contentRect.width);
    if (ancho !== anchoPrevio && estado.pronostico) {
        anchoPrevio = ancho;
        pintarGrafico();
    }
}).observe(el.grafico);

// Arranque: la última ciudad consultada o Managua
pintarUnidades();
pintarRecientes();
seleccionarLugar(estado.recientes[0] ?? LUGAR_INICIAL);
