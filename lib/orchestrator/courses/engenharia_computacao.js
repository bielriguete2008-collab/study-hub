import { routeToAgent } from '../router.js';
const COURSE_NAME = 'Engenharia de Computação';
const AGENTS = ["agente_calculo_1","agente_calculo_2","agente_calculo_3","agente_algebra_linear","agente_probabilidade_estatistica","agente_matematica_discreta","agente_equacoes_diferenciais","agente_fisica_1","agente_fisica_2","agente_circuitos_eletricos","agente_processamento_sinais","agente_intro_programacao","agente_estruturas_dados","agente_algoritmos","agente_sistemas_operacionais","agente_redes_computadores","agente_engenharia_software","agente_portugues","agente_ingles","agente_metodologia_cientifica","agente_etica_profissional"];
export async function orchestrate(student, message) { return routeToAgent(message, AGENTS, COURSE_NAME); }
