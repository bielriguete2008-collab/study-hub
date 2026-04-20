// lib/onboarding/flow.js — Fluxo de 5 perguntas para novos alunos

import { updateStudent } from '../supabase.js';
import { normalizeCourse } from '../orchestrator/index.js';

const STEPS = {
  0: askName,
  1: askCourse,
  2: askSemester,
  3: askStyle,
  4: askStruggle,
};

export async function handleOnboarding(student, userMessage) {
  const step = student.onboard_step || 0;
  const updateData = await processStep(step, student, userMessage);
  const nextStep   = step + 1;

  await updateStudent(student.phone, {
    ...updateData,
    onboard_step: nextStep,
    onboarded:    nextStep >= Object.keys(STEPS).length
  });

  if (nextStep >= Object.keys(STEPS).length) {
    return { message: buildWelcomeMessage(student, updateData), done: true };
  }

  const nextFn = STEPS[nextStep];
  return { message: nextFn(student, updateData), done: false };
}

export function getFirstQuestion() {
  return `👋 Olá! Sou o *Study Hub*, seu tutor de estudos por IA.

Vou te conhecer melhor com 5 perguntas rápidas para personalizar sua experiência!

*1️⃣ Qual é o seu nome?*`;
}

async function processStep(step, student, answer) {
  switch (step) {
    case 0: return { name: answer.trim().split(' ')[0] };
    case 1:
      const courseId = normalizeCourse(answer);
      return { course: courseId || answer.trim(), institution: extractInstitution(answer) };
    case 2:
      const sem = parseInt(answer.match(/\d+/)?.[0]);
      return { semester: sem || 1 };
    case 3:
      const lower = answer.toLowerCase();
      let style = 'balanced';
      if (lower.includes('a') || lower.includes('diret') || lower.includes('simples')) style = 'direct';
      if (lower.includes('b') || lower.includes('socr') || lower.includes('pens')) style = 'socratic';
      if (lower.includes('c') || lower.includes('equilib') || lower.includes('mist')) style = 'balanced';
      return { preferred_style: style };
    case 4: return { main_struggle: answer.trim() };
    default: return {};
  }
}

function askName(student, prevData) {
  return `Prazer, *${prevData.name}*! 😊\n\n*2️⃣ Qual curso você está fazendo e em qual faculdade?*\n_Ex: "Ciência de Dados no IBMEC" ou "Direito na USP"_`;
}
function askCourse(student, prevData) {
  return `Que curso incrível! 🚀\n\n*3️⃣ Em qual semestre você está?*\n_Ex: "3° semestre" ou só "3"_`;
}
function askSemester(student, prevData) {
  return `Anotado!\n\n*4️⃣ Como você prefere aprender?*\n\n*A)* Me explica direto, sem rodeios\n*B)* Me faz pensar com perguntas (método socrático)\n*C)* Equilibrado — explica E me faz pensar\n\n_Responda A, B ou C_`;
}
function askStyle(student, prevData) {
  return `Perfeito, gosto do seu estilo! 💡\n\n*5️⃣ Qual matéria te dá mais dor de cabeça atualmente?*\n_Ex: "Cálculo 2", "Algoritmos", "Direito Civil"_`;
}

function buildWelcomeMessage(student, lastData) {
  const name     = student.name || lastData.name || 'Aluno';
  const course   = student.course || 'seu curso';
  const struggle = lastData.main_struggle || 'suas matérias';
  const styleMap = { direct: 'direto ao ponto', socratic: 'socrático', balanced: 'equilibrado' };
  const style    = styleMap[lastData.preferred_style || student.preferred_style] || 'equilibrado';
  return `✅ *Perfil criado com sucesso, ${name}!*

📚 *Seu Study Hub está pronto:*
• Curso: ${course} (${student.semester || lastData.semester || '?'}° semestre)
• Estilo: ${style}
• Foco atual: ${struggle}

💳 *Saldo inicial: 150 créditos gratuitos*

🎯 *Pode mandar sua primeira dúvida!*`;
}

function extractInstitution(text) {
  const matches = text.match(/\b(ibmec|usp|unicamp|fgv|puc|ufrj|ufmg|unesp|ufscar|uel|ufsc|unb|uece|ufba|ufpe|ufc|ufpr)\b/i);
  return matches ? matches[0].toUpperCase() : null;
}
