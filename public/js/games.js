// public/js/games.js
$(function(){
  // start-game button requires ad flow: request token, show ad, then call /games/api/start-with-ad/:slug
  $('.start-game').on('click', async function(){
    const slug = $(this).data('slug');
    // fetch ad token (must be done from WebApp context)
    const tg = window.Telegram?.WebApp;
    if (!tg?.initDataUnsafe?.user) {
      return toastr.error("Buka dari Telegram WebApp");
    }
    const tgUser = tg.initDataUnsafe.user;
    const resp = await fetch('/api/request-ad', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ telegram_id: tgUser.id })});
    const j = await resp.json();
    if (!j.token) return toastr.error("Gagal request ad token");
    const adToken = j.token;
    // show ad (provider)
    if (typeof window.AdsterraRewardedShow === 'function') {
      window.AdsterraRewardedShow({ custom: adToken });
    } else {
      toastr.warning("Adsterra not available, simulating...");
      setTimeout(async ()=> {
        // simulate postback to server (dev)
        await fetch('/api/adsterra-postback', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ad_token: adToken, secret: 'REPLACE_WITH_ADSTER_SECRET' })});
        // now call start-with-ad
        const res2 = await fetch(`/games/api/start-with-ad/${slug}`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ telegram_id: tgUser.id, ad_token: adToken })});
        const r2 = await res2.json();
        if (r2.success) {
          toastr.success("Game dimulai! Good luck.");
          // redirect to a game page or open modal; for demo show secret
          alert('Game secret (demo): ' + JSON.stringify(r2.game));
        } else toastr.error(r2.message || 'Gagal mulai game');
      }, 10000);
    }
  });
});
