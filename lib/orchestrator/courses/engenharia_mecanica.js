import { routeToAgent } from '../router.js';
const COURSE_NAME = 'Engenharia Mecânica';
const AGENTS = ["agente_calculo_1","agente_calculo_2","agente_calculo_3","agente_algebra_linear","agente_probabilidade_estatistica","agente_equacoes_diferenciais","agente_fisica_1","agente_fisica_2","agente_fisica_3","agente_mecanica_solidos","agente_termodinamica","agente_mecanica_fluidos","agente_fenomenos_transporte","agente_materiais","agente_metodos_numericos","agente_gestao_projetos","agente_portugues","agente_ingles","agente_metodologia_cientifica","agente_etica_profissional"];
export async function orchestrate(student, message) { return routeToAgent(message, AGENTS, COURSE_NAME); }
