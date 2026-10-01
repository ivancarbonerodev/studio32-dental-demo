// Envía un lead de PRUEBA a /lead para comprobar la entrega (correo con Resend, webhook o logs).
// Uso:  npm run lead:test                       → formulario contra http://localhost:3000
//       npm run lead:test -- chat               → simula un lead del chat (con resumen de preguntas)
//       npm run lead:test -- formulario https://studio32demo.netlify.app
const origen = ['chat', 'formulario', 'reserva'].includes(process.argv[2]) ? process.argv[2] : 'formulario';
const base = (process.argv[3] || (process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://localhost:3000')).replace(/\/$/, '');

const lead = {
  nombre: 'Prueba Studio32',
  telefono: '600 000 000',
  tratamiento: origen === 'chat' ? 'no especificado' : 'Revisión digital gratuita',
  consentimiento: true,
  origen,
  website: '',
  ...(origen === 'chat' ? { resumen: ['¿Cuánto cuesta el plan de ortodoncia invisible?', 'Tengo miedo al dentista', 'Quiero que me llame una persona'] } : { mensaje: 'Lead de prueba enviado con npm run lead:test' }),
};

const res = await fetch(`${base}/lead`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(lead) });
const body = await res.json().catch(() => ({}));
console.log(`POST ${base}/lead (origen: ${origen}) → HTTP ${res.status}`, body);
if (body.demo) console.log('Modo demo: no hay LEAD_WEBHOOK_URL ni RESEND_API_KEY + LEAD_NOTIFY_EMAIL; el lead solo se ha registrado en los logs.');
else if (res.ok) console.log('OK. Si usas Resend, revisa tu bandeja (y spam) y el panel https://resend.com/emails. Si el correo no llega, mira la terminal de `npm run dev`: los fallos se registran como «[lead] correo NO enviado (…)».');
process.exit(res.ok ? 0 : 1);
