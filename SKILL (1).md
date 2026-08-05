---
name: landing-page-pro
description: Crea landing pages de alta conversión con copywriting persuasivo, diseño moderno y optimización CRO. Usar cuando el usuario pida una "landing", "página de ventas", "web de captación", "lanzar un producto", "página para validar una idea" o necesite una web que convierta visitas en clientes. Genera código HTML/Tailwind listo para desplegar en Vercel/Netlify.
---

# Landing Page Pro

Construye landings que convierten. No plantillas genéricas: páginas diseñadas con frameworks probados de copywriting y CRO (Conversion Rate Optimization).

## Flujo de trabajo

Cuando el usuario pida una landing, procede en este orden:

1. **Descubrimiento en 5 preguntas** (si no lo ha dado ya)
   - ¿Cuál es el producto o servicio en una frase?
   - ¿Quién es el cliente ideal? (rol, dolor, contexto)
   - ¿Qué transformación concreta prometes?
   - ¿Cuál es el CTA principal? (comprar, reservar demo, lista de espera, descargar)
   - ¿Qué tono de marca? (profesional, cercano, atrevido, técnico)

2. **Estructura obligatoria** (en este orden, siempre)
   - **Hero**: headline con promesa clara + subheadline con mecanismo + CTA primario + prueba social breve
   - **Bloque del dolor**: 3 dolores específicos del cliente (no genéricos)
   - **Propuesta de valor**: 3-4 beneficios tangibles con iconos
   - **Cómo funciona**: 3 pasos visuales
   - **Prueba social**: testimonios, logos de clientes, métricas
   - **Features**: características con captura o mockup
   - **Comparativa** (opcional): "Antes vs con [producto]"
   - **Pricing**: planes con plan recomendado destacado
   - **FAQ**: 5-7 objeciones reales resueltas
   - **CTA final**: cierre con urgencia o garantía

3. **Stack por defecto**: HTML + Tailwind CSS vía CDN + Alpine.js para interactividad + Lucide icons. Cero build step, desplegable en segundos.

4. **Entregable**: un solo archivo `index.html` responsive, dark mode opcional, con los meta tags OG/Twitter listos, favicon placeholder, y analytics snippet comentado.

## Frameworks de copywriting a aplicar

**Headline — fórmula PAS-T (Problema-Agitación-Solución-Transformación)**
- Mal: "La mejor herramienta de gestión"
- Bien: "Deja de perder 4 horas al día en reuniones. Automatiza la toma de decisiones de tu equipo en 15 minutos."

**Subheadline — mecanismo + prueba**
- "La única plataforma que usa IA entrenada con los 200 SaaS más rentables. Ya confían +3.000 founders."

**CTA — verbo + resultado, no función**
- Mal: "Enviar", "Registrarse"
- Bien: "Empezar gratis 14 días", "Reservar mi demo", "Validar mi idea ahora"

**Bullets de beneficios — AIDA invertida**
Cada bullet: resultado concreto → cómo lo consigues → cuánto tiempo/esfuerzo ahorra.

**FAQ — objeciones, no preguntas**
Escribe las dudas reales: "¿Y si no me convence?", "¿Necesito tarjeta?", "¿Funciona sin saber programar?", "¿Cuánto tarda en ver resultados?".

## Principios CRO no negociables

- **Un solo CTA primario** repetido 3-5 veces (mismo color, mismo texto)
- **Above the fold**: headline + subheadline + CTA visibles sin scroll
- **Prueba social en los primeros 500px**: logos, nº de usuarios, estrellas
- **Contraste alto** en el botón CTA (color que no aparezca en el resto)
- **Microcopy bajo el CTA**: "Sin tarjeta", "Cancela cuando quieras", "2 min de configuración"
- **Velocidad**: sin imágenes pesadas, fuentes del sistema o una sola fuente web
- **Móvil primero**: diseña mobile, escala desktop

## Plantillas de secciones

### Hero
```html
<section class="min-h-[90vh] flex items-center bg-gradient-to-b from-slate-50 to-white">
  <div class="max-w-6xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
    <div>
      <div class="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm mb-6">
        <span class="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
        [Badge: "Nuevo", "Beta cerrada", "+3.000 usuarios"]
      </div>
      <h1 class="text-5xl lg:text-6xl font-bold tracking-tight mb-6">[Headline con promesa]</h1>
      <p class="text-xl text-slate-600 mb-8">[Subheadline con mecanismo]</p>
      <div class="flex flex-col sm:flex-row gap-4">
        <a href="#cta" class="bg-indigo-600 text-white px-8 py-4 rounded-xl font-semibold hover:bg-indigo-700 transition">[CTA primario]</a>
        <a href="#demo" class="border border-slate-300 px-8 py-4 rounded-xl font-semibold">Ver demo (2 min)</a>
      </div>
      <p class="text-sm text-slate-500 mt-4">[Microcopy: sin tarjeta, garantía, etc.]</p>
    </div>
    <div>[Mockup, video o ilustración del producto]</div>
  </div>
</section>
```

### Prueba social
```html
<section class="py-12 border-y border-slate-200 bg-slate-50">
  <div class="max-w-6xl mx-auto px-6 text-center">
    <p class="text-sm text-slate-500 mb-6">Usado por equipos de</p>
    <div class="flex flex-wrap justify-center gap-10 opacity-60 grayscale">
      [Logos: 5-7 logos conocidos o clientes]
    </div>
  </div>
</section>
```

## Checklist antes de entregar

- [ ] Headline promete una transformación concreta y medible
- [ ] CTA repetido mínimo 3 veces
- [ ] Al menos 1 testimonio con nombre + cargo + foto (o mock)
- [ ] FAQ resuelve las 3 objeciones principales del nicho
- [ ] Meta tags Open Graph completos para compartir en redes
- [ ] Responsive testado mental en 375px, 768px, 1440px
- [ ] Sin lorem ipsum en ningún sitio
- [ ] Link del CTA apunta a algo (form, Calendly, Stripe, Typeform)

## Tras entregar el HTML

Sugiere al usuario:
1. Desplegar en Vercel arrastrando la carpeta (1 comando: `npx vercel`)
2. Conectar dominio propio
3. Instalar Plausible o Google Analytics (snippet ya comentado)
4. Configurar el form/CTA con Formspree, Tally, Typeform o Stripe Payment Link
5. Testear con PageSpeed Insights y corregir si <90
