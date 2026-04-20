import { routeToAgent } from '../router.js';
const COURSE_NAME = 'Ciência da Computação';
const AGENTS = ["agente_calculo_1","agente_calculo_2","agente_algebra_linear","agente_probabilidade_estatistica","agente_matematica_discreta","agente_geometria_analitica","agente_intro_programacao","agente_estruturas_dados","agente_algoritmos","agente_banco_dados","agente_redes_computadores","agente_sistemas_operacionais","agente_engenharia_software","agente_machine_learning","agente_processamento_sinais","agente_portugues","agente_ingles","agente_metodologia_cientifica","agente_etica_profissional"];
export async function orchestrate(student, message) { return routeToAgent(message, AGENTS, COURSE_NAME); }
