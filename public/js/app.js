/* ===========================
   Papaya Global — app.js (SPA)
   =========================== */

/* ===== Utilities ===== */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const fDate = (d) =>
  new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
const fDateTime = (d) =>
  new Date(d).toLocaleString(undefined, { year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' });
let fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' });

const debounce = (fn, ms=250) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; };
function ensureCanvasHeight(ctx, px = 300) {
  if (!ctx) return false;
  const c = ctx.canvas;
  const h = parseInt(getComputedStyle(c).height || '0', 10);
  if (!h) {
    c.style.height = `${px}px`;
    c.height = px;
  }
  return true;
}
function paintNextFrame(fn) { requestAnimationFrame(() => fn()); }

// global state cache (reduces refetch churn & helps realtime)
const STATE = { members: [], transactions: [] };

function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('pg:theme', t);
  const btn = $('#toggleTheme');
  if (btn) btn.textContent = t === 'dark' ? '☀️' : '🌙';
}
function initTheme() {
  const t = localStorage.getItem('pg:theme') ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  setTheme(t);
  $('#toggleTheme')?.addEventListener('click', () =>
    setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark')
  );
}

/* ===== API helper ===== */
const API_BASE = '/api';
const api = {
  get: (u) =>
    fetch(API_BASE + u, { credentials: 'include', cache: 'no-store' })
      .then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json(); }),
  post: (u, b) =>
    fetch(API_BASE + u, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify(b || {}),
      credentials: 'include', cache: 'no-store'
    }).then(async (r) => { const json = await r.json().catch(()=>({})); if (!r.ok) throw new Error(json?.error || r.statusText); return json; }),
  put: (u, b) =>
    fetch(API_BASE + u, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify(b || {}),
      credentials: 'include', cache: 'no-store'
    }).then(async (r) => { const json = await r.json().catch(()=>({})); if (!r.ok) throw new Error(json?.error || r.statusText); return json; }),
  del: (u) =>
    fetch(API_BASE + u, { method:'DELETE', credentials:'include', cache:'no-store', headers:{Accept:'application/json','Cache-Control':'no-store'} })
      .then(async (r) => { const json = await r.json().catch(()=>({})); if (!r.ok) throw new Error(json?.error || r.statusText); return json; }),
};

let ME = null; // { id, name, role, email }

/* ===== Auth UI ===== */
function showAuth(msg = '') {
  $('#auth').hidden = false;
  $('#app').hidden = true;
  $('#authMsg').textContent = msg || '';
}
function showApp() {
  $('#auth').hidden = true;
  $('#app').hidden = false;
}
function bindAuthTabs() {
  const tabs = { login: $('#formLogin'), signup: $('#formSignup'), bootstrap: $('#formBootstrap') };
  const set = (on) => {
    $('#tabLogin')?.classList.toggle('active', on === 'login');
    $('#tabSignup')?.classList.toggle('active', on === 'signup');
    $('#tabBootstrap')?.classList.toggle('active', on === 'bootstrap');
    tabs.login.hidden = on !== 'login';
    tabs.signup.hidden = on !== 'signup';
    tabs.bootstrap.hidden = on !== 'bootstrap';
  };
  $('#tabLogin')?.addEventListener('click', () => set('login'));
  $('#tabSignup')?.addEventListener('click', () => set('signup'));
  $('#tabBootstrap')?.addEventListener('click', () => set('bootstrap'));
}
function wireAuth() {
  bindAuthTabs();
  $('#formLogin')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const email = $('#loginEmail')?.value.trim();
      const password = $('#loginPass')?.value;
      const res = await api.post('/auth/login', { email, password });
      if (res?.user) { ME = res.user; await hydrateWorkspace(); showApp(); await afterLogin(); }
    } catch (err) { $('#authMsg').textContent = err?.message || 'Login failed'; }
  });
  $('#formSignup')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const name = $('#suName')?.value.trim();
      const email = $('#suEmail')?.value.trim();
      const password = $('#suPass')?.value;
      const code = $('#suCode')?.value.trim();
      const r = await api.post('/auth/signup', { name, email, password, code });
      if (r?.ok) { $('#authMsg').textContent = 'Account created. Please log in.'; $('#tabLogin')?.click(); $('#loginEmail').value = email; $('#loginPass').value = password; }
    } catch (err) { $('#authMsg').textContent = err?.message || 'Signup failed'; }
  });
  $('#formBootstrap')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const name = $('#bootName')?.value.trim();
      const email = $('#bootEmail')?.value.trim();
      const password = $('#bootPass')?.value;
      const currencyCode = $('#bootCurr')?.value;
      const r = await api.post('/auth/bootstrap', { name, email, password, currencyCode });
      if (r?.ok) { ME = r.user; await hydrateWorkspace(); showApp(); await afterLogin(); }
    } catch (err) { $('#authMsg').textContent = err?.message || 'Bootstrap failed'; }
  });
  $('#logout')?.addEventListener('click', async () => { try { await api.post('/auth/logout', {}); } finally { location.reload(); } });
}

/* ===== Workspace hydrate ===== */
async function hydrateWorkspace() {
  try {
    const cfg = await api.get('/config');
    const code = cfg?.currencyCode || 'USD';
    fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: code });

    $('#uName').textContent = ME?.name || 'User';
    $('#uRole').textContent = ME?.role || 'Employee';
    $('#uBadge').textContent = ME?.role === 'Admin' ? 'ADM' : 'EMP';
    $('#avatar').textContent = (ME?.name || 'U').slice(0,1).toUpperCase();

    $('#stName').value = ME?.name || '';
    $('#stRole').value = ME?.role || 'Employee';
    $('#stCurrency').value = code;
    $('#stBonusPct').value = (cfg?.bonusRate ?? 0.04) * 100;
    $('#stPerTask').value = (cfg?.fixedPerTask ?? 1);

    const lock = ME?.role !== 'Admin';
    $('#stRole').disabled = ME?.role !== 'Admin';
    $('#stCurrency').disabled = lock;
    $('#stBonusPct').disabled = lock;
    $('#stPerTask').disabled = lock;

    $$('.admin-only').forEach((el) => (el.style.display = ME?.role === 'Admin' ? '' : 'none'));
  } catch (e) { console.error('hydrateWorkspace failed', e); }
}

/* ===== Navigation ===== */
function showView(id) {
  $$('.view').forEach(v => v.classList.remove('active'));
  $('#view-' + id)?.classList.add('active');

  $$('#navList li').forEach(li => li.classList.toggle('active', li.dataset.view === id));

  const titleMap = {
    dashboard:'Payroll Dashboard', employees:'Employees', members:'Members',
    transactions:'Transactions', reports:'Reports', admin:'Admin Portal', settings:'Settings'
  };
  $('#title').textContent = titleMap[id] || 'Payroll Dashboard';

  if (id === 'transactions') {
    populateTxTypeOptions();
    renderTxExtras();
    fillTxMemberSelect();
  }
  if (id === 'admin') renderCodes();
}
function nav() {
  $$('#navList li').forEach(li => {
    if (!li.dataset.view) return;
    li.addEventListener('click', () => {
      showView(li.dataset.view);
      if (li.dataset.view === 'transactions') fillTxMemberSelect();
    });
  });
}

/* ===== Dashboard helpers ===== */
const calc = {
  totals(members) {
    const t = members.reduce((a, m) => {
      a.recv += m.recv || 0; a.pay += m.pay || 0; a.fro += m.frozen || 0; a.run += m.runaway || 0; a.fee += m.charges || 0; return a;
    }, { recv:0, pay:0, fro:0, run:0, fee:0 });
    const balance = t.recv - t.pay - t.fro - t.run - t.fee;
    const commission = members.reduce((a, m) => a + ((m.recv || 0) * ((m.comm || 0) / 100)), 0);
    return { balance, receivables:t.recv, payouts:t.pay, frozen:t.fro, runaway:t.run, charges:t.fee, commission };
  },
  employeeBalance(members, owner) {
    const mem = members.filter((m) => m.owner === owner);
    return mem.reduce((a, m) => a + ((m.recv || 0) - (m.pay || 0) - (m.frozen || 0) - (m.runaway || 0) - (m.charges || 0)), 0);
  },
};
function buildTimeSeries(transactions, days) {
  const labels = [], rec = Array.from({ length: days }, () => 0), pay = Array.from({ length: days }, () => 0);
  const today = new Date();
  const dayIdx = (iso) => {
    const d = new Date(iso);
    const one = 24 * 3600 * 1000;
    const diffDays = Math.floor((new Date(today.getFullYear(), today.getMonth(), today.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / one);
    const idx = days - 1 - Math.min(Math.max(days - 1 - diffDays, 0), days - 1);
    return idx;
  };
  for (let i = 0; i < days; i++) {
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i));
    labels.push(d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' }));
  }
  (transactions || []).forEach((t) => {
    const idx = dayIdx(t.dateISO || t.createdAt || Date.now());
    if (idx < 0 || idx >= days) return;
    if (t.type === 'USDT Top Up' || t.type === 'Fiat Convert') rec[idx] += t.amount || 0;
    if (t.type === 'Payout') pay[idx] += t.amount || 0;
  });
  const bal = rec.map((_, i) => (rec[i] || 0) - (pay[i] || 0));
  return { labels, rec, pay, bal };
}

let CHART_FIN = null, CHART_EMP = null;
function renderCardsFrom(members) {
  const el = $('#cards'); if (!el) return;
  const { balance, receivables, payouts, frozen, runaway, charges, commission } = calc.totals(members);
  const items = [
    { title: 'Total Balance', value: fmt.format(balance) },
    { title: 'Total Received (Fiat + Top Up)', value: fmt.format(receivables) },
    { title: 'Total Payouts', value: fmt.format(payouts) },
    { title: 'Transaction Charges', value: fmt.format(charges) },
    { title: 'Frozen Funds', value: fmt.format(frozen) },
    { title: 'Runaway Loss', value: fmt.format(runaway) },
    { title: 'Estimated Commission', value: fmt.format(commission) },
  ];
  el.innerHTML = items.map(
    (x) => `<div class="card"><div class="card-title">${x.title}</div><div class="card-value">${x.value}</div></div>`
  ).join('');
}
function renderFinanceChart(days = 30) {
  if (typeof Chart === 'undefined') { $('#chartFinanceMsg').hidden = false; return; }
  $('#chartFinanceMsg').hidden = true;
  const ctx = $('#chartFinance')?.getContext('2d'); if (!ctx) return;
  paintNextFrame(() => {
    if (!ensureCanvasHeight(ctx, 320)) return;
    const filtered = ME?.role === 'Admin' ? STATE.transactions : STATE.transactions.filter((t) => t.owner === ME?.name);
    const { labels, rec, pay, bal } = buildTimeSeries(filtered, days);
    CHART_FIN && CHART_FIN.destroy();
    CHART_FIN = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: [{ label: 'Received', data: rec }, { label: 'Payouts', data: pay }, { label: 'Balance', data: bal }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { ticks: { callback: (v) => fmt.format(v) } } } },
    });
    requestAnimationFrame(() => CHART_FIN && CHART_FIN.resize());
  });
}
function renderEmpBalanceChart(members) {
  if (typeof Chart === 'undefined') { $('#chartEmpMsg').hidden = false; return; }
  $('#chartEmpMsg').hidden = true;
  const ctx = $('#chartEmpBal')?.getContext('2d'); if (!ctx) return;
  paintNextFrame(() => {
    if (!ensureCanvasHeight(ctx, 260)) return;
    const names = [...new Set(members.map((m) => m.owner))];
    const vals  = names.map((n) => calc.employeeBalance(members, n));
    CHART_EMP && CHART_EMP.destroy();
    CHART_EMP = new Chart(ctx, {
      type: 'bar',
      data: { labels: names, datasets: [{ label: 'Balance', data: vals }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: (v) => fmt.format(v) } } } },
    });
    requestAnimationFrame(() => CHART_EMP && CHART_EMP.resize());
  });
}

/* ===== Toast ===== */
function __toastHost() {
  let el = document.getElementById('toastHost');
  if (!el) { el = document.createElement('div'); el.id = 'toastHost'; el.className = 'toast-container'; document.body.appendChild(el); }
  return el;
}
function toast(message, opts = {}) {
  if (typeof opts === 'string') opts = { type: opts };
  const { type = 'success', timeout = 2500 } = opts;
  const host = __toastHost();
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
  el.textContent = message; host.appendChild(el);
  const remove = () => { el.style.animation = 'toast-out .18s ease-in forwards'; el.addEventListener('animationend', () => el.remove(), { once: true }); };
  const t = setTimeout(remove, timeout);
  return { close: () => { clearTimeout(t); remove(); } };
}

/* ===== Employees ===== */
$('#addEmp')?.addEventListener('click', async () => {
  if (ME?.role !== 'Admin') return alert('Admin only');
  const name = prompt('Employee name?'); if (!name) return;
  const email = prompt('Employee email (optional)', '') || '';
  try {
    const row = await api.post('/employees', { name, email });
    if (row?._id) { await renderEmployees(); await renderMemberTabs(); await refreshDashboard(); }
  } catch (e) { alert(e?.message || 'Create failed'); }
});
async function renderEmployees() {
  const tb = $('#empTable'); if (!tb) return;
  if (ME?.role !== 'Admin') { $('#view-employees').innerHTML = '<div class="panel"><p>Admin only</p></div>'; return; }
  const rows = await api.get('/employees');
  const members = await api.get('/members');
  tb.innerHTML =
    rows.map((e) => {
      const mcount = members.filter((x) => x.owner === e.name).length;
      const bal = fmt.format(calc.employeeBalance(members, e.name));
      return `<tr>
        <td>${e.name}</td><td>${e.email || '-'}</td><td>${mcount}</td><td>${bal}</td>
        <td><span class="badge ${e.status === 'Active' ? 'badge-success' : 'badge-warning'}">${e.status}</span></td>
        <td>${ME?.role === 'Admin' ? `<button class="btn btn-danger" data-del-emp="${e._id}">Delete</button>` : ''}</td>
      </tr>`;
    }).join('') || '<tr><td colspan="6">No employees yet</td></tr>';
  tb.querySelectorAll('[data-del-emp]')?.forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-del-emp');
      if (!confirm('Delete employee?')) return;
      try {
        const r = await api.del('/employees/' + id);
        if (r?.ok) { await renderEmployees(); await renderMemberTabs(); await refreshDashboard(); }
      } catch (e) { alert(e?.message || 'Delete failed'); }
    };
  });
}

/* ===== Members ===== */
let editingMemberId = null;
$('#addMember')?.addEventListener('click', () => openMemberModal());
$('#mmClose')?.addEventListener('click', closeMemberModal);
$('#mmCancel')?.addEventListener('click', closeMemberModal);

function openMemberModal(existing) {
  editingMemberId = existing?._id || null;
  $('#mmTitle').textContent = editingMemberId ? 'Edit Member' : 'Add Member';
  fillOwnerSelect(existing?.owner || ME?.name);
  $('#mmName').value   = existing?.name || '';
  $('#mmWorkId').value = existing?.workId || '';
  $('#mmGroup').value  = existing?.group || '';
  $('#mmOpening').value= existing?.opening ?? 0;
  $('#mmComm').value   = existing?.comm ?? 10;
  if (typeof existing?.bonusRateOverride === 'number') $('#mmBonusOv').value = existing.bonusRateOverride * 100;
  else $('#mmBonusOv').value = '';
  $('#mmBonusOv').disabled = ME?.role !== 'Admin';
  $('#mmRecv').value   = existing?.recv ?? 0;
  $('#mmPay').value    = existing?.pay ?? 0;
  $('#mmFrozen').value = existing?.frozen ?? 0;
  $('#mmRun').value    = existing?.runaway ?? 0;
  if (ME?.role !== 'Admin') { $('#mmComm').disabled = true; $('#mmBonusOv').disabled = true; }
  $('#memberModal').hidden = false;
}
function closeMemberModal() { $('#memberModal').hidden = true; }
async function fillOwnerSelect(preselect) {
  const sel = $('#mmOwner'); if (!sel) return;
  if (ME?.role === 'Admin') {
    const employees = await api.get('/employees');
    sel.innerHTML = employees.map(e => `<option value="${e.name}">${e.name}</option>`).join('');
    sel.disabled = false; sel.value = preselect || employees[0]?.name || '';
  } else {
    sel.innerHTML = `<option value="${ME?.name}">${ME?.name}</option>`;
    sel.value = ME?.name || ''; sel.disabled = true;
  }
}
$('#mmSave')?.addEventListener('click', async () => {
  const payload = {
    _id: editingMemberId || undefined,
    owner: $('#mmOwner')?.value,
    name: $('#mmName')?.value.trim(),
    workId: $('#mmWorkId')?.value.trim(),
    group: $('#mmGroup')?.value.trim(),
    opening: parseFloat($('#mmOpening')?.value) || 0,
    comm: parseFloat($('#mmComm')?.value) || 0,
    bonusRateOverride: (() => {
      const v = $('#mmBonusOv')?.value?.trim(); return v === '' ? null : (parseFloat(v) || 0) / 100;
    })(),
    recv: parseFloat($('#mmRecv')?.value) || 0,
    pay: parseFloat($('#mmPay')?.value) || 0,
    frozen: parseFloat($('#mmFrozen')?.value) || 0,
    runaway: parseFloat($('#mmRun')?.value) || 0,
    charges: 0,
  };
  if (ME?.role !== 'Admin') {
    payload.owner = ME?.name;
    if (editingMemberId) {
      const old = (await api.get('/members')).find((x) => x._id === editingMemberId);
      payload.comm = old?.comm ?? payload.comm;
      payload.bonusRateOverride = typeof old?.bonusRateOverride === 'number' ? old.bonusRateOverride : null;
      payload.charges = old?.charges || 0;
    }
  }
  if (!payload.owner || !payload.name) return alert('Owner & Member name are required.');
  try {
    const r = await api.post('/members', payload);
    if (r?._id || r?.ok) { closeMemberModal(); await renderMembers(); await refreshDashboard(); }
  } catch (e) { alert(e?.message || 'Save failed'); }
});

/* delegate actions on the members table */
function wireMembersTableActions(){
  const tb = $('#memberTable'); if (!tb || tb.__wired) return; tb.__wired = true;
  tb.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]'); if (!btn) return;
    const action = btn.dataset.action; const id = btn.dataset.id; if (!action || !id) return;
    const ownerFilter = $('#memberTabs .tab.active')?.dataset.owner || 'All';
    try {
      if (action === 'tx') { openTx(id); return; }
      if (action === 'edit') {
        const list = await api.get('/members'); const m = list.find(x => x._id === id);
        if (!m) return alert('Member not found'); openMemberModal(m); return;
      }
      if (action === 'del') {
        const list = await api.get('/members'); const mm = list.find(x => x._id === id);
        if (!mm) return alert('Member no longer exists');
        if (!confirm(`Delete member "${mm.name}"?`)) return;
        btn.disabled = true; const r = await api.del('/members/' + id);
        if (!r?.ok) throw new Error(r?.error || 'Delete failed');
        await renderMembers(ownerFilter); await refreshDashboard();
      }
    } catch (err) { alert(err.message || 'Action failed'); }
    finally { btn && (btn.disabled = false); }
  });
  tb.addEventListener('change', async (e) => {
    const inp = e.target.closest('input[data-comm]'); if (!inp) return;
    try {
      const id = inp.dataset.comm; const list = await api.get('/members'); const m = list.find(x => x._id === id);
      if (!m) return alert('Member not found'); m.comm = parseFloat(inp.value) || 0;
      await api.post('/members', m); await refreshDashboard();
    } catch (err) { alert(err.message || 'Update failed'); }
  });
}
async function renderMemberTabs() {
  const wrap = $('#memberTabs'); if (!wrap) return;
  let tabs = [];
  if (ME?.role === 'Admin') {
    const employees = await api.get('/employees'); tabs = ['All', ...employees.map((e) => e.name)];
  } else { tabs = [ME?.name || '']; }
  wrap.innerHTML = tabs.map((t, i) => `<div class="tab ${i === 0 ? 'active' : ''}" data-owner="${t}">${t}</div>`).join('');
  $$('#memberTabs .tab').forEach((tab) => {
    tab.onclick = () => { tab.parentNode.querySelectorAll('.tab').forEach((x) => x.classList.remove('active')); tab.classList.add('active'); renderMembers(tab.dataset.owner); };
  });
}
const mBalance = (m) => (m.recv || 0) - (m.pay || 0) - (m.frozen || 0) - (m.runaway || 0) - (m.charges || 0);
async function renderMembers(owner = 'All') {
  const tb = $('#memberTable'); if (!tb) return;
  let list = await api.get('/members');
  if (ME?.role === 'Admin' && owner !== 'All') list = list.filter((m) => m.owner === owner);
  wireMembersTableActions();
  tb.innerHTML =
    list.map((m) => {
      const commCell = ME?.role === 'Admin'
        ? `<input type="number" min="0" max="100" step="0.1" value="${m.comm || 0}" style="width:84px" data-comm="${m._id}">`
        : `<span>${m.comm || 0}%</span>`;
      return `<tr>
        <td>${m.name}</td><td>${m.workId || '-'}</td><td>${m.group || '-'}</td><td>${m.owner}</td>
        <td>${commCell}</td><td>${fmt.format(m.recv || 0)}</td><td>${fmt.format(m.pay || 0)}</td>
        <td>${fmt.format(m.frozen || 0)}</td><td>${fmt.format(m.runaway || 0)}</td><td>${fmt.format(mBalance(m))}</td>
        <td>
          <button class="btn btn-outline" data-action="tx" data-id="${m._id}">Tx</button>
          <button class="btn" data-action="edit" data-id="${m._id}">Edit</button>
          ${ME?.role === 'Admin' ? `<button class="btn btn-danger" data-action="del" data-id="${m._id}">Delete</button>` : ''}
        </td>
      </tr>`;
    }).join('') || '<tr><td colspan="11">No members yet</td></tr>';
}
function openTx(id) { showView('transactions'); fillTxMemberSelect(id); }

/* ===== Transactions ===== */
function populateTxTypeOptions() {
  const sel = $('#txTypeSel'); if (!sel) return;
  const EMP = ['Fiat Convert', 'Payout', 'USDT Top Up']; const ADM = [...EMP, 'Frozen', 'Runaway'];
  sel.innerHTML = (ME?.role === 'Admin' ? ADM : EMP).map((x) => `<option>${x}</option>`).join('');
  if (!sel.value) sel.value = 'Fiat Convert';
  renderTxExtras();
}
async function fillTxMemberSelect(preselectId) {
  const sel = $('#txMemberSel'); if (!sel) return;
  let members = await api.get('/members');
  if (ME?.role !== 'Admin') members = members.filter(m => m.owner === ME?.name);
  sel.innerHTML = members.map(m => `<option value="${m._id}">${m.name} (${m.owner})</option>`).join('');
  const current = sel.value; const has = v => members.some(m => m._id === v);
  if (preselectId && has(preselectId)) sel.value = preselectId;
  else if (current && has(current)) sel.value = current;
  else if (sel.options.length) sel.selectedIndex = 0;
}
function renderTxExtras() {
  const t = $('#txTypeSel')?.value; const host = $('#txExtras'); if (!host) return; let html = '';
  const feeField = `<div class="form-group"><label>Transaction Fee</label><input id="txFee" type="number" min="0" step="0.01" value="0"></div>`;
  if (t === 'USDT Top Up') {
    html = `<div class="form-group"><label>Crypto Address</label><input id="txCrypto" placeholder="TRC20 / ERC20 address"></div>${feeField}`;
  } else if (t === 'Payout') {
    html = `<div class="form-group"><label>Bank Details</label><input id="txBank" placeholder="Bank name / acct / ref"></div>
            <div class="form-group"><label>Bonus % Override (this payout)</label><input id="txBonusPct" type="number" min="0" step="0.01" placeholder="blank = member/global"></div>
            ${feeField}`;
  } else if (t === 'Fiat Convert') { html = `${feeField}<div class="form-group"></div>`; }
  else { html = `<div class="form-group"></div><div class="form-group"></div>`; }
  host.innerHTML = html;
}
$('#txTypeSel')?.addEventListener('change', renderTxExtras);

$('#txAdd')?.addEventListener('click', async () => {
  const btn = $('#txAdd'); btn && (btn.disabled = true);
  const id   = $('#txMemberSel')?.value;
  const type = $('#txTypeSel')?.value;
  const amt  = parseFloat($('#txAmt')?.value) || 0;
  const note = $('#txNote')?.value || '';
  if (!id || (!amt && !['Frozen', 'Runaway'].includes(type))) {
    alert('Select member and enter amount'); btn && (btn.disabled = false); return;
  }
  const fee = parseFloat($('#txFee')?.value) || 0;
  let bonusRate = null, cryptoAddress = null, bankDetails = null;
  if (type === 'Payout') {
    const v = parseFloat($('#txBonusPct')?.value); if (!isNaN(v)) bonusRate = v / 100;
    bankDetails = $('#txBank')?.value?.trim() || null;
  }
  if (type === 'USDT Top Up') cryptoAddress = $('#txCrypto')?.value?.trim() || null;

  const payload = { memberId: id, type, amount: amt, fee, note, bonusRate, cryptoAddress, bankDetails };

  try {
    await api.post('/transactions', payload);
    $('#txAmt') && ($('#txAmt').value = ''); $('#txNote') && ($('#txNote').value = ''); renderTxExtras();
    await Promise.all([ renderTxTable(), refreshDashboard(), renderMembers($('#memberTabs .tab.active')?.dataset.owner || 'All') ]);
    toast('Transaction added successfully');
  } catch (e) { alert(e?.message || 'Add failed'); }
  finally { btn && (btn.disabled = false); }
});
function txDetails(t) {
  const parts = [];
  if (t.type === 'USDT Top Up') { if (t.cryptoAddress) parts.push(`Addr: ${t.cryptoAddress}`); }
  if (t.type === 'Payout') { if (t.bankDetails) parts.push(`Bank: ${t.bankDetails}`); if (typeof t.bonusRate === 'number') parts.push(`Bonus ${(t.bonusRate * 100).toFixed(2)}%`); }
  if (typeof t.fee === 'number' && t.fee > 0) parts.push(`Fee ${fmt.format(t.fee)}`);
  if (t.type === 'Fiat Convert') parts.push('Fiat credited');
  if (t.type === 'Frozen') parts.push('Affects Frozen');
  if (t.type === 'Runaway') parts.push('Affects Runaway');
  return parts.join(' · ');
}

/* ==== Minimal search bar (Transactions view) ==== */
$('#txSearchBtn')?.addEventListener('click', () => renderTxTable());
$('#txSearch')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); renderTxTable(); } });
$('#txClear')?.addEventListener('click', () => { const inp = $('#txSearch'); if (inp) inp.value = ''; renderTxTable(); });

/* Optional quick-search on dashboard recent list (right panel) */
$('#dashTxSearchBtn')?.addEventListener('click', () => renderTxTable(true));
$('#dashTxSearch')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); renderTxTable(true); } });
$('#dashTxClear')?.addEventListener('click', () => { const i=$('#dashTxSearch'); if(i) i.value=''; renderTxTable(true); });

async function renderTxTable(onlyRecent = false) {
  const tb = $('#txTable');
  const recent = $('#txRecent');
  if (!tb && !recent) return;

  let list = await api.get('/transactions');
  STATE.transactions = list;

  if (ME?.role !== 'Admin') list = list.filter((t) => t.owner === ME?.name);

  // view search (transactions page)
  if (!onlyRecent) {
    const q = ($('#txSearch')?.value || '').trim().toLowerCase();
    if (q) {
      list = list.filter((t) => {
        const fields = [t.owner, t.member, t.type, t.note, txDetails(t), fmt.format(t.amount || 0), fDateTime(t.dateISO)];
        return fields.some((v) => String(v || '').toLowerCase().includes(q));
      });
    }
  }

  if (tb && !onlyRecent) {
    tb.innerHTML =
      list.map((t) =>
        `<tr>
          <td>${fDateTime(t.dateISO)}</td>
          <td>${t.owner}</td>
          <td>${t.member}</td>
          <td>${t.type}</td>
          <td>${fmt.format(t.amount || 0)}</td>
          <td>${txDetails(t)}</td>
          <td>${t.note || ''}</td>
          <td>${ME?.role === 'Admin' ? `<button class="btn btn-outline" data-edit="${t._id}">Edit</button>` : ''}</td>
        </tr>`
      ).join('') || '<tr><td colspan="8">No transactions yet</td></tr>';

    // admin-only edit hooks (expects PUT /api/transactions/:id on server)
    if (ME?.role === 'Admin') {
      tb.querySelectorAll('[data-edit]').forEach((btn) => {
        btn.onclick = () => openTxEdit(btn.getAttribute('data-edit'));
      });
    }
  }

  // dashboard “Recent Transactions” (always top 10 of all data; also supports optional quick search)
  if (recent) {
    let r = (STATE.transactions || []);
    if (ME?.role !== 'Admin') r = r.filter((t) => t.owner === ME?.name);
    const q2 = ($('#dashTxSearch')?.value || '').trim().toLowerCase();
    if (q2) {
      r = r.filter((t) => {
        const fields = [t.owner, t.member, t.type, t.note, txDetails(t), fmt.format(t.amount || 0), fDateTime(t.dateISO)];
        return fields.some((v) => String(v || '').toLowerCase().includes(q2));
      });
    }
    recent.innerHTML =
      r.slice(0, 10).map((t) =>
        `<tr>
          <td>${t.owner}</td>
          <td>${t.member}</td>
          <td>${t.type}</td>
          <td>${fmt.format(t.amount || 0)}</td>
          <td>${txDetails(t)}</td>
          <td>${fDateTime(t.dateISO)}</td>
        </tr>`
      ).join('') || '<tr><td colspan="6">No transactions yet</td></tr>';
    $('#goTx') && ($('#goTx').onclick = () => showView('transactions'));
  }
}

/* ===== Reports ===== */
function todayRange() {
  const d = new Date();
  const from = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const to = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}
function toCSV(rows) {
  const head = ['Date', 'Owner', 'Member', 'Type', 'Amount', 'Details', 'Note'];
  const body = rows.map((r) => [new Date(r.dateISO).toISOString(), r.owner, r.member, r.type, r.amount || 0, txDetails(r), r.note || '']);
  return [head.join(','), ...body.map((a) => a.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','))].join('\n');
}
$('#rpDaily')?.addEventListener('click', async () => {
  const { from, to } = todayRange();
  const rows = await api.post('/reports/range', { fromISO: from, toISO: to });
  renderReport(rows);
});
$('#rpRange')?.addEventListener('click', async () => {
  const from = $('#rpFrom')?.value ? new Date($('#rpFrom').value).toISOString() : todayRange().from;
  const to = $('#rpTo')?.value ? new Date($('#rpTo').value).toISOString() : todayRange().to;
  const rows = await api.post('/reports/range', { fromISO: from, toISO: to });
  renderReport(rows);
});
$('#rpCSV')?.addEventListener('click', async () => {
  const from = $('#rpFrom')?.value ? new Date($('#rpFrom').value).toISOString() : todayRange().from;
  const to = $('#rpTo')?.value ? new Date($('#rpTo').value).toISOString() : todayRange().to;
  const rows = await api.post('/reports/range', { fromISO: from, toISO: to });
  if (!rows.length) return alert('No rows');
  const blob = new Blob([toCSV(rows)], { type: 'text/csv' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'papaya-report.csv'; a.click(); URL.revokeObjectURL(url);
});
$('#rpSalaryToday')?.addEventListener('click', async () => {
  const res = await api.get('/reports/salary/today'); renderSalary(res?.rows || []);
});
$('#rpSalaryCSV')?.addEventListener('click', async () => {
  const res = await api.get('/reports/salary/today'); const rows = res?.rows || [];
  if (!rows.length) return alert('No salary rows');
  const t = new Date(); const title = `${t.getMonth()+1}-${t.getDate()}-${t.getFullYear()}`;
  const head = ['Date','Receptionist','Work Group Name','Member','USDT Top Up','Fiat Convert','Pay Out','Percentage Bonus','Fixed Bonus','Transaction Charges','Total Gross Reward','Remaining Balance'];
  const body = rows.map((r) => [new Date(r.date).toLocaleDateString(), r.receptionist, r.group || '', r.member, r.topUp, r.fiat, r.payout, r.percBonus, r.fixedBonus, r.txCharge, r.gross, r.remaining]);
  const csv = [head.join(','), ...body.map((a) => a.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `USA-SALARY-SHEET-${title}.csv`; a.click(); URL.revokeObjectURL(url);
});
function renderReport(rows) {
  const body = $('#reportBody'); if (!body) return;
  body.innerHTML =
    rows.map((r) =>
      `<tr><td>${fDate(r.dateISO)}</td><td>${r.owner}</td><td>${r.member}</td><td>${r.type}</td><td>${fmt.format(r.amount || 0)}</td><td>${txDetails(r)}</td><td>${r.note || ''}</td></tr>`
    ).join('') || '<tr><td colspan="7">No rows</td></tr>';
}
function renderSalary(rows) {
  const body = $('#salaryBody'); if (!body) return;
  body.innerHTML =
    rows.map((r) =>
      `<tr><td>${fDate(r.date)}</td><td>${r.receptionist}</td><td>${r.group || ''}</td><td>${r.member}</td><td>${fmt.format(r.topUp)}</td><td>${fmt.format(r.fiat)}</td><td>${fmt.format(r.payout)}</td><td>${fmt.format(r.percBonus)}</td><td>${fmt.format(r.fixedBonus)}</td><td>${fmt.format(r.txCharge)}</td><td>${fmt.format(r.gross)}</td><td>${fmt.format(r.remaining)}</td></tr>`
    ).join('') || '<tr><td colspan="12">No data</td></tr>';
}

/* ===== Settings ===== */
$('#saveSettings')?.addEventListener('click', async () => {
  try {
    const name = $('#stName')?.value?.trim();
    if (name && name !== ME?.name) $('#uName').textContent = name;
    if (ME?.role === 'Admin') {
      const currencyCode = $('#stCurrency')?.value;
      const bonusRate = (parseFloat($('#stBonusPct')?.value) || 4) / 100;
      const fixedPerTask = parseFloat($('#stPerTask')?.value) || 1;
      await api.post('/config', { currencyCode, bonusRate, fixedPerTask });
      await hydrateWorkspace(); await refreshDashboard();
    }
    alert('Settings saved');
  } catch (e) { alert(e?.message || 'Save failed'); }
});

/* ===== Realtime (SSE) ===== */
let ES_HANDLE = null;
function connectRealtime() {
  try {
    if (ES_HANDLE) { ES_HANDLE.close(); ES_HANDLE = null; }
    const es = new EventSource('/api/stream', { withCredentials: true });
    ES_HANDLE = es;
    const updateAll = async () => { await Promise.all([renderTxTable(), refreshDashboard()]); };
    const updateMembers = async () => { await Promise.all([renderMembers($('#memberTabs .tab.active')?.dataset.owner || 'All'), refreshDashboard()]); };
    const updateEmployees = async () => { if (ME?.role === 'Admin') { await Promise.all([renderEmployees(), refreshDashboard()]); } else { await refreshDashboard(); } };

    es.addEventListener('hello', () => console.log('[SSE] connected'));
    ['transactions:created', 'transactions:updated', 'transactions:deleted'].forEach((evt) => es.addEventListener(evt, updateAll));
    ['members:created', 'members:updated', 'members:deleted'].forEach((evt) => es.addEventListener(evt, updateMembers));
    ['employees:created', 'employees:deleted', 'employees:updated'].forEach((evt) => es.addEventListener(evt, updateEmployees));
    es.onerror = (e) => console.warn('[SSE] error', e);
  } catch (e) { console.warn('Realtime disabled:', e?.message || e); }
}

/* ===== Init after login ===== */
async function refreshDashboard() {
  const [members, txs] = await Promise.all([api.get('/members'), api.get('/transactions')]);
  STATE.members = members; STATE.transactions = txs;

  const visibleMembers = ME?.role === 'Admin' ? members : members.filter(m => m.owner === (ME?.name || ''));
  renderCardsFrom(visibleMembers);

  const d = parseInt($('#range')?.value, 10) || 30;
  paintNextFrame(() => {
    renderFinanceChart(d);
    renderEmpBalanceChart(visibleMembers);
  });

  // refresh dashboard recent list
  renderTxTable(true);
}
async function afterLogin() {
  if (ME?.role === 'Admin') await renderEmployees();
  await renderMemberTabs();
  await renderMembers('All');
  await renderTxTable();
  await refreshDashboard();
  if (ME?.role === 'Admin') await renderCodes();
  connectRealtime();
}

/* ===== Admin: Codes ===== */
async function renderCodes() {
  const tb = document.querySelector('#codeTable'); if (!tb) return;
  try {
    const rows = await api.get('/codes');
    tb.innerHTML = rows.map(r => `
      <tr>
        <td>${r.code}</td>
        <td>${r.issuedTo || '-'}</td>
        <td><span class="badge ${r.used ? 'badge-warning' : 'badge-success'}">${r.used ? 'Used' : 'Unused'}</span></td>
        <td>${fDate(r.createdAt || r.created || Date.now())}</td>
      </tr>
    `).join('') || '<tr><td colspan="4">No codes yet</td></tr>';
  } catch (e) { toast(e?.message || 'Failed to load codes', { type: 'error' }); }
}
document.querySelector('#genCode')?.addEventListener('click', async () => {
  try {
    const r = await api.post('/codes/generate', { count: 5 });
    if (r?.ok) { toast(`Generated ${r.codes?.length || 5} code(s)`); await renderCodes(); }
  } catch (e) { toast(e?.message || 'Failed to generate codes', { type: 'error' }); }
});

/* ===== App startup ===== */
(async function start() {
  initTheme(); wireAuth(); nav(); wireMembersTableActions();
  try {
    const me = await api.get('/users/me');
    if (me?.user) { ME = me.user; await hydrateWorkspace(); showApp(); await afterLogin(); }
    else { showAuth(); }
  } catch { showAuth(); }
})();

/* ===== Admin edit modal (optional; requires PUT /api/transactions/:id on server) ===== */
let EDIT_TX_ID = null;
function openTxEdit(id) {
  const t = (STATE.transactions || []).find(x => x._id === id); if (!t) return alert('Not found');
  EDIT_TX_ID = id;
  $('#txeType').value = t.type;
  $('#txeAmt').value = t.amount || 0;
  $('#txeFee').value = t.fee || 0;
  $('#txeBonus').value = typeof t.bonusRate === 'number' ? (t.bonusRate * 100) : '';
  $('#txeBank').value = t.bankDetails || '';
  $('#txeCrypto').value = t.cryptoAddress || '';
  $('#txeNote').value = t.note || '';
  $('#txEditModal').hidden = false;
}
$('#txeClose')?.addEventListener('click', () => $('#txEditModal').hidden = true);
$('#txeCancel')?.addEventListener('click', () => $('#txEditModal').hidden = true);
$('#txeSave')?.addEventListener('click', async () => {
  if (!EDIT_TX_ID) return;
  try {
    const payload = {
      type: $('#txeType').value,
      amount: parseFloat($('#txeAmt').value) || 0,
      fee: parseFloat($('#txeFee').value) || 0,
      bonusRate: $('#txeBonus').value === '' ? null : (parseFloat($('#txeBonus').value) || 0) / 100,
      bankDetails: $('#txeBank').value.trim() || null,
      cryptoAddress: $('#txeCrypto').value.trim() || null,
      note: $('#txeNote').value || ''
    };
    await api.put(`/transactions/${EDIT_TX_ID}`, payload);
    $('#txEditModal').hidden = true;
    await renderTxTable();
    await refreshDashboard();
    toast('Transaction updated');
  } catch (e) {
    alert(e?.message || 'Update failed (ensure server supports PUT /api/transactions/:id)');
  } finally { EDIT_TX_ID = null; }
});
