(function () {
  'use strict';

  const cfg = window.OS_CONFIG;
  const base = cfg.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/';

  async function rpc(name, args) {
    let res;
    try {
      res = await fetch(base + name, {
        method: 'POST',
        headers: {
          'apikey': cfg.SUPABASE_KEY,
          'Authorization': 'Bearer ' + cfg.SUPABASE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(args || {})
      });
    } catch (err) {
      throw new Error('Connessione non disponibile');
    }
    if (!res.ok) {
      let message = 'Errore del servizio (' + res.status + ')';
      try {
        const body = await res.json();
        if (body && (body.message || body.hint || body.details)) message = body.message || body.hint || body.details;
      } catch (_) { /* ignore */ }
      throw new Error(message);
    }
    return res.json();
  }

  window.OS_API = {
    createProfile: (code, name, data) => rpc('os_create_profile', { p_code: code, p_name: name, p_data: data }),
    getProfile: (code) => rpc('os_get_profile', { p_code: code }),
    updateProfile: (code, data, name) => rpc('os_update_profile', { p_code: code, p_data: data, p_name: name || null }),
    deleteProfile: (code) => rpc('os_delete_profile', { p_code: code }),
    createShare: (code, slug, pageId, title, data) => rpc('os_create_share', { p_code: code, p_slug: slug, p_page_id: pageId, p_title: title, p_data: data }),
    getShare: (slug) => rpc('os_get_share', { p_slug: slug }),
    updateShare: (code, slug, pageId, title, data) => rpc('os_update_share', { p_code: code, p_slug: slug, p_page_id: pageId, p_title: title, p_data: data }),
    deleteShare: (code, slug) => rpc('os_delete_share', { p_code: code, p_slug: slug })
  };
})();
