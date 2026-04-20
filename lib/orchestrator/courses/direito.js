import { routeToAgent } from '../router.js';
const COURSE_NAME = 'Direito';
const AGENTS = ["agente_direito_constitucional","agente_direito_civil","agente_direito_penal","agente_direito_trabalho","agente_processo_civil_penal","agente_direito_empresarial","agente_filosofia_sociologia","agente_probabilidade_estatistica","agente_portugues","agente_ingles","agente_metodologia_cientifica","agente_etica_profissional"];
export async function orchestrate(student, message) { return routeToAgent(message, AGENTS, COURSE_NAME); }
