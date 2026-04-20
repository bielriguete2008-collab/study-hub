import { routeToAgent } from '../router.js';
const COURSE_NAME = 'Engenharia Civil';
const AGENTS = ["agente_calculo_1","agente_calculo_2","agente_calculo_3","agente_algebra_linear","agente_probabilidade_estatistica","agente_geometria_analitica","agente_equacoes_diferenciais","agente_metodos_numericos","agente_fisica_1","agente_fisica_2","agente_mecanica_solidos","agente_mecanica_fluidos","agente_termodinamica","agente_materiais","agente_instalacoes","agente_gestao_projetos","agente_portugues","agente_ingles","agente_metodologia_cientifica","agente_etica_profissional"];
export async function orchestrate(student, message) { return routeToAgent(message, AGENTS, COURSE_NAME); }
