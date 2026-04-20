import { routeToAgent } from '../router.js';
const COURSE_NAME = 'Marketing';
const AGENTS = ["agente_marketing_digital","agente_probabilidade_estatistica","agente_microeconomia","agente_matematica_financeira","agente_visualizacao_dados","agente_empreendedorismo","agente_direito_empresarial","agente_portugues","agente_ingles","agente_espanhol","agente_metodologia_cientifica","agente_etica_profissional"];
export async function orchestrate(student, message) { return routeToAgent(message, AGENTS, COURSE_NAME); }
