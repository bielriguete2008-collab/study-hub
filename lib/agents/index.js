// lib/agents/index.js — Mapa central de todos os 60 agentes únicos
// Cada agente é identificado por um ID e contém seu system prompt especializado.

import { getBasePrompt } from './base.js';

// ── Matemática e Exatas ───────────────────────────────────────────
import { prompt as calculo1 }      from './matematica/calculo_1.js';
import { prompt as calculo2 }      from './matematica/calculo_2.js';
import { prompt as calculo3 }      from './matematica/calculo_3.js';
import { prompt as algebraLinear } from './matematica/algebra_linear.js';
import { prompt as probEstat }     from './matematica/probabilidade_estatistica.js';
import { prompt as matDiscreta }   from './matematica/matematica_discreta.js';
import { prompt as geomAnalitica } from './matematica/geometria_analitica.js';
import { prompt as eqDiferenciais } from './matematica/equacoes_diferenciais.js';
import { prompt as metNumericos }  from './matematica/metodos_numericos.js';
import { prompt as matFinanceira } from './matematica/matematica_financeira.js';

// ── Computação e Tecnologia ───────────────────────────────────────
import { prompt as introProg }     from './computacao/intro_programacao.js';
import { prompt as estrutDados }   from './computacao/estruturas_dados.js';
import { prompt as algoritmos }    from './computacao/algoritmos.js';
import { prompt as bancoDados }    from './computacao/banco_dados.js';
import { prompt as redes }         from './computacao/redes_computadores.js';
import { prompt as sistOp }        from './computacao/sistemas_operacionais.js';
import { prompt as engSoft }       from './computacao/engenharia_software.js';
import { prompt as ml }            from './computacao/machine_learning.js';
import { prompt as deepLearning }  from './computacao/deep_learning.js';
import { prompt as vizDados }      from './computacao/visualizacao_dados.js';
import { prompt as procSinais }    from './computacao/processamento_sinais.js';

// ── Física e Engenharia ───────────────────────────────────────────
import { prompt as fisica1 }       from './fisica/fisica_1.js';
import { prompt as fisica2 }       from './fisica/fisica_2.js';
import { prompt as fisica3 }       from './fisica/fisica_3.js';
import { prompt as mecSolidos }    from './fisica/mecanica_solidos.js';
import { prompt as termodinamica } from './fisica/termodinamica.js';
import { prompt as circuitos }     from './fisica/circuitos_eletricos.js';
import { prompt as mecFluidos }    from './fisica/mecanica_fluidos.js';
import { prompt as fenTransporte } from './fisica/fenomenos_transporte.js';
import { prompt as materiais }     from './fisica/materiais.js';
import { prompt as instalacoes }   from './fisica/instalacoes.js';

// ── Gestão e Negócios ─────────────────────────────────────────────
import { prompt as micro }         from './gestao/microeconomia.js';
import { prompt as macro }         from './gestao/macroeconomia.js';
import { prompt as contab }        from './gestao/contabilidade_geral.js';
import { prompt as financas }      from './gestao/financas_corporativas.js';
import { prompt as marketing }     from './gestao/marketing_digital.js';
import { prompt as gestaoOp }      from './gestao/gestao_operacoes.js';
import { prompt as gestaoProj }    from './gestao/gestao_projetos.js';
import { prompt as dirEmpresa }    from './gestao/direito_empresarial.js';
import { prompt as empreend }      from './gestao/empreendedorismo.js';

// ── Saúde ─────────────────────────────────────────────────────────
import { prompt as anatomia }      from './saude/anatomia.js';
import { prompt as fisiologia }    from './saude/fisiologia.js';
import { prompt as bioquimica }    from './saude/bioquimica.js';
import { prompt as microbiologia } from './saude/microbiologia.js';
import { prompt as farmacologia }  from './saude/farmacologia.js';
import { prompt as patologia }     from './saude/patologia.js';
import { prompt as epidemiologia } from './saude/epidemiologia.js';
import { prompt as histologia }    from './saude/histologia.js';
import { prompt as parasitologia } from './saude/parasitologia.js';
import { prompt as semiologia }    from './saude/semiologia.js';

// ── Ciências Humanas e Direito ────────────────────────────────────
import { prompt as filosofia }     from './humanas/filosofia_sociologia.js';
import { prompt as psicologia }    from './humanas/psicologia_geral.js';
import { prompt as dirConst }      from './humanas/direito_constitucional.js';
import { prompt as dirCivil }      from './humanas/direito_civil.js';
import { prompt as dirPenal }      from './humanas/direito_penal.js';
import { prompt as dirTrabalho }   from './humanas/direito_trabalho.js';
import { prompt as processos }     from './humanas/processo_civil_penal.js';
import { prompt as pedagogia }     from './humanas/pedagogia.js';

// ── Línguas ───────────────────────────────────────────────────────
import { prompt as portugues }     from './linguas/portugues.js';
import { prompt as ingles }        from './linguas/ingles.js';
import { prompt as espanhol }      from './linguas/espanhol.js';

// ── Transversal ───────────────────────────────────────────────────
import { prompt as metodologia }   from './transversal/metodologia_cientifica.js';
import { prompt as etica }         from './transversal/etica_profissional.js';

// ── Mapa ID → prompt ─────────────────────────────────────────────
export const AGENTS = {
  agente_calculo_1:                { label: 'Cálculo I',                    prompt: calculo1 },
  agente_calculo_2:                { label: 'Cálculo II',                   prompt: calculo2 },
  agente_calculo_3:                { label: 'Cálculo III',                  prompt: calculo3 },
  agente_algebra_linear:           { label: 'Álgebra Linear',               prompt: algebraLinear },
  agente_probabilidade_estatistica:{ label: 'Probabilidade e Estatística',  prompt: probEstat },
  agente_matematica_discreta:      { label: 'Matemática Discreta',          prompt: matDiscreta },
  agente_geometria_analitica:      { label: 'Geometria Analítica',          prompt: geomAnalitica },
  agente_equacoes_diferenciais:    { label: 'Equações Diferenciais',        prompt: eqDiferenciais },
  agente_metodos_numericos:        { label: 'Métodos Numéricos',            prompt: metNumericos },
  agente_matematica_financeira:    { label: 'Matemática Financeira',        prompt: matFinanceira },

  agente_intro_programacao:        { label: 'Introdução à Programação',     prompt: introProg },
  agente_estruturas_dados:         { label: 'Estruturas de Dados',          prompt: estrutDados },
  agente_algoritmos:               { label: 'Algoritmos',                   prompt: algoritmos },
  agente_banco_dados:              { label: 'Banco de Dados',               prompt: bancoDados },
  agente_redes_computadores:       { label: 'Redes de Computadores',        prompt: redes },
  agente_sistemas_operacionais:    { label: 'Sistemas Operacionais',        prompt: sistOp },
  agente_engenharia_software:      { label: 'Engenharia de Software',       prompt: engSoft },
  agente_machine_learning:         { label: 'Machine Learning',             prompt: ml },
  agente_deep_learning:            { label: 'Deep Learning',                prompt: deepLearning },
  agente_visualizacao_dados:       { label: 'Visualização de Dados',        prompt: vizDados },
  agente_processamento_sinais:     { label: 'Processamento de Sinais',      prompt: procSinais },

  agente_fisica_1:                 { label: 'Física I — Mecânica',          prompt: fisica1 },
  agente_fisica_2:                 { label: 'Física II — Eletromagnetismo', prompt: fisica2 },
  agente_fisica_3:                 { label: 'Física III — Óptica/Ondas',    prompt: fisica3 },
  agente_mecanica_solidos:         { label: 'Mecânica dos Sólidos',         prompt: mecSolidos },
  agente_termodinamica:            { label: 'Termodinâmica',                prompt: termodinamica },
  agente_circuitos_eletricos:      { label: 'Circuitos Elétricos',          prompt: circuitos },
  agente_mecanica_fluidos:         { label: 'Mecânica dos Fluidos',         prompt: mecFluidos },
  agente_fenomenos_transporte:     { label: 'Fenômenos de Transporte',      prompt: fenTransporte },
  agente_materiais:                { label: 'Ciência dos Materiais',        prompt: materiais },
  agente_instalacoes:              { label: 'Instalações e Estruturas',     prompt: instalacoes },

  agente_microeconomia:            { label: 'Microeconomia',                prompt: micro },
  agente_macroeconomia:            { label: 'Macroeconomia',                prompt: macro },
  agente_contabilidade_geral:      { label: 'Contabilidade Geral',          prompt: contab },
  agente_financas_corporativas:    { label: 'Finanças Corporativas',        prompt: financas },
  agente_marketing_digital:        { label: 'Marketing',                    prompt: marketing },
  agente_gestao_operacoes:         { label: 'Gestão de Operações',          prompt: gestaoOp },
  agente_gestao_projetos:          { label: 'Gestão de Projetos',           prompt: gestaoProj },
  agente_direito_empresarial:      { label: 'Direito Empresarial',          prompt: dirEmpresa },
  agente_empreendedorismo:         { label: 'Empreendedorismo',             prompt: empreend },

  agente_anatomia:                 { label: 'Anatomia Humana',              prompt: anatomia },
  agente_fisiologia:               { label: 'Fisiologia Humana',            prompt: fisiologia },
  agente_bioquimica:               { label: 'Bioquímica',                   prompt: bioquimica },
  agente_microbiologia:            { label: 'Microbiologia e Imunologia',   prompt: microbiologia },
  agente_farmacologia:             { label: 'Farmacologia',                 prompt: farmacologia },
  agente_patologia:                { label: 'Patologia Geral',              prompt: patologia },
  agente_epidemiologia:            { label: 'Epidemiologia',                prompt: epidemiologia },
  agente_histologia:               { label: 'Histologia e Embriologia',     prompt: histologia },
  agente_parasitologia:            { label: 'Parasitologia',                prompt: parasitologia },
  agente_semiologia:               { label: 'Semiologia Médica',            prompt: semiologia },

  agente_filosofia_sociologia:     { label: 'Filosofia e Sociologia',       prompt: filosofia },
  agente_psicologia_geral:         { label: 'Psicologia Geral',             prompt: psicologia },
  agente_direito_constitucional:   { label: 'Direito Constitucional',       prompt: dirConst },
  agente_direito_civil:            { label: 'Direito Civil',                prompt: dirCivil },
  agente_direito_penal:            { label: 'Direito Penal',                prompt: dirPenal },
  agente_direito_trabalho:         { label: 'Direito do Trabalho',          prompt: dirTrabalho },
  agente_processo_civil_penal:     { label: 'Processo Civil e Penal',       prompt: processos },
  agente_pedagogia:                { label: 'Pedagogia e Didática',         prompt: pedagogia },

  agente_portugues:                { label: 'Português',                    prompt: portugues },
  agente_ingles:                   { label: 'Inglês',                       prompt: ingles },
  agente_espanhol:                 { label: 'Espanhol',                     prompt: espanhol },

  agente_metodologia_cientifica:   { label: 'Metodologia Científica / TCC', prompt: metodologia },
  agente_etica_profissional:       { label: 'Ética Profissional',           prompt: etica },
};

export function buildAgentPrompt(agentId, student, memories = '') {
  const agent   = AGENTS[agentId];
  if (!agent) return getBasePrompt(student, memories);
  const base    = agent.prompt(student);
  const profile = buildStudentProfile(student);
  return `${base}\n\n${profile}${memories}`;
}

function buildStudentProfile(student) {
  return `\nPERFIL DO ALUNO:\n- Nome: ${student.name || 'Aluno'}\n- Curso: ${student.course || 'Não informado'}, ${student.semester || '?'}° semestre\n- Instituição: ${student.institution || 'Não informada'}\n- Estilo de aprendizado: ${student.preferred_style || 'balanced'}\n- Ritmo: ${student.study_pace || 'normal'}\n- Principal dificuldade declarada: ${student.main_struggle || 'Não informado'}\n`;
}
