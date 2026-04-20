import { routeToAgent } from '../router.js';
const COURSE_NAME = 'Psicologia';
const AGENTS = ["agente_psicologia_geral","agente_filosofia_sociologia","agente_fisiologia","agente_bioquimica","agente_probabilidade_estatistica","agente_pedagogia","agente_epidemiologia","agente_portugues","agente_ingles","agente_metodologia_cientifica","agente_etica_profissional"];
export async function orchestrate(student, message) { return routeToAgent(message, AGENTS, COURSE_NAME); }
