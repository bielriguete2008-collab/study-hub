import { routeToAgent } from '../router.js';
const COURSE_NAME = 'Ciências Contábeis';
const AGENTS = ["agente_contabilidade_geral","agente_matematica_financeira","agente_probabilidade_estatistica","agente_microeconomia","agente_macroeconomia","agente_financas_corporativas","agente_direito_empresarial","agente_banco_dados","agente_portugues","agente_ingles","agente_metodologia_cientifica","agente_etica_profissional"];
export async function orchestrate(student, message) { return routeToAgent(message, AGENTS, COURSE_NAME); }
