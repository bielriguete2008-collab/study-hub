import { routeToAgent } from '../router.js';
const COURSE_NAME = 'Biomedicina';
const AGENTS = ["agente_anatomia","agente_fisiologia","agente_bioquimica","agente_microbiologia","agente_farmacologia","agente_patologia","agente_epidemiologia","agente_histologia","agente_parasitologia","agente_probabilidade_estatistica","agente_intro_programacao","agente_portugues","agente_ingles","agente_metodologia_cientifica","agente_etica_profissional"];
export async function orchestrate(student, message) { return routeToAgent(message, AGENTS, COURSE_NAME); }
