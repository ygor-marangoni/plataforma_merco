const STORAGE_KEYS = {
  clients: 'merco_clients',
  projects: 'merco_projects',
  tasks: 'merco_tasks',
  proposals: 'merco_proposals',
  contracts: 'merco_contracts',
  charges: 'merco_charges',
  settings: 'merco_settings',
};

const PROJECT_STATUSES = ['Lead', 'Em desenvolvimento', 'Aguardando cliente', 'Concluído'];
const PROJECT_URGENCIES = ['Baixa', 'Média', 'Alta', 'Crítica'];
const PROJECT_COLORS = [
  '#1F7A8C',
  '#0F4C81',
  '#2C7A7B',
  '#9B2C2C',
  '#7B341E',
  '#9D174D',
  '#6B21A8',
  '#4C1D95',
  '#1E3A8A',
  '#0F172A',
  '#14532D',
  '#166534',
  '#115E59',
  '#0E7490',
  '#155E75',
  '#1D4ED8',
  '#1E40AF',
  '#4338CA',
  '#6B7280',
  '#4B5563',
];

function colorWithAlpha(hex, alpha = 0.1) {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const state = {
  clients: [],
  projects: [],
  tasks: [],
  proposals: [],
  contracts: [],
  charges: [],
  projectView: 'board',
  hideClients: false,
  hideProjects: false,
  settings: {
    theme: 'light',
    accent: '#d85747',
    avatar: '🙋‍♂️',
    section: 'dashboard',
    projectView: 'board',
  },
};

const projectModalRefs = {
  modal: null,
  form: null,
  backdrop: null,
  nameInput: null,
  title: null,
  coverInput: null,
  coverPreview: null,
  coverValue: null,
  techChips: [],
};
let selectedTechs = new Set();

const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => [...document.querySelectorAll(sel)];

function uuid() {
  return (
    (crypto.randomUUID && crypto.randomUUID()) ||
    `id-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 8)}`
  );
}

function loadState() {
  state.clients = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.clients) || '[]',
  );
  state.projects = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.projects) || '[]',
  );
  state.tasks = JSON.parse(localStorage.getItem(STORAGE_KEYS.tasks) || '[]');
  state.proposals = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.proposals) || '[]',
  );
  state.contracts = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.contracts) || '[]',
  );
  state.charges = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.charges) || '[]',
  );
  const savedSettings = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.settings) || '{}',
  );
  state.settings = {
    theme: savedSettings.theme || 'light',
    accent: savedSettings.accent || '#d85747',
    avatar: savedSettings.avatar || '🙋‍♂️',
    section: savedSettings.section || 'dashboard',
    projectView: savedSettings.projectView || 'board',
  };
  state.projectView = state.settings.projectView || 'board';
  ensureProjectColors();
}

function persist(key, data) {
  localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(data));
}

function persistSettings() {
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
}

function applyTheme() {
  document.body.classList.toggle('dark-theme', state.settings.theme === 'dark');
  document.body.classList.toggle(
    'light-theme',
    state.settings.theme === 'light',
  );
  document.documentElement.style.setProperty('--accent', state.settings.accent);
  document.documentElement.style.setProperty(
    '--accent-2',
    state.settings.accent,
  );
  highlightThemeButtons();
  [qs('#accent-picker'), qs('#accent-picker-config')].forEach(
    (input) => input && (input.value = state.settings.accent),
  );
  applyAvatar();
}

function highlightThemeButtons() {
  qsa('button[data-theme]').forEach((btn) => {
    const active = btn.dataset.theme === state.settings.theme;
    btn.classList.toggle('btn-primary', active);
    btn.disabled = active;
  });
}

function handleNavigation() {
  qsa('.nav-card').forEach((item) => {
    item.addEventListener('click', () => {
      const target = item.dataset.section;
      setActiveSection(target);
    });
  });
}

function formatCurrency(value) {
  const num = Number(value || 0);
  return Number.isNaN(num)
    ? 'R$ 0,00'
    : num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('pt-BR') : 'Sem data';
}

function emptyState(text, className = 'list-card') {
  const div = document.createElement('div');
  div.className = className;
  div.textContent = text;
  return div;
}

function clientName(id) {
  const c = state.clients.find((cl) => cl.id === id);
  return c ? c.name : 'Sem cliente';
}

function getClientPhone(id) {
  const c = state.clients.find((cl) => cl.id === id);
  return c?.phone || 'Sem telefone';
}

function projectName(id) {
  const p = state.projects.find((pr) => pr.id === id);
  return p ? p.name : 'Sem projeto';
}

function updateClientOptions() {
  const selects = [
    { el: qs('#projeto-cliente'), placeholder: 'Selecione um cliente' },
    { el: qs('#projeto-filtro-cliente'), placeholder: 'Todos' },
    {
      el: qs('#proposta-cliente'),
      placeholder: 'Selecione um cliente (opcional)',
    },
    {
      el: qs('#contrato-cliente'),
      placeholder: 'Selecione um cliente (opcional)',
    },
    {
      el: qs('#cobranca-cliente'),
      placeholder: 'Selecione um cliente (opcional)',
    },
  ];
  selects.forEach(({ el, placeholder }) => {
    if (!el) return;
    el.innerHTML = '';
    const def = document.createElement('option');
    def.value = '';
    def.textContent = placeholder;
    el.appendChild(def);
    state.clients.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      el.appendChild(opt);
    });
  });
}

function updateProjectOptions() {
  const selects = [
    { el: qs('#tarefa-projeto'), placeholder: 'Relacionar projeto (opcional)' },
    { el: qs('#tarefa-filtro-projeto'), placeholder: 'Todos' },
  ];
  selects.forEach(({ el, placeholder }) => {
    if (!el) return;
    el.innerHTML = '';
    const def = document.createElement('option');
    def.value = '';
    def.textContent = placeholder;
    el.appendChild(def);
    state.projects.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      el.appendChild(opt);
    });
  });
}

function ensureOption(select, value, label) {
  if (!select || !value) return;
  const exists = [...select.options].some((o) => o.value === value);
  if (!exists) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label || value;
    select.appendChild(opt);
  }
}

function syncProjectStatusSelects() {
  const statuses = [...PROJECT_STATUSES];
  const statusSelect = qs('#projeto-status');
  const filterSelect = qs('#projeto-filtro-status');
  const currentFilter = filterSelect?.value || '';
  statuses.forEach((status) => {
    ensureOption(statusSelect, status, status);
  });
  if (filterSelect) {
    filterSelect.innerHTML = '';
    const priorities = ['', ...PROJECT_URGENCIES];
    priorities.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p ? p : 'Todas urgências';
      filterSelect.appendChild(opt);
    });
    filterSelect.value = currentFilter;
  }
}

function resetProjectModal() {
  if (!projectModalRefs.form) return;
  projectModalRefs.form.reset();
  qs('#projeto-id').value = '';
  qs('#projeto-modal-title').textContent = 'Novo projeto';
  qs('#projeto-form-modal button[type="submit"]').textContent =
    'Salvar projeto';
  selectedTechs = new Set();
  syncTechChips();
  setCoverPreview('');
}

function syncTechChips() {
  projectModalRefs.techChips.forEach((chip) => {
    const active = selectedTechs.has(chip.dataset.tech);
    chip.classList.toggle('active', active);
  });
  qs('#projeto-techs-value').value = JSON.stringify([...selectedTechs]);
}

function setSelectedTechs(list = []) {
  selectedTechs = new Set(list);
  syncTechChips();
}

function getSelectedTechs() {
  try {
    const parsed = JSON.parse(qs('#projeto-techs-value').value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function setCoverPreview(dataUrl = '') {
  const preview = projectModalRefs.coverPreview;
  if (!preview) return;
  const placeholder = preview.querySelector('.cover-placeholder');
  if (dataUrl) {
    preview.style.backgroundImage = `url(${dataUrl})`;
    preview.classList.add('has-image');
    if (placeholder) placeholder.classList.add('hidden');
    qs('#projeto-capa-base64').value = dataUrl;
  } else {
    preview.style.backgroundImage = 'none';
    preview.classList.remove('has-image');
    if (placeholder) placeholder.classList.remove('hidden');
    qs('#projeto-capa-base64').value = '';
  }
}

function showProjectModal() {
  if (!projectModalRefs.modal) return;
  projectModalRefs.modal.classList.remove('hidden');
  lockScroll();
  setTimeout(() => projectModalRefs.nameInput?.focus(), 50);
}

function hideProjectModal() {
  if (!projectModalRefs.modal) return;
  projectModalRefs.modal.classList.add('hidden');
  unlockScroll();
}

function collectProjectPayload() {
  const id = qs('#projeto-id').value || uuid();
  const name = (qs('#projeto-nome').value || '').trim();
  const clientId = qs('#projeto-cliente').value;
  const status = qs('#projeto-status').value;
  const urgency = qs('#projeto-urgencia').value;
  const deadline = qs('#projeto-entrega').value;
  const valueRaw = qs('#projeto-valor').value;
  const description = (qs('#projeto-descricao').value || '').trim();
  const techs = getSelectedTechs();
  const cover = qs('#projeto-capa-base64').value || '';
  const value = Number((valueRaw || '0').toString().replace(',', '.'));

  const missing = [];
  if (!name) missing.push('Nome');
  if (!clientId) missing.push('Cliente');
  if (!status) missing.push('Status');
  if (!urgency) missing.push('Urgência');
  if (!deadline) missing.push('Entrega');
  if (valueRaw === '') missing.push('Valor');
  if (missing.length) {
    alert(`Preencha: ${missing.join(', ')}.`);
    return null;
  }

  return {
    id,
    name,
    clientId,
    status,
    urgency,
    deadline,
    value: Number.isNaN(value) ? 0 : value,
    description,
    techs,
    cover,
  };
}

function showToast(message) {
  const stack = qs('#toast-stack');
  if (!stack) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  stack.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function setupProjectModal() {
  projectModalRefs.modal = qs('.project-modal');
  projectModalRefs.form = qs('#projeto-form-modal');
  projectModalRefs.backdrop =
    projectModalRefs.modal?.querySelector('.modal-backdrop');
  projectModalRefs.nameInput = qs('#projeto-nome');
  projectModalRefs.title = qs('#projeto-modal-title');
  projectModalRefs.coverInput = qs('#projeto-capa');
  projectModalRefs.coverPreview = qs('#projeto-capa-preview');
  projectModalRefs.coverValue = qs('#projeto-capa-base64');
  projectModalRefs.techChips = qsa('#projeto-techs .chip');
  if (!projectModalRefs.modal || !projectModalRefs.form) return;

  qsa('.open-project-modal').forEach((btn) => {
    btn.addEventListener('click', () => {
      resetProjectModal();
      showProjectModal();
    });
  });

  const closeProject = () => hideProjectModal();
  [...projectModalRefs.modal.querySelectorAll('.close-project-modal')].forEach(
    (btn) => btn.addEventListener('click', closeProject),
  );
  projectModalRefs.backdrop?.addEventListener('click', closeProject);
  document.addEventListener('keydown', (e) => {
    if (
      e.key === 'Escape' &&
      !projectModalRefs.modal.classList.contains('hidden')
    )
      closeProject();
  });

  projectModalRefs.techChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const tech = chip.dataset.tech;
      if (selectedTechs.has(tech)) selectedTechs.delete(tech);
      else selectedTechs.add(tech);
      syncTechChips();
    });
  });

  projectModalRefs.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = collectProjectPayload();
    if (!data) return;
    const exists = state.projects.some((p) => p.id === data.id);
    const existing = state.projects.find((p) => p.id === data.id) || {};
    const payload = {
      ...existing,
      ...data,
      createdAt: existing.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    state.projects = exists
      ? state.projects.map((p) => (p.id === data.id ? payload : p))
      : [...state.projects, payload];
    persist('projects', state.projects);
    resetProjectModal();
    hideProjectModal();
    renderProjects();
    renderTasks();
    renderDashboard();
    const msg = exists
      ? 'Projeto atualizado com sucesso!'
      : 'Projeto criado com sucesso!';
    showToast(msg);
  });

  projectModalRefs.coverInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCoverPreview(ev.target.result);
    reader.readAsDataURL(file);
  });

  const triggerCoverSelect = () => projectModalRefs.coverInput?.click();
  projectModalRefs.coverPreview?.addEventListener('click', triggerCoverSelect);
  projectModalRefs.coverPreview?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      triggerCoverSelect();
    }
  });
  projectModalRefs.modal
    .querySelector('.clear-cover')
    ?.addEventListener('click', () => setCoverPreview(''));
  syncTechChips();
}

function setupDeleteProjectModal() {
  const modal = qs('.confirm-delete-project-modal');
  if (!modal) return;
  const backdrop = modal.querySelector('.modal-backdrop');
  const closeBtns = modal.querySelectorAll('.close-delete-project-modal');
  const confirmBtn = modal.querySelector('.confirm-delete-project');

  const close = () => hideDeleteProjectModal();
  backdrop?.addEventListener('click', close);
  closeBtns.forEach((btn) => btn.addEventListener('click', close));
  confirmBtn?.addEventListener('click', () => {
    const id = modal.dataset.id;
    if (id) deleteProject(id);
  });
}

function renderRecentList(list, containerId, templateFn) {
  const container = qs(`#${containerId}`);
  container.innerHTML = '';
  if (!list.length) {
    container.appendChild(emptyState('Sem itens ainda.'));
    return;
  }
  [...list]
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 3)
    .forEach((item) => {
      const card = document.createElement('div');
      card.className = 'list-card';
      card.innerHTML = templateFn(item);
      container.appendChild(card);
    });
}

function renderDashboard() {
  qs('#summary-clientes').textContent = state.clients.length;
  qs('#summary-projetos').textContent = state.projects.filter(
    (p) => p.status !== 'Concluído' && p.status !== 'Arquivado',
  ).length;
  qs('#summary-tarefas').textContent = state.tasks.filter(
    (t) => t.status !== 'Concluída',
  ).length;
  qs('#summary-propostas').textContent = state.proposals.filter(
    (p) => p.status === 'Em aberto',
  ).length;
  qs('#summary-cobrancas').textContent = state.charges.filter(
    (c) => c.status === 'Pendente',
  ).length;

  renderRecentList(state.projects, 'recent-projetos', (item) => {
    return `<div class="title-row"><strong>${
      item.name || 'Sem nome'
    }</strong><span class="pill-tag">${item.status || 'Sem status'}</span></div>
            <div class="meta">Cliente: <strong>${clientName(
              item.clientId,
            )}</strong> · Prazo: <strong>${formatDate(
      item.deadline,
    )}</strong></div>`;
  });

  renderRecentList(state.tasks, 'recent-tarefas', (item) => {
    return `<div class="title-row"><strong>${
      item.title || 'Tarefa sem título'
    }</strong><span class="pill-tag">${item.status}</span></div>
            <div class="meta">Projeto: <strong>${projectName(
              item.projectId,
            )}</strong> · Limite: <strong>${formatDate(
      item.dueDate,
    )}</strong></div>`;
  });
}

function renderClients() {
  const container = qs('#clientes-lista');
  container.innerHTML = '';
  const searchInput = (qs('#cliente-busca').value || '').toLowerCase().trim();
  const filtered = sequentialSearchByName(searchInput, state.clients);

  const totalEl = qs('#clientes-total');
  if (totalEl) totalEl.textContent = state.clients.length;

  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.className = 'table-row empty-row';
    empty.innerHTML = `<div>Nenhum cliente cadastrado ainda.</div>`;
    container.appendChild(empty);
  }

  filtered.forEach((client) => {
    const mask = (val, placeholder = 'Sem informação') => val || placeholder;
    const row = document.createElement('div');
    row.className = 'table-row';
    row.innerHTML = `
      <div>${mask(client.name, 'Sem nome')}</div>
      <div>${mask(client.type, 'Sem tipo')}</div>
      <div>${mask(client.email, 'Sem e-mail')}</div>
      <div>${mask(client.phone, 'Sem telefone')}</div>
      <div>${mask(client.document, 'Sem documento')}</div>
      <div class="align-right actions">
        <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${
          client.id
        }">Editar</button>
        <button class="btn btn-danger-soft btn-sm" data-action="delete" data-id="${
          client.id
        }" data-name="${client.name}">Excluir</button>
      </div>
    `;
    container.appendChild(row);
  });

  container.onclick = (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'edit') fillClientForm(id);
    if (btn.dataset.action === 'delete')
      promptDeleteClient(id, btn.dataset.name || 'este cliente');
  };
  updateClientOptions();
  renderDashboard();
}

function sequentialSearchByName(term, list) {
  if (!term) return [...list];
  const results = [];
  for (let i = 0; i < list.length; i += 1) {
    const name = (list[i].name || '').toLowerCase();
    if (name.includes(term)) {
      results.push(list[i]);
    }
  }
  return results;
}
function fillClientForm(id) {
  const client = state.clients.find((c) => c.id === id);
  if (!client) return;
  qs('#cliente-id').value = client.id;
  qs('#cliente-nome').value = client.name;
  qs('#cliente-tipo').value = client.type;
  qs('#cliente-email').value = client.email;
  qs('#cliente-telefone').value = client.phone;
  qs('#cliente-doc').value = client.document || '';
  qs('#cliente-form button[type="submit"]').textContent = 'Atualizar cliente';
  showClientModal();
}

function deleteClient(id) {
  state.clients = state.clients.filter((c) => c.id !== id);
  persist('clients', state.clients);
  updateClientOptions();
  renderClients();
  renderProjects();
  renderProposals();
  renderContracts();
  renderCharges();
  renderDashboard();
  hideDeleteClientModal();
}

function renderProjects() {
  const listContainer = qs('#projetos-lista');
  const boardContainer = qs('#projetos-board');
  listContainer.innerHTML = '';
  boardContainer.innerHTML = '';
  syncProjectStatusSelects();
  const filterPriority = qs('#projeto-filtro-status').value;
  const filterClient = qs('#projeto-filtro-cliente').value;
  const filtered = state.projects.filter((p) => {
    const priorityMatch = filterPriority ? p.urgency === filterPriority : true;
    const clientMatch = filterClient ? p.clientId === filterClient : true;
    return priorityMatch && clientMatch;
  });
  const ordered = [...filtered].sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
  );
  ensureProjectColors();

  if (!filtered.length && state.projectView === 'list') {
    const empty = document.createElement('div');
    empty.className = 'table-row empty-row';
    empty.innerHTML = `<div>Nenhum projeto cadastrado.</div>`;
    listContainer.appendChild(empty);
  }
  ordered.forEach((project) => {
    const row = document.createElement('div');
    row.className = 'table-row';
    row.innerHTML = `
      <div>
        <div class="title-row">
          <strong>${project.name || 'Sem nome'}</strong>
        </div>
      </div>
      <div>${clientName(project.clientId)}</div>
      <div>${getClientPhone(project.clientId)}</div>
      <div>${formatDate(project.deadline)}</div>
      <div><span class="pill-tag small neutral">${project.status || 'Sem status'}</span></div>
      <div>${project.urgency || '—'}</div>
      <div class="align-right actions">
        <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${
          project.id
        }">Editar</button>
        <button class="btn btn-danger-soft btn-sm" data-action="delete" data-id="${
          project.id
        }">Excluir</button>
      </div>
    `;
    listContainer.appendChild(row);
  });

  listContainer.onclick = (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'edit') fillProjectForm(id);
    if (btn.dataset.action === 'delete') promptDeleteProject(id);
  };

  const columns = Array.from(
    new Set([
      ...PROJECT_STATUSES,
      ...filtered.map((p) => p.status).filter(Boolean),
    ]),
  );
  columns.forEach((status) => {
    const col = document.createElement('div');
    col.className = 'board-column';
    const heading = document.createElement('h3');
    heading.textContent = status;
    col.appendChild(heading);
    const dropzone = document.createElement('div');
    dropzone.className = 'board-dropzone';
    dropzone.dataset.status = status;
    const items = ordered.filter((p) => p.status === status);
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'meta';
      empty.textContent = 'Sem projetos';
      dropzone.appendChild(empty);
    } else {
      items.forEach((project) => {
        const card = document.createElement('div');
        card.className = 'board-item';
        card.dataset.id = project.id;
        const color = getProjectColor(project.id);
        const bgSoft = colorWithAlpha(color, 0.08);
        const bgLighter = colorWithAlpha(color, 0.02);
        card.style.borderColor = color;
        card.style.background = `linear-gradient(135deg, ${bgSoft}, ${bgLighter})`;
        const techPreview = (project.techs || []).slice(0, 3);
        const desc =
          (project.description || '').length > 85
            ? `${project.description.slice(0, 85)}...`
            : project.description || '';
        card.innerHTML = `
          ${project.cover ? `<div class="board-cover" style="background-image:url(${project.cover})"></div>` : ''}
          <div class="board-item-title">
            <strong style="color:${color}">${project.name}</strong>
            <div class="board-item-tags">
              <span class="pill-tag soft small" style="color:${color};border-color:${color};background:${colorWithAlpha(color, 0.16)}">${project.urgency || '—'}</span>
            </div>
          </div>
          <div class="board-item-meta">
            <span>Cliente: <strong>${clientName(project.clientId)}</strong></span>
            <span>Urgência: <strong>${project.urgency || '—'}</strong></span>
            <span>Prazo: <strong>${formatDate(project.deadline)}</strong></span>
          </div>
          ${desc ? `<p class="board-desc">${desc}</p>` : ''}
          ${
            techPreview.length
              ? `<div class="board-techs">${techPreview
                  .map((t) => `<span class="chip mini">${t}</span>`)
                  .join('')}</div>`
              : ''
          }
        `;
        dropzone.appendChild(card);
      });
    }
    col.appendChild(dropzone);
    boardContainer.appendChild(col);
  });
  initProjectDrag();
  toggleProjectView(state.projectView);
  updateProjectOptions();
  renderDashboard();
}

function fillProjectForm(id) {
  const project = state.projects.find((p) => p.id === id);
  if (!project) return;
  resetProjectModal();
  qs('#projeto-modal-title').textContent = 'Editar projeto';
  qs('#projeto-id').value = project.id;
  qs('#projeto-nome').value = project.name || '';
  ensureOption(
    qs('#projeto-cliente'),
    project.clientId,
    clientName(project.clientId),
  );
  qs('#projeto-cliente').value = project.clientId || '';
  ensureOption(qs('#projeto-status'), project.status, project.status);
  qs('#projeto-status').value = project.status || PROJECT_STATUSES[0];
  qs('#projeto-urgencia').value = project.urgency || PROJECT_URGENCIES[0];
  qs('#projeto-entrega').value = project.deadline || '';
  qs('#projeto-valor').value = project.value || '';
  qs('#projeto-descricao').value = project.description || '';
  setSelectedTechs(project.techs || []);
  setCoverPreview(project.cover || '');
  qs('#projeto-form-modal button[type="submit"]').textContent =
    'Atualizar projeto';
  showProjectModal();
}

function updateProjectStatus(id, status) {
  const exists = state.projects.some((p) => p.id === id);
  if (!exists) return;
  state.projects = state.projects.map((p) =>
    p.id === id ? { ...p, status } : p,
  );
  persist('projects', state.projects);
}

function ensureProjectColors() {
  let changed = false;
  const assigned = new Set();
  const palette = [...PROJECT_COLORS];
  let paletteIndex = 0;

  state.projects = state.projects.map((p) => {
    if (p.tagColor && !assigned.has(p.tagColor)) {
      assigned.add(p.tagColor);
      return p;
    }
    let color = '';
    // choose an unused palette color if available
    while (paletteIndex < palette.length && assigned.has(palette[paletteIndex])) {
      paletteIndex += 1;
    }
    if (paletteIndex < palette.length) {
      color = palette[paletteIndex];
      paletteIndex += 1;
    } else {
      // fallback: pick a random not-yet-used or cycle
      const remaining = palette.filter((c) => !assigned.has(c));
      color = remaining.length
        ? remaining[Math.floor(Math.random() * remaining.length)]
        : palette[assigned.size % palette.length];
    }
    assigned.add(color);
    changed = true;
    return { ...p, tagColor: color };
  });
  if (changed) persist('projects', state.projects);
}

function getProjectColor(id) {
  const project = state.projects.find((p) => p.id === id);
  return project?.tagColor || PROJECT_COLORS[0];
}

function promptDeleteProject(id) {
  const modal = qs('.confirm-delete-project-modal');
  if (!modal) return;
  const nameEl = modal.querySelector('#delete-project-name');
  const project = state.projects.find((p) => p.id === id);
  if (nameEl) nameEl.textContent = project?.name || 'este projeto';
  modal.dataset.id = id;
  modal.classList.remove('hidden');
  lockScroll();
}

function hideDeleteProjectModal() {
  const modal = qs('.confirm-delete-project-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.dataset.id = '';
  unlockScroll();
}

function initProjectDrag() {
  if (typeof Sortable === 'undefined') return;
  qsa('.board-dropzone').forEach((zone) => {
    if (zone.dataset.sortableInit) return;
    zone.dataset.sortableInit = '1';
    new Sortable(zone, {
      group: 'projetos-board',
      animation: 150,
      ghostClass: 'drag-ghost',
      dragClass: 'dragging',
      fallbackOnBody: true,
      swapThreshold: 0.65,
      forceFallback: true,
      direction: 'vertical',
      onAdd: (evt) => {
        const id = evt.item.dataset.id;
        const target = evt.to.dataset.status;
        if (!id || !target) return;
        if (target !== (evt.from.dataset.status || '')) {
          updateProjectStatus(id, target);
        }
      },
      onStart: (evt) => {
        const placeholder = evt.from.querySelector('.meta');
        if (placeholder && placeholder.textContent === 'Sem projetos') {
          placeholder.remove();
        }
      },
      onEnd: () => {
        renderProjects();
        renderDashboard();
      },
    });
  });
}

function deleteProject(id) {
  state.projects = state.projects.filter((p) => p.id !== id);
  persist('projects', state.projects);
  updateProjectOptions();
  renderProjects();
  renderTasks();
  renderDashboard();
  hideDeleteProjectModal();
}

function renderTasks() {
  const container = qs('#tarefas-lista');
  container.innerHTML = '';
  const statusFilter = qs('#tarefa-filtro-status').value;
  const projectFilter = qs('#tarefa-filtro-projeto').value;
  const filtered = state.tasks.filter((t) => {
    const statusMatch = statusFilter ? t.status === statusFilter : true;
    const projectMatch = projectFilter ? t.projectId === projectFilter : true;
    return statusMatch && projectMatch;
  });

  if (!filtered.length)
    container.appendChild(emptyState('Nenhuma tarefa cadastrada.'));
  filtered.forEach((task) => {
    const card = document.createElement('div');
    card.className = 'list-card';
    card.innerHTML = `
      <div class="title-row">
        <h3>${task.title}</h3>
        <span class="pill-tag">${task.priority}</span>
      </div>
      <div class="meta">
        <span>Status: <strong>${task.status}</strong></span>
        <span>Projeto: <strong>${projectName(task.projectId)}</strong></span>
        <span>Limite: <strong>${formatDate(task.dueDate)}</strong></span>
      </div>
      <div class="actions">
        <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${
          task.id
        }">Editar</button>
        <button class="btn btn-danger-soft btn-sm" data-action="delete" data-id="${
          task.id
        }">Excluir</button>
      </div>
    `;
    container.appendChild(card);
  });

  container.onclick = (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'edit') fillTaskForm(id);
    if (btn.dataset.action === 'delete') deleteTask(id);
  };
  renderDashboard();
}

function fillTaskForm(id) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;
  qs('#tarefa-id').value = task.id;
  qs('#tarefa-titulo').value = task.title;
  qs('#tarefa-projeto').value = task.projectId || '';
  qs('#tarefa-status').value = task.status;
  qs('#tarefa-prioridade').value = task.priority;
  qs('#tarefa-limite').value = task.dueDate || '';
  qs('#tarefa-form button[type="submit"]').textContent = 'Atualizar tarefa';
}

function deleteTask(id) {
  state.tasks = state.tasks.filter((t) => t.id !== id);
  persist('tasks', state.tasks);
  renderTasks();
  renderDashboard();
}

function renderProposals() {
  const container = qs('#propostas-lista');
  container.innerHTML = '';
  if (!state.proposals.length)
    container.appendChild(emptyState('Nenhuma proposta cadastrada.'));
  state.proposals.forEach((proposal) => {
    const card = document.createElement('div');
    card.className = 'list-card';
    card.innerHTML = `
      <div class="title-row">
        <h3>${proposal.title}</h3>
        <span class="pill-tag">${proposal.status}</span>
      </div>
      <div class="meta">
        <span>Cliente: <strong>${clientName(proposal.clientId)}</strong></span>
        <span>Valor: <strong>${formatCurrency(proposal.value)}</strong></span>
      </div>
      <div class="actions">
        <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${
          proposal.id
        }">Editar</button>
        <button class="btn btn-danger-soft btn-sm" data-action="delete" data-id="${
          proposal.id
        }">Excluir</button>
      </div>
    `;
    container.appendChild(card);
  });
  container.onclick = (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'edit') fillProposalForm(id);
    if (btn.dataset.action === 'delete') deleteProposal(id);
  };
  renderDashboard();
}

function fillProposalForm(id) {
  const proposal = state.proposals.find((p) => p.id === id);
  if (!proposal) return;
  qs('#proposta-id').value = proposal.id;
  qs('#proposta-titulo').value = proposal.title;
  qs('#proposta-cliente').value = proposal.clientId || '';
  qs('#proposta-valor').value = proposal.value || '';
  qs('#proposta-status').value = proposal.status;
  qs('#proposta-form button[type="submit"]').textContent = 'Atualizar proposta';
}

function deleteProposal(id) {
  state.proposals = state.proposals.filter((p) => p.id !== id);
  persist('proposals', state.proposals);
  renderProposals();
  renderDashboard();
}

function renderContracts() {
  const container = qs('#contratos-lista');
  container.innerHTML = '';
  if (!state.contracts.length)
    container.appendChild(emptyState('Nenhum contrato ainda.'));
  state.contracts.forEach((contract) => {
    const card = document.createElement('div');
    card.className = 'list-card';
    card.innerHTML = `
      <div class="title-row">
        <h3>${contract.title}</h3>
        <span class="pill-tag">Valor ${formatCurrency(contract.value)}</span>
      </div>
      <div class="meta">
        <span>Cliente: <strong>${clientName(contract.clientId)}</strong></span>
        <span>Vigência: <strong>${formatDate(contract.term)}</strong></span>
      </div>
      <div class="actions">
        <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${
          contract.id
        }">Editar</button>
        <button class="btn btn-danger-soft btn-sm" data-action="delete" data-id="${
          contract.id
        }">Excluir</button>
      </div>
    `;
    container.appendChild(card);
  });
  container.onclick = (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'edit') fillContractForm(id);
    if (btn.dataset.action === 'delete') deleteContract(id);
  };
}

function fillContractForm(id) {
  const contract = state.contracts.find((c) => c.id === id);
  if (!contract) return;
  qs('#contrato-id').value = contract.id;
  qs('#contrato-titulo').value = contract.title;
  qs('#contrato-cliente').value = contract.clientId || '';
  qs('#contrato-valor').value = contract.value || '';
  qs('#contrato-vigencia').value = contract.term || '';
  qs('#contrato-form button[type="submit"]').textContent = 'Atualizar contrato';
}

function deleteContract(id) {
  state.contracts = state.contracts.filter((c) => c.id !== id);
  persist('contracts', state.contracts);
  renderContracts();
}

function renderCharges() {
  const container = qs('#cobrancas-lista');
  container.innerHTML = '';
  if (!state.charges.length)
    container.appendChild(emptyState('Nenhuma cobrança criada.'));
  state.charges.forEach((charge) => {
    const card = document.createElement('div');
    card.className = 'list-card';
    card.innerHTML = `
      <div class="title-row">
        <h3>${charge.description}</h3>
        <span class="pill-tag">${charge.status}</span>
      </div>
      <div class="meta">
        <span>Cliente: <strong>${clientName(charge.clientId)}</strong></span>
        <span>Valor: <strong>${formatCurrency(charge.value)}</strong></span>
      </div>
      <div class="actions">
        <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${
          charge.id
        }">Editar</button>
        <button class="btn btn-danger-soft btn-sm" data-action="delete" data-id="${
          charge.id
        }">Excluir</button>
      </div>
    `;
    container.appendChild(card);
  });
  container.onclick = (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'edit') fillChargeForm(id);
    if (btn.dataset.action === 'delete') deleteCharge(id);
  };
  renderDashboard();
}

function fillChargeForm(id) {
  const charge = state.charges.find((c) => c.id === id);
  if (!charge) return;
  qs('#cobranca-id').value = charge.id;
  qs('#cobranca-descricao').value = charge.description;
  qs('#cobranca-cliente').value = charge.clientId || '';
  qs('#cobranca-valor').value = charge.value || '';
  qs('#cobranca-status').value = charge.status;
  qs('#cobranca-form button[type="submit"]').textContent = 'Atualizar cobrança';
}

function deleteCharge(id) {
  state.charges = state.charges.filter((c) => c.id !== id);
  persist('charges', state.charges);
  renderCharges();
  renderDashboard();
}

function setupForms() {
  const clientForm = qs('#cliente-form');
  if (clientForm) {
    clientForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = qs('#cliente-id').value || uuid();
      const payload = {
        id,
        name: qs('#cliente-nome').value.trim(),
        type: qs('#cliente-tipo').value,
        email: qs('#cliente-email').value.trim(),
        phone: qs('#cliente-telefone').value.trim(),
        document: qs('#cliente-doc').value.trim(),
        createdAt: Date.now(),
      };
      const exists = state.clients.some((c) => c.id === id);
      state.clients = exists
        ? state.clients.map((c) => (c.id === id ? { ...c, ...payload } : c))
        : [...state.clients, payload];
      persist('clients', state.clients);
      clientForm.reset();
      qs('#cliente-id').value = '';
      clientForm.querySelector('button[type="submit"]').textContent =
        'Salvar cliente';
      renderClients();
      updateClientOptions();
      renderProjects();
      renderProposals();
      renderContracts();
      renderCharges();
      renderDashboard();
      hideClientModal();
      const msg = exists
        ? 'Cliente atualizado com sucesso!'
        : 'Cliente cadastrado com sucesso!';
      showToast(msg);
    });
  }

  const tarefaForm = qs('#tarefa-form');
  if (tarefaForm) {
    tarefaForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = qs('#tarefa-id').value || uuid();
      const payload = {
        id,
        title: qs('#tarefa-titulo').value.trim(),
        projectId: qs('#tarefa-projeto').value,
        status: qs('#tarefa-status').value,
        priority: qs('#tarefa-prioridade').value,
        dueDate: qs('#tarefa-limite').value,
        createdAt: Date.now(),
      };
      const exists = state.tasks.some((t) => t.id === id);
      state.tasks = exists
        ? state.tasks.map((t) => (t.id === id ? { ...t, ...payload } : t))
        : [...state.tasks, payload];
      persist('tasks', state.tasks);
      tarefaForm.reset();
      qs('#tarefa-id').value = '';
      tarefaForm.querySelector('button[type="submit"]').textContent =
        'Salvar tarefa';
      renderTasks();
      renderDashboard();
    });
  }

  const propostaForm = qs('#proposta-form');
  if (propostaForm) {
    propostaForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = qs('#proposta-id').value || uuid();
      const payload = {
        id,
        title: qs('#proposta-titulo').value.trim(),
        clientId: qs('#proposta-cliente').value,
        value: qs('#proposta-valor').value,
        status: qs('#proposta-status').value,
        createdAt: Date.now(),
      };
      const exists = state.proposals.some((p) => p.id === id);
      state.proposals = exists
        ? state.proposals.map((p) => (p.id === id ? { ...p, ...payload } : p))
        : [...state.proposals, payload];
      persist('proposals', state.proposals);
      propostaForm.reset();
      qs('#proposta-id').value = '';
      propostaForm.querySelector('button[type="submit"]').textContent =
        'Salvar proposta';
      renderProposals();
      renderDashboard();
    });
  }

  const contratoForm = qs('#contrato-form');
  if (contratoForm) {
    contratoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = qs('#contrato-id').value || uuid();
      const payload = {
        id,
        title: qs('#contrato-titulo').value.trim(),
        clientId: qs('#contrato-cliente').value,
        value: qs('#contrato-valor').value,
        term: qs('#contrato-vigencia').value,
        createdAt: Date.now(),
      };
      const exists = state.contracts.some((c) => c.id === id);
      state.contracts = exists
        ? state.contracts.map((c) => (c.id === id ? { ...c, ...payload } : c))
        : [...state.contracts, payload];
      persist('contracts', state.contracts);
      contratoForm.reset();
      qs('#contrato-id').value = '';
      contratoForm.querySelector('button[type="submit"]').textContent =
        'Salvar contrato';
      renderContracts();
    });
  }

  const cobrancaForm = qs('#cobranca-form');
  if (cobrancaForm) {
    cobrancaForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = qs('#cobranca-id').value || uuid();
      const payload = {
        id,
        description: qs('#cobranca-descricao').value.trim(),
        clientId: qs('#cobranca-cliente').value,
        value: qs('#cobranca-valor').value,
        status: qs('#cobranca-status').value,
        createdAt: Date.now(),
      };
      const exists = state.charges.some((c) => c.id === id);
      state.charges = exists
        ? state.charges.map((c) => (c.id === id ? { ...c, ...payload } : c))
        : [...state.charges, payload];
      persist('charges', state.charges);
      cobrancaForm.reset();
      qs('#cobranca-id').value = '';
      cobrancaForm.querySelector('button[type="submit"]').textContent =
        'Salvar cobrança';
      renderCharges();
      renderDashboard();
    });
  }
}

function setupFilters() {
  qs('#projeto-filtro-status').addEventListener('change', renderProjects);
  qs('#projeto-filtro-cliente').addEventListener('change', renderProjects);
  qs('#tarefa-filtro-status').addEventListener('change', renderTasks);
  qs('#tarefa-filtro-projeto').addEventListener('change', renderTasks);
  qs('#cliente-busca').addEventListener('input', renderClients);
}

function setupSettings() {
  qsa('button[data-theme]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.settings.theme = btn.dataset.theme;
      persistSettings();
      applyTheme();
    });
  });
  [qs('#accent-picker'), qs('#accent-picker-config')].forEach((input) => {
    if (!input) return;
    input.addEventListener('input', (e) => {
      state.settings.accent = e.target.value;
      persistSettings();
      applyTheme();
    });
  });
}

function setupProjectViewToggle() {
  const viewButtons = qsa('.view-toggle button');
  viewButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.projectView = btn.dataset.view;
      state.settings.projectView = state.projectView;
      persistSettings();
      viewButtons.forEach((b) => {
        const active = b.dataset.view === state.projectView;
        b.classList.toggle('btn-primary', active);
        b.disabled = active;
      });
      toggleProjectView(state.projectView);
      renderProjects();
    });
  });
  viewButtons.forEach((b) => {
    const active = b.dataset.view === state.projectView;
    b.classList.toggle('btn-primary', active);
    b.disabled = active;
  });
}

function toggleProjectView(view) {
  const listWrap = qs('#projetos-list-view');
  const boardWrap = qs('#projetos-board-view');
  if (!listWrap || !boardWrap) return;
  const isList = view === 'list';
  listWrap.classList.toggle('hidden', !isList);
  boardWrap.classList.toggle('hidden', isList);
}

function setupSearchModal() {
  const trigger = qs('.search-trigger');
  const modal = qs('.search-modal');
  const backdrop = qs('.search-modal-backdrop');
  const closeBtn = qs('.close-modal');
  const input = qs('#modal-search-input');
  if (!trigger || !modal || !backdrop || !closeBtn || !input) return;
  const open = () => {
    modal.classList.remove('hidden');
    setTimeout(() => input.focus(), 50);
    lockScroll();
  };
  const close = () => {
    modal.classList.add('hidden');
    unlockScroll();
  };
  trigger.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}

function applyAvatar() {
  const avatarEl = qs('.avatar');
  if (avatarEl) avatarEl.textContent = state.settings.avatar || '🙋‍♂️';
  qsa('.avatar-option').forEach((btn) =>
    btn.classList.toggle(
      'active',
      btn.dataset.avatar === state.settings.avatar,
    ),
  );
}

function setupAvatarPicker() {
  qsa('.avatar-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.settings.avatar = btn.dataset.avatar;
      persistSettings();
      applyAvatar();
    });
  });
}

function setupProjectPrivacyToggle() {
  const toggle = qs('.toggle-project-privacy');
  const section = qs('#projetos');
  if (!toggle || !section) return;
  const update = () => {
    const hidden = state.hideProjects;
    toggle.textContent = hidden ? '🙈' : '👁️';
    toggle.setAttribute('aria-pressed', hidden ? 'true' : 'false');
    section.classList.toggle('hidden-project-data', hidden);
  };
  toggle.addEventListener('click', () => {
    state.hideProjects = !state.hideProjects;
    update();
  });
  update();
}

function setupClientModal() {
  const openBtn = qs('.open-client-modal');
  const modal = qs('.client-modal');
  const backdrop = modal?.querySelector('.modal-backdrop');
  const closeBtns = modal
    ? [...modal.querySelectorAll('.close-client-modal')]
    : [];
  if (!openBtn || !modal || !backdrop) return;
  openBtn.addEventListener('click', () => {
    qs('#cliente-form').reset();
    qs('#cliente-id').value = '';
    qs('#cliente-form button[type="submit"]').textContent = 'Salvar cliente';
    showClientModal();
  });
  backdrop.addEventListener('click', hideClientModal);
  closeBtns.forEach((btn) => btn.addEventListener('click', hideClientModal));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideClientModal();
  });
}

function setupPhoneMask() {
  const phoneInput = qs('#cliente-telefone');
  const docInput = qs('#cliente-doc');
  if (phoneInput) {
    phoneInput.addEventListener('input', () => {
      const digits = phoneInput.value.replace(/\D/g, '').slice(0, 11);
      let formatted = digits;
      if (digits.length > 6)
        formatted = `(${digits.slice(0, 2)}) ${digits.slice(
          2,
          7,
        )}-${digits.slice(7)}`;
      else if (digits.length > 2)
        formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
      else if (digits.length > 0) formatted = `(${digits}`;
      phoneInput.value = formatted;
    });
  }
  if (docInput) {
    docInput.addEventListener('input', () => {
      const digits = docInput.value.replace(/\D/g, '').slice(0, 14);
      let formatted = digits;
      if (digits.length > 11) {
        formatted = digits
          .replace(/^(\d{2})(\d)/, '$1.$2')
          .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
          .replace(/\.(\d{3})(\d)/, '.$1/$2')
          .replace(/(\d{4})(\d)/, '$1-$2');
      } else if (digits.length > 9) {
        formatted = digits
          .replace(/(\d{3})(\d)/, '$1.$2')
          .replace(/(\d{3})(\d)/, '$1.$2')
          .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      } else if (digits.length > 6) {
        formatted = digits
          .replace(/(\d{3})(\d)/, '$1.$2')
          .replace(/(\d{3})(\d)/, '$1.$2');
      } else if (digits.length > 3) {
        formatted = digits.replace(/(\d{3})(\d)/, '$1.$2');
      }
      docInput.value = formatted;
    });
  }
}

function setupPrivacyToggle() {
  const toggle = qs('.toggle-privacy');
  const clientSection = qs('#clientes');
  if (!toggle) return;
  const update = () => {
    const hidden = state.hideClients;
    toggle.textContent = hidden ? '🙈' : '👁️';
    toggle.setAttribute('aria-pressed', hidden ? 'true' : 'false');
    if (clientSection) clientSection.classList.toggle('hidden-data', hidden);
    renderClients();
  };
  toggle.addEventListener('click', () => {
    state.hideClients = !state.hideClients;
    update();
  });
  update();
}

function promptDeleteClient(id, name) {
  const modal = qs('.confirm-delete-modal');
  const nameEl = qs('#delete-client-name');
  const confirmBtn = qs('.confirm-delete-client');
  if (!modal || !nameEl || !confirmBtn) {
    deleteClient(id);
    return;
  }
  nameEl.textContent = name;
  confirmBtn.onclick = () => deleteClient(id);
  modal.classList.remove('hidden');
  lockScroll();
}

function hideDeleteClientModal() {
  const modal = qs('.confirm-delete-modal');
  if (modal && !modal.classList.contains('hidden')) {
    modal.classList.add('hidden');
    unlockScroll();
  }
}

function setupDeleteModal() {
  const modal = qs('.confirm-delete-modal');
  if (!modal) return;
  const backdrop = modal.querySelector('.modal-backdrop');
  const closeBtns = [...modal.querySelectorAll('.close-delete-modal')];
  const close = () => hideDeleteClientModal();
  backdrop?.addEventListener('click', close);
  closeBtns.forEach((btn) => btn.addEventListener('click', close));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}

function showClientModal() {
  const modal = qs('.client-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  setTimeout(() => qs('#cliente-nome')?.focus(), 60);
  lockScroll();
}

function hideClientModal() {
  const modal = qs('.client-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  hideDeleteClientModal();
  unlockScroll();
}

function setActiveSection(section) {
  const target = section || 'dashboard';
  state.settings.section = target;
  persistSettings();
  qsa('.nav-card').forEach((i) =>
    i.classList.toggle('active', i.dataset.section === target),
  );
  qsa('.section').forEach((sectionEl) =>
    sectionEl.classList.toggle('active', sectionEl.id === target),
  );
}

function bootstrap() {
  loadState();
  applyTheme();
  setActiveSection(state.settings.section || 'dashboard');
  handleNavigation();
  setupForms();
  setupFilters();
  setupSettings();
  setupProjectViewToggle();
  setupProjectModal();
  setupDeleteProjectModal();
  setupProjectPrivacyToggle();
  setupSearchModal();
  setupAvatarPicker();
  setupClientModal();
  setupPrivacyToggle();
  setupDeleteModal();
  setupPhoneMask();
  updateClientOptions();
  updateProjectOptions();
  toggleProjectView(state.projectView);
  renderClients();
  renderProjects();
  renderTasks();
  renderProposals();
  renderContracts();
  renderCharges();
  renderDashboard();
}

bootstrap();
let modalDepth = 0;

function lockScroll() {
  modalDepth += 1;
  document.body.classList.add('modal-open');
}

function unlockScroll() {
  modalDepth = Math.max(0, modalDepth - 1);
  if (modalDepth === 0) {
    document.body.classList.remove('modal-open');
  }
}
