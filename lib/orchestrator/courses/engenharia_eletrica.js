import { routeToAgent } from '../router.js';
const COURSE_NAME = 'Engenharia Elétrica';
const AGENTS = ["agente_calculo_1","agente_calculo_2","agente_calculo_3","agente_algebra_linear","agente_probabilidade_estatistica","agente_equacoes_diferenciais","agente_fisica_1","agente_fisica_2","agente_circuitos_eletricos","agente_processamento_sinais","agente_intro_programacao","agente_metodos_numericos","agente_portugues","agente_ingles","agente_metodologia_cientifica","agente_etica_profissional"];
export async function orchestrate(student, message) { return routeToAgent(message, AGENTS, COURSE_NAME); }
