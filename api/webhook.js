export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('Study Bot OK');

  const msg = ((req.body && req.body.Body) || '').toLowerCase().trim();
  const today = new Date();
  const days = ['Domingo','Segunda','Tera','Quarta','Quinta','Sexta','Sabado'];
  const day = days[today.getDay()];
  const date = today.toLocaleDateString('pt-BR');

  // Calcular dias ate as provas
  const prova1 = new Date('2026-04-04');
  const prova2 = new Date('2026-04-07');
  const diff1 = Math.ceil((prova1 - today) / 86400000);
  const diff2 = Math.ceil((prova2 - today) / 86400000);
  const countdown1 = diff1 > 0 ? diff1 + ' dias' : (diff1 === 0 ? 'HOJE' : 'passou');
  const countdown2 = diff2 > 0 ? diff2 + ' dias' : (diff2 === 0 ? 'HOJE' : 'passou');

  let reply = '';

  const has = (...words) => words.some(w => msg.includes(w));

  if (has('oi','ola','ola','bom dia','boa tarde','boa noite','hey','hi')) {
    reply = '*Oi Gabriel!* Sou seu agente de estudos IBMEC.\n\nO que voce quer?\n\n- *prova* - proximas provas\n- *plano* - o que estudar hoje\n- *matrizes* - resumo GAAL\n- *derivadas* - resumo Calculo\n- *limites* - limites especiais\n- *discreta* - Mat. Discreta\n- *programacao* - Prog. Estruturada\n- *hub* - link do site';
  } else if (has('prova','provas','avaliacao','quando','falta')) {
    reply = '*Proximas Provas*\n\nMat. Discreta - 04/04 (' + countdown1 + ')\nProg. Estruturada - 07/04 (' + countdown2 + ')\n\nHoje e ' + day + ', ' + date;
  } else if (has('plano','hoje','estudar','foco','meta','agenda')) {
    const topics = diff1 <= 3 ? 'Mat. Discreta (URGENTE!)\n- Calculo\n- GAAL' : diff2 <= 3 ? 'Prog. Estruturada (URGENTE!)\n- Calculo\n- GAAL' : 'GAAL - Matrizes\n- Calculo - Derivadas\n- Mat. Discreta';
    reply = '*Plano de hoje - ' + day + '*\n\nFoco:\n' + topics + '\n\nMeta: 90 min\nHub: https://bielriguete2008-collab.github.io/study-hub/';
  } else if (has('matri','gaal','algebra','linear')) {
    reply = '*Matrizes (GAAL)*\n\nUma matriz m x n organiza numeros em linhas e colunas.\n\nMultiplicacao: A(m x n) x B(n x p) = C(m x p)\nLembre: colunas de A = linhas de B!\n\nPropriedades:\n- A x B diferente B x A (nao comutativa)\n- (A x B) x C = A x (B x C) (associativa)\n- A x I = A (identidade)\n\nCai na prova: calcular produto manual e verificar dimensoes!';
  } else if (has('derivad','regra da cadeia','derivar')) {
    reply = '*Derivadas (Calculo)*\n\nRegras:\n- xn -> n.x(n-1)\n- ex -> ex\n- sen(x) -> cos(x)\n- cos(x) -> -sen(x)\n- ln(x) -> 1/x\n\nRegra do Produto: (f.g)\'=f\'.g+f.g\'\nRegra da Cadeia: (fog)\'=f\'(g(x)).g\'(x)\n\nExemplo: f(x)=(3x+2)^5 -> f\'=5.(3x+2)^4.3=15.(3x+2)^4';
  } else if (has('limit','lim ','l\'hopital','indetermina')) {
    reply = '*Limites (Calculo)*\n\nLimites especiais:\n- lim sen(x)/x = 1 (x->0)\n- lim (1-cos x)/x^2 = 1/2 (x->0)\n- lim (1+1/x)^x = e (x->inf)\n- lim (ex-1)/x = 1 (x->0)\n\nIndeterminacao 0/0: fatorar ou usar L\'Hopital\n- L\'Hopital: lim f/g = lim f\'/g\'';
  } else if (has('discret','logica','proposicion','tabela verdade','conjunt','inducao')) {
    reply = '*Matematica Discreta*\n\nLogica: p^q (e), pvq (ou), ~p (nao), p->q (implica)\n\nTabela verdade: pratique bastante!\n\nConjuntos:\n- A uniao B: elementos em A ou B\n- A intersecao B: so os comuns\n- A\': complemento de A\n\nInducao matematica:\n1. Caso base: P(1) verdadeiro\n2. Passo: P(k) -> P(k+1)\n\nPROVA: ' + countdown1 + '!';
  } else if (has('program','python','codigo','if','for','while','funcao','variavel')) {
    reply = '*Programacao Estruturada*\n\nConceitos-chave:\n- Variaveis e tipos (int, float, str, bool)\n- Condicionais: if/elif/else\n- Repeticao: for, while\n- Funcoes: def nome(params): ...\n\nDica: escreva codigo todo dia!\n\nPROVA: ' + countdown2 + '!';
  } else if (has('hub','site','link','url','acessar')) {
    reply = '*Study Hub*\n\nhttps://bielriguete2008-collab.github.io/study-hub/\n\nSeu hub com:\n- Score de dificuldade por materia\n- Resumos interativos\n- Plano de estudos semanal';
  } else if (has('resumo','explica','me fala','como funciona','o que e','o que eh')) {
    reply = 'Sobre qual materia voce quer o resumo?\n\n- *matrizes* - GAAL\n- *derivadas* ou *limites* - Calculo\n- *discreta* - Mat. Discreta\n- *programacao* - Prog. Estruturada';
  } else if (has('obrigad','valeu','thanks','tmj','show','otimo','perfeito')) {
    reply = 'Disponha, Gabriel! Bons estudos!\nSempre que precisar e so mandar mensagem.\n\nPROVAS CHEGANDO: Mat. Discreta (' + countdown1 + ') e Prog. Estruturada (' + countdown2 + ')!\n\nBora estudar!';
  } else {
    reply = 'Nao entendi bem. Posso te ajudar com:\n\n- *prova* - proximas provas\n- *plano* - o que estudar hoje\n- *matrizes* - GAAL\n- *derivadas* / *limites* - Calculo\n- *discreta* - Mat. Discreta\n- *programacao* - Prog. Estruturada\n- *hub* - link do site\n\nOu me pergunte qualquer coisa sobre os estudos!';
  }

  const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Message><Body>' + reply + '</Body></Message></Response>';
  res.setHeader('Content-Type', 'text/xml');
  res.status(200).send(twiml);
    }
