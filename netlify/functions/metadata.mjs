/* Suggerisce il titolo di un collegamento leggendo <title> o og:site_name della pagina. */

function decode(value) {
  return String(value || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
    .replace(/<[^>]+>/g, '')
    .trim();
}

function clean(value) {
  return decode(value).replace(/\s+/g, ' ').trim().slice(0, 120);
}

function validate(raw) {
  let target;
  try { target = new URL(raw); } catch (_) { throw new Error('URL non valido'); }
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('Protocollo non consentito');
  const host = target.hostname.toLowerCase();
  if (host === 'localhost' || host === '0.0.0.0' || host === '[::1]' || host === '::1' ||
      host.endsWith('.local') || host.endsWith('.internal') ||
      /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
    throw new Error('Indirizzo non consentito');
  }
  return target;
}

async function fetchSafe(target, redirects) {
  const res = await fetch(target.toString(), {
    redirect: 'manual',
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; OpenStart Link Title/1.0)',
      'accept': 'text/html,application/xhtml+xml'
    },
    signal: AbortSignal.timeout(8000)
  });
  if ([301, 302, 303, 307, 308].includes(res.status)) {
    if (redirects >= 3) throw new Error('Troppi redirect');
    const location = res.headers.get('location');
    if (!location) throw new Error('Redirect senza destinazione');
    return fetchSafe(validate(new URL(location, target).toString()), redirects + 1);
  }
  return res;
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=86400' }
  });
}

export default async (req) => {
  const raw = new URL(req.url).searchParams.get('url');
  if (!raw) return json({ error: 'Parametro url mancante' }, 400);

  let target;
  try { target = validate(raw); } catch (err) { return json({ error: err.message }, 400); }

  try {
    const res = await fetchSafe(target, 0);
    if (!res.ok) return json({ error: 'Pagina non raggiungibile (' + res.status + ')' }, 502);
    const html = (await res.text()).slice(0, 400000);

    const titleTag = html.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i);
    let title = titleTag ? clean(titleTag[1]) : '';
    if (!title) {
      const og = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i) ||
                 html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);
      title = og ? clean(og[1]) : '';
    }

    return json({ title: title, host: target.hostname.replace(/^www\./, '') });
  } catch (err) {
    return json({ error: 'Impossibile leggere il titolo della pagina' }, 502);
  }
};
