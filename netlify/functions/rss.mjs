/* Proxy RSS per il widget Notizie: scarica un feed pubblico e lo restituisce come JSON. */

function decode(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
    .replace(/<[^>]+>/g, '')
    .trim();
}

function tag(block, names) {
  for (const name of names) {
    const m = block.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'i'));
    if (m) return decode(m[1]);
  }
  return '';
}

function linkOf(block) {
  const atom = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
  if (atom) return decode(atom[1]);
  return tag(block, ['link']);
}

function parseFeed(xml) {
  const blocks = xml.match(/<(item|entry)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi) || [];
  return blocks.slice(0, 12).map(block => ({
    title: tag(block, ['title']) || 'Senza titolo',
    link: linkOf(block),
    pubDate: tag(block, ['pubDate', 'published', 'updated', 'dc:date'])
  })).filter(item => item.link);
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=900' }
  });
}

export default async (req) => {
  const raw = new URL(req.url).searchParams.get('url');
  if (!raw) return json({ error: 'Parametro url mancante' }, 400);

  let target;
  try { target = new URL(raw); } catch (_) { return json({ error: 'URL non valido' }, 400); }
  if (!['http:', 'https:'].includes(target.protocol)) return json({ error: 'Protocollo non consentito' }, 400);

  const host = target.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') ||
      /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || host === '[::1]') {
    return json({ error: 'Indirizzo non consentito' }, 400);
  }

  try {
    const res = await fetch(target.toString(), {
      headers: { 'user-agent': 'OpenStart RSS Reader/1.0', 'accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
      signal: AbortSignal.timeout(9000)
    });
    if (!res.ok) return json({ error: 'Feed non raggiungibile (' + res.status + ')' }, 502);
    const xml = (await res.text()).slice(0, 1200000);
    return json({ items: parseFeed(xml) });
  } catch (err) {
    return json({ error: 'Impossibile leggere il feed' }, 502);
  }
};
