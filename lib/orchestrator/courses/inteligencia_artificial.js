import { routeToAgent } from '../router.js';
const COURSE_NAME = 'Inteligência Artificial';
const AGENTS = ["agente_calculo_1","agente_calculo_2","agente_algebra_linear","agente_probabilidade_estatistica","agente_matematica_discreta","agente_intro_programacao","agente_estruturas_dados","agente_algoritmos","agente_machine_learning","agente_deep_learning","agente_processamento_sinais","agente_banco_dados","agente_portugues","agente_ingles","agente_metodologia_cientifica","agente_etica_profissional"];
export async function orchestrate(student, message) { return routeToAgent(message, AGENTS, COURSE_NAME); }
