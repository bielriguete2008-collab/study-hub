import { routeToAgent } from '../router.js';
const COURSE_NAME = 'Enfermagem';
const AGENTS = ["agente_anatomia","agente_fisiologia","agente_microbiologia","agente_farmacologia","agente_epidemiologia","agente_probabilidade_estatistica","agente_psicologia_geral","agente_portugues","agente_ingles","agente_metodologia_cientifica","agente_etica_profissional"];
export async function orchestrate(student, message) { return routeToAgent(message, AGENTS, COURSE_NAME); }
