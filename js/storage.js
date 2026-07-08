const DB_KEY = 'safety_huddle_db_v001';

const Storage = {
  load() {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);

    const cfg = window.SAFETY_HUDDLE_CONFIG;
    const db = {
      versao: '0.1.0',
      setores: cfg.setores,
      perguntas: cfg.perguntas,
      reunioes: [],
      respostas: [],
      pendencias: [],
      pendenciaParticipantes: [],
      historicoPendencias: []
    };
    this.save(db);
    return db;
  },

  save(db) {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  },

  resetSeeds() {
    localStorage.removeItem(DB_KEY);
    return this.load();
  },

  uid(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  },

  nowISO() {
    return new Date().toISOString();
  },

  formatDateTime(iso) {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('pt-BR');
  },

  addHistory(db, evento) {
    db.historicoPendencias.push({
      id: this.uid('hist'),
      dataHora: this.nowISO(),
      ...evento
    });
  }
};
