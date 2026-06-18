/**
 * Smart Construction Planner — guided steps, rule-based “AI” insights,
 * rough quantity hints, todos (localStorage), and supplier search links.
 * Replace buildNarrative() with an API call when you add a real model.
 */
(function () {
  'use strict';

  const TODO_KEY = 'buildsmart_smart_todos_v1';
  const STATE_KEY = 'buildsmart_planner_state_v1';

  const REGIONS = {
    na: { label: 'North America', codes: 'IBC / NEC typical; verify local AHJ.' },
    eu: { label: 'EU / UK', codes: 'Eurocode + national annexes; CE-marked materials.' },
    me: { label: 'Middle East & Gulf', codes: 'Municipal civil + DEWA/ADDC-style utilities where applicable.' },
    asia: { label: 'Asia–Pacific', codes: 'Local seismic/wind + national electrical code.' },
    latam: { label: 'Latin America', codes: 'NBR / local concrete grades; verify rebar spec.' },
    africa: { label: 'Africa (general)', codes: 'SABS / local standards; import availability varies.' },
  };

  const DISCIPLINES = [
    {
      id: 'shell',
      icon: 'fa-cubes',
      title: 'Structure & envelope',
      summary: 'Foundations, frame or masonry, roof, insulation, and weather barrier before MEP rough-in.',
      steps: [
        'Confirm structural drawings and load paths.',
        'Sequence: waterproof shell → MEP penetrations → fire stopping.',
      ],
      shop: ['Portland cement Type I/II', 'structural lumber or steel sections', 'roofing underlayment'],
    },
    {
      id: 'plumb',
      icon: 'fa-faucet',
      title: 'Plumbing',
      summary: 'Potable supply, waste/vent, storm where needed, pressure tests before concealment.',
      steps: [
        'Rough-in before insulation; isolate zones with valves.',
        'Hot/cold balance; plan thermal expansion for long runs.',
      ],
      shop: ['PEX or copper pipe', 'PVC DWV fittings', 'shutoff valves'],
    },
    {
      id: 'vent',
      icon: 'fa-fan',
      title: 'Ventilation & IAQ',
      summary: 'Bath/kitchen exhaust CFM, makeup air, optional HRV/ERV in tight envelopes.',
      steps: [
        'Size duct runs for static pressure; avoid sharp bends.',
        'Coordinate ceiling chases with structure and lighting.',
      ],
      shop: ['inline duct fan', 'flex or rigid duct', 'bathroom exhaust grille'],
    },
    {
      id: 'bath',
      icon: 'fa-bath',
      title: 'Bathrooms (wet areas)',
      summary: 'Waterproofing, slope to drain, niche blocking, GFCI zones, lighting IP rating.',
      steps: [
        'Flood test pan/wet room before tile.',
        'Stack wet walls vertically where possible.',
      ],
      shop: ['liquid waterproof membrane', 'cement board', 'linear drain'],
    },
    {
      id: 'elec',
      icon: 'fa-bolt',
      title: 'Electrical',
      summary: 'Service size, panel schedule, circuits for HVAC/kitchen/bath, surge & grounding.',
      steps: [
        'Rough before drywall; photograph boxes before cover.',
        'Label neutrals; arc-fault where required by code.',
      ],
      shop: ['NM-B or conduit', 'breaker panel', 'LED downlights'],
    },
  ];

  function supplierSearchUrl(query) {
    const q = encodeURIComponent(query + ' construction supplies buy');
    return 'https://www.google.com/search?q=' + q;
  }

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STATE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveState(partial) {
    const next = { ...loadState(), ...partial };
    localStorage.setItem(STATE_KEY, JSON.stringify(next));
  }

  function loadTodos() {
    try {
      const raw = localStorage.getItem(TODO_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) { /* ignore */ }
    return defaultTodos();
  }

  function uid() {
    return 't-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
  }

  function defaultTodos() {
    return [
      { id: uid(), text: 'Define gross floor area & number of wet rooms', done: false },
      { id: uid(), text: 'Collect geotech + structural design package', done: false },
      { id: uid(), text: 'MEP coordination meeting (clash check)', done: false },
      { id: uid(), text: 'Order long-lead items (panel, windows, HVAC)', done: false },
      { id: uid(), text: 'Book inspections: underground / rough / final', done: false },
    ];
  }

  function saveTodos(list) {
    localStorage.setItem(TODO_KEY, JSON.stringify(list));
  }

  function buildNarrative(regionKey, area, baths, floors) {
    const r = REGIONS[regionKey] || REGIONS.na;
    const a = Math.max(0, Number(area) || 0);
    const b = Math.max(0, Number(baths) || 0);
    const f = Math.max(1, Number(floors) || 1);
    const parts = [];
    parts.push(`**Region focus:** ${r.label}. ${r.codes}`);
    if (a > 0) {
      parts.push(`**Scale:** ~${a} m² conditioned over ${f} floor(s) — prioritize early procurement for façade and MEP shafts.`);
      const roughSlab = Math.round(a * f * 0.12);
      parts.push(`**Indicative concrete (order-of-magnitude only):** rough structural slab/foundation budget often discussed around **${roughSlab}–${roughSlab * 2} m³** class of quantity before engineering — *always verify with drawings*.`);
    }
    if (b > 0) {
      parts.push(`**Wet rooms (${b}):** sequence waterproofing → pressure test → conceal. Add dedicated exhaust CFM per bath + makeup path if building tight.`);
    }
    parts.push('**Sequence tip:** structure dry-in → MEP rough-in → inspection → insulation/air barrier → drywall.');
    parts.push('*This planner gives educational sequencing, not legal or engineering sign-off. Hire licensed pros for code compliance.*');
    return parts.join('\n\n');
  }

  function formatNarrative(md) {
    return md
      .split('\n\n')
      .map((block) => {
        const t = block.trim();
        if (t.startsWith('**') && t.includes(':**')) {
          const cut = t.indexOf(':**');
          const head = t.slice(2, cut);
          const rest = t.slice(cut + 3).replace(/\*\*/g, '');
          return `<p class="copilot-block"><strong>${head}</strong> ${rest}</p>`;
        }
        return `<p class="copilot-block">${t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`;
      })
      .join('');
  }

  function roughCalc(area, floors) {
    const a = Math.max(0, Number(area) || 0);
    const fl = Math.max(1, Number(floors) || 1);
    const gross = a * fl;
    if (!gross) return '<p class="hint">Enter floor area to see indicative quantities (educational only).</p>';
    const cementBags = Math.round(gross * 7);
    const sandM3 = (gross * 0.045).toFixed(1);
    const rebarKg = Math.round(gross * 95);
    return `
      <ul class="calc-list">
        <li><span>Cement (illustrative mix designs vary)</span><strong>~${cementBags} bags (50 kg eq.)</strong></li>
        <li><span>Fine aggregate (sand, ballpark)</span><strong>~${sandM3} m³</strong></li>
        <li><span>Reinforcement (very rough)</span><strong>~${rebarKg} kg</strong> — engineer must detail bar schedule</li>
      </ul>
      <p class="hint">Formulas are simplified global teaching aids, not a bill of quantities.</p>
    `;
  }

  function renderDisciplines(container) {
    container.innerHTML = DISCIPLINES.map((d) => `
      <article class="discipline-card" data-discipline="${d.id}">
        <header><i class="fas ${d.icon}"></i><h3>${d.title}</h3></header>
        <p>${d.summary}</p>
        <ol class="mini-steps">
          ${d.steps.map((s) => `<li>${s}</li>`).join('')}
        </ol>
        <div class="shop-row">
          ${d.shop.map((q) => `<a class="shop-chip" href="${supplierSearchUrl(q)}" target="_blank" rel="noopener">Shop: ${q}</a>`).join('')}
        </div>
      </article>
    `).join('');
  }

  function renderTodos(listEl, list) {
    listEl.innerHTML = list
      .map(
        (t) => `
      <li class="todo-row" data-id="${t.id}">
        <label><input type="checkbox" ${t.done ? 'checked' : ''} /><span>${escapeHtml(t.text)}</span></label>
        <button type="button" class="todo-del" aria-label="Remove">×</button>
      </li>`
      )
      .join('');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function paragraphsToHtml(paragraphs) {
    return paragraphs.map((p) => `<p class="copilot-block">${escapeHtml(p)}</p>`).join('');
  }

  /** When `window.BUILDSMART_API_BASE` is set (e.g. Django on GoDaddy :8001), Copilot uses `/api/copilot-plan/`. */
  async function refreshCopilot() {
    const region = document.getElementById('planner-region')?.value || 'na';
    const area = document.getElementById('planner-area')?.value;
    const baths = document.getElementById('planner-baths')?.value;
    const floors = document.getElementById('planner-floors')?.value;
    const out = document.getElementById('copilot-output');
    const calc = document.getElementById('rough-calc-output');
    const apiBase = (typeof window !== 'undefined' && window.BUILDSMART_API_BASE) || '';

    if (out) {
      if (apiBase) {
        try {
          const base = apiBase.replace(/\/$/, '');
          const u = new URL(`${base}/api/copilot-plan/`);
          u.searchParams.set('region', region);
          u.searchParams.set('area', String(area || 0));
          u.searchParams.set('baths', String(baths || 0));
          u.searchParams.set('floors', String(floors || 1));
          const res = await fetch(u.toString(), { credentials: 'omit' });
          if (res.ok) {
            const data = await res.json();
            if (data.paragraphs && Array.isArray(data.paragraphs)) {
              let html = paragraphsToHtml(data.paragraphs);
              if (data.source) {
                html += `<p class="copilot-block copilot-meta"><small>Source: ${escapeHtml(data.source)}</small></p>`;
              }
              out.innerHTML = html;
            } else {
              out.innerHTML = formatNarrative(buildNarrative(region, area, baths, floors));
            }
          } else {
            out.innerHTML = formatNarrative(buildNarrative(region, area, baths, floors));
          }
        } catch (_) {
          out.innerHTML = formatNarrative(buildNarrative(region, area, baths, floors));
        }
      } else {
        out.innerHTML = formatNarrative(buildNarrative(region, area, baths, floors));
      }
    }
    if (calc) calc.innerHTML = roughCalc(area, floors);
    saveState({ region, area, baths, floors });
  }

  function init() {
    const root = document.getElementById('smart-planner-root');
    if (!root) return;

    const state = loadState();
    const regionEl = document.getElementById('planner-region');
    const areaEl = document.getElementById('planner-area');
    const bathsEl = document.getElementById('planner-baths');
    const floorsEl = document.getElementById('planner-floors');
    if (regionEl && state.region) regionEl.value = state.region;
    if (areaEl && state.area) areaEl.value = state.area;
    if (bathsEl && state.baths) bathsEl.value = state.baths;
    if (floorsEl && state.floors) floorsEl.value = state.floors;

    renderDisciplines(document.getElementById('discipline-grid'));

    const todoList = document.getElementById('todo-list');
    let todos = loadTodos();
    renderTodos(todoList, todos);

    todoList.addEventListener('change', (e) => {
      const row = e.target.closest('.todo-row');
      if (!row || e.target.type !== 'checkbox') return;
      const id = row.getAttribute('data-id');
      todos = todos.map((t) => (t.id === id ? { ...t, done: e.target.checked } : t));
      saveTodos(todos);
    });

    todoList.addEventListener('click', (e) => {
      if (!e.target.classList.contains('todo-del')) return;
      const row = e.target.closest('.todo-row');
      const id = row.getAttribute('data-id');
      todos = todos.filter((t) => t.id !== id);
      saveTodos(todos);
      renderTodos(todoList, todos);
    });

    document.getElementById('todo-add')?.addEventListener('click', () => {
      const input = document.getElementById('todo-input');
      const text = (input.value || '').trim();
      if (!text) return;
      todos.push({ id: uid(), text, done: false });
      saveTodos(todos);
      renderTodos(todoList, todos);
      input.value = '';
    });

    [regionEl, areaEl, bathsEl, floorsEl].forEach((el) => {
      el?.addEventListener('input', refreshCopilot);
      el?.addEventListener('change', refreshCopilot);
    });

    document.querySelectorAll('.wizard-step').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.wizard-step').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const step = btn.getAttribute('data-step');
        document.querySelectorAll('.planner-panel').forEach((p) => {
          p.classList.toggle('active', p.getAttribute('data-panel') === step);
        });
      });
    });

    refreshCopilot();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
