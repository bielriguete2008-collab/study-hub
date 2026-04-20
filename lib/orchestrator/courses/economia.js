import { routeToAgent } from '../router.js';
const COURSE_NAME = 'Economia';
const AGENTS = ["agente_microeconomia","agente_macroeconomia","agente_matematica_financeira","agente_calculo_1","agente_calculo_2","agente_algebra_linear","agente_probabilidade_estatistica","agente_contabilidade_geral","agente_financas_corporativas","agente_direito_empresarial","agente_banco_dados","agente_visualizacao_dados","agente_portugues","agente_ingles","agente_metodologia_cientifica","agente_etica_profissional"];
export async function orchestrate(student, message) { return routeToAgent(message, AGENTS, COURSE_NAME); }
