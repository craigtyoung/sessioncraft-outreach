// ===== State =====
let currentTab = 'practitioners';
let allData = { practitioners: [], organizations: [], ideas: [] };
let activeId = null;
let searchQuery = '';
let filters = { status: '', category: '', priority: '', warmth: '' };
let modalSaveAction = null;

// Team identity + view filters (persisted to localStorage)
const TEAM_MEMBERS = ['Craig', 'Scottie', 'Christine'];
let currentUser = localStorage.getItem('sc_user') || 'Craig';
let showMineOnly = localStorage.getItem('sc_mine') !== 'false'; // default true
let kanbanMode = 'status'; // 'status' | 'tier'
let goals = { weekly_target: 15 };
let currentTheme = localStorage.getItem('sc_theme') || 'dark';

// ===== Pipeline Stages =====
const PRACTITIONER_STAGES = ['Not Contacted', 'Contacted', 'Responded', 'Account Created', 'Demo Done', 'Onboarded', 'Affiliate'];
const ORG_STAGES = ['Not Contacted', 'Contacted', 'Responded', 'Demo', 'Partner'];
const TIER_STAGES = ['Individual', 'Group Leader', 'Organization'];
const PLATFORM_FIT_OPTIONS = ['SSB', 'Voice', 'Craft'];
const IDEAS_STAGES = ['Brainstormed', 'Discussed', 'Executing', 'Completed'];
const IDEAS_CATEGORIES = ['Warm Market', 'Practitioner Network', 'Content', 'Events', 'Partnerships', 'Growth Mechanics', 'Paid', 'Team'];
const IDEAS_PLATFORMS = ['General', 'SessionCraft', 'Voice', 'Sacred Songbook'];

// ===== Boot =====
async function init() {
  applyTheme();
  await fetchAll();
  renderGoalsBar();
  renderFilterBar();
  renderMain();
  bindGlobalEvents();
  setDefaultLogDate();
}

async function fetchAll() {
  const [p, o, id, g] = await Promise.all([
    fetch('/api/practitioners').then(r => r.json()).catch(() => []),
    fetch('/api/organizations').then(r => r.json()).catch(() => []),
    fetch('/api/ideas').then(r => r.json()).catch(() => []),
    fetch('/api/goals').then(r => r.json()).catch(() => ({ weekly_target: 15 }))
  ]);
  allData.practitioners = p;
  allData.organizations = o;
  allData.ideas = id;
  goals = g;
}

// ===== Goals Bar =====
function getThisWeekTouches() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const mondayISO = monday.toISOString().split('T')[0];
  let count = 0;
  [...allData.practitioners, ...allData.organizations].forEach(item => {
    (item.log || []).forEach(e => { if (e.date >= mondayISO) count++; });
  });
  return count;
}

function renderGoalsBar() {
  const bar = document.getElementById('goalsBar');
  if (!bar) return;
  const touches = getThisWeekTouches();
  const target = goals.weekly_target || 15;
  const pct = Math.min(100, Math.round((touches / target) * 100));
  const done = touches >= target;
  bar.innerHTML = `
    <div class="goals-bar-inner">
      <span class="goals-label">This Week</span>
      <div class="goals-progress-track">
        <div class="goals-progress-fill${done ? ' goals-done' : ''}" style="width:${pct}%"></div>
      </div>
      <span class="goals-count${done ? ' goals-done' : ''}">${touches}</span>
      <span class="goals-sep">/</span>
      <div class="goals-target-wrap">
        <span class="goals-target-label">target:</span>
        <input type="number" class="goals-input" id="goalsTargetInput" value="${target}" min="1" max="200" />
      </div>
    </div>`;
  document.getElementById('goalsTargetInput').addEventListener('change', async (e) => {
    const val = parseInt(e.target.value, 10);
    if (!val || val < 1) return;
    goals.weekly_target = val;
    await fetch('/api/goals', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekly_target: val })
    });
    renderGoalsBar();
  });
}

function applyTheme() {
  document.body.setAttribute('data-theme', currentTheme);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = currentTheme === 'dark' ? '☀' : '☽';
}

// ===== Render Main =====
function renderMain() {
  renderStats();
  const data = getFilteredData();
  if (kanbanMode === 'tier' && (currentTab === 'practitioners' || currentTab === 'organizations')) {
    const html = `<div class="pipeline">${TIER_STAGES.map(t => renderColumn(t, data.filter(d => (d.tier || 'Individual') === t), 'tier')).join('')}</div>`;
    document.getElementById('mainContent').innerHTML = html;
  } else {
    const stages = currentTab === 'practitioners' ? PRACTITIONER_STAGES : currentTab === 'ideas' ? IDEAS_STAGES : ORG_STAGES;
    const html = `<div class="pipeline">${stages.map(s => renderColumn(s, data.filter(d => d.status === s), 'status')).join('')}</div>`;
    document.getElementById('mainContent').innerHTML = html;
  }
  bindCardClicks();
  if (currentTab === 'ideas') bindIdeaTooltips();
}

function renderColumn(stage, items, mode) {
  return `
    <div class="pipeline-col" data-stage="${stage}" data-mode="${mode || 'status'}">
      <div class="pipeline-col-header">
        <h3>${stage}</h3>
        <span class="pipeline-count">${items.length}</span>
      </div>
      <div class="pipeline-cards" data-stage="${stage}" data-mode="${mode || 'status'}">
        ${items.length ? items.map(renderCard).join('') : ''}
      </div>
    </div>`;
}

function renderCard(item) {
  if (currentTab === 'practitioners') return renderPractitionerCard(item);
  if (currentTab === 'ideas') return renderIdeaCard(item);
  return renderOrgCard(item);
}

function renderPractitionerCard(p) {
  const warmTag = p.warmth ? `<span class="tag tag-${p.warmth.toLowerCase()}">${p.warmth}</span>` : '';
  const demoTag = p.demo ? `<span class="tag tag-demo">Demo</span>` : '';
  const acctTag = p.accountCreated ? `<span class="tag tag-account">Account</span>` : '';
  const playlistTag = p.playlistCreated ? `<span class="tag tag-playlist">Playlist</span>` : '';
  const modTag = p.modality ? `<span class="tag tag-modality">${p.modality}</span>` : '';
  const assignedTag = p.assigned_to && p.assigned_to !== currentUser ? `<span class="tag tag-assigned">${p.assigned_to}</span>` : '';
  const fitTags = (p.platform_fit || []).map(f => `<span class="tag tag-fit tag-fit-${f.toLowerCase()}">${f}</span>`).join('');
  const landedTag = p.landed_by ? `<span class="tag tag-landed">${p.landed_by}</span>` : '';
  const channelTag = p.channel ? `<span class="tag tag-channel">${p.channel}</span>` : '';
  return `
    <div class="card" data-id="${p.id}" draggable="true">
      <div class="card-name">${p.name}</div>
      <div class="card-sub">${p.source || ''}</div>
      <div class="card-tags">${warmTag}${modTag}${channelTag}${acctTag}${demoTag}${playlistTag}${fitTags}${assignedTag}${landedTag}</div>
    </div>`;
}

function renderOrgCard(o) {
  const priorityKey = (o.priority || '').replace('+', 'p');
  const badge = o.priority ? `<span class="priority-badge priority-${priorityKey}">${o.priority}</span>` : '';
  const warmTag = o.warmConnection ? `<span class="tag tag-connection">Warm</span>` : '';
  const catTag = o.category ? `<span class="tag tag-category">${o.category}</span>` : '';
  const assignedTag = o.assigned_to && o.assigned_to !== currentUser ? `<span class="tag tag-assigned">${o.assigned_to}</span>` : '';
  const fitTags = (o.platform_fit || []).map(f => `<span class="tag tag-fit tag-fit-${f.toLowerCase()}">${f}</span>`).join('');
  const landedTag = o.landed_by ? `<span class="tag tag-landed">${o.landed_by}</span>` : '';
  const channelTag = o.channel ? `<span class="tag tag-channel">${o.channel}</span>` : '';
  const dots = Array.from({ length: 5 }, (_, i) =>
    `<span class="dot${i < (o.musicRelevance || 0) ? ' filled' : ''}"></span>`
  ).join('');
  return `
    <div class="card" data-id="${o.id}" draggable="true">
      ${badge}
      <div class="card-name">${o.name}</div>
      <div class="card-sub">${o.estPractitioners ? o.estPractitioners + ' practitioners' : ''}</div>
      <div class="card-tags">${warmTag}${catTag}${channelTag}${fitTags}${assignedTag}${landedTag}</div>
      <div class="relevance-dots">${dots}</div>
    </div>`;
}

function renderIdeaCard(idea) {
  const platClass = (idea.platform || 'general').toLowerCase().replace(/\s+/g, '-');
  const platTag = idea.platform ? `<span class="tag tag-fit tag-fit-${platClass}">${idea.platform}</span>` : '';
  const catTag = idea.category ? `<span class="tag tag-category">${idea.category}</span>` : '';
  const desc = (idea.description || '').replace(/"/g, '&quot;');
  return `
    <div class="card" data-id="${idea.id}" data-desc="${desc}" draggable="true">
      <div class="card-name">${idea.title}</div>
      <div class="card-tags">${platTag}${catTag}</div>
    </div>`;
}

// ===== Filter Bar =====
function teamViewControls() {
  if (currentTab !== 'practitioners' && currentTab !== 'organizations') return '';
  const mineLabel = showMineOnly ? 'Mine' : 'All';
  const mineClass = showMineOnly ? 'filter-toggle active' : 'filter-toggle';
  const tierLabel = kanbanMode === 'tier' ? 'By Tier' : 'By Status';
  return `
    <button class="${mineClass}" id="btnMineToggle">${mineLabel}</button>
    <button class="filter-toggle" id="btnKanbanToggle">${tierLabel}</button>
  `;
}

function bindTeamViewControls() {
  const mineBtn = document.getElementById('btnMineToggle');
  if (mineBtn) {
    mineBtn.addEventListener('click', () => {
      showMineOnly = !showMineOnly;
      localStorage.setItem('sc_mine', showMineOnly);
      renderFilterBar();
      renderMain();
    });
  }
  const kanbanBtn = document.getElementById('btnKanbanToggle');
  if (kanbanBtn) {
    kanbanBtn.addEventListener('click', () => {
      kanbanMode = kanbanMode === 'status' ? 'tier' : 'status';
      renderFilterBar();
      renderMain();
    });
  }
}

function renderFilterBar() {
  const bar = document.getElementById('filterBar');
  if (currentTab === 'practitioners') {
    const statuses = ['', ...PRACTITIONER_STAGES];
    const modalities = ['', ...getUnique('practitioners', 'modality')];
    const warmths = ['', 'Hot', 'Warm'];
    bar.innerHTML = `
      ${teamViewControls()}
      <select class="filter-select" id="fStatus"><option value="">All Stages</option>${statuses.slice(1).map(s => `<option value="${s}">${s}</option>`).join('')}</select>
      <select class="filter-select" id="fModality"><option value="">All Modalities</option>${modalities.slice(1).map(m => `<option value="${m}">${m}</option>`).join('')}</select>
      <select class="filter-select" id="fWarmth"><option value="">All Warmth</option>${warmths.slice(1).map(w => `<option value="${w}">${w}</option>`).join('')}</select>
    `;
    document.getElementById('fStatus').addEventListener('change', e => { filters.status = e.target.value; renderMain(); });
    document.getElementById('fModality').addEventListener('change', e => { filters.category = e.target.value; renderMain(); });
    document.getElementById('fWarmth').addEventListener('change', e => { filters.warmth = e.target.value; renderMain(); });
    bindTeamViewControls();
  } else if (currentTab === 'ideas') {
    bar.innerHTML = `
      <select class="filter-select" id="fStatus"><option value="">All Stages</option>${IDEAS_STAGES.map(s => `<option value="${s}">${s}</option>`).join('')}</select>
      <select class="filter-select" id="fCategory"><option value="">All Categories</option>${IDEAS_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
      <select class="filter-select" id="fPlatform"><option value="">All Platforms</option>${IDEAS_PLATFORMS.map(p => `<option value="${p}">${p}</option>`).join('')}</select>
    `;
    document.getElementById('fStatus').addEventListener('change', e => { filters.status = e.target.value; renderMain(); });
    document.getElementById('fCategory').addEventListener('change', e => { filters.category = e.target.value; renderMain(); });
    document.getElementById('fPlatform').addEventListener('change', e => { filters.warmth = e.target.value; renderMain(); });
  } else {
    const statuses = ['', ...ORG_STAGES];
    const categories = ['', ...getUnique('organizations', 'category')];
    const priorities = ['', 'A+', 'A', 'B+', 'B'];
    bar.innerHTML = `
      ${teamViewControls()}
      <select class="filter-select" id="fStatus"><option value="">All Stages</option>${statuses.slice(1).map(s => `<option value="${s}">${s}</option>`).join('')}</select>
      <select class="filter-select" id="fCategory"><option value="">All Categories</option>${categories.slice(1).map(c => `<option value="${c}">${c}</option>`).join('')}</select>
      <select class="filter-select" id="fPriority"><option value="">All Priorities</option>${priorities.slice(1).map(p => `<option value="${p}">${p}</option>`).join('')}</select>
    `;
    document.getElementById('fStatus').addEventListener('change', e => { filters.status = e.target.value; renderMain(); });
    document.getElementById('fCategory').addEventListener('change', e => { filters.category = e.target.value; renderMain(); });
    document.getElementById('fPriority').addEventListener('change', e => { filters.priority = e.target.value; renderMain(); });
    bindTeamViewControls();
  }
}

function getUnique(type, field) {
  return [...new Set(allData[type].map(d => d[field]).filter(Boolean))].sort();
}

function getFilteredData() {
  let data = allData[currentTab];
  // Mine/All filter — only on practitioner + org tabs
  if (showMineOnly && (currentTab === 'practitioners' || currentTab === 'organizations')) {
    data = data.filter(d => !d.assigned_to || d.assigned_to === currentUser);
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    data = data.filter(d =>
      (d.name || '').toLowerCase().includes(q) ||
      (d.title || '').toLowerCase().includes(q) ||
      (d.description || '').toLowerCase().includes(q) ||
      (d.email || '').toLowerCase().includes(q) ||
      (d.notes || '').toLowerCase().includes(q) ||
      (d.offering || '').toLowerCase().includes(q) ||
      (d.whyTarget || '').toLowerCase().includes(q) ||
      (d.category || '').toLowerCase().includes(q) ||
      (d.platform || '').toLowerCase().includes(q) ||
      (d.modality || '').toLowerCase().includes(q) ||
      (d.focus || '').toLowerCase().includes(q) ||
      (d.role || '').toLowerCase().includes(q) ||
      (d.source || '').toLowerCase().includes(q) ||
      (d.assigned_to || '').toLowerCase().includes(q)
    );
  }
  if (filters.status) data = data.filter(d => d.status === filters.status);
  if (filters.category && currentTab === 'practitioners') data = data.filter(d => d.modality === filters.category);
  if (filters.category && currentTab === 'organizations') data = data.filter(d => d.category === filters.category);
  if (filters.priority) data = data.filter(d => d.priority === filters.priority);
  if (filters.warmth && currentTab !== 'ideas') data = data.filter(d => d.warmth === filters.warmth);
  if (filters.warmth && currentTab === 'ideas') data = data.filter(d => d.platform === filters.warmth);
  return data;
}

function renderStats() {
  const data = allData[currentTab];
  const total = data.length;
  if (currentTab === 'ideas') {
    const active = data.filter(d => d.status !== 'Completed').length;
    const executing = data.filter(d => d.status === 'Executing').length;
    const completed = data.filter(d => d.status === 'Completed').length;
    document.getElementById('statsBar').innerHTML = `
      <div class="stat-chip">Total: <span>${total}</span></div>
      <div class="stat-chip">Active: <span>${active}</span></div>
      <div class="stat-chip">Executing: <span>${executing}</span></div>
      <div class="stat-chip">Completed: <span>${completed}</span></div>
    `;
    return;
  }
  const contacted = data.filter(d => d.status !== 'Not Contacted').length;
  const warm = currentTab === 'practitioners'
    ? data.filter(d => d.warmth === 'Hot' || d.warmth === 'Warm').length
    : data.filter(d => d.warmConnection).length;
  document.getElementById('statsBar').innerHTML = `
    <div class="stat-chip">Total: <span>${total}</span></div>
    <div class="stat-chip">In Pipeline: <span>${contacted}</span></div>
    <div class="stat-chip">Warm: <span>${warm}</span></div>
  `;
}

// ===== Detail Panel =====
function openPanel(id) {
  activeId = id;
  const item = allData[currentTab].find(d => d.id === id);
  if (!item) return;

  document.getElementById('panelName').textContent = item.name || item.title || '';
  renderPanelMeta(item);
  renderPanelFields(item);
  renderLogEntries(item);
  setDefaultLogDate();

  document.getElementById('logNote').value = '';
  document.getElementById('overlay').classList.add('active');
  document.getElementById('detailPanel').classList.add('open');
}

function renderPanelMeta(item) {
  const meta = document.getElementById('panelMeta');
  if (currentTab === 'practitioners') {
    meta.innerHTML = `
      <span class="tag tag-${(item.warmth || '').toLowerCase()}">${item.warmth || ''}</span>
      ${item.modality ? `<span class="tag tag-modality">${item.modality}</span>` : ''}
      <span style="color:var(--text-dim)">${item.source || ''}</span>
    `;
  } else if (currentTab === 'ideas') {
    const platClass = (item.platform || 'general').toLowerCase().replace(/\s+/g, '-');
    meta.innerHTML = `
      ${item.platform ? `<span class="tag tag-fit tag-fit-${platClass}">${item.platform}</span>` : ''}
      ${item.category ? `<span class="tag tag-category">${item.category}</span>` : ''}
    `;
  } else {
    const pk = (item.priority || '').replace('+', 'p');
    meta.innerHTML = `
      <span class="priority-badge priority-${pk}" style="position:static;font-size:11px">${item.priority || ''}</span>
      ${item.category ? `<span class="tag tag-category">${item.category}</span>` : ''}
      ${item.warmConnection ? `<span class="tag tag-connection">Warm Connection</span>` : ''}
    `;
  }
}

function renderPanelFields(item) {
  let fields = '';

  if (currentTab === 'ideas') {
    const ideaStatusOpts = IDEAS_STAGES.map(s => `<option value="${s}"${s === (item.status || 'Brainstormed') ? ' selected' : ''}>${s}</option>`).join('');
    const platOpts = IDEAS_PLATFORMS.map(p => `<option value="${p}"${p === (item.platform || 'General') ? ' selected' : ''}>${p}</option>`).join('');
    const catOpts = ['', ...IDEAS_CATEGORIES].map(c => `<option value="${c}"${c === (item.category || '') ? ' selected' : ''}>${c || '—'}</option>`).join('');
    fields = `
      <div class="field-row">
        <span class="field-label">Status</span>
        <select class="field-inline-select" id="inlineStatus">${ideaStatusOpts}</select>
      </div>
      <div class="field-row">
        <span class="field-label">Platform</span>
        <select class="field-inline-select" id="inlinePlatform">${platOpts}</select>
      </div>
      <div class="field-row">
        <span class="field-label">Category</span>
        <select class="field-inline-select" id="inlineCategory">${catOpts}</select>
      </div>
      <div class="field-row">
        <span class="field-label">Description</span>
        <span class="field-value" style="white-space:pre-wrap;font-size:12px;color:var(--text-dim);line-height:1.5">${escHtml(item.description || '—')}</span>
      </div>
    `;
    if (item.notes) fields += `<div class="field-note">${escHtml(item.notes)}</div>`;
    fields += '<div class="panel-delete-action"><button class="btn-delete-record" id="btnDeleteRecord">Delete this idea</button></div>';
    document.getElementById('panelFields').innerHTML = fields;
    document.getElementById('inlineStatus').addEventListener('change', async (e) => {
      await fetch(`/api/ideas/${activeId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: e.target.value }) });
      const idx = allData.ideas.findIndex(d => d.id === activeId);
      if (idx !== -1) allData.ideas[idx].status = e.target.value;
      renderMain();
    });
    document.getElementById('inlinePlatform').addEventListener('change', async (e) => {
      await fetch(`/api/ideas/${activeId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: e.target.value }) });
      const idx = allData.ideas.findIndex(d => d.id === activeId);
      if (idx !== -1) { allData.ideas[idx].platform = e.target.value; renderPanelMeta(allData.ideas[idx]); renderMain(); }
    });
    document.getElementById('inlineCategory').addEventListener('change', async (e) => {
      await fetch(`/api/ideas/${activeId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: e.target.value }) });
      const idx = allData.ideas.findIndex(d => d.id === activeId);
      if (idx !== -1) { allData.ideas[idx].category = e.target.value; renderPanelMeta(allData.ideas[idx]); renderMain(); }
    });
    document.getElementById('btnDeleteRecord').addEventListener('click', async () => {
      if (!confirm('Delete this idea?')) return;
      await fetch('/api/ideas/' + item.id, { method: 'DELETE' });
      allData.ideas = allData.ideas.filter(d => d.id !== item.id);
      closePanel();
      renderMain();
    });
    return;
  }

  const stages = currentTab === 'practitioners' ? PRACTITIONER_STAGES : ORG_STAGES;
  const stageOptions = stages.map(s => `<option value="${s}"${s === item.status ? ' selected' : ''}>${s}</option>`).join('');
  fields = `
    <div class="field-row">
      <span class="field-label">Status</span>
      <select class="field-inline-select" id="inlineStatus">${stageOptions}</select>
    </div>
  `;

  if (currentTab === 'practitioners') {
    const tierOpts = TIER_STAGES.map(t => `<option value="${t}"${t === (item.tier || 'Individual') ? ' selected' : ''}>${t}</option>`).join('');
    const assignedOpts = TEAM_MEMBERS.map(m => `<option value="${m}"${m === (item.assigned_to || '') ? ' selected' : ''}>${m}</option>`).join('');
    const landedOpts = ['', ...TEAM_MEMBERS].map(m => `<option value="${m}"${m === (item.landed_by || '') ? ' selected' : ''}>${m || '—'}</option>`).join('');
    const channelOpts = ['', 'Email', 'Instagram DM', 'LinkedIn', 'In Person', 'Other'].map(c => `<option value="${c}"${c === (item.channel || '') ? ' selected' : ''}>${c || '—'}</option>`).join('');
    const fitChecks = PLATFORM_FIT_OPTIONS.map(f => `<label class="check-item"><input type="checkbox" class="pfit-cb" data-fit="${f}" ${(item.platform_fit || []).includes(f) ? 'checked' : ''} /> ${f}</label>`).join('');
    fields += `
      <div class="field-row">
        <span class="field-label">Email</span>
        <span class="field-value">${item.email ? `<a href="mailto:${item.email}">${item.email}</a>` : '—'}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Assigned To</span>
        <span class="field-value"><select class="field-inline-select" id="inlineAssigned">${assignedOpts}</select></span>
      </div>
      <div class="field-row">
        <span class="field-label">Channel</span>
        <span class="field-value"><select class="field-inline-select" id="inlineChannel">${channelOpts}</select></span>
      </div>
      <div class="field-row">
        <span class="field-label">Tier</span>
        <span class="field-value"><select class="field-inline-select" id="inlineTier">${tierOpts}</select></span>
      </div>
      <div class="field-row">
        <span class="field-label">Landed By</span>
        <span class="field-value"><select class="field-inline-select" id="inlineLandedBy">${landedOpts}</select></span>
      </div>
      <div class="field-row">
        <span class="field-label">Platform Fit</span>
        <span class="field-value"><div class="field-checkboxes">${fitChecks}</div></span>
      </div>
      <div class="field-row">
        <span class="field-label">Offering</span>
        <span class="field-value">${item.offering || '—'}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Checkboxes</span>
        <span class="field-value">
          <div class="field-checkboxes">
            <label class="check-item"><input type="checkbox" data-field="accountCreated" ${item.accountCreated ? 'checked' : ''} /> Account Created</label>
            <label class="check-item"><input type="checkbox" data-field="demo" ${item.demo ? 'checked' : ''} /> Demo Done</label>
            <label class="check-item"><input type="checkbox" data-field="playlistCreated" ${item.playlistCreated ? 'checked' : ''} /> First Playlist</label>
            <label class="check-item"><input type="checkbox" data-field="followUp" ${item.followUp ? 'checked' : ''} /> Follow Up Needed</label>
          </div>
        </span>
      </div>
    `;
  } else {
    const dots = Array.from({ length: 5 }, (_, i) =>
      `<span class="dot${i < (item.musicRelevance || 0) ? ' filled' : ''}"></span>`
    ).join('');
    const orgAssignedOpts = TEAM_MEMBERS.map(m => `<option value="${m}"${m === (item.assigned_to || '') ? ' selected' : ''}>${m}</option>`).join('');
    const orgTierOpts = TIER_STAGES.map(t => `<option value="${t}"${t === (item.tier || 'Organization') ? ' selected' : ''}>${t}</option>`).join('');
    const orgLandedOpts = ['', ...TEAM_MEMBERS].map(m => `<option value="${m}"${m === (item.landed_by || '') ? ' selected' : ''}>${m || '—'}</option>`).join('');
    const orgChannelOpts = ['', 'Email', 'Instagram DM', 'LinkedIn', 'In Person', 'Other'].map(c => `<option value="${c}"${c === (item.channel || '') ? ' selected' : ''}>${c || '—'}</option>`).join('');
    const orgFitChecks = PLATFORM_FIT_OPTIONS.map(f => `<label class="check-item"><input type="checkbox" class="pfit-cb" data-fit="${f}" ${(item.platform_fit || []).includes(f) ? 'checked' : ''} /> ${f}</label>`).join('');
    fields += `
      <div class="field-row">
        <span class="field-label">Assigned To</span>
        <span class="field-value"><select class="field-inline-select" id="inlineAssigned">${orgAssignedOpts}</select></span>
      </div>
      <div class="field-row">
        <span class="field-label">Channel</span>
        <span class="field-value"><select class="field-inline-select" id="inlineChannel">${orgChannelOpts}</select></span>
      </div>
      <div class="field-row">
        <span class="field-label">Tier</span>
        <span class="field-value"><select class="field-inline-select" id="inlineTier">${orgTierOpts}</select></span>
      </div>
      <div class="field-row">
        <span class="field-label">Landed By</span>
        <span class="field-value"><select class="field-inline-select" id="inlineLandedBy">${orgLandedOpts}</select></span>
      </div>
      <div class="field-row">
        <span class="field-label">Platform Fit</span>
        <span class="field-value"><div class="field-checkboxes">${orgFitChecks}</div></span>
      </div>
      <div class="field-row">
        <span class="field-label">Website</span>
        <span class="field-value">${item.website ? `<a href="${item.website}" target="_blank">${item.website}</a>` : '—'}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Key Contact</span>
        <span class="field-value">${item.keyContact || '—'}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Instagram</span>
        <span class="field-value">${item.instagram || '—'}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Practitioners</span>
        <span class="field-value">${item.estPractitioners || '—'}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Geography</span>
        <span class="field-value">${item.geography || '—'}</span>
      </div>
      <div class="field-row">
        <span class="field-label">Music Relevance</span>
        <span class="field-value"><div class="relevance-dots" style="display:flex;gap:4px">${dots}</div></span>
      </div>
      <div class="field-row">
        <span class="field-label">Why Target</span>
        <span class="field-value">${item.whyTarget || '—'}</span>
      </div>
    `;
  }

  if (item.notes) {
    fields += `<div class="field-note">${item.notes}</div>`;
  }

  const deleteLabel = currentTab === 'practitioners' ? 'practitioner' : 'organization';
  fields += '<div class="panel-delete-action"><button class="btn-delete-record" id="btnDeleteRecord">Delete this ' + deleteLabel + '</button></div>';

  if (currentTab === 'organizations') {
    fields += renderContactsSection(item);
  }

  document.getElementById('panelFields').innerHTML = fields;

  if (currentTab === 'organizations') {
    bindContactEvents(item);
  }

  document.getElementById('inlineStatus').addEventListener('change', async (e) => {
    const endpoint = currentTab === 'practitioners' ? 'practitioners' : 'organizations';
    await fetch(`/api/${endpoint}/${activeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: e.target.value })
    });
    const idx = allData[currentTab].findIndex(d => d.id === activeId);
    if (idx !== -1) allData[currentTab][idx].status = e.target.value;
    renderMain();
  });

  const assignedSel = document.getElementById('inlineAssigned');
  if (assignedSel) {
    assignedSel.addEventListener('change', async (e) => {
      const endpoint = currentTab === 'practitioners' ? 'practitioners' : 'organizations';
      await fetch(`/api/${endpoint}/${activeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: e.target.value })
      });
      const idx = allData[currentTab].findIndex(d => d.id === activeId);
      if (idx !== -1) allData[currentTab][idx].assigned_to = e.target.value;
      renderMain();
    });
  }

  const tierSel = document.getElementById('inlineTier');
  if (tierSel) {
    tierSel.addEventListener('change', async (e) => {
      const endpoint = currentTab === 'practitioners' ? 'practitioners' : 'organizations';
      await fetch(`/api/${endpoint}/${activeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: e.target.value })
      });
      const idx = allData[currentTab].findIndex(d => d.id === activeId);
      if (idx !== -1) allData[currentTab][idx].tier = e.target.value;
      renderMain();
    });
  }

  const channelSel = document.getElementById('inlineChannel');
  if (channelSel) {
    channelSel.addEventListener('change', async (e) => {
      const endpoint = currentTab === 'practitioners' ? 'practitioners' : 'organizations';
      await fetch(`/api/${endpoint}/${activeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: e.target.value })
      });
      const idx = allData[currentTab].findIndex(d => d.id === activeId);
      if (idx !== -1) allData[currentTab][idx].channel = e.target.value;
      renderMain();
    });
  }

  const landedSel = document.getElementById('inlineLandedBy');
  if (landedSel) {
    landedSel.addEventListener('change', async (e) => {
      const endpoint = currentTab === 'practitioners' ? 'practitioners' : 'organizations';
      await fetch(`/api/${endpoint}/${activeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landed_by: e.target.value })
      });
      const idx = allData[currentTab].findIndex(d => d.id === activeId);
      if (idx !== -1) allData[currentTab][idx].landed_by = e.target.value;
      renderMain();
    });
  }

  document.querySelectorAll('.pfit-cb').forEach(cb => {
    cb.addEventListener('change', async () => {
      const endpoint = currentTab === 'practitioners' ? 'practitioners' : 'organizations';
      const selected = Array.from(document.querySelectorAll('.pfit-cb:checked')).map(c => c.dataset.fit);
      await fetch(`/api/${endpoint}/${activeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform_fit: selected })
      });
      const idx = allData[currentTab].findIndex(d => d.id === activeId);
      if (idx !== -1) allData[currentTab][idx].platform_fit = selected;
      renderMain();
    });
  });

  const deleteBtn = document.getElementById('btnDeleteRecord');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Delete ' + item.name + '? This cannot be undone.')) return;
      const endpoint = currentTab === 'practitioners' ? 'practitioners' : 'organizations';
      await fetch('/api/' + endpoint + '/' + item.id, { method: 'DELETE' });
      allData[currentTab] = allData[currentTab].filter(d => d.id !== item.id);
      closePanel();
      renderMain();
    });
  }

  document.querySelectorAll('.field-checkboxes input[data-field]').forEach(cb => {
    cb.addEventListener('change', async (e) => {
      const field = e.target.dataset.field;
      const val = e.target.checked;
      await fetch(`/api/practitioners/${activeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: val })
      });
      const idx = allData.practitioners.findIndex(d => d.id === activeId);
      if (idx !== -1) allData[currentTab][idx][field] = val;
      renderMain();
    });
  });
}

// ===== Contacts (Org sub-layer) =====

const CONTACT_STATUSES = ['Research Needed', 'Not Contacted', 'Contacted', 'Responded', 'Converted'];

function renderContactsSection(org) {
  const contacts = org.contacts || [];
  const reachabilityBar = (n) => Array.from({length:5},(_,i)=>
    `<span class="reach-dot${i<n?' filled':''}" style="width:8px;height:8px;border-radius:50%;background:${i<n?'var(--sc-gold)':'var(--bg4)'};border:1px solid ${i<n?'var(--sc-gold)':'var(--border)'};display:inline-block;"></span>`
  ).join('');

  const rows = contacts.map(c => {
    const statusOpts = CONTACT_STATUSES.map(s =>
      `<option value="${s}"${s===c.status?' selected':''}>${s}</option>`
    ).join('');
    const isTBC = c.name.startsWith('TBC');
    return `
      <div class="contact-row" data-contact-id="${c.id}">
        <div class="contact-row-top">
          <div class="contact-name-role">
            <span class="contact-name${isTBC?' contact-tbc':''}">${c.name}</span>
            <span class="contact-role">${c.role}</span>
          </div>
          <button class="contact-delete-btn" data-contact-id="${c.id}" title="Remove contact">✕</button>
        </div>
        <div class="contact-row-meta">
          ${c.instagram && c.instagram !== 'TBC - research needed' ? `<span class="contact-ig">${c.instagram}</span>` : ''}
          ${c.estFollowers ? `<span class="contact-followers">${c.estFollowers}</span>` : ''}
          <span style="display:flex;gap:3px;align-items:center;">${reachabilityBar(c.reachability||0)}</span>
          <span class="contact-method">${c.outreachMethod||''}</span>
        </div>
        <div class="contact-why">${c.whyReachOut||''}</div>
        <div class="contact-row-footer">
          <select class="contact-status-select" data-contact-id="${c.id}">${statusOpts}</select>
          <button class="contact-log-toggle btn-secondary" style="font-size:11px;padding:3px 8px;" data-contact-id="${c.id}">
            Log ${c.log&&c.log.length ? `(${c.log.length})` : ''}
          </button>
        </div>
        <div class="contact-log-area" id="clog_${c.id}" style="display:none;">
          <div class="contact-log-entries" id="clog_entries_${c.id}">
            ${(c.log||[]).map(e=>`
              <div class="log-entry" style="margin-top:6px;">
                <div class="log-entry-header">
                  <span class="log-entry-date">${e.date}</span>
                  <button class="log-delete-btn" data-clog-id="${e.id}" data-contact-id="${c.id}">✕</button>
                </div>
                <div class="log-entry-text">${escHtml(e.note)}</div>
              </div>`).join('')||'<div class="log-empty">No notes yet.</div>'}
          </div>
          <div style="margin-top:8px;display:flex;gap:6px;">
            <textarea class="log-add textarea" id="clog_input_${c.id}" placeholder="Add note..." rows="2" style="flex:1;background:var(--bg4);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px 8px;font-size:12px;font-family:inherit;resize:none;outline:none;"></textarea>
            <button class="btn-primary btn-sm" style="align-self:flex-end;" data-contact-id="${c.id}" onclick="addContactLog('${org.id}','${c.id}')">Add</button>
          </div>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="contacts-section">
      <div class="contacts-section-header">
        <h3>Key Contacts <span style="font-size:11px;color:var(--text-muted);font-weight:400;">(${contacts.length})</span></h3>
        <button class="btn-secondary" id="btnAddContact" style="font-size:11px;padding:4px 10px;">+ Add Contact</button>
      </div>
      ${contacts.length ? `<div class="contact-rows">${rows}</div>` : '<div class="log-empty">No contacts yet. Add the first one.</div>'}
    </div>`;
}

function bindContactEvents(org) {
  // Status changes
  document.querySelectorAll('.contact-status-select').forEach(sel => {
    sel.addEventListener('change', async (e) => {
      const contactId = e.target.dataset.contactId;
      await fetch(`/api/organizations/${activeId}/contacts/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: e.target.value })
      });
      const oi = allData.organizations.findIndex(o => o.id === activeId);
      const ci = allData.organizations[oi].contacts.findIndex(c => c.id === contactId);
      if (ci !== -1) allData.organizations[oi].contacts[ci].status = e.target.value;
    });
  });

  // Log toggles
  document.querySelectorAll('.contact-log-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const area = document.getElementById(`clog_${btn.dataset.contactId}`);
      if (area) area.style.display = area.style.display === 'none' ? 'block' : 'none';
    });
  });

  // Delete contact log entries
  document.querySelectorAll('[data-clog-id]').forEach(btn => {
    btn.addEventListener('click', () => deleteContactLog(activeId, btn.dataset.contactId, btn.dataset.clogId));
  });

  // Delete contacts
  document.querySelectorAll('.contact-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const contactId = btn.dataset.contactId;
      if (!confirm('Remove this contact?')) return;
      await fetch(`/api/organizations/${activeId}/contacts/${contactId}`, { method: 'DELETE' });
      const oi = allData.organizations.findIndex(o => o.id === activeId);
      allData.organizations[oi].contacts = allData.organizations[oi].contacts.filter(c => c.id !== contactId);
      renderPanelFields(allData.organizations[oi]);
      bindContactEvents(allData.organizations[oi]);
    });
  });

  // Add contact
  const addBtn = document.getElementById('btnAddContact');
  if (addBtn) {
    addBtn.addEventListener('click', () => openAddContactModal(activeId));
  }
}

async function addContactLog(orgId, contactId) {
  const input = document.getElementById(`clog_input_${contactId}`);
  const note = input ? input.value.trim() : '';
  if (!note) return;
  const dateInput = document.getElementById('logDate');
  const date = dateInput ? dateInput.value : today();
  const entry = await fetch(`/api/organizations/${orgId}/contacts/${contactId}/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note, date })
  }).then(r => r.json());
  const oi = allData.organizations.findIndex(o => o.id === orgId);
  const ci = allData.organizations[oi].contacts.findIndex(c => c.id === contactId);
  if (ci !== -1) allData.organizations[oi].contacts[ci].log.unshift(entry);
  if (input) input.value = '';
  // Refresh just the entries
  const container = document.getElementById(`clog_entries_${contactId}`);
  if (container) {
    const logs = allData.organizations[oi].contacts[ci].log;
    container.innerHTML = logs.map(e=>`
      <div class="log-entry" style="margin-top:6px;">
        <div class="log-entry-header">
          <span class="log-entry-date">${e.date}</span>
          <button class="log-delete-btn" data-clog-id="${e.id}" data-contact-id="${contactId}" onclick="deleteContactLog('${orgId}','${contactId}','${e.id}')">✕</button>
        </div>
        <div class="log-entry-text">${escHtml(e.note)}</div>
      </div>`).join('');
  }
  // Update toggle button count
  const toggle = document.querySelector(`.contact-log-toggle[data-contact-id="${contactId}"]`);
  if (toggle) toggle.textContent = `Log (${allData.organizations[oi].contacts[ci].log.length})`;
}

async function deleteContactLog(orgId, contactId, logId) {
  await fetch(`/api/organizations/${orgId}/contacts/${contactId}/log/${logId}`, { method: 'DELETE' });
  const oi = allData.organizations.findIndex(o => o.id === orgId);
  const ci = allData.organizations[oi].contacts.findIndex(c => c.id === contactId);
  if (ci !== -1) {
    allData.organizations[oi].contacts[ci].log = allData.organizations[oi].contacts[ci].log.filter(e => String(e.id) !== String(logId));
    const container = document.getElementById(`clog_entries_${contactId}`);
    if (container) {
      const logs = allData.organizations[oi].contacts[ci].log;
      container.innerHTML = logs.length ? logs.map(e=>`
        <div class="log-entry" style="margin-top:6px;">
          <div class="log-entry-header"><span class="log-entry-date">${e.date}</span>
            <button class="log-delete-btn" onclick="deleteContactLog('${orgId}','${contactId}','${e.id}')">✕</button>
          </div>
          <div class="log-entry-text">${escHtml(e.note)}</div>
        </div>`).join('') : '<div class="log-empty">No notes yet.</div>';
    }
  }
}

function openAddContactModal(orgId) {
  document.getElementById('modalTitle').textContent = 'Add Key Contact';
  document.getElementById('modalBody').innerHTML = `
    <div class="form-row">
      <div class="form-group"><label>Name / Search Strategy *</label><input class="form-input" id="fName" placeholder="e.g. Jane Smith or TBC — search #hashtag" /></div>
      <div class="form-group"><label>Role</label><input class="form-input" id="fRole" placeholder="Certified Facilitator, Founder..." /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Instagram</label><input class="form-input" id="fInstagram" /></div>
      <div class="form-group"><label>Est. Followers</label><input class="form-input" id="fFollowers" placeholder="5K-20K" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Reachability (1-5)</label><input class="form-input" id="fReachability" type="number" min="1" max="5" /></div>
      <div class="form-group"><label>Outreach Method</label><input class="form-input" id="fMethod" placeholder="Instagram DM, Email..." /></div>
    </div>
    <div class="form-group"><label>Status</label>
      <select class="form-select" id="fStatus">
        ${CONTACT_STATUSES.map(s=>`<option value="${s}">${s}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label>Why Reach Out</label><textarea class="form-textarea" id="fWhy" rows="2"></textarea></div>
  `;
  // Set save action for contact add
  modalSaveAction = async () => {
    const name = document.getElementById('fName').value.trim();
    if (!name) return;
    const payload = {
      name,
      role: document.getElementById('fRole').value.trim(),
      instagram: document.getElementById('fInstagram').value.trim(),
      estFollowers: document.getElementById('fFollowers').value.trim(),
      reachability: parseInt(document.getElementById('fReachability').value) || 0,
      outreachMethod: document.getElementById('fMethod').value.trim(),
      status: document.getElementById('fStatus').value,
      whyReachOut: document.getElementById('fWhy').value.trim(),
      log: []
    };
    const contact = await fetch(`/api/organizations/${orgId}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(r => r.json());
    const oi = allData.organizations.findIndex(o => o.id === orgId);
    if (!allData.organizations[oi].contacts) allData.organizations[oi].contacts = [];
    allData.organizations[oi].contacts.push(contact);
    closeModalFn();
    // Re-render panel fields
    renderPanelFields(allData.organizations[oi]);
    bindContactEvents(allData.organizations[oi]);
  };
  document.getElementById('modalOverlay').classList.add('active');
}

function renderLogEntries(item) {
  const container = document.getElementById('logEntries');
  if (!item.log || item.log.length === 0) {
    container.innerHTML = '<div class="log-empty">No notes yet.</div>';
    return;
  }
  container.innerHTML = item.log.map(e => `
    <div class="log-entry" data-log-id="${e.id}">
      <div class="log-entry-header">
        <span class="log-entry-date">${e.date}</span>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="log-entry-author">${e.author || 'Craig'}</span>
          <button class="log-delete-btn" data-log-id="${e.id}">✕</button>
        </div>
      </div>
      <div class="log-entry-text">${escHtml(e.note)}</div>
    </div>
  `).join('');

  container.querySelectorAll('.log-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteLogEntry(btn.dataset.logId));
  });
}

async function addLogEntry() {
  const note = document.getElementById('logNote').value.trim();
  if (!note) return;
  const date = document.getElementById('logDate').value || today();
  const endpoint = currentTab === 'practitioners' ? 'practitioners' : currentTab === 'ideas' ? 'ideas' : 'organizations';
  const targetId = activeId;
  const targetTab = currentTab;
  const entry = await fetch(`/api/${endpoint}/${targetId}/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note, date })
  }).then(r => r.json());

  const idx = allData[targetTab].findIndex(d => d.id === targetId);
  if (idx !== -1) allData[targetTab][idx].log.unshift(entry);
  document.getElementById('logNote').value = '';
  setDefaultLogDate();
  if (activeId === targetId) renderLogEntries(allData[targetTab][idx]);
  renderGoalsBar();
}

async function deleteLogEntry(logId) {
  const endpoint = currentTab === 'practitioners' ? 'practitioners' : currentTab === 'ideas' ? 'ideas' : 'organizations';
  const targetId = activeId;
  const targetTab = currentTab;
  await fetch(`/api/${endpoint}/${targetId}/log/${logId}`, { method: 'DELETE' });
  const idx = allData[targetTab].findIndex(d => d.id === targetId);
  if (idx !== -1) {
    allData[targetTab][idx].log = allData[targetTab][idx].log.filter(e => String(e.id) !== String(logId));
    if (activeId === targetId) renderLogEntries(allData[targetTab][idx]);
  }
}

function closePanel() {
  document.getElementById('overlay').classList.remove('active');
  document.getElementById('detailPanel').classList.remove('open');
  activeId = null;
}

// ===== Add Modal =====
function openAddModal() {
  const titles = { practitioners: 'Add Practitioner', organizations: 'Add Organization', ideas: 'New Idea' };
  document.getElementById('modalTitle').textContent = titles[currentTab] || 'Add';
  let formHtml;
  if (currentTab === 'practitioners') formHtml = practitionerForm();
  else if (currentTab === 'ideas') formHtml = ideaForm();
  else formHtml = orgForm();
  document.getElementById('modalBody').innerHTML = formHtml;
  document.getElementById('modalOverlay').classList.add('active');
}

function practitionerForm(data = {}) {
  const statusOptions = PRACTITIONER_STAGES.map(s => `<option value="${s}"${s === (data.status || 'Not Contacted') ? ' selected' : ''}>${s}</option>`).join('');
  const tierOptions = TIER_STAGES.map(t => `<option value="${t}"${t === (data.tier || 'Individual') ? ' selected' : ''}>${t}</option>`).join('');
  const assignedOptions = ['', ...TEAM_MEMBERS].map(m => `<option value="${m}"${m === (data.assigned_to || currentUser) ? ' selected' : ''}>${m || '—'}</option>`).join('');
  const fitChecks = PLATFORM_FIT_OPTIONS.map(f => `<label class="check-item"><input type="checkbox" name="fPlatformFit" value="${f}" ${(data.platform_fit || []).includes(f) ? 'checked' : ''} /> ${f}</label>`).join('');
  return `
    <div class="form-row">
      <div class="form-group"><label>Name *</label><input class="form-input" id="fName" value="${data.name || ''}" /></div>
      <div class="form-group"><label>Email</label><input class="form-input" id="fEmail" value="${data.email || ''}" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Source</label><input class="form-input" id="fSource" value="${data.source || ''}" /></div>
      <div class="form-group"><label>Modality</label><input class="form-input" id="fModality" value="${data.modality || ''}" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Status</label><select class="form-select" id="fStatus">${statusOptions}</select></div>
      <div class="form-group"><label>Warmth</label>
        <select class="form-select" id="fWarmth">
          <option value="">—</option>
          <option value="Hot"${data.warmth === 'Hot' ? ' selected' : ''}>Hot</option>
          <option value="Warm"${data.warmth === 'Warm' ? ' selected' : ''}>Warm</option>
          <option value="Cool"${data.warmth === 'Cool' ? ' selected' : ''}>Cool</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Assigned To</label><select class="form-select" id="fAssigned">${assignedOptions}</select></div>
      <div class="form-group"><label>Channel</label>
        <select class="form-select" id="fChannel">
          <option value="">—</option>
          ${['Email','Instagram DM','LinkedIn','In Person','Other'].map(c => `<option value="${c}"${data.channel === c ? ' selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group"><label>Tier</label><select class="form-select" id="fTier">${tierOptions}</select></div>
    <div class="form-group"><label>Platform Fit</label><div class="field-checkboxes" style="padding:4px 0">${fitChecks}</div></div>
    <div class="form-group"><label>Offering</label><input class="form-input" id="fOffering" value="${data.offering || ''}" /></div>
    <div class="form-group"><label>Notes</label><textarea class="form-textarea" id="fNotes" rows="3">${data.notes || ''}</textarea></div>
  `;
}

function orgForm(data = {}) {
  const statusOptions = ORG_STAGES.map(s => `<option value="${s}"${s === (data.status || 'Not Contacted') ? ' selected' : ''}>${s}</option>`).join('');
  const tierOptions = TIER_STAGES.map(t => `<option value="${t}"${t === (data.tier || 'Organization') ? ' selected' : ''}>${t}</option>`).join('');
  const assignedOptions = ['', ...TEAM_MEMBERS].map(m => `<option value="${m}"${m === (data.assigned_to || currentUser) ? ' selected' : ''}>${m || '—'}</option>`).join('');
  const fitChecks = PLATFORM_FIT_OPTIONS.map(f => `<label class="check-item"><input type="checkbox" name="fPlatformFit" value="${f}" ${(data.platform_fit || []).includes(f) ? 'checked' : ''} /> ${f}</label>`).join('');
  return `
    <div class="form-row">
      <div class="form-group"><label>Organization *</label><input class="form-input" id="fName" value="${data.name || ''}" /></div>
      <div class="form-group"><label>Category</label><input class="form-input" id="fCategory" value="${data.category || ''}" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Priority</label>
        <select class="form-select" id="fPriority">
          <option value="">—</option>
          ${['A+','A','B+','B'].map(p => `<option value="${p}"${data.priority === p ? ' selected' : ''}>${p}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Status</label><select class="form-select" id="fStatus">${statusOptions}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Assigned To</label><select class="form-select" id="fAssigned">${assignedOptions}</select></div>
      <div class="form-group"><label>Channel</label>
        <select class="form-select" id="fChannel">
          <option value="">—</option>
          ${['Email','Instagram DM','LinkedIn','In Person','Other'].map(c => `<option value="${c}"${data.channel === c ? ' selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group"><label>Tier</label><select class="form-select" id="fTier">${tierOptions}</select></div>
    <div class="form-group"><label>Platform Fit</label><div class="field-checkboxes" style="padding:4px 0">${fitChecks}</div></div>
    <div class="form-row">
      <div class="form-group"><label>Key Contact</label><input class="form-input" id="fKeyContact" value="${data.keyContact || ''}" /></div>
      <div class="form-group"><label>Email</label><input class="form-input" id="fEmail" value="${data.email || ''}" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Website</label><input class="form-input" id="fWebsite" value="${data.website || ''}" /></div>
      <div class="form-group"><label>Instagram</label><input class="form-input" id="fInstagram" value="${data.instagram || ''}" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Est. Practitioners</label><input class="form-input" id="fPractitioners" value="${data.estPractitioners || ''}" /></div>
      <div class="form-group"><label>Music Relevance (1-5)</label><input class="form-input" id="fRelevance" type="number" min="1" max="5" value="${data.musicRelevance || ''}" /></div>
    </div>
    <div class="form-group"><label>Why Target</label><textarea class="form-textarea" id="fWhyTarget" rows="2">${data.whyTarget || ''}</textarea></div>
    <div class="form-group"><label>Notes</label><textarea class="form-textarea" id="fNotes" rows="2">${data.notes || ''}</textarea></div>
    <div class="form-group"><label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="fWarm" ${data.warmConnection ? 'checked' : ''} /> Warm Connection</label></div>
  `;
}

function ideaForm(data = {}) {
  const statusOpts = IDEAS_STAGES.map(s => `<option value="${s}"${s === (data.status || 'Brainstormed') ? ' selected' : ''}>${s}</option>`).join('');
  const platOpts = IDEAS_PLATFORMS.map(p => `<option value="${p}"${p === (data.platform || 'General') ? ' selected' : ''}>${p}</option>`).join('');
  const catOpts = ['', ...IDEAS_CATEGORIES].map(c => `<option value="${c}"${c === (data.category || '') ? ' selected' : ''}>${c || '—'}</option>`).join('');
  return `
    <div class="form-group"><label>Title *</label><input class="form-input" id="fName" placeholder="Idea title..." value="${data.title || ''}" /></div>
    <div class="form-row">
      <div class="form-group"><label>Platform</label><select class="form-select" id="fPlatform">${platOpts}</select></div>
      <div class="form-group"><label>Category</label><select class="form-select" id="fCategory">${catOpts}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Status</label><select class="form-select" id="fStatus">${statusOpts}</select></div>
    </div>
    <div class="form-group"><label>Description</label><textarea class="form-textarea" id="fDescription" rows="4" placeholder="What's the idea? Who does it reach? How does it work?">${data.description || ''}</textarea></div>
    <div class="form-group"><label>Notes</label><textarea class="form-textarea" id="fNotes" rows="2">${data.notes || ''}</textarea></div>
  `;
}

async function saveModal() {
  const nameEl = document.getElementById('fName');
  if (!nameEl) { console.error('saveModal: fName not found'); return; }
  const name = nameEl.value.trim();
  if (!name) {
    nameEl.style.border = '1px solid #e57373';
    nameEl.focus();
    return;
  }
  nameEl.style.border = '';

  const saveBtn = document.getElementById('btnModalSave');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }

  try {

  let payload = {};
  if (currentTab === 'ideas') {
    payload = {
      title: name,
      platform: document.getElementById('fPlatform').value,
      category: document.getElementById('fCategory').value,
      status: document.getElementById('fStatus').value,
      description: document.getElementById('fDescription').value.trim(),
      notes: document.getElementById('fNotes').value.trim(),
      log: []
    };
    const r = await fetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error(`Server error ${r.status}`);
    const res = await r.json();
    allData.ideas.push(res);
    closeModalFn();
    renderFilterBar();
    renderMain();
    return;
  } else if (currentTab === 'practitioners') {
    const fitSelected = Array.from(document.querySelectorAll('input[name="fPlatformFit"]:checked')).map(c => c.value);
    payload = {
      name,
      email: document.getElementById('fEmail').value.trim(),
      source: document.getElementById('fSource').value.trim(),
      modality: document.getElementById('fModality').value.trim(),
      status: document.getElementById('fStatus').value,
      warmth: document.getElementById('fWarmth').value,
      assigned_to: document.getElementById('fAssigned').value,
      tier: document.getElementById('fTier').value,
      platform_fit: fitSelected,
      channel: document.getElementById('fChannel') ? document.getElementById('fChannel').value : '',
      offering: document.getElementById('fOffering').value.trim(),
      notes: document.getElementById('fNotes').value.trim(),
      accountCreated: false, demo: false, followUp: false, log: []
    };
  } else {
    const fitSelected = Array.from(document.querySelectorAll('input[name="fPlatformFit"]:checked')).map(c => c.value);
    payload = {
      name,
      category: document.getElementById('fCategory').value.trim(),
      priority: document.getElementById('fPriority').value,
      status: document.getElementById('fStatus').value,
      assigned_to: document.getElementById('fAssigned').value,
      tier: document.getElementById('fTier').value,
      platform_fit: fitSelected,
      keyContact: document.getElementById('fKeyContact').value.trim(),
      email: document.getElementById('fEmail').value.trim(),
      website: document.getElementById('fWebsite').value.trim(),
      instagram: document.getElementById('fInstagram').value.trim(),
      estPractitioners: document.getElementById('fPractitioners').value.trim(),
      musicRelevance: parseInt(document.getElementById('fRelevance').value) || 0,
      whyTarget: document.getElementById('fWhyTarget').value.trim(),
      notes: document.getElementById('fNotes').value.trim(),
      channel: document.getElementById('fChannel') ? document.getElementById('fChannel').value : '',
      warmConnection: document.getElementById('fWarm').checked,
      log: []
    };
  }

  const endpoint = currentTab === 'practitioners' ? 'practitioners' : 'organizations';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  let r;
  try {
    r = await fetch(`/api/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    });
  } finally {
    clearTimeout(timer);
  }
  if (!r.ok) throw new Error(`Server error ${r.status}`);
  const res = await r.json();
  allData[currentTab].push(res);
  closeModalFn();
  renderFilterBar();
  renderMain();

  } catch (err) {
    console.error('saveModal error:', err);
    alert('Save failed: ' + err.message);
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
  }
}

function closeModalFn() {
  document.getElementById('modalOverlay').classList.remove('active');
  const saveBtn = document.getElementById('btnModalSave');
  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save'; }
  modalSaveAction = null;
}

// ===== Utility =====
function today() {
  return new Date().toISOString().split('T')[0];
}

function setDefaultLogDate() {
  const input = document.getElementById('logDate');
  if (input) input.value = today();
}

function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ===== Event Bindings =====
function bindGlobalEvents() {
  // User selector
  const userSel = document.getElementById('userSelect');
  if (userSel) {
    userSel.value = currentUser;
    userSel.addEventListener('change', e => {
      currentUser = e.target.value;
      localStorage.setItem('sc_user', currentUser);
      showMineOnly = true;
      localStorage.setItem('sc_mine', 'true');
      renderFilterBar();
      renderMain();
    });
  }

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      const addLabels = { ideas: '+ New Idea' };
      document.getElementById('btnAdd').textContent = addLabels[currentTab] || '+ Add';
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filters = { status: '', category: '', priority: '', warmth: '' };
      searchQuery = '';
      document.getElementById('searchInput').value = '';
      closePanel();
      renderFilterBar();
      renderMain();
    });
  });

  // Search
  document.getElementById('searchInput').addEventListener('input', e => {
    searchQuery = e.target.value;
    renderMain();
  });

  // Panel close
  document.getElementById('closePanel').addEventListener('click', closePanel);
  document.getElementById('overlay').addEventListener('click', closePanel);

  // Add log note
  document.getElementById('btnAddLog').addEventListener('click', addLogEntry);
  document.getElementById('logNote').addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addLogEntry();
  });

  // Add button
  document.getElementById('btnAdd').addEventListener('click', openAddModal);
  document.getElementById('closeModal').addEventListener('click', closeModalFn);
  document.getElementById('btnModalCancel').addEventListener('click', closeModalFn);
  document.getElementById('btnModalSave').addEventListener('click', () => {
    if (modalSaveAction) { modalSaveAction(); return; }
    saveModal();
  });
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) closeModalFn();
  });

  // Theme toggle
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('sc_theme', currentTheme);
      applyTheme();
    });
  }
}

function bindIdeaTooltips() {
  const tooltip = document.getElementById('idea-tooltip');
  if (!tooltip) return;
  document.querySelectorAll('.card[data-desc]').forEach(card => {
    card.addEventListener('mouseenter', (e) => {
      const desc = card.dataset.desc;
      if (!desc) return;
      tooltip.textContent = desc;
      tooltip.classList.add('visible');
      positionTooltip(e, tooltip);
    });
    card.addEventListener('mousemove', (e) => {
      positionTooltip(e, tooltip);
    });
    card.addEventListener('mouseleave', () => {
      tooltip.classList.remove('visible');
    });
  });
}

function positionTooltip(e, tooltip) {
  const pad = 16;
  let x = e.clientX + pad;
  let y = e.clientY + pad;
  if (x + 270 > window.innerWidth) x = e.clientX - 270 - pad;
  if (y + 180 > window.innerHeight) y = e.clientY - 180;
  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
}

function bindCardClicks() {
  // Click handler — open panel (only if not dragging)
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('mousedown', e => {
      card._mouseDownPos = { x: e.clientX, y: e.clientY };
    });
    card.addEventListener('click', e => {
      if (card._wasDragged) {
        card._wasDragged = false;
        return;
      }
      openPanel(card.dataset.id);
    });
  });
}

// ===== Document-level Drag & Drop =====
let draggedId = null;

document.addEventListener('dragstart', e => {
  const card = e.target.closest('.card');
  if (!card) return;
  draggedId = card.dataset.id;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedId);
  card._wasDragged = true;
  requestAnimationFrame(() => { card.style.opacity = '0.4'; card.classList.add('dragging'); });
});

document.addEventListener('dragend', e => {
  const card = e.target.closest('.card');
  if (card) {
    card.style.opacity = '';
    card.classList.remove('dragging');
  }
  draggedId = null;
  document.querySelectorAll('.pipeline-cards').forEach(c => c.classList.remove('drag-over'));
});

document.addEventListener('dragover', e => {
  if (!draggedId) return;
  let col = e.target.closest('.pipeline-cards');
  if (!col) {
    const parentCol = e.target.closest('.pipeline-col');
    if (parentCol) col = parentCol.querySelector('.pipeline-cards');
  }
  if (!col) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.pipeline-cards').forEach(c => {
    if (c === col) c.classList.add('drag-over');
    else c.classList.remove('drag-over');
  });
});

document.addEventListener('drop', async e => {
  let col = e.target.closest('.pipeline-cards');
  if (!col) {
    const parentCol = e.target.closest('.pipeline-col');
    if (parentCol) col = parentCol.querySelector('.pipeline-cards');
  }
  if (!col || !draggedId) return;
  e.preventDefault();
  document.querySelectorAll('.pipeline-cards').forEach(c => c.classList.remove('drag-over'));
  const id = draggedId;
  const newStage = col.dataset.stage;
  const colMode = col.dataset.mode || 'status';
  draggedId = null;
  if (!id || !newStage) return;
  const endpoint = currentTab === 'practitioners' ? 'practitioners' : currentTab === 'ideas' ? 'ideas' : 'organizations';
  const updateField = colMode === 'tier' ? 'tier' : 'status';
  await fetch(`/api/${endpoint}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [updateField]: newStage })
  });
  const idx = allData[currentTab].findIndex(d => d.id === id);
  if (idx !== -1) allData[currentTab][idx][updateField] = newStage;
  renderMain();
})

function isThisWeek(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0,0,0,0);
  return d >= startOfWeek;
}

// ===== Go =====
init();
