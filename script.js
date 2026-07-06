    /* ===== スタンドアロン・デモ版（Google接続なし・localStorage保存） ===== */

    /* ===== ステータス定義（4種類） ===== */
    const STATUSES = [
      { id: 'pending', label: '未着手', color: 'var(--c-pending)' },
      { id: 'active', label: '対応中', color: 'var(--c-active)' },
      { id: 'issued', label: '請求済み', color: 'var(--c-issued)' },
      { id: 'paid', label: '入金済み', color: 'var(--c-paid)' },
    ];

    const KEY = 'invoice-app-v2-jobs';
    const CLIENTS_KEY = 'invoice-app-v2-clients';
    const SETTINGS_KEY = 'invoice-app-v2-settings';
    const DEMO_SEED_KEY = 'invoice-app-v2-demo-seed';
    const DEMO_VERSION = '2026-06-30-v5';

    let jobs = [];
    let clients = [];
    let settings = {};
    let editingId = null;

    /* ===== localStorage 保存・読み込み ===== */
    function saveAll() {
      try {
        localStorage.setItem(KEY, JSON.stringify(jobs));
        localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch { }
    }

    function loadAll() {
      try { jobs = JSON.parse(localStorage.getItem(KEY)) || []; } catch { jobs = []; }
      jobs = jobs.map(normalizeJob);
      let raw = null;
      try { raw = JSON.parse(localStorage.getItem(CLIENTS_KEY)); } catch { }
      if (Array.isArray(raw)) {
        clients = raw.map(c => typeof c === 'string' ? { name: c } : { name: c.name || '' }).filter(c => c.name);
      } else {
        clients = [...new Set(jobs.map(j => j.client).filter(Boolean))].map(n => ({ name: n }));
      }
      try { settings = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { settings = {}; }
      settings = migrateSettings(settings);
    }

    /* ===== CLIENTS ===== */
    function loadClients() { }
    function saveClients() { saveAll(); }
    function clientNames() { return clients.map(c => c.name); }

    /* ===== JOBS ===== */
    function normalizeJob(j) { return j || {}; }
    function load() { }
    function save() { saveAll(); }

    function today() {
      const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
      return jst.toISOString().slice(0, 10);
    }

    function fmtYen(n) { return n ? '¥' + Number(n).toLocaleString() : ''; }
    function fmtDate(d) {
      if (!d) return '';
      const [, m, day] = d.split('-');
      return `${Number(m)}/${Number(day)}`;
    }
    function dueClass(d, status) {
      if (!d) return '';
      const ym = today().slice(0, 7);
      if (!d.startsWith(ym)) return ''; // 今月以外は色付けしない
      const t = new Date(); t.setHours(0, 0, 0, 0);
      const due = new Date(d + 'T00:00:00');
      const diff = (due - t) / 86400000;
      if (diff < 0) return 'overdue';
      if (diff <= 3) return 'soon';
      return 'this-month';
    }
    function esc(s) {
      return String(s || '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    /* ===== STATUS CHIPS & MONTHLY TOTAL ===== */
    function renderStatusChips() {
      const chips = document.getElementById('statusChips');
      const allCount = jobs.length;
      const allChip = `<span class="status-chip" data-status="all">すべて <span class="chip-count">${allCount}</span></span>`;
      const statusChips = STATUSES.map(st => {
        const count = jobs.filter(j => j.status === st.id).length;
        return `<span class="status-chip" data-status="${st.id}">${st.label} <span class="chip-count">${count}</span></span>`;
      }).join('');
      chips.innerHTML = allChip + statusChips;
    }
    function renderMonthlyTotal() {
      const ym = today().slice(0, 7);
      const total = jobs
        .filter(j => (j.status === 'active' || j.status === 'issued') && j.due && j.due.startsWith(ym))
        .reduce((sum, j) => sum + (Number(j.price) || 0), 0);
      document.getElementById('monthlyTotal').innerHTML =
        `今月予定 <span class="mt-amount">¥${total.toLocaleString()}</span>`;
    }

    /* ===== RENDER BOARD ===== */
    function render() {
      const board = document.getElementById('board');
      board.innerHTML = '';
      renderStatusChips();

      for (const st of STATUSES) {
        const items = jobs
          .filter(j => j.status === st.id)
          .sort((a, b) => (a.due || '9999') < (b.due || '9999') ? -1 : 1);

        const col = document.createElement('div');
        col.className = 'column';
        col.dataset.status = st.id;

        // カラムヘッドのドット色
        const cssColor = {
          pending: '#FED7E2', active: '#38A169', issued: '#1E3A8A', paid: '#F6AD55'
        }[st.id];

        col.innerHTML = `
      <div class="col-head">
        <span class="col-dot" style="background:${cssColor}"></span>
        ${st.label}
        <span class="count">${items.length}</span>
      </div>
      <div class="cards"></div>`;

        const cards = col.querySelector('.cards');
        if (!items.length) cards.innerHTML = '<div class="empty-hint">案件なし</div>';

        for (const j of items) {
          const el = document.createElement('div');
          el.className = 'card-item';
          el.draggable = true;
          el.dataset.id = j.id;
          el.dataset.status = j.status;
          const dc = dueClass(j.due, j.status);
          el.innerHTML = `
        <div class="card-client">${esc(j.client)}</div>
        <div class="card-title">${esc(j.title)}</div>
        <div class="card-meta">
          <span class="due ${dc}">${j.due ? (dc === 'overdue' ? '<i data-lucide="alert-circle" style="width:12px;height:12px;vertical-align:-1px;margin-right:2px"></i>' : '') + fmtDate(j.due) : ''}</span>
          <span class="price">${fmtYen(j.price)}</span>
        </div>`;
          el.addEventListener('click', () => openModal(j.id));
          el.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', j.id); el.classList.add('dragging'); });
          el.addEventListener('dragend', () => el.classList.remove('dragging'));
          cards.appendChild(el);
        }

        col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('dragover'); });
        col.addEventListener('dragleave', () => col.classList.remove('dragover'));
        col.addEventListener('drop', e => {
          e.preventDefault(); col.classList.remove('dragover');
          const id = e.dataTransfer.getData('text/plain');
          const job = jobs.find(j => j.id === id);
          if (job && job.status !== st.id) { job.status = st.id; save(); render(); }
        });

        board.appendChild(col);
      }

      // 今月予定
      renderMonthlyTotal();
      // Lucideアイコン初期化
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /* ===== カスタム日付ピッカー（汎用） ===== */
    function initDatePicker({ wrapId, hiddenId, type = 'date', placeholder = '日付を選択' }) {
      let dpYear, dpMonth, dpSelectedValue = '';

      const wrap = document.getElementById(wrapId);
      if (!wrap) return null;
      const inputRow = wrap.querySelector('.date-input-row');
      const display = wrap.querySelector('.date-display');
      const clearBtn = wrap.querySelector('.date-clear-btn');
      const popup = wrap.querySelector('.dp-popup');
      const prevBtn = wrap.querySelector('.dp-prev');
      const nextBtn = wrap.querySelector('.dp-next');
      const monthLbl = wrap.querySelector('.dp-month-label');
      const grid = wrap.querySelector('.dp-grid');
      const hidden = document.getElementById(hiddenId);

      function todayYMD() {
        const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
        return jst.toISOString().slice(0, 10);
      }

      function fmtDisplay(ymd) {
        if (!ymd) return '';
        const [y, m, d] = ymd.split('-');
        return `${y}年${Number(m)}月${Number(d)}日`;
      }

      function fmtDisplayMonth(ym) {
        if (!ym) return '';
        const [y, m] = ym.split('-');
        return `${y}年${Number(m)}月`;
      }

      function setSelected(val) {
        dpSelectedValue = val || '';
        const oldVal = hidden.value;
        hidden.value = dpSelectedValue;
        if (dpSelectedValue) {
          display.textContent = type === 'month' ? fmtDisplayMonth(dpSelectedValue) : fmtDisplay(dpSelectedValue);
          display.classList.remove('empty');
          clearBtn.style.display = '';
        } else {
          display.textContent = placeholder;
          display.classList.add('empty');
          clearBtn.style.display = 'none';
        }
        if (oldVal !== hidden.value) {
          hidden.dispatchEvent(new Event('change'));
        }
      }

      function renderGrid() {
        if (type === 'month') {
          monthLbl.textContent = `${dpYear}年`;
          let html = '';
          for (let m = 0; m < 12; m++) {
            const ym = `${dpYear}-${String(m + 1).padStart(2, '0')}`;
            let cls = 'dp-cell dp-month-cell';
            const curYm = todayYMD().slice(0, 7);
            if (ym === curYm) cls += ' dp-today';
            if (ym === dpSelectedValue) cls += ' dp-selected';
            html += `<div class="${cls}" data-ym="${ym}">${m + 1}月</div>`;
          }
          grid.innerHTML = html;
          grid.querySelectorAll('.dp-cell[data-ym]').forEach(el => {
            el.addEventListener('click', () => { setSelected(el.dataset.ym); closePopup(); });
          });
        } else {
          const td = todayYMD();
          monthLbl.textContent = `${dpYear}年${dpMonth + 1}月`;
          const firstDay = new Date(dpYear, dpMonth, 1).getDay();
          const daysInMonth = new Date(dpYear, dpMonth + 1, 0).getDate();
          let html = '';
          for (let i = 0; i < firstDay; i++) html += '<div class="dp-cell dp-empty"></div>';
          for (let d = 1; d <= daysInMonth; d++) {
            const ymd = `${dpYear}-${String(dpMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            let cls = 'dp-cell';
            if (ymd === td) cls += ' dp-today';
            if (ymd === dpSelectedValue) cls += ' dp-selected';
            html += `<div class="${cls}" data-ymd="${ymd}">${d}</div>`;
          }
          grid.innerHTML = html;
          grid.querySelectorAll('.dp-cell[data-ymd]').forEach(el => {
            el.addEventListener('click', () => { setSelected(el.dataset.ymd); closePopup(); });
          });
        }
      }

      function openPopup() {
        const base = dpSelectedValue || todayYMD();
        const parts = base.split('-').map(Number);
        dpYear = parts[0];
        dpMonth = type === 'month' ? 0 : parts[1] - 1;
        renderGrid();
        popup.style.display = '';
        inputRow.classList.add('open');
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }

      function closePopup() {
        popup.style.display = 'none';
        inputRow.classList.remove('open');
      }

      inputRow.addEventListener('click', e => {
        if (e.target === clearBtn) return;
        popup.style.display === 'none' ? openPopup() : closePopup();
      });

      clearBtn.addEventListener('click', e => { e.stopPropagation(); setSelected(''); });

      prevBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (type === 'month') {
          dpYear--;
        } else {
          dpMonth--;
          if (dpMonth < 0) { dpMonth = 11; dpYear--; }
        }
        renderGrid();
      });
      nextBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (type === 'month') {
          dpYear++;
        } else {
          dpMonth++;
          if (dpMonth > 11) { dpMonth = 0; dpYear++; }
        }
        renderGrid();
      });

      document.addEventListener('click', e => {
        if (!wrap.contains(e.target)) closePopup();
      });

      setSelected('');

      return {
        setValue: setSelected,
        getValue: () => hidden.value,
        close: closePopup
      };
    }

    // カレンダーの初期化
    const dueDatePicker = initDatePicker({ wrapId: 'duePicker', hiddenId: 'fDue', type: 'date' });
    const invoiceMonthPicker = initDatePicker({ wrapId: 'invoiceMonthPicker', hiddenId: 'iMonth', type: 'month', placeholder: '月を選択' });
    const invoiceIssuePicker = initDatePicker({ wrapId: 'invoiceIssuePicker', hiddenId: 'iIssue', type: 'date' });
    const invoiceDuePicker = initDatePicker({ wrapId: 'invoiceDuePicker', hiddenId: 'iDue', type: 'date' });

    /* ===== 案件モーダル ===== */
    const overlay = document.getElementById('overlay');
    const fStatusSel = document.getElementById('fStatus');
    fStatusSel.innerHTML = STATUSES.map(s => `<option value="${s.id}">${s.label}</option>`).join('');

    function openModal(id) {
      editingId = id || null;
      document.getElementById('modalTitle').textContent = id ? 'プロジェクト管理' : 'プロジェクトの新規追加';
      document.getElementById('deleteBtn').style.display = id ? '' : 'none';
      const j = id ? jobs.find(x => x.id === id) : {};
      populateClientSelect(j ? j.client || '' : '');
      document.getElementById('fTitle').value = j ? j.title || '' : '';
      dueDatePicker.setValue(j ? j.due || '' : '');
      fStatusSel.value = j ? j.status || 'pending' : 'pending';
      document.getElementById('fPrice').value = j && j.price != null ? j.price : '';
      document.getElementById('fMemo').value = j ? j.memo || '' : '';
      document.getElementById('fContact').value = j ? j.contact || '' : '';
      overlay.classList.add('open');
      document.getElementById('fClient').focus();
    }
    function closeModal() { overlay.classList.remove('open'); }

    document.getElementById('addBtn').onclick = () => openModal(null);
    document.getElementById('cancelBtn').onclick = closeModal;
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeModal();
        ['clientsOverlay', 'settingsOverlay', 'invoiceOverlay'].forEach(id => {
          document.getElementById(id).classList.remove('open');
        });
      }
    });

    function populateClientSelect(current) {
      const sel = document.getElementById('fClient');
      const opts = clientNames();
      if (current && !opts.includes(current)) opts.unshift(current);
      sel.innerHTML =
        '<option value="">（未選択）</option>' +
        opts.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('') +
        '<option value="__new__">＋ 新しいクライアントを追加…</option>';
      sel.value = current || '';
      toggleNewClientInput();
    }
    function toggleNewClientInput() {
      const isNew = document.getElementById('fClient').value === '__new__';
      const inp = document.getElementById('fClientNew');
      inp.style.display = isNew ? '' : 'none';
      if (isNew) { inp.value = ''; inp.focus(); }
    }
    document.getElementById('fClient').addEventListener('change', toggleNewClientInput);

    function getClientValue() {
      const v = document.getElementById('fClient').value;
      if (v !== '__new__') return v;
      const name = document.getElementById('fClientNew').value.trim();
      if (name && !clientNames().includes(name)) { clients.push({ name }); saveClients(); }
      return name;
    }

    document.getElementById('saveBtn').onclick = () => {
      const data = {
        client: getClientValue(),
        contact: document.getElementById('fContact').value.trim(),
        title: document.getElementById('fTitle').value.trim(),
        due: document.getElementById('fDue').value,
        status: fStatusSel.value,
        price: document.getElementById('fPrice').value ? Number(document.getElementById('fPrice').value) : null,
        memo: document.getElementById('fMemo').value.trim(),
      };
      if (!data.title && !data.client) { alert('クライアント名か案件名を入力してください'); return; }
      if (editingId) {
        const j = jobs.find(x => x.id === editingId);
        Object.assign(j, data);
      } else {
        jobs.push({ id: 'j' + Date.now() + Math.random().toString(36).slice(2, 6), ...data });
      }
      save(); render(); closeModal();
    };

    document.getElementById('deleteBtn').onclick = () => {
      if (!editingId) return;
      if (confirm('この案件を削除しますか？')) { jobs = jobs.filter(j => j.id !== editingId); save(); render(); closeModal(); }
    };

    /* ===== クライアント管理 ===== */
    const clientsOverlay = document.getElementById('clientsOverlay');

    function renderClientList() {
      const list = document.getElementById('clientList');
      if (!clients.length) { list.innerHTML = '<div class="empty-hint">クライアントが未登録です。下から追加してください。</div>'; return; }
      list.innerHTML = '';
      clients.forEach((c, idx) => {
        const name = c.name;
        const count = jobs.filter(j => j.client === name).length;
        const row = document.createElement('div');
        row.className = 'client-row';
        const inp = document.createElement('input');
        inp.value = name;
        inp.addEventListener('change', () => {
          const newName = inp.value.trim();
          if (!newName) { inp.value = name; return; }
          if (clientNames().includes(newName) && newName !== name) { alert('同じ名前のクライアントが既にあります'); inp.value = name; return; }
          jobs.forEach(j => { if (j.client === name) j.client = newName; });
          clients[idx].name = newName;
          save(); saveClients(); render(); renderClientList();
        });
        const cnt = document.createElement('span');
        cnt.className = 'jobs-count';
        cnt.textContent = `既存件数：${count}件`;
        const del = document.createElement('button');
        del.style.cssText = 'border:1px solid #fecaca;color:#dc2626;background:#fff;padding:6px 10px;font-size:12px;cursor:pointer;white-space:nowrap;';
        del.textContent = '削除';
        del.onclick = () => {
          if (confirm(`「${name}」を削除しますか？\n（既存案件のデータは残ります）`)) { clients.splice(idx, 1); saveClients(); renderClientList(); }
        };
        row.append(inp, cnt, del);
        list.appendChild(row);
      });
    }

    document.getElementById('clientsBtn').onclick = () => { renderClientList(); document.getElementById('newClientName').value = ''; clientsOverlay.classList.add('open'); };
    document.getElementById('clientsCloseBtn').onclick = () => clientsOverlay.classList.remove('open');
    clientsOverlay.addEventListener('click', e => { if (e.target === clientsOverlay) clientsOverlay.classList.remove('open'); });

    function addClient() {
      const inp = document.getElementById('newClientName');
      const name = inp.value.trim();
      if (!name) return;
      if (clientNames().includes(name)) { alert('同じ名前のクライアントが既にあります'); return; }
      clients.push({ name });
      saveClients(); renderClientList();
      inp.value = ''; inp.focus();
    }
    document.getElementById('addClientBtn').onclick = addClient;
    document.getElementById('newClientName').addEventListener('keydown', e => { if (e.key === 'Enter') addClient(); });

    /* ===== 設定（振込先なし） ===== */
    const settingsOverlay = document.getElementById('settingsOverlay');
    function migrateSettings(raw) { return raw && typeof raw === 'object' ? { ...raw } : {}; }
    function loadSettings() { }
    function saveSettings() { saveAll(); }

    document.getElementById('settingsBtn').onclick = () => {
      document.getElementById('sName').value = settings.name || '';
      document.getElementById('sInfo').value = settings.info || '';
      document.getElementById('sReg').value = settings.reg || '';
      document.getElementById('sBankName').value = settings.bankName || '';
      document.getElementById('sBankType').value = settings.bankType || '';
      document.getElementById('sBankNumber').value = settings.bankNumber || '';
      document.getElementById('sBankHolder').value = settings.bankHolder || '';
      settingsOverlay.classList.add('open');
    };
    document.getElementById('settingsCancelBtn').onclick = () => settingsOverlay.classList.remove('open');
    settingsOverlay.addEventListener('click', e => { if (e.target === settingsOverlay) settingsOverlay.classList.remove('open'); });
    document.getElementById('settingsSaveBtn').onclick = () => {
      settings = {
        name: document.getElementById('sName').value.trim(),
        info: document.getElementById('sInfo').value.trim(),
        reg: document.getElementById('sReg').value.trim(),
        bankName: document.getElementById('sBankName').value.trim(),
        bankType: document.getElementById('sBankType').value.trim(),
        bankNumber: document.getElementById('sBankNumber').value.trim(),
        bankHolder: document.getElementById('sBankHolder').value.trim(),
      };
      saveSettings();
      settingsOverlay.classList.remove('open');
      renderInvoice();
    };

    /* ===== 請求書（対応中ステータスが対象） ===== */
    const invoiceOverlay = document.getElementById('invoiceOverlay');
    const iMonth = document.getElementById('iMonth');
    const iClient = document.getElementById('iClient');
    const iIssue = document.getElementById('iIssue');
    const iDue = document.getElementById('iDue');
    const iNo = document.getElementById('iNo');
    const iHonorific = document.getElementById('iHonorific');
    const iDetail = document.getElementById('iDetail');

    function jpDate(iso) {
      if (!iso) return '';
      const [y, m, d] = iso.split('-').map(Number);
      return `${y}年${m}月${d}日`;
    }
    function endOfNextMonth(ym) {
      const [y, m] = ym.split('-').map(Number);
      const d = new Date(y, m + 1, 0);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    /* 対応中（active）かつ対象月に納期がある案件 + 納期未設定の対応中案件 */
    function invoiceSourceJobs(ym) {
      return jobs.filter(j => j.status === 'active' && (!j.due || j.due.startsWith(ym)));
    }

    function refreshInvoiceClientOptions() {
      const cls = [...new Set(invoiceSourceJobs(iMonth.value).map(j => j.client || '（クライアント未設定）'))];
      const prev = iClient.value;
      iClient.innerHTML = cls.length
        ? '<option value="__all__">すべてのクライアント</option>' + cls.map(c => `<option>${esc(c)}</option>`).join('')
        : '<option value="">（対象月に対応中の案件がありません）</option>';
      if (prev === '__all__' || cls.includes(prev)) iClient.value = prev;
      else if (cls.length) iClient.value = '__all__';
    }

    function defaultInvoiceNo() {
      const base = iMonth.value.replace('-', '');
      const used = new Set(jobs.map(j => j.invoiceNo).filter(Boolean));
      let seq = 1;
      while (used.has(`${base}-${String(seq).padStart(2, '0')}`)) seq++;
      return `${base}-${String(seq).padStart(2, '0')}`;
    }
    function invoiceNoWithOffset(offset) {
      const baseNo = iNo.value.trim() || defaultInvoiceNo();
      const match = baseNo.match(/^(.*?)(\d+)$/);
      if (!match || !offset) return baseNo;
      return match[1] + String(Number(match[2]) + offset).padStart(match[2].length, '0');
    }
    function invoiceClientsForView() {
      const cls = [...new Set(invoiceSourceJobs(iMonth.value).map(j => j.client || '（クライアント未設定）'))];
      if (!cls.length) return [];
      if (iClient.value && iClient.value !== '__all__') return cls.includes(iClient.value) ? [iClient.value] : [];
      return cls;
    }
    function invoiceItemsForClient(client) {
      return invoiceSourceJobs(iMonth.value)
        .filter(j => (j.client || '（クライアント未設定）') === client)
        .sort((a, b) => (a.due || '') < (b.due || '') ? -1 : 1);
    }
    function invoiceHonorificLabel() { return iHonorific.value === 'sama' ? '様' : '御中'; }

    function renderInvoiceSheet(client, items, index) {
      const subtotal = items.reduce((s, j) => s + (Number(j.price) || 0), 0);
      const tax = Math.floor(subtotal * 0.10);
      const total = subtotal + tax;
      const s = settings;
      const detail = iDetail.value.trim();
      const invoiceNo = invoiceNoWithOffset(index);
      // 空行を最低8行確保（案件数が少ない場合のパディング）
      const EMPTY_ROWS = Math.max(0, 9 - items.length);

      return `
  <div class="invoice-preview" data-client="${esc(client)}">
  <div class="sheet">

    <div class="sheet-title">請 求 書</div>
    <hr class="sheet-title-rule">

    <div class="sheet-meta-from">
      <div class="to-col">
        <span class="client-name">${esc(client)}&nbsp;${invoiceHonorificLabel()}</span>
      </div>
      <div class="meta-from-inner">
        <div>発行日：${jpDate(iIssue.value)}</div>
        <div>請求書番号：${esc(invoiceNo)}</div>
        ${s.reg ? `<div class="reg-line">登録番号：${esc(s.reg)}</div>` : ''}
        <div style="margin-top:10px">
          <div class="seller-name">${esc(s.name || '')}</div>
          <div style="white-space:pre-line">${esc(s.info || '')}</div>
        </div>
      </div>
    </div>

    <div class="sheet-greeting">下記の通りご請求申し上げます。</div>

    <table class="sheet-amount-box">
      <colgroup>
        <col class="col-left-label">
        <col class="col-left-value">
        <col class="col-right-label">
        <col class="col-right-value">
      </colgroup>
      <tbody>
        <tr>
          <td class="amt-label-cell" rowspan="2">ご請求金額</td>
          <td class="amt-value-cell" rowspan="2"><strong style="font-size:20px">${fmtYen(total)}</strong></td>
          <td class="bank-label-cell">振込先</td>
          <td class="bank-value-cell">
            ${s.bankName ? esc(s.bankName) + '<br>' : ''}${(s.bankType || s.bankNumber) ? (s.bankType ? esc(s.bankType) : '') + (s.bankNumber ? '&nbsp;' + esc(s.bankNumber) : '') + '<br>' : ''}${s.bankHolder ? esc(s.bankHolder) : ''}
          </td>
        </tr>
        <tr>
          <td class="due-label-cell">支払期日</td>
          <td class="due-value-cell">${jpDate(iDue.value)}</td>
        </tr>
      </tbody>
    </table>

    <table class="sheet-items">
      <thead>
        <tr>
          <th class="col-name">品名</th>
          <th class="col-price">単価（税抜）</th>
          <th class="col-amt">金額</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(j => `
        <tr>
          <td>${esc(j.title)}</td>
          <td class="num">${fmtYen(j.price) || ''}</td>
          <td class="num">${fmtYen(j.price) || ''}</td>
        </tr>`).join('')}
        ${Array(EMPTY_ROWS).fill('<tr class="empty-row"><td></td><td></td><td></td></tr>').join('')}
      </tbody>
    </table>

    <table class="sheet-totals-wrap">
      <colgroup>
        <col style="width:auto">
        <col style="width:110px">
        <col style="width:110px">
      </colgroup>
      <tr><td class="t-spacer"></td><td class="t-label">小計</td><td class="t-value">${fmtYen(subtotal)}</td></tr>
      <tr><td class="t-spacer"></td><td class="t-label">消費税</td><td class="t-value">${fmtYen(tax)}</td></tr>
      <tr class="grand"><td class="t-spacer"></td><td class="t-label">合計金額</td><td class="t-value">${fmtYen(total)}</td></tr>
    </table>

    <div class="sheet-footer-note">ご不明な点、お気づきの点がございましたら、お気軽にご連絡ください。</div>

    <div style="border:1px solid #888; padding:3px 6px; font-size:12px; white-space:pre-line; min-height:60px; display:flex; flex-direction:column; gap:2px;">
      <span style="font-weight:700; font-size:11px; line-height:1.4; display:block;">備考</span><span style="line-height:1.6;">${detail ? esc(detail) : ''}</span>
    </div>

  </div>
  <div class="invoice-actions">
    <button class="btn invoice-pdf-btn" type="button" data-client="${esc(client)}" style="background:var(--text);color:#fff;border-color:var(--text);padding:8px 20px;"><i data-lucide="file-text" style="width:13px;height:13px;vertical-align:-2px;margin-right:5px"></i>PDFをダウンロード</button>
  </div>
  </div>`;
    }

    function attachInvoicePrintButtons() {
      document.querySelectorAll('.invoice-pdf-btn').forEach(btn => {
        btn.addEventListener('click', () => printInvoiceForClient(btn.dataset.client));
      });
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function renderInvoice() {
      const sheet = document.getElementById('invoiceSheet');
      if (!sheet) return;
      const cls = invoiceClientsForView();
      if (!cls.length) {
        sheet.innerHTML = '<div class="empty-hint" style="padding:30px">対象月に「対応中」の案件がありません。</div>';
        document.getElementById('invoicePrintBtn').style.display = 'none';
        return;
      }
      sheet.innerHTML = cls.map((c, i) => renderInvoiceSheet(c, invoiceItemsForClient(c), i)).join('');
      document.getElementById('invoicePrintBtn').style.display = '';
      attachInvoicePrintButtons();
    }

    function cleanupPrintTarget() {
      document.body.classList.remove('printing-single');
      document.querySelectorAll('.sheet.print-target').forEach(el => el.classList.remove('print-target'));
      document.querySelectorAll('.invoice-preview.print-preview-target').forEach(p => p.classList.remove('print-preview-target'));
    }
    function printInvoiceForClient(client) {
      const preview = [...document.querySelectorAll('.invoice-preview')].find(el => el.dataset.client === client);
      const sheet = preview ? preview.querySelector('.sheet') : null;
      if (!sheet) return;
      const shouldMark = confirm(`PDFダウンロード後、「${client}」の案件を「請求済み」に更新しますか？`);
      cleanupPrintTarget();
      sheet.classList.add('print-target');
      document.body.classList.add('printing-single');
      let finished = false;
      const finish = () => {
        if (finished) return; finished = true;
        cleanupPrintTarget();
        if (shouldMark) {
          invoiceItemsForClient(client).forEach(j => {
            j.status = 'issued';
            j.invoiceNo = iNo.value.trim() || defaultInvoiceNo();
            j.invoiceIssueDate = iIssue.value || today();
          });
          save(); render(); refreshInvoiceClientOptions(); renderInvoice();
        }
      };
      window.addEventListener('afterprint', finish, { once: true });
      preview.classList.add('print-preview-target');
      window.print();
    }

    document.getElementById('invoiceBtn').onclick = () => {
      const cur = today();
      invoiceMonthPicker.setValue(iMonth.value || cur.slice(0, 7));
      invoiceIssuePicker.setValue(cur);
      invoiceDuePicker.setValue(endOfNextMonth(iIssue.value));
      refreshInvoiceClientOptions();
      iNo.value = defaultInvoiceNo();
      iDetail.value = '';
      renderInvoice();
      invoiceOverlay.classList.add('open');
    };
    iMonth.onchange = () => {
      invoiceDuePicker.setValue(endOfNextMonth(iIssue.value || iMonth.value));
      iNo.value = defaultInvoiceNo();
      refreshInvoiceClientOptions();
      renderInvoice();
    };
    iClient.onchange = renderInvoice;
    iHonorific.onchange = renderInvoice;
    iDetail.oninput = renderInvoice;
    iIssue.onchange = () => {
      invoiceDuePicker.setValue(endOfNextMonth(iIssue.value));
      renderInvoice();
    };
    iDue.onchange = renderInvoice;
    iNo.oninput = renderInvoice;

    document.getElementById('invoiceCloseBtn').onclick = () => invoiceOverlay.classList.remove('open');
    invoiceOverlay.addEventListener('click', e => { if (e.target === invoiceOverlay) invoiceOverlay.classList.remove('open'); });
    document.getElementById('invoicePrintBtn').onclick = () => {
      const cls = invoiceClientsForView();
      if (cls.length && confirm(`対象 ${invoiceSourceJobs(iMonth.value).length} 件を「請求済み」として記録しますか？`)) {
        invoiceSourceJobs(iMonth.value).forEach(j => {
          j.status = 'issued';
          j.invoiceNo = iNo.value.trim() || defaultInvoiceNo();
          j.invoiceIssueDate = iIssue.value || today();
        });
        save(); render(); refreshInvoiceClientOptions(); renderInvoice();
      }
      window.print();
    };

    /* ===== デモデータ ===== */
    const DEMO_CLIENTS = [
      { name: 'サンプル株式会社' },
      { name: 'sample & co.' },
      { name: '株式会社テスト' },
      { name: '山田 花子' },
      { name: '岡山 太郎' },
    ];
    const DEMO_SETTINGS = {
      name: '深森呼吸',
      info: '〒100-0000\n東京都千代田区丸の内1-2-3\nhello@sample.com\n03-1111-2222',
      reg: 'T1234567890123',
      bankName: 'サンプル銀行 サンプル支店',
      bankType: '普通',
      bankNumber: '01234567',
      bankHolder: 'ｼﾝｼﾝｺｷｭｳ',
    };
    const DEMO_JOBS = [
      { id: 'demo-001', client: 'サンプル株式会社', title: 'キャンペーンサイト制作', due: '2026-09-30', status: 'pending', price: 100000, memo: '・サイトディレクション\n・サイトデザイン', contact: '鈴木様' },
      { id: 'demo-002', client: '岡山 太郎', title: 'オンライン秘書 8月', due: '2026-08-31', status: 'pending', price: 90000, memo: '事務処理', contact: '' },
      { id: 'demo-003', client: 'sample & co.', title: '企業PR動画編集', due: '2026-08-10', status: 'active', price: 50000, memo: '社内PR用', contact: '' },
      { id: 'demo-004', client: '株式会社テスト', title: '企業サイト制作', due: '2026-07-24', status: 'issued', price: 100000, memo: 'デザインのみ', contact: '' },
      { id: 'demo-005', client: '山田 花子', title: 'LINE公式アカウント構築', due: '2026-06-30', status: 'active', price: 60000, memo: '', contact: '' },
      { id: 'demo-006', client: 'サンプル株式会社', title: 'バックオフィス支援', due: '2026-07-31', status: 'active', price: 50000, memo: '業務相談\nリサーチ\nデータ入力', contact: '鈴木様' },
      { id: 'demo-009', client: 'サンプル株式会社', title: 'バックオフィス支援', due: '2026-05-31', status: 'paid', price: 100000, invoiceNo: '202605-01', memo: '', contact: '' },
      { id: 'demo-010', client: '岡山 太郎', title: 'オンライン秘書 6月', due: '2026-06-30', status: 'paid', price: 90000, invoiceNo: '202605-02', memo: '30H', contact: '' },
      { id: 'j1782792993243ka8c', client: '岡山 太郎', title: 'オンライン秘書 7月', due: '2026-07-31', status: 'active', price: 90000, memo: '30H', contact: '' },
    ];

    function cloneData(v) { return JSON.parse(JSON.stringify(v)); }
    function installDemo() {
      try {
        localStorage.setItem(KEY, JSON.stringify(DEMO_JOBS));
        localStorage.setItem(CLIENTS_KEY, JSON.stringify(DEMO_CLIENTS));
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEMO_SETTINGS));
        localStorage.setItem(DEMO_SEED_KEY, DEMO_VERSION);
      } catch {
        jobs = cloneData(DEMO_JOBS).map(normalizeJob);
        clients = cloneData(DEMO_CLIENTS);
        settings = migrateSettings(cloneData(DEMO_SETTINGS));
      }
    }

    /* ===== INIT（スタンドアロン版：localStorage から直接起動） ===== */
    if (localStorage.getItem(DEMO_SEED_KEY) !== DEMO_VERSION) {
      installDemo();
    }
    loadAll();
    render();
    if (typeof lucide !== 'undefined') lucide.createIcons();
