# Studio32 Dental Studio — landing demo

Landing de **demostración** de una clínica dental **ficticia** (Studio32, Chamberí, Madrid), pensada como portfolio para
vender landings + reservas + automatizaciones a clínicas reales. Marca, equipo, reseñas, cifras, teléfono, dirección y
nº de colegiado son inventados y están marcados como demo en la propia web.

## Qué incluye

- Landing estática (HTML + Tailwind CLI + Alpine + Lucide), fuentes autoalojadas, imágenes WebP responsive.
- **Reserva** con embed de Cal.com (selector de tratamiento + teléfono como prefill).
- **WhatsApp** con textos prellenados por contexto (hero, planes, tratamientos…).
- **Asistente de IA** (Netlify Function + API de Anthropic) con captura de lead dentro del chat.
- **Formulario corto de lead** con honeypot y confirmación visual.
- **Endpoint `/lead`** desacoplado (webhook opcional).
- Secciones de tratamientos, equipo, antes/después (placeholders demo) y mapa (carga solo al pulsar).
- SEO: JSON-LD `Dentist`, canonical, `og:*`, `sitemap.xml`, `robots.txt`.
- Páginas legales **plantilla** (privacidad, aviso legal, cookies) y **banner de cookies** que bloquea Plausible hasta aceptar.

## Estructura

```
src/index.html              Página principal (marcadores %CSS% %JS% %SITE_URL% %CAL_LINK% %WA:clave% …)
src/partials/               Pie de página y banner de cookies (se incluyen con <!--@include …-->)
src/legal/                  Plantillas de Privacidad, Aviso legal y Cookies + layout
src/input.css               Entrada de Tailwind, @font-face y estilos de las páginas legales
src/main.js                 Arranque de Alpine/Lucide, contador y componente de reserva
src/chat.js · lead.js       Asistente de IA y formularios de lead
src/cal.js · consent.js     Embed de Cal.com · consentimiento de cookies y analítica
src/whatsapp-messages.json  Texto prellenado de WhatsApp por contexto
netlify/functions/          chat.mjs (/api/chat) y lead.mjs (/lead)
netlify/lib/                Prompt/datos de la clínica, utilidades HTTP y límite de peticiones
public/                     Imágenes WebP y og-image.png (se copian a dist/)
scripts/                    build · dev-server · qa (pruebas) · lighthouse · images · og-image
docs/                       Claims de publicidad sanitaria (antes/después) e informe de QA
```

## Desarrollo local

Requiere Node 20.6+ (probado con Node 24).

```bash
npm install
cp .env.example .env     # y rellena lo que tengas (todo es opcional para ver la web)
npm run dev              # build + servidor en http://localhost:3000 con las funciones montadas
```

`npm run dev` equivale a `netlify dev` para esta demo: sirve `dist/` y expone `/lead` y `/api/chat`.
Si cambias algo en `src/`, vuelve a lanzarlo (el build tarda ~1 s).

| Comando              | Qué hace                                                                                   |
|----------------------|--------------------------------------------------------------------------------------------|
| `npm run build`      | Genera `dist/` (CSS minificado, JS empaquetado, páginas legales, sitemap, robots)           |
| `npm test`           | Batería de pruebas: endpoints, chat, formulario, reserva, WhatsApp y cookies (con mocks)    |
| `npm run lighthouse` | Lighthouse móvil sobre `http://localhost:3000` (necesita `npm run dev` en otra terminal)    |
| `npm run images`     | Regenera los WebP desde Unsplash (caché en `.cache/`)                                       |
| `npm run og`         | Regenera `public/assets/og-image.png`                                                       |

`npm test` construye con variables de prueba y levanta mocks de Anthropic y del webhook: **no gasta API real ni envía leads**.

## Despliegue en Netlify

1. Sube el repo a GitHub/GitLab/Bitbucket.
2. En Netlify: **Add new site → Import an existing project** y elige el repo. Los ajustes salen de `netlify.toml`
   (`npm run build`, carpeta `dist`, funciones en `netlify/functions`).
3. Define las variables de entorno (tabla siguiente) en **Site configuration → Environment variables** y despliega.
4. Con dominio propio: define `SITE_URL` (p. ej. `https://studio32.es`) y relanza el deploy para que canonical, sitemap,
   JSON-LD y `og:*` usen esa URL.

### Variables de entorno

| Variable             | Obligatoria | Para qué                                                                                   |
|----------------------|-------------|--------------------------------------------------------------------------------------------|
| `SITE_URL`           | Recomendada | URL pública (canonical, og, sitemap, JSON-LD). Por defecto usa `URL` de Netlify             |
| `CAL_LINK`           | Para reservar | `usuario/evento` de Cal.com. Sin definir: aviso de modo demo en el calendario             |
| `WHATSAPP_NUMBER`    | Sí          | Número internacional sin `+` (p. ej. `34600123456`). Por defecto, un número falso           |
| `ANTHROPIC_API_KEY`  | Para el chat | Clave de la API de Anthropic. **Solo servidor.** Sin ella el chat responde con un error amable |
| `ANTHROPIC_MODEL`    | No          | Por defecto `claude-haiku-4-5-20251001`                                                      |
| `LEAD_WEBHOOK_URL`   | No          | Si existe, cada lead se reenvía ahí (ver más abajo). Si no, modo demo                        |
| `PLAUSIBLE_DOMAIN`   | No          | Dominio dado de alta en Plausible. Sin definir: no hay analítica                             |

Ninguna clave va al cliente: `ANTHROPIC_API_KEY` y `LEAD_WEBHOOK_URL` solo las leen las funciones. El resto son valores
públicos que el build incrusta en el HTML.

## Reserva con Cal.com

El calendario se incrusta en `#reservar` con `CAL_LINK`. Encima hay un selector de **tratamiento** y un campo de **teléfono** que
se envían como prefill. Para que aparezcan en la reserva, en el tipo de evento de Cal.com (*Advanced → Booking questions*)
activa el teléfono (`attendeePhoneNumber`) y crea una pregunta de tipo **desplegable** con identificador `tratamiento` y estas opciones, exactamente así (el valor debe coincidir letra por letra): `Revision`, `Ortodoncia invisible`, `Blanqueamiento`, `Implantes`, `Urgencia`. Los valores están en `src/lead.js` (`cal`). «Otro / no lo sé» no tiene opción en Cal.com: no se prefilla y la persona elige.
Todos los botones «Reservar…» llevan a `#reservar`; los de planes y tratamientos preseleccionan el tratamiento.

## WhatsApp

Los enlaces `wa.me` se generan en el build a partir de `WHATSAPP_NUMBER` y de [src/whatsapp-messages.json](src/whatsapp-messages.json).
En el HTML se usa el marcador `%WA:clave%`; una clave inexistente rompe el build.

## Asistente de IA

- `POST /api/chat` ([netlify/functions/chat.mjs](netlify/functions/chat.mjs)) llama a la API de Anthropic con la clave del servidor.
- El **prompt de sistema** con horarios, planes, FAQ y ubicación está en [netlify/lib/clinic.mjs](netlify/lib/clinic.mjs).
  Declara que es un asistente virtual (IA), prohíbe el consejo clínico, indica qué hacer ante urgencias y deriva a una persona
  añadiendo la etiqueta `[[LEAD]]`, que el servidor elimina y convierte en `lead: true` para abrir el formulario de contacto en el chat.
  **Si cambias datos de la clínica, actualiza este fichero.**
- Protecciones: máximo 12 mensajes por sesión (cliente), 500 caracteres por mensaje, 20 turnos de historial y 400 tokens de
  salida (servidor), 30 peticiones / 10 min por IP, timeout de 20 s y mensajes de error amables.
- El límite por IP es en memoria (por instancia de función): frena abusos casuales, no es un WAF.

## Conectar una automatización

El frontend nunca habla con Make, n8n ni similares: todos los leads van a `POST /lead`
([netlify/functions/lead.mjs](netlify/functions/lead.mjs)). Para conectar una automatización **basta con definir `LEAD_WEBHOOK_URL`**
(un webhook de Make, n8n, Zapier, un CRM…) y volver a desplegar. Sin la variable, el lead solo se registra en los logs de la
función (modo demo: teléfono enmascarado, sin texto libre).

**Entrada** (`POST /lead`, `application/json`):

```json
{
  "nombre": "Ana Pérez",
  "telefono": "600 123 456",
  "tratamiento": "Implantes",
  "mensaje": "Opcional, máx. 500 caracteres",
  "consentimiento": true,
  "origen": "formulario",
  "website": ""
}
```

Validación en servidor (400 con `{ "error": "…", "errors": { campo: "…" } }`): `consentimiento` debe ser `true`; `telefono` de 9–15 dígitos
(con `+` opcional); `nombre` 2–80; `tratamiento` ≤ 60 (por defecto «no especificado»); `mensaje` ≤ 500; `origen` ∈ `chat | formulario | reserva`;
`website` (honeypot) vacío. Límite: 5 envíos / 10 min por IP.

**Salida hacia el webhook** (`POST` JSON, timeout 5 s; si falla, el usuario no lo nota y queda constancia en logs):

```json
{
  "nombre": "Ana Pérez",
  "telefono": "600123456",
  "tratamiento": "Implantes",
  "mensaje": "",
  "consentimiento": true,
  "origen": "formulario",
  "fecha": "2026-10-01T09:47:18.115Z",
  "sitio": "studio32-demo"
}
```

El origen `reserva` está aceptado por el endpoint pero la web no lo envía todavía (la reserva la gestiona Cal.com; se puede
conectar su webhook `BOOKING_CREATED` a la misma automatización).

## Analítica y cookies

Plausible solo se carga **después de pulsar «Aceptar»** en el banner (`src/consent.js`) y únicamente si `PLAUSIBLE_DOMAIN` está definido.
La decisión se guarda en `localStorage` (`studio32-consent`) y se puede cambiar desde «Configurar cookies» en el pie.
Eventos de conversión (solo con consentimiento): `Lead` (con `origen`) y `Reserva`.

## Páginas legales

`/privacidad`, `/aviso-legal` y `/cookies` son **plantillas** con un aviso visible «revisar con un profesional». Los datos entre
`[CORCHETES]` están pendientes. Antes de usarlas con una clínica real las debe revisar un abogado o DPD, y hay que actualizar la
tabla de cookies si se añaden servicios.

## Antes de vender esto a una clínica real

- Sustituir todo lo ficticio: equipo y nº de colegiado, reseñas, cifras, fotos de casos, teléfono, dirección y datos legales.
- Las imágenes de Unsplash son de ejemplo (las reseñas y el equipo usan iniciales, no fotos de personas).
- Revisar la publicidad sanitaria con un profesional (ver [docs/fase9-claims.md](docs/fase9-claims.md)).
- El JSON-LD no incluye valoraciones (`aggregateRating`) a propósito: no publiques valoraciones que no sean reales y verificables.

## Créditos de imágenes

Fotografías de [Unsplash](https://unsplash.com) (licencia Unsplash), usadas como imágenes de ejemplo en esta demo.
