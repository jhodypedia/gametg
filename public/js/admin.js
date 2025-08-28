// public/js/admin.js
(async function(){
  // This script runs on admin dashboard page
  const statsUrl = '/_adm/api/stats';
  const monitorUrl = '/_adm/api/monitor';
  const logsUrl = '/_adm/api/logs';

  async function loadStats(){
    try {
      const res = await fetch(statsUrl);
      if (!res.ok) throw new Error('Unauthorized');
      const j = await res.json();
      renderStats(j);
    } catch (e) {
      console.error(e);
      toastr.error('Gagal load stats (pastikan login)');
    }
  }

  function renderStats(data){
    $('#statRevenue').text('Rp ' + (data.revenue||0));
    $('#statExpense').text('Rp ' + (data.expense||0));
    $('#statNet').text('Rp ' + ((data.revenue||0) - (data.expense||0)));
    $('#statShare').text('Rp ' + Math.round(((data.revenue||0) - (data.expense||0))/2));

    // users list
    const tbody = $('#adminUsersTable tbody').empty();
    (data.users || []).forEach(u => {
      const row = `<tr>
        <td>${u.id}</td>
        <td>${u.telegram_id}</td>
        <td>${u.name||''}</td>
        <td>${u.email||''}</td>
        <td>${u.points}</td>
        <td>
          <button class="btn btn-sm btn-danger btn-ban" data-id="${u.id}">Ban</button>
          <button class="btn btn-sm btn-secondary btn-unban" data-id="${u.id}">Unban</button>
        </td>
      </tr>`;
      tbody.append(row);
    });

    // withdraws
    let html = '';
    (data.withdraws || []).forEach(w => {
      html += `<div class="d-flex justify-content-between align-items-start border-bottom py-2">
        <div><strong>${w.name || w.telegram_id}</strong><br><small>${w.amount} pts - ${w.method} - ${w.account}</small></div>
        <div>
          ${w.status === 'pending' ? `<button class="btn btn-sm btn-success me-1" data-id="${w.id}" data-action="approve">Approve</button><button class="btn btn-sm btn-danger" data-id="${w.id}" data-action="reject">Reject</button>` : `<span class="badge bg-secondary">${w.status}</span>`}
        </div>
      </div>`;
    });
    $('#withdrawList').html(html);

    // adViews chart
    const labels = (data.adViews || []).map(r => r.day).reverse();
    const vals = (data.adViews || []).map(r => r.cnt).reverse();
    renderAdChart(labels, vals);
  }

  // chart
  let chart;
  function renderAdChart(labels, dataSet){
    const ctx = document.getElementById('adChart').getContext('2d');
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{ label:'Ad views', data: dataSet, borderColor:'#0d6efd', backgroundColor:'rgba(13,110,253,0.08)', fill:true }]
      },
      options: { responsive:true, maintainAspectRatio:false }
    });
  }

  // events (delegated)
  $(document).on('click', '.btn-ban', async function(){
    const id = $(this).data('id');
    await fetch(`/_adm/api/users/ban/${id}`, { method:'POST' });
    toastr.success('User banned'); loadStats();
  });
  $(document).on('click', '.btn-unban', async function(){
    const id = $(this).data('id');
    await fetch(`/_adm/api/users/unban/${id}`, { method:'POST' });
    toastr.success('User unbanned'); loadStats();
  });
  $(document).on('click', '#withdrawList button', async function(){
    const id = $(this).data('id'), action = $(this).data('action');
    if (action === 'approve') {
      await fetch(`/_adm/api/withdraw/${id}/approve`, { method:'POST' });
      toastr.success('Withdraw approved'); loadStats();
    } else {
      await fetch(`/_adm/api/withdraw/${id}/reject`, { method:'POST' });
      toastr.warning('Withdraw rejected & refunded'); loadStats();
    }
  });

  // settings form
  $('#settingsForm').on('submit', async function(e){
    e.preventDefault();
    const fd = new FormData(this);
    const key = fd.get('key'), value = fd.get('value');
    const res = await fetch('/_adm/api/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ key, value })});
    const j = await res.json();
    if (j.success) { toastr.success('Saved'); loadStats(); } else toastr.error('Save failed');
  });

  // monitor fetch
  $('#btnReloadStats').on('click', async ()=>{
    await loadStats();
    try {
      const r = await fetch(monitorUrl);
      const j = await r.json();
      if (j.ok) $('#monitorPre').text(JSON.stringify(j.data, null, 2));
      else $('#monitorPre').text('monitor error');
    } catch(e) { $('#monitorPre').text('monitor fetch failed'); }
  });

  // initial load
  await loadStats();
})();
