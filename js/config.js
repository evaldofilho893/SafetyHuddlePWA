// CONFIGURAÇÃO INICIAL
// Depois, esses dados podem vir do Google Sheets/App Script.
window.SAFETY_HUDDLE_CONFIG = {
  SCRIPT_URL: '', // Cole aqui a URL do Apps Script quando for integrar o envio.
  hospital: 'HRDJSN',
  setores: [
    { id: 'ps', nome: 'Pronto Socorro', tipo: 'assistencial', ativo: true },
    { id: 'uti', nome: 'UTI', tipo: 'assistencial', ativo: true },
    { id: 'clinica_medica', nome: 'Clínica Médica', tipo: 'assistencial', ativo: true },
    { id: 'clinica_cirurgica', nome: 'Clínica Cirúrgica', tipo: 'assistencial', ativo: true },
    { id: 'centro_cirurgico', nome: 'Centro Cirúrgico', tipo: 'assistencial', ativo: true },
    { id: 'farmacia', nome: 'Farmácia', tipo: 'apoio', ativo: true },
    { id: 'laboratorio', nome: 'Laboratório', tipo: 'apoio', ativo: true },
    { id: 'manutencao', nome: 'Manutenção', tipo: 'apoio', ativo: true },
    { id: 'higienizacao', nome: 'Higienização', tipo: 'apoio', ativo: true },
    { id: 'nir', nome: 'NIR', tipo: 'apoio', ativo: true }
  ],
  perguntas: [
    { id: 'ps_p1', setorId: 'ps', ordem: 1, texto: 'Há algum risco assistencial crítico no momento?', tipo: 'sim_nao', podeGerarPendencia: true, ativo: true },
    { id: 'ps_p2', setorId: 'ps', ordem: 2, texto: 'Há pacientes aguardando definição de fluxo ou transferência interna?', tipo: 'numero', podeGerarPendencia: true, ativo: true },
    { id: 'uti_p1', setorId: 'uti', ordem: 1, texto: 'Há indisponibilidade de leito, equipamento ou insumo crítico?', tipo: 'sim_nao', podeGerarPendencia: true, ativo: true },
    { id: 'uti_p2', setorId: 'uti', ordem: 2, texto: 'Há paciente com previsão de alta ou transferência?', tipo: 'texto', podeGerarPendencia: false, ativo: true },
    { id: 'clinica_medica_p1', setorId: 'clinica_medica', ordem: 1, texto: 'Há pendência que impacta alta, exame, medicação ou segurança do paciente?', tipo: 'sim_nao', podeGerarPendencia: true, ativo: true },
    { id: 'clinica_cirurgica_p1', setorId: 'clinica_cirurgica', ordem: 1, texto: 'Há pendência cirúrgica, material, avaliação ou leito?', tipo: 'sim_nao', podeGerarPendencia: true, ativo: true },
    { id: 'centro_cirurgico_p1', setorId: 'centro_cirurgico', ordem: 1, texto: 'Há risco de suspensão cirúrgica por material, equipe ou documentação?', tipo: 'sim_nao', podeGerarPendencia: true, ativo: true },
    { id: 'farmacia_p1', setorId: 'farmacia', ordem: 1, texto: 'Há falta, atraso ou substituição de medicamento/insumo relevante?', tipo: 'sim_nao', podeGerarPendencia: true, ativo: true },
    { id: 'laboratorio_p1', setorId: 'laboratorio', ordem: 1, texto: 'Há exames com atraso, equipamento indisponível ou outra limitação?', tipo: 'sim_nao', podeGerarPendencia: true, ativo: true },
    { id: 'manutencao_p1', setorId: 'manutencao', ordem: 1, texto: 'Há chamados críticos abertos que impactam assistência ou segurança?', tipo: 'sim_nao', podeGerarPendencia: true, ativo: true },
    { id: 'higienizacao_p1', setorId: 'higienizacao', ordem: 1, texto: 'Há dificuldade de higienização, isolamento, enxoval ou fluxo?', tipo: 'sim_nao', podeGerarPendencia: true, ativo: true },
    { id: 'nir_p1', setorId: 'nir', ordem: 1, texto: 'Há gargalo de regulação, transferência, vaga ou fluxo de pacientes?', tipo: 'sim_nao', podeGerarPendencia: true, ativo: true }
  ]
};
