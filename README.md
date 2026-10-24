# Cielo: portal del tiempo con Open-Meteo

Portal web que consume servicios públicos de [Open-Meteo](https://open-meteo.com/) para mostrar el tiempo actual, el pronóstico por hora, la semana y la calidad del aire de cualquier ciudad. Desarrollado para la asignatura **Diseño de Sistemas de Internet** (Universidad Nacional de Ingeniería), Guía Frontend Consumo de API.

**Sitio publicado:** https://mattmnz.github.io/portal-clima/

## Funcionalidades

- **Buscador con autocompletado:** sugiere ciudades mientras se escribe y se maneja con teclado (flechas, Enter, Escape).
- **Cielo dinámico:** el color de la banda superior se calcula con la condición actual y la posición del sol en la ciudad consultada (día, noche o crepúsculo).
- **Boletín en lenguaje natural:** temperatura, sensación térmica, viento, humedad, probabilidad de lluvia, índice UV, salida y puesta del sol.
- **Gráfico interactivo por hora:** temperatura y probabilidad de lluvia de las próximas 24 horas, con franjas de noche. Se recorre con el mouse, con el dedo o con las flechas del teclado.
- **Semana:** rango de temperaturas de cada día ubicado dentro del rango semanal. Al elegir un día, el gráfico muestra sus 24 horas.
- **Calidad del aire:** índice AQI de la EPA con su escala y concentraciones de PM2.5 y PM10.
- **Ubicación actual** mediante la API de geolocalización del navegador.
- **Conversión °C / °F** sin nuevas peticiones, y **ciudades recientes** guardadas en `localStorage`.
- **Registro de peticiones:** cada llamada queda anotada con estado HTTP, duración, sintaxis usada y la respuesta JSON completa.

## Servicios consumidos

| Servicio | Endpoint | Uso |
|---|---|---|
| Geocoding | `https://geocoding-api.open-meteo.com/v1/search` | Nombre de ciudad → coordenadas |
| Pronóstico | `https://api.open-meteo.com/v1/forecast` | Condiciones actuales, por hora y por día |
| Calidad del aire | `https://air-quality-api.open-meteo.com/v1/air-quality` | AQI, PM2.5 y PM10 |

Ninguno requiere API key y todos habilitan CORS, por lo que se consumen directamente desde el navegador.

## Mecanismos de consumo de API aplicados

| Mecanismo | Dónde |
|---|---|
| `fetch()` con cadena `.then()` / `.catch()` | `buscarCiudades()`: autocompletado |
| `fetch()` con `async` / `await` y `try` / `catch` | `pedirJSON()`: pronóstico y calidad del aire |
| Validación de `response.ok` (fetch no rechaza ante 4xx/5xx) | Ambas funciones, con la clase `ErrorApi` |
| Lectura del motivo de error que envía la API (`reason`) | `ErrorApi` |
| Peticiones dependientes (en secuencia) | Geocoding → pronóstico: el segundo necesita las coordenadas del primero |
| Peticiones independientes (en paralelo) con `Promise.allSettled` | Pronóstico y calidad del aire: si falla la calidad del aire, el pronóstico se muestra igual |
| Cancelación con `AbortController` | Una búsqueda o ciudad nueva cancela la anterior, para que una respuesta vieja nunca pise a la nueva |
| *Debounce* de 300 ms | El autocompletado no pide en cada tecla |
| Adaptar una API de *callbacks* a `Promise` | `obtenerUbicacion()` envuelve `navigator.geolocation` |
| Estados de carga, éxito, vacío y error | Boletín, sugerencias y bloques de datos |
| Render seguro | Los textos de la API y del usuario se insertan con `textContent`, nunca con `innerHTML` |

## Estructura del proyecto

```text
portal-clima/
├── index.html        # Estructura semántica de la página
├── css/
│   └── styles.css    # Estilos, tema claro/oscuro y diseño responsivo
├── js/
│   └── app.js        # Estado, capa de datos, buscador y pintado de la interfaz
└── README.md
```

## Cómo ejecutarlo localmente

1. Clonar el repositorio: `git clone https://github.com/Mattmnz/portal-clima.git`
2. Abrir la carpeta en VS Code y ejecutar `index.html` con la extensión **Live Server**.

La geolocalización solo funciona en un origen seguro (`https://` o `localhost`).

## Créditos de datos

- Datos meteorológicos: [Open-Meteo](https://open-meteo.com/), bajo licencia CC BY 4.0.
- Calidad del aire: Copernicus Atmosphere Monitoring Service (CAMS).
- Ubicaciones: [GeoNames](https://www.geonames.org/).

## Autor

Matthew Muñoz
