import { routeToAgent } from '../router.js';
const COURSE_NAME = 'Arquitetura e Urbanismo';
const AGENTS = ["agente_calculo_1","agente_fisica_1","agente_mecanica_solidos","agente_materiais","agente_instalacoes","agente_geometria_analitica","agente_probabilidade_estatistica","agente_gestao_projetos","agente_filosofia_sociologia","agente_portugues","agente_ingles","agente_metodologia_cientifica","agente_etica_profissional"];
export async function orchestrate(student, message) { return routeToAgent(message, AGENTS, COURSE_NAME); }
