# Informe de QA (Fase 10)

Fecha: 2026-10-01 · Entorno local (`npm run dev`, con compresión Brotli como en Netlify) · Chrome headless (Puppeteer) · Lighthouse en modo **móvil** con throttling por defecto.

## Lighthouse móvil

| Página           | Rendimiento | Accesibilidad | Buenas prácticas | SEO |
|------------------|:-----------:|:-------------:|:----------------:|:---:|
| `/`              | 97          | 100           | 100              | 100 |
| `/privacidad`    | 100         | 100           | 100              | 100 |
| `/cookies`       | 100         | 100           | 100              | 100 |
| `/aviso-legal`   | 100         | 100           | 100              | 100 |

Home: LCP 2,3 s · TBT 70 ms · CLS 0 · FCP 1,7 s. Objetivo (≥ 90 en las cuatro categorías): **cumplido**.
Nota: son medidas en local, sin red real de Netlify/CDN; conviene repetirlas sobre la URL desplegada (`node scripts/lighthouse.mjs https://…`).

### Correcciones hechas durante la fase

- Contraste: `text-ink/50` → `/70`, `text-white/40` y `/50` → `/60`, iconos `white/30` → `/50`.
- Nuevo token `mint-text` (`#007A5A`) para texto verde sobre fondos claros (antes `#00B589`, contraste 2,5:1). Logo del header en `#009E76` (≥ 3:1, texto grande). Números «01 02 03» de «Cómo funciona» a `mint-text/80`.
- Enlaces «Más información» sin contexto → «Ver política de cookies» (auditoría `link-text`).
- Preload de la imagen del hero (LCP) y compresión Brotli en el servidor local.

## Pruebas funcionales automáticas (`npm test`) — 61/61 correctas

Con mocks de Anthropic y del webhook (no se gasta API real ni se envían leads).

**Endpoint `/lead` (16):** lead válido reenviado al webhook con `fecha` y `sitio`; consentimiento ausente/no booleano → 400; teléfono inválido → 400; nombre > 80 y mensaje > 500 → 400; origen no permitido → 400; honeypot relleno → 400; JSON inválido → 400; webhook que devuelve 500 → el usuario recibe 200; webhook lento → timeout a los 5 s y 200; modo demo sin `LEAD_WEBHOOK_URL` → 200 y log con teléfono enmascarado; GET → 405; límite de peticiones → 429.

**Endpoint `/api/chat` (11):** respuesta correcta; la llamada lleva `x-api-key` del servidor y `anthropic-version`; el prompt de sistema incluye IA, no-consejo-clínico, derivación y datos de la clínica; `max_tokens` acotado; `[[LEAD]]` → `lead:true` y se elimina del texto; mensaje > 500, rol no permitido, roles no alternados e historial > 20 → 400; error de Anthropic → 502 con mensaje amable; sin `ANTHROPIC_API_KEY` → 503 sin filtrar detalles.

**Banner de cookies (8):** aparece en la primera visita; Plausible no se carga antes de aceptar ni al recargar sin decidir; al aceptar se carga con el dominio configurado; la decisión persiste; «Configurar cookies» reabre el banner; al rechazar no se carga nunca.

**Reserva (6):** los 11 botones «Reservar…» llevan a `#reservar`; Cal.com no se carga hasta acercarse a la sección; el embed apunta a `CAL_LINK`; prefill de tratamiento y teléfono (+34); los CTA de tratamiento preseleccionan el tratamiento; sin errores de JS.

**WhatsApp (5):** 12 enlaces `wa.me` con el número configurado y `rel="noopener"`; textos distintos por contexto (hero, plan, tratamiento); botón flotante visible y ≥ 44 px en escritorio y móvil.

**Formulario (5):** honeypot fuera de pantalla y fuera del orden de tabulación; vacío → errores sin llamar al servidor; sin consentimiento no se envía; confirmación visual; el servidor recibe el lead con origen `formulario`.

**Chat con captura de lead (10):** se presenta como IA; aviso de que no da consejo médico; respuesta en pantalla; input limitado a 500; error del servidor → mensaje amable y el chat sigue usable; `[[LEAD]]` abre el formulario del chat; exige consentimiento; el lead llega a `/lead` con origen `chat`; límite de 12 mensajes por sesión; sin errores de JS.

## Qué NO se ha podido probar

- **Reserva real en Cal.com**: no hay enlace real; se verificó que el iframe apunta a `CAL_LINK` con el prefill correcto. El campo `tratamiento` solo se verá en Cal.com si se crea la pregunta con ese identificador.
- **Respuestas reales de Claude**: no hay `ANTHROPIC_API_KEY`; el flujo se probó con un mock que imita la API. Conviene probar el chat con la clave real (calidad de respuestas, tono, derivación en urgencias).
- **WhatsApp real**: solo se comprueba la URL generada, no la apertura de la app.
- **Plausible** con dominio real y **Netlify** (funciones, cabeceras, `URL`): se prueba al desplegar.
- Lighthouse sobre la URL desplegada y pruebas en dispositivos reales.
