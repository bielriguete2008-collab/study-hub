// lib/orchestrator/index.js — Mapa de cursos para orquestradores

import { orchestrate as cienciaDados }       from './courses/ciencia_dados.js';
import { orchestrate as ia }                 from './courses/inteligencia_artificial.js';
import { orchestrate as cienciaComp }        from './courses/ciencia_computacao.js';
import { orchestrate as engComp }            from './courses/engenharia_computacao.js';
import { orchestrate as engCivil }           from './courses/engenharia_civil.js';
import { orchestrate as engEletrica }        from './courses/engenharia_eletrica.js';
import { orchestrate as engMecanica }        from './courses/engenharia_mecanica.js';
import { orchestrate as engQuimica }         from './courses/engenharia_quimica.js';
import { orchestrate as administracao }      from './courses/administracao.js';
import { orchestrate as economia }           from './courses/economia.js';
import { orchestrate as contabilidade }      from './courses/contabilidade.js';
import { orchestrate as marketing }          from './courses/marketing.js';
import { orchestrate as direito }            from './courses/direito.js';
import { orchestrate as psicologia }         from './courses/psicologia.js';
import { orchestrate as pedagogia }          from './courses/pedagogia.js';
import { orchestrate as medicina }           from './courses/medicina.js';
import { orchestrate as biomedicina }        from './courses/biomedicina.js';
import { orchestrate as enfermagem }         from './courses/enfermagem.js';
import { orchestrate as farmacia }           from './courses/farmacia.js';
import { orchestrate as arquitetura }        from './courses/arquitetura.js';

const COURSE_MAP = {
  ciencia_dados: cienciaDados, inteligencia_artificial: ia, ciencia_computacao: cienciaComp,
  engenharia_computacao: engComp, engenharia_civil: engCivil, engenharia_eletrica: engEletrica,
  engenharia_mecanica: engMecanica, engenharia_quimica: engQuimica,
  administracao, economia, contabilidade, marketing, direito,
  psicologia, pedagogia, medicina, biomedicina, enfermagem, farmacia, arquitetura
};

const ALIASES = {
  'ciência de dados': 'ciencia_dados', 'ciencias de dados': 'ciencia_dados', 'data science': 'ciencia_dados',
  'ia': 'inteligencia_artificial', 'inteligência artificial': 'inteligencia_artificial',
  'computação': 'ciencia_computacao', 'cc': 'ciencia_computacao',
  'eng comp': 'engenharia_computacao', 'engenharia de software': 'engenharia_computacao',
  'civil': 'engenharia_civil', 'elétrica': 'engenharia_eletrica', 'mecânica': 'engenharia_mecanica',
  'química': 'engenharia_quimica', 'adm': 'administracao', 'administração': 'administracao',
  'negócios': 'administracao', 'eco': 'economia', 'cont': 'contabilidade',
  'ciências contábeis': 'contabilidade', 'mkt': 'marketing', 'med': 'medicina',
  'bio': 'biomedicina', 'farm': 'farmacia', 'arq': 'arquitetura'
};

export function normalizeCourse(rawCourse) {
  if (!rawCourse) return null;
  const lower = rawCourse.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [alias, id] of Object.entries(ALIASES)) {
    const aliasNorm = alias.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (lower.includes(aliasNorm)) return id;
  }
  for (const id of Object.keys(COURSE_MAP)) {
    if (lower.includes(id.replace(/_/g, ' ')) || lower.includes(id)) return id;
  }
  return null;
}

export async function routeToCourse(student, message) {
  const orchestFn = COURSE_MAP[student.course];
  if (!orchestFn) return 'agente_metodologia_cientifica';
  return orchestFn(student, message);
}
