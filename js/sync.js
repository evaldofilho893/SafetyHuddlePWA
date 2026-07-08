const Sync = {
  async enviarReuniao(db, reuniaoId) {
    const url = window.SAFETY_HUDDLE_CONFIG.SCRIPT_URL;
    const payload = this.montarPayload(db, reuniaoId);

    if (!url) {
      return { ok: false, modo: 'local', mensagem: 'SCRIPT_URL não configurada. Dados mantidos localmente.' };
    }

    const resp = await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return { ok: true, modo: 'online', mensagem: 'Envio solicitado ao Apps Script.', resposta: resp };
  },

  montarPayload(db, reuniaoId) {
    return {
      reuniao: db.reunioes.find(r => r.id === reuniaoId),
      respostas: db.respostas.filter(r => r.reuniaoId === reuniaoId),
      pendencias: db.pendencias.filter(p => p.reuniaoOrigemId === reuniaoId || p.reuniaoUltimaAtualizacaoId === reuniaoId),
      pendenciaParticipantes: db.pendenciaParticipantes,
      historicoPendencias: db.historicoPendencias.filter(h => h.reuniaoId === reuniaoId)
    };
  },

  baixarJSON(db, reuniaoId) {
    const payload = this.montarPayload(db, reuniaoId);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safety-huddle-${reuniaoId}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
};
