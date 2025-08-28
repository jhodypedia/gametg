// public/js/user.js
// Handles: tg.initDataUnsafe, request-ad => show ad => checkin/start game/claim repeat
(async function(){
  // Telegram WebApp object (if inside Telegram)
  const tg = window.Telegram?.WebApp;
  const statusEl = document.getElementById('status');
  const greetEl = document.getElementById('greeting');
  const pointsEl = document.getElementById('points');
  const emailArea = document.getElementById('email-area');
  const actions = document.getElementById('actions');

  // load ads script into page
  if (window.serverAdsScript && window.serverAdsScript.trim().length) {
    const container = document.getElementById('ads-slot');
    container.innerHTML = window.serverAdsScript;
  }

  // obtain tg user
  let tgUser = tg?.initDataUnsafe?.user || null;
  if (!tgUser) {
    // allow limited usage if not Telegram WebApp, but warn
    greetEl.innerText = "Akses lewat Telegram WebApp direkomendasikan.";
  }

  async function upsertUser() {
    if (!tgUser) return null;
    const res = await fetch('/api/user-info', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ telegram_id: tgUser.id, username: tgUser.username, name: tgUser.first_name })
    });
    const j = await res.json();
    return j.user;
  }

  // keep last ad_token client-side for action attempts
  let lastAdToken = null;

  // request ad token from server (creates ad_session)
  async function requestAdToken() {
    if (!tgUser) return toastr.error("Buka lewat Telegram WebApp untuk dapat token.");
    const res = await fetch('/api/request-ad', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ telegram_id: tgUser.id })
    });
    const j = await res.json();
    if (j.token) {
      lastAdToken = j.token;
      toastr.info("Ad token diterbitkan. Memanggil Adsterra...");
      return j.token;
    }
    throw new Error('gagal request token');
  }

  // call Adsterra rewarded show function (integration depends on provider)
  // We expect Adsterra script to accept ad_token as custom param and will call server postback.
  function showAd(adToken) {
    // Example: if Adsterra exposes a global function to trigger rewarded video and accepts customData
    // Replace with real Adsterra invocation per their docs.
    if (typeof window.AdsterraRewardedShow === 'function') {
      try {
        window.AdsterraRewardedShow({ custom: adToken });
        return true;
      } catch (e) {
        console.warn("Adsterra show error:", e);
      }
    }

    // fallback simulation (development only)
    toastr.warning("Adsterra not available — simulating ad (10s).");
    setTimeout(() => {
      // simulate server postback by calling a debug endpoint (in production Adsterra will call /api/adsterra-postback)
      fetch('/api/adsterra-postback', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ad_token: adToken, secret: 'REPLACE_WITH_ADSTER_SECRET' })
      }).then(()=> {
        toastr.success("Simulated ad postback complete (dev).");
      }).catch(()=>{});
    }, 10000);
    return false;
  }

  // consume ad_token for actions by calling backend endpoints that require ad_token
  async function performActionWithAd(endpoint, adToken) {
    if (!tgUser) return toastr.error("Telegram WebApp required");
    const res = await fetch(endpoint, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ telegram_id: tgUser.id, ad_token: adToken })
    });
    const j = await res.json();
    if (j.success) {
      toastr.success(j.message || 'Action success');
      await loadUser(); // refresh
    } else {
      toastr.error(j.message || 'Action failed');
    }
    // clear lastAdToken to force new ad next action
    lastAdToken = null;
  }

  // handlers
  document.getElementById('btnRequestAd').addEventListener('click', async ()=>{
    try {
      const token = await requestAdToken();
      showAd(token);
    } catch (e) { toastr.error('Gagal request ad token'); }
  });

  document.getElementById('btnCheckin').addEventListener('click', async ()=> {
    if (!lastAdToken) {
      toastr.info("Silakan klik 'Mulai Iklan' dulu untuk memutar Ad.");
      return;
    }
    await performActionWithAd('/api/checkin-with-ad', lastAdToken);
  });

  document.getElementById('btnWatchAd').addEventListener('click', async ()=> {
    // watch ad itself (Adsterra postback will credit points server-side)
    if (!lastAdToken) {
      toastr.info("Klik 'Mulai Iklan' untuk memutar iklan.");
      return;
    }
    toastr.info("Iklan sedang diputar... tunggu postback server.");
    // After ad postback server credits automatically; we still try to refresh after small wait
    setTimeout(async ()=> { await loadUser(); lastAdToken = null; }, 3000);
  });

  document.getElementById('btnGames').addEventListener('click', async ()=>{
    // redirect to games list
    window.location.href = '/games';
  });

  document.getElementById('btnWithdraw').addEventListener('click', async ()=>{
    if (!tgUser) return toastr.error("Akses lewat Telegram diperlukan");
    const amount = parseInt(prompt("Masukkan jumlah poin untuk withdraw:"));
    if (!amount || amount <= 0) return;
    const method = prompt("Metode (bank/gopay/dana/ovo/paypal):");
    const account = prompt("Nomor rekening / No HP / Email tujuan:");
    const res = await fetch('/api/withdraw', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ telegram_id: tgUser.id, amount, method, account })
    });
    const j = await res.json();
    if (j.success) { toastr.success(j.message); await loadUser(); } else toastr.error(j.message || 'Gagal');
  });

  document.getElementById('saveEmail').addEventListener('click', async ()=>{
    if (!tgUser) return toastr.error("Akses lewat Telegram diperlukan");
    const email = document.getElementById('email').value;
    if (!email) return toastr.error("Isi email");
    const res = await fetch('/api/save-email', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ telegram_id: tgUser.id, email })
    });
    const j = await res.json();
    if (j.success) toastr.success('Email tersimpan'); else toastr.error('Gagal simpan email');
    await loadUser();
  });

  // load user info and UI states
  async function loadUser() {
    if (!tgUser) {
      greetEl.innerText = "Akses tidak melalui Telegram WebApp";
      pointsEl.innerText = "-";
      actions.style.display = "none";
      emailArea.style.display = "none";
      return;
    }
    const res = await fetch('/api/user-info', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ telegram_id: tgUser.id, username: tgUser.username, name: tgUser.first_name })
    });
    const j = await res.json();
    const user = j.user;
    greetEl.innerText = user.name ? `Halo, ${user.name}` : `Halo, ${user.username || 'Player'}`;
    pointsEl.innerText = user.points || 0;
    if (!user.email) { emailArea.style.display = 'block'; actions.style.display = 'none'; }
    else { emailArea.style.display = 'none'; actions.style.display = 'block'; }
  }

  // init
  await (async ()=> {
    // read tg.initDataUnsafe user right away (if present)
    if (tg?.initDataUnsafe?.user) tgUser = tg.initDataUnsafe.user;
    await loadUser();
  })();

})();
