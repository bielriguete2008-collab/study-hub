import { routeToAgent } from '../router.js';
const COURSE_NAME = 'Farmácia';
const AGENTS = ["agente_bioquimica","agente_farmacologia","agente_microbiologia","agente_anatomia","agente_fisiologia","agente_patologia","agente_parasitologia","agente_probabilidade_estatistica","agente_quimica_organica","agente_portugues","agente_ingles","agente_metodologia_cientifica","agente_etica_profissional"];
export async function orchestrate(student, message) { return routeToAgent(message, AGENTS, COURSE_NAME); }
