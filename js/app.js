let db = Storage.load();
let currentMeetingId = null;
let currentSectorId = null;
let pendingContext = { setorId: null, perguntaId: null };
let statusContextPendenciaId = null;

const app = document.querySelector('#app');
const syncStatus = document.querySelector('#syncStatus');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').catch(console.warn);
}

function activeSectors() {
  return db.setores.filter(s => s.ativo !== false).sort((a, b) => a.nome.localeCompare(b.nome));
}

function sectorById(id) {
  return db.setores.find(s => s.id === id) || { nome: id, tipo: '-' };
}

function meeting() {
  return db.reunioes.find(r => r.id === currentMeetingId);
}

function perguntasDoSetor(setorId) {
  return db.perguntas
    .filter(p => p.ativo !== false && p.setorId === setorId)
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
}

function respostasDaReuniaoSetor(setorId) {
  return db.respostas.filter(r => r.reuniaoId === currentMeetingId && r.setorId === setorId);
}

function respostaExistente(setorId, perguntaId) {
  return db.respostas.find(r => r.reuniaoId === currentMeetingId && r.setorId === setorId && r.perguntaId === perguntaId);
}

function pendenciasRelacionadasSetor(setorId, somenteAbertas = true) {
  const ids = db.pendenciaParticipantes
    .filter(pp => pp.setorId === setorId)
    .map(pp => pp.pendenciaId);

  return db.pendencias.filter(p => {
    const relacionado = p.setorOrigemId === setorId || ids.includes(p.id);
    const aberto = p.statusGlobal !== 'concluida' && p.statusGlobal !== 'cancelada';
    return relacionado && (!somenteAbertas || aberto);
  });
}

function pendenciasDaReuniaoAtual() {
  return db.pendencias.filter(p => p.reuniaoOrigemId === currentMeetingId || p.reuniaoUltimaAtualizacaoId === currentMeetingId);
}

function calcStatusGlobal(pendenciaId) {
  const partes = db.pendenciaParticipantes.filter(pp => pp.pendenciaId === pendenciaId);
  if (!partes.length) return 'aberta';
  const validas = partes.filter(p => p.papel !== 'acompanhamento');
  const base = validas.length ? validas : partes;
  const total = base.length;
  const cumpridas = base.filter(p => p.status === 'cumprida').length;
  const parciais = base.filter(p => p.status === 'parcial').length;

  if (cumpridas === total) return 'concluida';
  if (cumpridas > 0 || parciais > 0) return 'parcial';
  return 'aberta';
}

function atualizarStatusGlobal(pendenciaId) {
  const p = db.pendencias.find(x => x.id === pendenciaId);
  if (!p) return;
  const antigo = p.statusGlobal;
  const novo = calcStatusGlobal(pendenciaId);
  p.statusGlobal = novo;
  p.reuniaoUltimaAtualizacaoId = currentMeetingId;
  if (novo === 'concluida' && !p.dataConclusao) p.dataConclusao = Storage.nowISO();
  if (novo !== 'concluida') p.dataConclusao = null;
  if (antigo !== novo) {
    Storage.addHistory(db, {
      reuniaoId: currentMeetingId,
      pendenciaId,
      tipo: 'status_global',
      statusAnterior: antigo,
      statusNovo: novo
    });
  }
}

function horasEmAberto(p) {
  const inicio = new Date(p.dataAbertura).getTime();
  const fim = p.dataConclusao ? new Date(p.dataConclusao).getTime() : Date.now();
  return Math.max(0, Math.round((fim - inicio) / 36e5));
}

function isAtrasada(p) {
  if (!p.prazoHoras || p.statusGlobal === 'concluida') return false;
  return horasEmAberto(p) > Number(p.prazoHoras);
}

function renderHome() {
  currentMeetingId = null;
  currentSectorId = null;
  const abertas = db.pendencias.filter(p => p.statusGlobal !== 'concluida' && p.statusGlobal !== 'cancelada');
  const reunioes = [...db.reunioes].sort((a, b) => new Date(b.dataInicio) - new Date(a.dataInicio)).slice(0, 5);

  app.innerHTML = `
    <section class="hero">
      <div class="card">
        <p class="eyebrow">Condução da reunião</p>
        <h2>Presença, perguntas e pendências em um só fluxo.</h2>
        <p>Esta base foi pensada para o gestor conduzir o Safety Huddle setor por setor, registrar respostas e criar pendências independentes da resposta da pergunta.</p>
        <div class="actions">
          <button class="primary" id="btnNovaReuniao">Iniciar nova reunião</button>
          <button class="secondary" id="btnVerPendencias">Ver pendências abertas</button>
        </div>
      </div>
      <div class="card">
        <p class="eyebrow">Resumo local</p>
        <div class="stat-grid">
          <div class="stat"><strong>${db.reunioes.length}</strong><span>reuniões</span></div>
          <div class="stat"><strong>${abertas.length}</strong><span>pendências abertas</span></div>
          <div class="stat"><strong>${db.setores.filter(s => s.ativo !== false).length}</strong><span>setores ativos</span></div>
        </div>
      </div>
    </section>

    <section class="card" style="margin-top:1rem">
      <div class="section-title"><h2>Últimas reuniões</h2></div>
      ${reunioes.length ? `
        <div class="table-like">
          ${reunioes.map(r => `
            <div class="item-row">
              <div>
                <strong>${Storage.formatDateTime(r.dataInicio)}</strong>
                <p>${r.gestor || 'Gestor não informado'} · ${r.setoresPresentes.length} setores presentes · status: ${r.status}</p>
              </div>
              <button class="ghost" data-open-meeting="${r.id}">Abrir</button>
            </div>`).join('')}
        </div>` : '<p class="muted">Nenhuma reunião criada ainda.</p>'}
    </section>
  `;

  document.querySelector('#btnNovaReuniao').onclick = renderStartMeeting;
  document.querySelector('#btnVerPendencias').onclick = renderPendenciasAbertas;
  document.querySelectorAll('[data-open-meeting]').forEach(btn => {
    btn.onclick = () => {
      currentMeetingId = btn.dataset.openMeeting;
      currentSectorId = meeting().setoresPresentes[0] || null;
      renderMeeting();
    };
  });
}

function renderStartMeeting() {
  app.innerHTML = `
    <section class="card">
      <p class="eyebrow">Nova reunião</p>
      <h2>Confirmar presença dos setores</h2>
      <p class="muted">Marque os setores presentes. O sistema vai conduzir as perguntas apenas para quem estiver na reunião.</p>
      <label class="field compact">
        <span>Gestor responsável</span>
        <input id="gestorResponsavel" placeholder="Nome do condutor" />
      </label>
      <div class="check-grid">
        ${activeSectors().map(s => `
          <label class="check-card">
            <input type="checkbox" class="presencaSetor" value="${s.id}" checked />
            <span><strong>${s.nome}</strong><small>${s.tipo}</small></span>
          </label>
        `).join('')}
      </div>
      <div class="actions">
        <button class="ghost" id="btnVoltarHome">Voltar</button>
        <button class="primary" id="btnComecarReuniao">Começar reunião</button>
      </div>
    </section>
  `;
  document.querySelector('#btnVoltarHome').onclick = renderHome;
  document.querySelector('#btnComecarReuniao').onclick = () => {
    const presentes = [...document.querySelectorAll('.presencaSetor:checked')].map(x => x.value);
    if (!presentes.length) return alert('Marque pelo menos um setor presente.');
    const id = Storage.uid('reuniao');
    db.reunioes.push({
      id,
      dataInicio: Storage.nowISO(),
      dataFim: null,
      gestor: document.querySelector('#gestorResponsavel').value.trim(),
      setoresPresentes: presentes,
      setoresConcluidos: [],
      status: 'em_andamento',
      enviado: false
    });
    Storage.save(db);
    currentMeetingId = id;
    currentSectorId = presentes[0];
    renderMeeting();
  };
}

function renderMeeting() {
  const r = meeting();
  if (!r) return renderHome();
  if (!currentSectorId) currentSectorId = r.setoresPresentes[0];
  const setor = sectorById(currentSectorId);
  const perguntas = perguntasDoSetor(currentSectorId);
  const pendenciasSetor = pendenciasRelacionadasSetor(currentSectorId, true);

  app.innerHTML = `
    <section class="meeting-layout">
      <aside class="card sidebar">
        <p class="eyebrow">Reunião em andamento</p>
        <h2>${Storage.formatDateTime(r.dataInicio)}</h2>
        <p class="muted">${r.gestor || 'Gestor não informado'}</p>
        <div class="sector-list">
          ${r.setoresPresentes.map(id => {
            const s = sectorById(id);
            const done = r.setoresConcluidos.includes(id);
            const countPend = pendenciasRelacionadasSetor(id, true).length;
            return `<button class="sector-btn ${id === currentSectorId ? 'active' : ''} ${done ? 'done' : ''}" data-sector="${id}">
              <strong>${s.nome}</strong>
              <div class="sector-meta">
                <span class="badge ${s.tipo === 'assistencial' ? 'assistencial' : ''}">${s.tipo}</span>
                ${done ? '<span class="badge ok">respondido</span>' : ''}
                ${countPend ? `<span class="badge pendente">${countPend} pend.</span>` : ''}
              </div>
            </button>`;
          }).join('')}
        </div>
        <div class="actions">
          <button class="secondary" id="btnResumo">Resumo</button>
          <button class="primary" id="btnFinalizar">Finalizar</button>
        </div>
      </aside>

      <div class="grid">
        <section class="card">
          <div class="section-title">
            <div>
              <p class="eyebrow">Setor atual</p>
              <h2>${setor.nome}</h2>
            </div>
            <button class="primary" id="btnAddPendenciaSetor">+ Pendência do setor</button>
          </div>
          ${pendenciasSetor.length ? `
            <h3>Pendências abertas relacionadas a este setor</h3>
            ${pendenciasSetor.map(renderPendingCard).join('')}
          ` : '<p class="muted">Nenhuma pendência aberta relacionada a este setor.</p>'}
        </section>

        <section class="card">
          <div class="section-title">
            <h2>Perguntas do setor</h2>
            <span class="badge">${perguntas.length} perguntas</span>
          </div>
          ${perguntas.length ? perguntas.map((p, idx) => renderQuestion(p, idx + 1)).join('') : '<p class="muted">Nenhuma pergunta cadastrada para este setor.</p>'}
          <div class="actions">
            <button class="success" id="btnSalvarSetor">Salvar setor como respondido</button>
            <button class="ghost" id="btnProximoSetor">Próximo setor</button>
          </div>
        </section>
      </div>
    </section>
  `;

  document.querySelectorAll('[data-sector]').forEach(btn => btn.onclick = () => { currentSectorId = btn.dataset.sector; renderMeeting(); });
  document.querySelector('#btnAddPendenciaSetor').onclick = () => openPendenciaModal(currentSectorId, null);
  document.querySelectorAll('[data-add-pend]').forEach(btn => btn.onclick = () => openPendenciaModal(currentSectorId, btn.dataset.addPend));
  document.querySelectorAll('[data-status-pend]').forEach(btn => btn.onclick = () => openStatusModal(btn.dataset.statusPend));
  document.querySelectorAll('[data-answer], [data-obs]').forEach(el => el.onchange = saveAnswerFromInput);
  document.querySelectorAll('[data-answer-text]').forEach(el => el.oninput = debounce(saveAnswerFromInput, 300));
  document.querySelector('#btnSalvarSetor').onclick = marcarSetorRespondido;
  document.querySelector('#btnProximoSetor').onclick = proximoSetor;
  document.querySelector('#btnResumo').onclick = renderResumo;
  document.querySelector('#btnFinalizar').onclick = finalizarReuniao;
}

function renderQuestion(p, idx) {
  const resp = respostaExistente(currentSectorId, p.id);
  let input = '';
  const val = resp?.resposta || '';
  if (p.tipo === 'sim_nao') {
    input = `<select data-answer="${p.id}"><option value="">Selecionar</option><option ${val === 'Sim' ? 'selected' : ''}>Sim</option><option ${val === 'Não' ? 'selected' : ''}>Não</option><option ${val === 'Não se aplica' ? 'selected' : ''}>Não se aplica</option></select>`;
  } else if (p.tipo === 'numero') {
    input = `<input type="number" data-answer="${p.id}" value="${escapeHtml(val)}" placeholder="Digite um número" />`;
  } else {
    input = `<input type="text" data-answer-text="${p.id}" value="${escapeHtml(val)}" placeholder="Resposta rápida" />`;
  }

  return `
    <article class="question-card">
      <div class="question-head">
        <h3>${idx}. ${p.texto}</h3>
        ${p.podeGerarPendencia ? '<span class="badge pendente">pode gerar pendência</span>' : '<span class="badge">informativa</span>'}
      </div>
      <div class="response-row">
        <label class="field"><span>Resposta</span>${input}</label>
        <label class="field"><span>Observação rápida</span><input data-obs="${p.id}" value="${escapeHtml(resp?.observacao || '')}" placeholder="Observação opcional" /></label>
      </div>
      <div class="actions">
        <button class="secondary" data-add-pend="${p.id}">+ Adicionar pendência nesta pergunta</button>
      </div>
    </article>
  `;
}

function renderPendingCard(p) {
  const origem = sectorById(p.setorOrigemId).nome;
  const partes = db.pendenciaParticipantes.filter(pp => pp.pendenciaId === p.id);
  const statusClass = p.statusGlobal === 'concluida' ? 'concluida' : p.statusGlobal === 'parcial' ? 'parcial' : '';
  const atraso = isAtrasada(p);

  return `
    <article class="pending-card ${statusClass}">
      <h4>${escapeHtml(p.descricao)}</h4>
      <p>Origem: <strong>${origem}</strong> · Aberta há <strong>${horasEmAberto(p)}h</strong> ${p.prazoHoras ? `· Prazo: ${p.prazoHoras}h` : ''}</p>
      <div class="sector-meta">
        <span class="badge ${p.statusGlobal === 'concluida' ? 'ok' : p.statusGlobal === 'parcial' ? 'parcial' : 'pendente'}">${p.statusGlobal}</span>
        ${atraso ? '<span class="badge pendente">atrasada</span>' : ''}
        ${partes.map(pp => `<span class="badge">${sectorById(pp.setorId).nome}: ${pp.status}</span>`).join('')}
      </div>
      <div class="pending-actions">
        <button class="secondary" data-status-pend="${p.id}">Atualizar status</button>
      </div>
    </article>
  `;
}

function saveAnswerFromInput(event) {
  const el = event.target;
  const perguntaId = el.dataset.answer || el.dataset.answerText || el.dataset.obs;
  const p = db.perguntas.find(x => x.id === perguntaId);
  if (!p) return;
  let resp = respostaExistente(currentSectorId, perguntaId);
  if (!resp) {
    resp = {
      id: Storage.uid('resp'),
      reuniaoId: currentMeetingId,
      setorId: currentSectorId,
      perguntaId,
      perguntaTexto: p.texto,
      resposta: '',
      observacao: '',
      dataHora: Storage.nowISO()
    };
    db.respostas.push(resp);
  }
  const answerEl = document.querySelector(`[data-answer="${perguntaId}"], [data-answer-text="${perguntaId}"]`);
  const obsEl = document.querySelector(`[data-obs="${perguntaId}"]`);
  resp.resposta = answerEl ? answerEl.value : resp.resposta;
  resp.observacao = obsEl ? obsEl.value : resp.observacao;
  resp.dataHora = Storage.nowISO();
  Storage.save(db);
}

function marcarSetorRespondido() {
  const r = meeting();
  if (!r.setoresConcluidos.includes(currentSectorId)) r.setoresConcluidos.push(currentSectorId);
  Storage.save(db);
  renderMeeting();
}

function proximoSetor() {
  marcarSetorRespondido();
  const r = meeting();
  const idx = r.setoresPresentes.indexOf(currentSectorId);
  currentSectorId = r.setoresPresentes[idx + 1] || r.setoresPresentes[0];
  renderMeeting();
}

function openPendenciaModal(setorId, perguntaId) {
  pendingContext = { setorId, perguntaId };
  const modal = document.querySelector('#modalPendencia');
  document.querySelector('#pendDescricao').value = '';
  document.querySelector('#pendPrazoHoras').value = '';
  const setores = activeSectors().filter(s => s.id !== setorId);
  document.querySelector('#pendSetoresApoio').innerHTML = setores.map(s => checkOption('apoio', s)).join('');
  document.querySelector('#pendSetoresAcompanhamento').innerHTML = setores.map(s => checkOption('acompanha', s)).join('');
  modal.showModal();
}

function checkOption(prefix, s) {
  return `<label class="check-card"><input type="checkbox" name="${prefix}" value="${s.id}" /><span><strong>${s.nome}</strong><small>${s.tipo}</small></span></label>`;
}

function salvarPendencia() {
  const descricao = document.querySelector('#pendDescricao').value.trim();
  if (!descricao) return alert('Descreva a pendência.');
  const prazoHorasRaw = document.querySelector('#pendPrazoHoras').value;
  const prazoHoras = prazoHorasRaw === '' ? null : Number(prazoHorasRaw);
  const pergunta = db.perguntas.find(p => p.id === pendingContext.perguntaId);
  const id = Storage.uid('pend');

  db.pendencias.push({
    id,
    reuniaoOrigemId: currentMeetingId,
    reuniaoUltimaAtualizacaoId: currentMeetingId,
    setorOrigemId: pendingContext.setorId,
    perguntaOrigemId: pendingContext.perguntaId,
    perguntaTexto: pergunta?.texto || null,
    descricao,
    prazoHoras,
    statusGlobal: 'aberta',
    dataAbertura: Storage.nowISO(),
    dataConclusao: null
  });

  const participantes = new Map();
  participantes.set(pendingContext.setorId, 'origem');
  [...document.querySelectorAll('input[name="apoio"]:checked')].forEach(x => participantes.set(x.value, 'apoio'));
  [...document.querySelectorAll('input[name="acompanha"]:checked')].forEach(x => {
    if (!participantes.has(x.value)) participantes.set(x.value, 'acompanhamento');
  });

  participantes.forEach((papel, setorId) => {
    db.pendenciaParticipantes.push({
      id: Storage.uid('pp'),
      pendenciaId: id,
      setorId,
      papel,
      status: papel === 'acompanhamento' ? 'acompanhar' : 'aberta',
      dataStatus: Storage.nowISO(),
      observacao: ''
    });
  });

  Storage.addHistory(db, {
    reuniaoId: currentMeetingId,
    pendenciaId: id,
    setorId: pendingContext.setorId,
    tipo: 'criacao',
    statusNovo: 'aberta',
    observacao: descricao
  });

  Storage.save(db);
  document.querySelector('#modalPendencia').close();
  renderMeeting();
}

function openStatusModal(pendenciaId) {
  statusContextPendenciaId = pendenciaId;
  const p = db.pendencias.find(x => x.id === pendenciaId);
  document.querySelector('#statusDescricao').textContent = p.descricao;
  renderStatusParticipantes();
  document.querySelector('#statusObs').value = '';
  document.querySelector('#modalStatus').showModal();
}

function renderStatusParticipantes() {
  const partes = db.pendenciaParticipantes.filter(pp => pp.pendenciaId === statusContextPendenciaId);
  document.querySelector('#statusParticipantes').innerHTML = partes.map(pp => `
    <div class="status-row">
      <div>
        <strong>${sectorById(pp.setorId).nome}</strong>
        <p class="muted">Papel: ${pp.papel}</p>
      </div>
      <select data-status-participante="${pp.id}">
        ${['aberta', 'parcial', 'cumprida', 'não cumprida', 'acompanhar'].map(st => `<option ${pp.status === st ? 'selected' : ''}>${st}</option>`).join('')}
      </select>
    </div>
  `).join('');
}

function salvarStatusPendencia() {
  const obs = document.querySelector('#statusObs').value.trim();
  document.querySelectorAll('[data-status-participante]').forEach(sel => {
    const pp = db.pendenciaParticipantes.find(x => x.id === sel.dataset.statusParticipante);
    if (!pp) return;
    const antigo = pp.status;
    pp.status = sel.value;
    pp.dataStatus = Storage.nowISO();
    pp.observacao = obs;
    if (antigo !== pp.status) {
      Storage.addHistory(db, {
        reuniaoId: currentMeetingId,
        pendenciaId: pp.pendenciaId,
        setorId: pp.setorId,
        tipo: 'status_setor',
        statusAnterior: antigo,
        statusNovo: pp.status,
        observacao: obs
      });
    }
  });
  atualizarStatusGlobal(statusContextPendenciaId);
  Storage.save(db);
  document.querySelector('#modalStatus').close();
  renderMeeting();
}

function renderResumo() {
  const r = meeting();
  const pend = pendenciasDaReuniaoAtual();
  app.innerHTML = `
    <section class="card">
      <p class="eyebrow">Resumo da reunião</p>
      <h2>${Storage.formatDateTime(r.dataInicio)}</h2>
      <div class="stat-grid">
        <div class="stat"><strong>${r.setoresPresentes.length}</strong><span>setores presentes</span></div>
        <div class="stat"><strong>${db.respostas.filter(x => x.reuniaoId === r.id).length}</strong><span>respostas</span></div>
        <div class="stat"><strong>${pend.length}</strong><span>pendências movimentadas</span></div>
      </div>
      <div class="actions">
        <button class="ghost" id="btnVoltarReuniao">Voltar para reunião</button>
        <button class="secondary" id="btnJSON">Baixar JSON</button>
        <button class="primary" id="btnEnviar">Enviar/registrar</button>
      </div>
    </section>
    <section class="card" style="margin-top:1rem">
      <h2>Pendências da reunião</h2>
      ${pend.length ? pend.map(renderPendingCard).join('') : '<p class="muted">Nenhuma pendência criada ou atualizada nesta reunião.</p>'}
    </section>
  `;
  document.querySelector('#btnVoltarReuniao').onclick = renderMeeting;
  document.querySelector('#btnJSON').onclick = () => Sync.baixarJSON(db, currentMeetingId);
  document.querySelector('#btnEnviar').onclick = async () => {
    const result = await Sync.enviarReuniao(db, currentMeetingId);
    syncStatus.textContent = result.modo === 'online' ? 'Enviado' : 'Local';
    alert(result.mensagem);
  };
  document.querySelectorAll('[data-status-pend]').forEach(btn => btn.onclick = () => openStatusModal(btn.dataset.statusPend));
}

async function finalizarReuniao() {
  const r = meeting();
  if (!confirm('Finalizar esta reunião?')) return;
  r.status = 'finalizada';
  r.dataFim = Storage.nowISO();
  Storage.save(db);
  renderResumo();
}

function renderPendenciasAbertas() {
  const pend = db.pendencias.filter(p => p.statusGlobal !== 'concluida' && p.statusGlobal !== 'cancelada');
  app.innerHTML = `
    <section class="card">
      <div class="section-title">
        <div><p class="eyebrow">Acompanhamento</p><h2>Pendências abertas</h2></div>
        <button class="ghost" id="btnHomePend">Voltar</button>
      </div>
      ${pend.length ? pend.map(renderPendingCard).join('') : '<p class="muted">Nenhuma pendência aberta.</p>'}
    </section>
  `;
  document.querySelector('#btnHomePend').onclick = renderHome;
  document.querySelectorAll('[data-status-pend]').forEach(btn => btn.onclick = () => {
    currentMeetingId = db.reunioes[0]?.id || null;
    openStatusModal(btn.dataset.statusPend);
  });
}

function renderConfig() {
  app.innerHTML = `
    <section class="grid two">
      <div class="card">
        <p class="eyebrow">Configurações</p>
        <h2>Setores</h2>
        <label class="field"><span>Nome do setor</span><input id="novoSetorNome" placeholder="Ex.: Farmácia" /></label>
        <label class="field"><span>Tipo</span><select id="novoSetorTipo"><option value="assistencial">assistencial</option><option value="apoio">apoio</option></select></label>
        <button class="primary" id="btnAddSetor">Adicionar setor</button>
        <div class="table-like" style="margin-top:1rem">
          ${db.setores.map(s => `<div class="item-row"><div><strong>${s.nome}</strong><p>${s.tipo} · ${s.ativo === false ? 'inativo' : 'ativo'}</p></div><button class="ghost" data-toggle-setor="${s.id}">${s.ativo === false ? 'Ativar' : 'Inativar'}</button></div>`).join('')}
        </div>
      </div>
      <div class="card">
        <p class="eyebrow">Configurações</p>
        <h2>Perguntas por setor</h2>
        <label class="field"><span>Setor</span><select id="perguntaSetor">${db.setores.map(s => `<option value="${s.id}">${s.nome}</option>`).join('')}</select></label>
        <label class="field"><span>Pergunta</span><textarea id="perguntaTexto" rows="3" placeholder="Digite a pergunta"></textarea></label>
        <label class="field"><span>Tipo de resposta</span><select id="perguntaTipo"><option value="sim_nao">Sim/Não</option><option value="numero">Número</option><option value="texto">Texto</option></select></label>
        <label class="check-card"><input type="checkbox" id="perguntaPodePend" checked /><span><strong>Pode gerar pendência</strong><small>Mesmo assim, a pendência sempre poderá ser criada manualmente.</small></span></label>
        <div class="actions"><button class="primary" id="btnAddPergunta">Adicionar pergunta</button><button class="danger" id="btnReset">Resetar base local</button></div>
      </div>
    </section>
    <section class="card" style="margin-top:1rem">
      <div class="section-title"><h2>Perguntas cadastradas</h2><button class="ghost" id="btnHomeConfig">Voltar</button></div>
      <div class="table-like">
        ${db.perguntas.map(p => `<div class="item-row"><div><strong>${sectorById(p.setorId).nome}</strong><p>${p.texto} · tipo: ${p.tipo} · ${p.podeGerarPendencia ? 'pode gerar pendência' : 'informativa'}</p></div><button class="ghost" data-toggle-pergunta="${p.id}">${p.ativo === false ? 'Ativar' : 'Inativar'}</button></div>`).join('')}
      </div>
    </section>
  `;
  document.querySelector('#btnHomeConfig').onclick = renderHome;
  document.querySelector('#btnAddSetor').onclick = () => {
    const nome = document.querySelector('#novoSetorNome').value.trim();
    const tipo = document.querySelector('#novoSetorTipo').value;
    if (!nome) return alert('Informe o nome do setor.');
    db.setores.push({ id: slug(nome), nome, tipo, ativo: true });
    Storage.save(db);
    renderConfig();
  };
  document.querySelector('#btnAddPergunta').onclick = () => {
    const setorId = document.querySelector('#perguntaSetor').value;
    const texto = document.querySelector('#perguntaTexto').value.trim();
    if (!texto) return alert('Digite a pergunta.');
    db.perguntas.push({
      id: Storage.uid('perg'),
      setorId,
      ordem: perguntasDoSetor(setorId).length + 1,
      texto,
      tipo: document.querySelector('#perguntaTipo').value,
      podeGerarPendencia: document.querySelector('#perguntaPodePend').checked,
      ativo: true
    });
    Storage.save(db);
    renderConfig();
  };
  document.querySelector('#btnReset').onclick = () => {
    if (!confirm('Apagar dados locais e voltar para a configuração inicial?')) return;
    db = Storage.resetSeeds();
    renderHome();
  };
  document.querySelectorAll('[data-toggle-setor]').forEach(btn => btn.onclick = () => {
    const s = db.setores.find(x => x.id === btn.dataset.toggleSetor);
    s.ativo = s.ativo === false;
    Storage.save(db);
    renderConfig();
  });
  document.querySelectorAll('[data-toggle-pergunta]').forEach(btn => btn.onclick = () => {
    const p = db.perguntas.find(x => x.id === btn.dataset.togglePergunta);
    p.ativo = p.ativo === false;
    Storage.save(db);
    renderConfig();
  });
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function slug(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || Storage.uid('setor');
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

document.querySelector('#btnHome').onclick = renderHome;
document.querySelector('#btnConfig').onclick = renderConfig;
document.querySelector('#btnFecharPendencia').onclick = () => document.querySelector('#modalPendencia').close();
document.querySelector('#btnCancelarPendencia').onclick = () => document.querySelector('#modalPendencia').close();
document.querySelector('#formPendencia').onsubmit = event => { event.preventDefault(); salvarPendencia(); };
document.querySelectorAll('[data-prazo]').forEach(btn => btn.onclick = () => {
  document.querySelectorAll('[data-prazo]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelector('#pendPrazoHoras').value = btn.dataset.prazo === '0' ? '' : btn.dataset.prazo;
});
document.querySelector('#btnFecharStatus').onclick = () => document.querySelector('#modalStatus').close();
document.querySelector('#btnCancelarStatus').onclick = () => document.querySelector('#modalStatus').close();
document.querySelector('#formStatusPendencia').onsubmit = event => { event.preventDefault(); salvarStatusPendencia(); };
document.querySelector('#btnCumprirTodos').onclick = () => {
  document.querySelectorAll('[data-status-participante]').forEach(sel => {
    if (sel.value !== 'acompanhar') sel.value = 'cumprida';
  });
};
document.querySelector('#btnAbrirTodos').onclick = () => {
  document.querySelectorAll('[data-status-participante]').forEach(sel => {
    if (sel.value !== 'acompanhar') sel.value = 'aberta';
  });
};

renderHome();
