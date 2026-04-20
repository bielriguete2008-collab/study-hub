import { routeToAgent } from '../router.js';
const COURSE_NAME = 'Administração';
const AGENTS = ["agente_microeconomia","agente_macroeconomia","agente_matematica_financeira","agente_probabilidade_estatistica","agente_contabilidade_geral","agente_financas_corporativas","agente_marketing_digital","agente_gestao_operacoes","agente_gestao_projetos","agente_direito_empresarial","agente_empreendedorismo","agente_intro_programacao","agente_banco_dados","agente_portugues","agente_ingles","agente_metodologia_cientifica","agente_etica_profissional"];
export async function orchestrate(student, message) { return routeToAgent(message, AGENTS, COURSE_NAME); }
