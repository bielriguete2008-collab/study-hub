import { routeToAgent } from '../router.js';
const COURSE_NAME = 'Pedagogia';
const AGENTS = ["agente_pedagogia","agente_psicologia_geral","agente_filosofia_sociologia","agente_probabilidade_estatistica","agente_portugues","agente_ingles","agente_metodologia_cientifica","agente_etica_profissional"];
export async function orchestrate(student, message) { return routeToAgent(message, AGENTS, COURSE_NAME); }
