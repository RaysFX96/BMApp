/**
 * Biker Manager - Cloudflare Worker
 * 
 * Endpoints:
 *   POST /sync  → salva dati utente (email + scadenze) in KV
 *   OPTIONS /sync → CORS preflight
 * 
 * Cron (0 11 * * * = ogni giorno alle 12:00 ora italiana):
 *   Controlla tutte le scadenze degli utenti e invia email via Resend
 */

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// ─── HTTP Handler ─────────────────────────────────────────────────────────────
export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: CORS_HEADERS });
        }

        // POST /sync → salva dati utente in KV
        if (request.method === 'POST' && url.pathname === '/sync') {
            try {
                const body = await request.json();
                const { email, bikes } = body;

                if (!email || !bikes) {
                    return new Response(JSON.stringify({ error: 'Missing email or bikes' }), {
                        status: 400,
                        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                    });
                }

                // Salva in KV con chiave "user:<email>", TTL 7 giorni
                await env.USERS_KV.put(
                    `user:${email}`,
                    JSON.stringify({ email, bikes, updatedAt: Date.now() }),
                    { expirationTtl: 60 * 60 * 24 * 7 }
                );

                return new Response(JSON.stringify({ ok: true }), {
                    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                });
            } catch (e) {
                return new Response(JSON.stringify({ error: e.message }), {
                    status: 500,
                    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                });
            }
        }

        // GET /test → trigger manuale per debug
        if (request.method === 'GET' && url.pathname === '/test') {
            const logs = [];
            const log = (msg) => { console.log(msg); logs.push(msg); };

            log('Starting manual test...');
            await checkAndSendNotifications(env, log);

            return new Response(JSON.stringify({ ok: true, diagnostics: logs }), {
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
        }

        return new Response('Not Found', { status: 404 });
    },

    // ─── Cron Handler ────────────────────────────────────────────────────────────
    async scheduled(event, env, ctx) {
        ctx.waitUntil(checkAndSendNotifications(env, console.log));
    },
};

// ─── Logica scadenze ─────────────────────────────────────────────────────────
async function checkAndSendNotifications(env, logger = console.log) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    logger(`Diagnostic: Today is ${today.toISOString()}`);

    // Elenca tutte le chiavi in KV
    const list = await env.USERS_KV.list({ prefix: 'user:' });
    logger(`Diagnostic: Found ${list.keys.length} users in KV`);

    for (const key of list.keys) {
        logger(`Diagnostic: Checking user ${key.name}`);
        const raw = await env.USERS_KV.get(key.name);
        if (!raw) {
            logger(`Diagnostic: No data for ${key.name}`);
            continue;
        }

        const userData = JSON.parse(raw);
        const { email, bikes } = userData;
        logger(`Diagnostic: User ${email} has ${(bikes || []).length} bikes`);

        const expiredItems = [];

        for (const bike of (bikes || [])) {
            const bikeLabel = bike.model || bike.name || 'Moto';
            const maintenance = bike.maintenance || {};

            for (const [field, value] of Object.entries(maintenance)) {
                if (!value || !value.lastDate) continue;

                // Calcolo scadenza: lastDate + intervalMonths
                const lastDate = new Date(value.lastDate);
                if (isNaN(lastDate.getTime())) continue;

                const intervalMonths = parseInt(value.intervalMonths) || 0;
                const dueDate = new Date(lastDate);
                dueDate.setMonth(dueDate.getMonth() + intervalMonths);
                dueDate.setHours(0, 0, 0, 0);

                const diffDays = Math.round((dueDate - today) / (1000 * 60 * 60 * 24));
                const label = FIELD_LABELS[field] || field;

                logger(`  - ${bikeLabel} [${label}]: Last ${value.lastDate}, Interval ${intervalMonths}m -> Due ${dueDate.toISOString()} (diff: ${diffDays} days)`);

                if (diffDays < 0) {
                    expiredItems.push(`❌ <b>${bikeLabel}</b> — ${label}: scaduta ${Math.abs(diffDays)} giorni fa`);
                } else if (diffDays <= 7) {
                    expiredItems.push(`⚠️ <b>${bikeLabel}</b> — ${label}: scade tra ${diffDays} giorni (${formatDate(dueDate)})`);
                }
            }
        }

        if (expiredItems.length === 0) {
            logger(`Diagnostic: No notifications needed for ${email}`);
            continue;
        }

        logger(`Diagnostic: Sending email to ${email} with ${expiredItems.length} items`);
        await sendEmail(env, email, expiredItems);
        logger(`Diagnostic: Email sent request completed for ${email}`);
    }
}

function formatDate(date) {
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const FIELD_LABELS = {
    tagliando: 'Tagliando',
    catena: 'Catena',
    freniAnte: 'Freni Anteriori',
    freniPost: 'Freni Posteriori',
    pneumaticiAnte: 'Pneumatici Anteriori',
    pneumaticiPost: 'Pneumatici Posteriori',
    oilFilter: 'Filtro Olio',
    airFilter: 'Filtro Aria',
    candele: 'Candele',
    liquido: 'Liquido Raffreddamento',
    revisione: 'Revisione',
    assicurazione: 'Assicurazione',
    bollo: 'Bollo',
};

// ─── Invio email via Resend ──────────────────────────────────────────────────
async function sendEmail(env, to, items) {
    const htmlList = items.map(i => `<li style="margin-bottom:8px;">${i}</li>`).join('');

    const body = {
        from: 'BikerManager <onboarding@resend.dev>',
        to: [to],
        subject: '🏍️ Biker Manager — Scadenze da controllare',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; background: #111; color: #fff; border-radius: 12px; padding: 32px;">
        <h2 style="color: #ff3b3b; margin-top: 0;">Biker Manager</h2>
        <p>Ciao! Hai delle scadenze da controllare per le tue moto:</p>
        <ul style="padding-left: 20px; line-height: 1.8;">
          ${htmlList}
        </ul>
        <p style="margin-top: 24px; font-size: 13px; color: #888;">
          Apri l'app per aggiornare i dati: 
          <a href="https://raysfx96.github.io/BMApp/" style="color: #ff3b3b;">Biker Manager</a>
        </p>
      </div>
    `,
    };

    await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
}
