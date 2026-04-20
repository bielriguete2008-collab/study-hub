import { routeToAgent } from '../router.js';
const COURSE_NAME = 'Medicina';
const AGENTS = ["agente_anatomia","agente_fisiologia","agente_bioquimica","agente_microbiologia","agente_farmacologia","agente_patologia","agente_epidemiologia","agente_histologia","agente_parasitologia","agente_semiologia","agente_fisica_1","agente_fisica_2","agente_fisica_3","agente_probabilidade_estatistica","agente_portugues","agente_ingles","agente_metodologia_cientifica","agente_etica_profissional"];
export async function orchestrate(student, message) { return routeToAgent(message, AGENTS, COURSE_NAME); }
