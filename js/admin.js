// =====================================================================
// BATE-CONTROLE ELITE — PAINEL MASTER (dono do sistema)
//  · receita, conversão e indicadores clicáveis
//  · lista de turmas com filtros, busca e ordenação
//  · próximos vencimentos, ranking de indicações, novas turmas por mês
//  · detalhes da turma: prazo, status, anotações, senha, WhatsApp, uso
// Depende das utilidades de js/app.js ($, esc, brl, toast, confirmar...).
// =====================================================================

let usuariosAdmin = [];
let filtroMaster = 'todas';
let turmaAtual = null;

const DIA_MS = 86400000;
const INDICACAO_INVALIDA = ['', 'nenhum', 'sim (sem id)'];

// ---------- dados derivados de cada turma ----------
function infoTurma(u) {
  const expira = dataLimiteAssinatura(u);
  const dias = Math.ceil((expira - new Date()) / DIA_MS);
  const expirado = new Date() > expira;
  const paga = u.status === 'pago';
  let cat, tag, cor;
  if (expirado) { cat = 'bloqueadas'; tag = '<span class="tag tag-vencido">Bloqueada</span>'; cor = 'var(--danger)'; }
  else if (paga) { cat = 'pagas'; tag = '<span class="tag tag-ok">Assinante</span>'; cor = 'var(--success)'; }
  else { cat = 'teste'; tag = '<span class="tag tag-ouro">Teste</span>'; cor = 'var(--gold)'; }
  const vencendo = !expirado && dias <= 7;
  if (vencendo) cor = 'var(--warn)';
  const indicacoes = usuariosAdmin.filter((x) => String(x.indicado_por || '').toLowerCase() === u.user.toLowerCase()).length;
  // sem acesso: turma ativa que não abre o app há DIAS_INATIVIDADE dia(s) ou mais
  const ultimo = u.ultimo_acesso ? new Date(u.ultimo_acesso) : null;
  const diasSemAcesso = ultimo ? Math.floor((Date.now() - ultimo) / DIA_MS) : null;
  const inativa = !expirado && temRegistroAcesso() && (ultimo ? diasSemAcesso >= DIAS_INATIVIDADE : true);
  return { u, expira, dias, expirado, paga, cat, tag, cor, vencendo, indicacoes, ultimo, diasSemAcesso, inativa };
}

// a coluna ultimo_acesso só existe depois de rodar o supabase/schema.sql
function temRegistroAcesso() { return usuariosAdmin.some((u) => 'ultimo_acesso' in u); }

function textoVisto(i) {
  if (!i.ultimo) return 'nunca entrou desde o cadastro';
  const min = Math.floor((Date.now() - i.ultimo) / 60000);
  if (min < 60) return 'visto agora há pouco';
  if (min < 24 * 60) return `visto há ${Math.floor(min / 60)} h`;
  return `sem entrar há ${i.diasSemAcesso} dia${i.diasSemAcesso === 1 ? '' : 's'}`;
}

// lembretes enviados ficam anotados neste aparelho para não mandar duas vezes no mesmo dia
function lembretes() { try { return JSON.parse(localStorage.getItem('bc_lembretes')) || {}; } catch (e) { return {}; } }
function lembradoHoje(user) { return lembretes()[user] === hojeISO(); }
function registrarLembrete(user) {
  const l = lembretes(); l[user] = hojeISO();
  try { localStorage.setItem('bc_lembretes', JSON.stringify(l)); } catch (e) { /* ok */ }
}

function enviarLembrete(user, btn) {
  const u = usuariosAdmin.find((x) => x.user === user);
  if (!u) return;
  if (!u.whatsapp) return toast('Essa turma não tem WhatsApp cadastrado.', 'erro');
  falarComLider(u.whatsapp, mensagemMaster('lembrete', u));
  registrarLembrete(user);
  if (btn) marcarEnviado(btn);
  renderizarUsuariosAdmin(false);
}

function textoPrazo(i) {
  if (i.expirado) return `venceu há ${Math.max(1, -i.dias)} dia${-i.dias === 1 ? '' : 's'}`;
  if (i.dias <= 0) return 'vence hoje';
  if (i.dias === 1) return 'vence amanhã';
  return `${i.dias} dias restantes`;
}

function dataHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d) ? '—' : d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ---------- carregar e desenhar ----------
async function renderizarUsuariosAdmin(recarregar = true) {
  const lista = $('lista-usuarios-admin');
  if (recarregar) {
    lista.innerHTML = '<li class="empty"><div class="esqueleto" style="max-width:260px;margin:0 auto"></div></li>';
    await comCarregando($('btn-master-atualizar'), async () => {
      const { data, error } = await supabaseInstance.from(TABELA_USUARIOS).select('*');
      if (error) { usuariosAdmin = null; return; }
      usuariosAdmin = (data || []).filter((u) => u.user !== ADMIN_USER);
    });
    if (!usuariosAdmin) {
      usuariosAdmin = [];
      lista.innerHTML = `<li class="empty"><div class="empty-ico">${iconeSvg('alerta')}</div><strong>Não foi possível carregar</strong>Verifique a conexão e toque em atualizar.</li>`;
      return;
    }
  }

  $('master-data').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  const todas = usuariosAdmin.map(infoTurma);
  const cont = { todas: todas.length, pagas: 0, teste: 0, vencendo: 0, bloqueadas: 0, inativas: 0 };
  let risco = 0, novas = 0;
  todas.forEach((i) => {
    cont[i.cat]++;
    if (i.inativa) cont.inativas++;
    if (i.vencendo) { cont.vencendo++; if (i.paga) risco += VALOR_MENSALIDADE; }
    if (i.u.criacao && Date.now() - new Date(i.u.criacao) <= 30 * DIA_MS) novas++;
  });

  // indicadores
  $('master-total-turmas').textContent = cont.todas;
  $('master-assinantes').textContent = cont.pagas;
  $('master-trial').textContent = cont.teste;
  $('master-vencendo').textContent = cont.vencendo;
  $('master-bloqueadas').textContent = cont.bloqueadas;
  $('master-inativas').textContent = temRegistroAcesso() ? cont.inativas : '—';
  $('master-inativas-meta').textContent = temRegistroAcesso() ? `há ${DIAS_INATIVIDADE} dia${DIAS_INATIVIDADE === 1 ? '' : 's'} ou mais` : 'rode o schema.sql';
  Object.keys(cont).forEach((k) => { $('mc-' + k).textContent = cont[k] || ''; });

  // receita
  const mrr = cont.pagas * VALOR_MENSALIDADE;
  const conv = cont.todas ? (cont.pagas / cont.todas) * 100 : 0;
  $('master-faturamento').innerHTML = `${brl(mrr)}<small>/mês</small>`;
  $('master-hero-status').innerHTML = cont.teste
    ? `${iconeSvg('tendencia')}${cont.teste} em teste podem somar ${brl(cont.teste * VALOR_MENSALIDADE)}/mês`
    : `${iconeSvg('check')}Nenhuma turma em teste agora`;
  $('master-conv-pct').textContent = conv.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + '%';
  $('master-conv-txt').textContent = `${cont.pagas} de ${cont.todas} turmas pagam`;
  $('master-conv-meter').style.width = conv + '%';
  $('master-potencial').textContent = brl(cont.todas * VALOR_MENSALIDADE);
  $('master-risco').textContent = brl(risco);
  $('master-novas').textContent = novas;

  document.querySelectorAll('[data-mfiltro]').forEach((b) => {
    const on = b.dataset.mfiltro === filtroMaster;
    if (b.classList.contains('seg-opt')) b.setAttribute('aria-pressed', String(on));
    else b.classList.toggle('ativo', on && filtroMaster !== 'todas');
  });

  renderizarListaMaster(todas);
  renderizarProximos(todas);
  renderizarInativas(todas);
  renderizarRanking();
  renderizarGraficoMaster();
}

function renderizarListaMaster(todas) {
  const lista = $('lista-usuarios-admin');
  const termo = ($('busca-admin').value || '').toLowerCase().trim();
  const termoDig = soDigitos(termo);
  const ordem = $('ordem-admin').value;

  let itens = todas.filter((i) => {
    if (filtroMaster === 'vencendo' && !i.vencendo) return false;
    if (filtroMaster === 'inativas' && !i.inativa) return false;
    if (!['todas', 'vencendo', 'inativas'].includes(filtroMaster) && i.cat !== filtroMaster) return false;
    if (!termo) return true;
    return i.u.user.toLowerCase().includes(termo)
      || String(i.u.indicado_por || '').toLowerCase().includes(termo)
      || (termoDig.length >= 3 && soDigitos(i.u.whatsapp).includes(termoDig));
  });

  const ordenar = {
    vencimento: (a, b) => a.expira - b.expira,
    recentes: (a, b) => new Date(b.u.criacao || 0) - new Date(a.u.criacao || 0),
    nome: (a, b) => a.u.user.localeCompare(b.u.user),
    indicacoes: (a, b) => b.indicacoes - a.indicacoes || a.u.user.localeCompare(b.u.user),
    acesso: (a, b) => (a.ultimo ? +a.ultimo : 0) - (b.ultimo ? +b.ultimo : 0)
  };
  // no filtro "sem acesso", quem está sumido há mais tempo aparece primeiro
  itens.sort(ordenar[filtroMaster === 'inativas' && ordem === 'vencimento' ? 'acesso' : ordem] || ordenar.vencimento);

  $('master-contador').textContent = itens.length || '';

  if (!itens.length) {
    lista.innerHTML = `<li class="empty"><div class="empty-ico">${iconeSvg(usuariosAdmin.length ? 'busca' : 'pessoas')}</div><strong>${usuariosAdmin.length ? 'Nenhuma turma nesse filtro' : 'Nenhuma turma cadastrada ainda'}</strong>${usuariosAdmin.length ? 'Troque o filtro ou a busca.' : 'As turmas aparecem aqui assim que se cadastrarem.'}</li>`;
    return;
  }

  lista.innerHTML = itens.map((i) => {
    const total = i.paga ? 30 : DIAS_TRIAL;
    const pct = i.expirado ? 100 : Math.max(4, Math.min(100, (i.dias / total) * 100));
    const corMeter = i.expirado ? 'perigo' : i.vencendo ? 'perigo' : i.paga ? 'ok' : 'ouro';
    const indic = i.indicacoes ? `<span class="selo-indic" title="Turmas indicadas">${iconeSvg('pessoas')}${i.indicacoes}</span>` : '';
    return `
      <li class="master-item" style="--linha-cor:${i.cor}" data-turma="${esc(i.u.user)}" tabindex="0" role="button" aria-label="Detalhes da turma ${esc(i.u.user)}">
        <div class="pessoa">
          <span class="av ${corAvatar(i.u.user)}">${esc(iniciais(i.u.user))}</span>
          <div class="pessoa-txt">
            <strong>${esc(i.u.user)}</strong>
            <span>${i.tag}${i.inativa ? '<span class="tag tag-sumida">Sem acesso</span>' : ''}${indic}<span class="mono">${esc(i.u.whatsapp ? formatarTel(i.u.whatsapp) : 'sem WhatsApp')}</span></span>
            ${temRegistroAcesso() ? `<span class="visto ${i.inativa ? 'alerta' : ''}">${textoVisto(i)}${lembradoHoje(i.u.user) ? ' · <span class="lembrado">lembrada hoje</span>' : ''}</span>` : ''}
          </div>
        </div>
        <div class="master-prazo">
          <div class="master-prazo-topo"><span>${textoPrazo(i)}</span><strong>${i.expira.toLocaleDateString('pt-BR')}</strong></div>
          <div class="meter"><span class="meter-seg ${corMeter}" style="width:${pct}%"></span></div>
        </div>
        <div class="master-acoes">
          ${i.inativa ? `<button type="button" class="btn-mini" data-acao="lembrar" title="Lembrar de entrar no app" aria-label="Lembrar de entrar no app">${iconeSvg('relogio')}</button>` : ''}
          <button type="button" class="btn-mini whats" data-acao="whats" title="Cobrar no WhatsApp" aria-label="Cobrar no WhatsApp">${iconeSvg('whats')}</button>
          <button type="button" class="btn btn-sm btn-ouro" data-acao="renovar" title="Confirmar pagamento e somar 30 dias">${iconeSvg('coroa')}+30d</button>
        </div>
      </li>`;
  }).join('');
}

function renderizarProximos(todas) {
  const prox = todas.filter((i) => i.dias >= -3 && i.dias <= 7).sort((a, b) => a.expira - b.expira).slice(0, 7);
  $('master-proximos').innerHTML = prox.length ? prox.map((i) => `
    <li class="atencao-item" data-turma="${esc(i.u.user)}" style="cursor:pointer">
      <div class="pessoa">
        <span class="av ${corAvatar(i.u.user)}">${esc(iniciais(i.u.user))}</span>
        <div class="pessoa-txt"><strong style="text-transform:uppercase">${esc(i.u.user)}</strong><span>${i.paga ? 'Assinante' : 'Teste'} · ${i.expira.toLocaleDateString('pt-BR')}</span></div>
      </div>
      <div class="atencao-fim"><span class="tag ${i.expirado ? 'tag-vencido' : 'tag-alerta'}">${i.expirado ? 'Venceu' : i.dias <= 1 ? (i.dias <= 0 ? 'Hoje' : 'Amanhã') : i.dias + ' dias'}</span></div>
    </li>`).join('') : `<li class="empty"><div class="empty-ico ok">${iconeSvg('check')}</div><strong>Nada vencendo</strong>Nenhuma turma vence nos próximos 7 dias.</li>`;
}

function renderizarInativas(todas) {
  const box = $('master-inativas-lista');
  $('master-inativas-hint').textContent = `Turmas ativas que não abrem o app há ${DIAS_INATIVIDADE} dia${DIAS_INATIVIDADE === 1 ? '' : 's'} ou mais.`;
  if (!temRegistroAcesso()) {
    box.innerHTML = `<li class="empty"><div class="empty-ico">${iconeSvg('info')}</div><strong>Falta ativar o registro de acesso</strong>Rode o arquivo <code>supabase/schema.sql</code> no Supabase. A partir daí, cada entrada no app é registrada.</li>`;
    return;
  }
  const lista = todas.filter((i) => i.inativa).sort((a, b) => (a.ultimo ? +a.ultimo : 0) - (b.ultimo ? +b.ultimo : 0)).slice(0, 7);
  box.innerHTML = lista.length ? lista.map((i) => {
    const feito = lembradoHoje(i.u.user);
    return `
    <li class="atencao-item" data-turma="${esc(i.u.user)}" style="cursor:pointer">
      <div class="pessoa">
        <span class="av ${corAvatar(i.u.user)}">${esc(iniciais(i.u.user))}</span>
        <div class="pessoa-txt"><strong style="text-transform:uppercase">${esc(i.u.user)}</strong><span>${textoVisto(i)}</span></div>
      </div>
      <div class="atencao-fim">${i.u.whatsapp
        ? `<button type="button" class="btn btn-sm ${feito ? 'btn-ghost' : 'btn-success'}" data-acao="lembrar">${iconeSvg(feito ? 'check' : 'whats')}${feito ? 'Lembrada' : 'Lembrar'}</button>`
        : '<span class="tag tag-neutro">sem WhatsApp</span>'}</div>
    </li>`;
  }).join('') : `<li class="empty"><div class="empty-ico ok">${iconeSvg('check')}</div><strong>Todas as turmas ativas</strong>Ninguém está há ${DIAS_INATIVIDADE} dia${DIAS_INATIVIDADE === 1 ? '' : 's'} sem entrar.</li>`;
}

// lembrete em lote: uma mensagem pronta por turma sem acesso
function lembrarInativasEmLote() {
  if (!temRegistroAcesso()) return toast('Rode o supabase/schema.sql para registrar os acessos.', 'info');
  const alvo = usuariosAdmin.map(infoTurma).filter((i) => i.inativa && i.u.whatsapp).sort((a, b) => (a.ultimo ? +a.ultimo : 0) - (b.ultimo ? +b.ultimo : 0));
  if (!alvo.length) return toast('Nenhuma turma sem acesso com WhatsApp cadastrado.', 'info');
  $('avisos-titulo').textContent = 'Lembrar turmas de entrar no app';
  $('avisos-texto').textContent = `${alvo.length} turma${alvo.length === 1 ? ' está' : 's estão'} há ${DIAS_INATIVIDADE} dia${DIAS_INATIVIDADE === 1 ? '' : 's'} ou mais sem abrir o app. Toque em "Enviar" para abrir a mensagem pronta de cada uma.`;
  $('avisos-lista').innerHTML = alvo.map((i) => {
    const feito = lembradoHoje(i.u.user);
    return `
    <li class="atencao-item">
      <div class="pessoa"><span class="av ${corAvatar(i.u.user)}">${esc(iniciais(i.u.user))}</span><div class="pessoa-txt"><strong style="text-transform:uppercase">${esc(i.u.user)}</strong><span>${textoVisto(i)}${feito ? ' · lembrada hoje' : ''}</span></div></div>
      <div class="atencao-fim"><button type="button" class="btn btn-sm ${feito ? 'btn-ghost' : 'btn-success'}" data-lembrar-lote="${esc(i.u.user)}">${iconeSvg('whats')}${feito ? 'Enviar de novo' : 'Enviar'}</button></div>
    </li>`;
  }).join('');
  abrirOverlay('modal-avisos');
}

function renderizarRanking() {
  const mapa = {};
  usuariosAdmin.forEach((u) => {
    const p = String(u.indicado_por || '').trim().toLowerCase();
    if (INDICACAO_INVALIDA.includes(p)) return;
    mapa[p] = (mapa[p] || 0) + 1;
  });
  const top = Object.entries(mapa).sort((a, b) => b[1] - a[1]).slice(0, 8);
  $('master-ranking').innerHTML = top.length ? top.map(([nome, n], idx) => {
    const existe = usuariosAdmin.some((u) => u.user.toLowerCase() === nome);
    const premio = n >= 10 ? '<span class="tag tag-ok">Grátis</span>' : n >= 5 ? '<span class="tag tag-ouro">50% off</span>' : `<span class="tag tag-neutro">faltam ${5 - n}</span>`;
    const pct = Math.min(100, (n / 10) * 100);
    return `
      <li class="atencao-item" ${existe ? `data-turma="${esc(nome)}" style="cursor:pointer"` : ''}>
        <span class="rank-pos ${idx < 3 ? 'p' + (idx + 1) : ''}">${idx + 1}</span>
        <div class="pessoa-txt" style="flex:1">
          <strong style="text-transform:uppercase">${esc(nome)}</strong>
          <span>${n} indicaç${n === 1 ? 'ão' : 'ões'}${existe ? '' : ' · turma não encontrada'}</span>
          <span class="meter rank-meta"><span class="meter-seg ${n >= 10 ? 'ok' : ''}" style="width:${pct}%"></span></span>
        </div>
        <div class="atencao-fim">${premio}</div>
      </li>`;
  }).join('') : `<li class="empty"><div class="empty-ico">${iconeSvg('pessoas')}</div><strong>Sem indicações ainda</strong>Quando uma turma indicar outra, aparece aqui.</li>`;
}

function renderizarGraficoMaster() {
  const meses = [];
  const agora = new Date();
  for (let k = 5; k >= 0; k--) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - k, 1);
    meses.push({ chave: `${d.getFullYear()}-${d.getMonth()}`, rotulo: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), n: 0 });
  }
  usuariosAdmin.forEach((u) => {
    if (!u.criacao) return;
    const d = new Date(u.criacao);
    const m = meses.find((x) => x.chave === `${d.getFullYear()}-${d.getMonth()}`);
    if (m) m.n++;
  });
  const max = Math.max(1, ...meses.map((m) => m.n));
  $('master-grafico').innerHTML = meses.map((m, idx) => `
    <div class="barra ${idx === meses.length - 1 ? 'atual' : ''}" title="${m.n} turma(s)">
      <b>${m.n}</b>
      <div class="barra-col" style="height:${(m.n / max) * 100}%"></div>
      <span>${m.rotulo}</span>
    </div>`).join('');
}

// ---------- ações rápidas da lista ----------
function falarComLider(numero, texto) {
  if (!numero) return toast('Essa turma não tem WhatsApp cadastrado.', 'erro');
  window.open(`https://api.whatsapp.com/send?phone=${telWhats(numero)}&text=${encodeURIComponent(texto || 'Olá! Aqui é o Caio do Bate-Controle.')}`, '_blank');
}

function mensagemMaster(tipo, u) {
  const i = infoTurma(u);
  const nome = u.user.toUpperCase();
  const valor = brl(VALOR_MENSALIDADE);
  switch (tipo) {
    case 'cobranca':
      return i.expirado
        ? `Olá, turma *${nome}*! 🎭\nAqui é o Caio do Bate-Controle. Seu acesso está pausado desde ${i.expira.toLocaleDateString('pt-BR')}.\n\nPara liberar é só pagar a mensalidade de *${valor}*:\n💳 Cartão: https://mpago.la/2zHDQ9Y\n🔑 PIX (e-mail): ${MEU_PIX}\n\nMe manda o comprovante que eu libero na hora!`
        : `Olá, turma *${nome}*! 🎭\nAqui é o Caio do Bate-Controle. Seu ${i.paga ? 'plano' : 'teste grátis'} ${i.dias <= 1 ? (i.dias <= 0 ? 'vence *hoje*' : 'vence *amanhã*') : `vence em *${i.dias} dias*`} (${i.expira.toLocaleDateString('pt-BR')}).\n\nPara continuar sem interrupção, a mensalidade é *${valor}*:\n💳 Cartão: https://mpago.la/2zHDQ9Y\n🔑 PIX (e-mail): ${MEU_PIX}`;
    case 'lembrete': {
      const ult = u.ultimo_acesso ? new Date(u.ultimo_acesso) : null;
      const dias = ult ? Math.floor((Date.now() - ult) / DIA_MS) : null;
      const tempo = dias === null ? 'vocês ainda não entraram no' : `faz ${dias} dia${dias === 1 ? '' : 's'} que vocês não entram no`;
      const link = location.origin + location.pathname;
      return `Olá, turma *${nome}*! 🎭\nAqui é o Caio do Bate-Controle. Vi que ${tempo} app.\n\nNão esquece de lançar os pagamentos e as despesas para o caixa ficar em dia — e de cobrar quem está atrasado direto pelo WhatsApp 😉\n\n👉 Acesse: ${link}\n\nQualquer dúvida é só me chamar!`;
    }
    case 'boasvindas':
      return `Olá, turma *${nome}*! 🎭 Seja bem-vinda ao Bate-Controle Elite!\nVocê tem ${DIAS_TRIAL} dias grátis para organizar o caixa da turma: componentes, pagamentos, custos extras e cobrança no WhatsApp.\n\nQualquer dúvida, me chama aqui. Boa folia!`;
    case 'renovado':
      return `Pagamento confirmado, turma *${nome}*! ✅\nSeu acesso ao Bate-Controle Elite está liberado até *${i.expira.toLocaleDateString('pt-BR')}*.\nObrigado pela confiança! 🎭`;
    default:
      return 'Olá! Aqui é o Caio do Bate-Controle.';
  }
}

async function renovarTurma(nomeTurma, dias = 30, cortesia = false) {
  const u = usuariosAdmin.find((x) => x.user === nomeTurma);
  if (!u) return false;
  const ok = await confirmar({
    titulo: cortesia ? `Dar ${dias} dias grátis para ${nomeTurma.toUpperCase()}?` : `Renovar ${nomeTurma.toUpperCase()} por ${dias} dias?`,
    texto: cortesia ? 'Estende o prazo sem marcar como pago.' : `Confirma o pagamento (${brl(VALOR_MENSALIDADE)}) e soma ${dias} dias ao prazo atual.`,
    ok: cortesia ? 'Dar dias grátis' : `Renovar ${dias} dias`, tom: 'ok'
  });
  if (!ok) return false;
  // soma a partir do vencimento atual se ainda estiver ativo (não perde dias pagos)
  const atual = dataLimiteAssinatura(u);
  const novaData = new Date(atual > new Date() ? atual : new Date());
  novaData.setDate(novaData.getDate() + dias);
  const patch = { data_expiracao: novaData.toISOString() };
  if (!cortesia) patch.status = 'pago';
  const { error } = await supabaseInstance.from(TABELA_USUARIOS).update(patch).eq('user', nomeTurma);
  if (error) { toast('Erro ao renovar.', 'erro'); return false; }
  Object.assign(u, patch);
  if (!cortesia) enviarNotificacaoTelegram(`💰 *PAGAMENTO CONFIRMADO!*\n👑 Turma: ${nomeTurma.toUpperCase()}\n📅 Nova Expiração: ${novaData.toLocaleDateString('pt-BR')}`);
  toast(`${nomeTurma.toUpperCase()} liberada até ${novaData.toLocaleDateString('pt-BR')}.`);
  renderizarUsuariosAdmin(false);
  return true;
}

async function deletarUsuarioAdmin(nome) {
  const ok = await confirmar({
    titulo: `Apagar ${nome.toUpperCase()}?`,
    texto: 'A turma perde o acesso e todos os dados dela (componentes, custos extras e despesas) são apagados. Essa ação não pode ser desfeita.',
    ok: 'Apagar turma e dados'
  });
  if (!ok) return false;
  const { error } = await supabaseInstance.from(TABELA_USUARIOS).delete().eq('user', nome);
  if (error) { toast('Erro ao apagar.', 'erro'); return false; }
  await Promise.all(['componentes', 'extras', 'gastos_manuais'].map((t) => supabaseInstance.from(t).delete().eq('turma_id', nome)));
  usuariosAdmin = usuariosAdmin.filter((u) => u.user !== nome);
  enviarNotificacaoTelegram(`🗑️ *TURMA DELETADA*\n👤 Nome: ${nome.toUpperCase()}`);
  toast('Turma apagada.');
  renderizarUsuariosAdmin(false);
  return true;
}

// avisar em lote: quem vence em 7 dias ou venceu há pouco
function cobrarVencendoEmLote() {
  const alvo = usuariosAdmin.map(infoTurma).filter((i) => i.dias >= -7 && i.dias <= 7 && i.u.whatsapp).sort((a, b) => a.expira - b.expira);
  if (!alvo.length) return toast('Nenhuma turma vencendo com WhatsApp cadastrado.', 'info');
  $('avisos-titulo').textContent = 'Avisar turmas que vencem';
  $('avisos-texto').textContent = `${alvo.length} turma${alvo.length === 1 ? '' : 's'} vence${alvo.length === 1 ? '' : 'm'} em até 7 dias ou venceu há pouco. Toque em "Enviar" para abrir a mensagem pronta.`;
  $('avisos-lista').innerHTML = alvo.map((i) => `
    <li class="atencao-item">
      <div class="pessoa"><span class="av ${corAvatar(i.u.user)}">${esc(iniciais(i.u.user))}</span><div class="pessoa-txt"><strong style="text-transform:uppercase">${esc(i.u.user)}</strong><span>${textoPrazo(i)}</span></div></div>
      <div class="atencao-fim"><button type="button" class="btn btn-sm btn-success" data-cobrar-lote="${esc(i.u.user)}">${iconeSvg('whats')}Enviar</button></div>
    </li>`).join('');
  abrirOverlay('modal-avisos');
}

$('avisos-lista').addEventListener('click', (e) => {
  const l = e.target.closest('[data-lembrar-lote]');
  if (l) { enviarLembrete(l.dataset.lembrarLote, l); return; }
  const b = e.target.closest('[data-cobrar-lote]');
  if (!b) return;
  const u = usuariosAdmin.find((x) => x.user === b.dataset.cobrarLote);
  if (u) { falarComLider(u.whatsapp, mensagemMaster('cobranca', u)); marcarEnviado(b); }
});

function exportarTurmasCSV() {
  const cel = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const linhas = [['Turma', 'WhatsApp', 'Situação', 'Status', 'Criada em', 'Expira em', 'Dias', 'Indicado por', 'Indicações feitas', 'Último acesso', 'Dias sem entrar', 'Anotações']];
  usuariosAdmin.map(infoTurma).sort((a, b) => a.expira - b.expira).forEach((i) => {
    linhas.push([i.u.user, formatarTel(i.u.whatsapp), { pagas: 'Assinante', teste: 'Teste', bloqueadas: 'Bloqueada' }[i.cat], i.u.status || '',
      i.u.criacao ? new Date(i.u.criacao).toLocaleDateString('pt-BR') : '', i.expira.toLocaleDateString('pt-BR'), i.dias,
      i.u.indicado_por || '', i.indicacoes, dataHora(i.u.ultimo_acesso), i.diasSemAcesso ?? '', i.u.observacao || '']);
  });
  const csv = '﻿' + linhas.map((l) => l.map(cel).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = `BateControle_turmas_${hojeISO()}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Lista de turmas exportada.');
}

// ---------- detalhes da turma ----------
function abrirTurma(nome) {
  const u = usuariosAdmin.find((x) => x.user === nome);
  if (!u) return;
  turmaAtual = u;
  preencherTurma();
  carregarUsoTurma(u.user);
  abrirOverlay('drawer-turma');
}

function preencherTurma() {
  const u = turmaAtual;
  const i = infoTurma(u);
  $('turma-avatar').className = 'av ' + corAvatar(u.user);
  $('turma-avatar').textContent = iniciais(u.user);
  $('turma-titulo').textContent = u.user;
  $('turma-tag').innerHTML = `${i.tag} <span class="mono">${textoPrazo(i)}</span>`;
  $('turma-info').innerHTML = `
    <div><span>WhatsApp</span><strong>${esc(u.whatsapp ? formatarTel(u.whatsapp) : '—')}</strong></div>
    <div><span>Expira em</span><strong>${i.expira.toLocaleDateString('pt-BR')}</strong></div>
    <div><span>Criada em</span><strong>${u.criacao ? new Date(u.criacao).toLocaleDateString('pt-BR') : '—'}</strong></div>
    <div><span>Último acesso</span><strong>${dataHora(u.ultimo_acesso)}</strong></div>
    <div><span>Indicada por</span><strong style="text-transform:uppercase">${esc(INDICACAO_INVALIDA.includes(String(u.indicado_por || '').toLowerCase()) ? 'Direto' : u.indicado_por)}</strong></div>
    <div><span>Indicações feitas</span><strong>${i.indicacoes}${i.indicacoes >= 10 ? ' · grátis' : i.indicacoes >= 5 ? ' · 50% off' : ''}</strong></div>`;
  $('turma-expira').value = isoLocal(i.expira);
  $('turma-status').value = u.status === 'pago' ? 'pago' : 'gratis';
  $('turma-obs').value = u.observacao || '';
  $('turma-obs-dica').classList.toggle('oculto', 'observacao' in u);
}

async function carregarUsoTurma(nome) {
  const box = $('turma-uso');
  box.innerHTML = '<div class="esqueleto"></div>';
  try {
    const [comp, gast, extr] = await Promise.all([
      supabaseInstance.from('componentes').select('valor_total,valor_pago,vencimento').eq('turma_id', nome),
      supabaseInstance.from('gastos_manuais').select('valor').eq('turma_id', nome),
      supabaseInstance.from('extras').select('valor').eq('turma_id', nome)
    ]);
    if (turmaAtual?.user !== nome) return;
    const c = comp.data || [];
    const pago = c.reduce((s, x) => s + (Number(x.valor_pago) || 0), 0);
    const meta = c.reduce((s, x) => s + (Number(x.valor_total) || 0), 0) + (extr.data || []).reduce((s, x) => s + (Number(x.valor) || 0), 0);
    const gastos = (gast.data || []).reduce((s, x) => s + (Number(x.valor) || 0), 0);
    const atrasados = c.filter((x) => x.vencimento && x.vencimento < hojeISO() && (Number(x.valor_total) || 0) > (Number(x.valor_pago) || 0)).length;
    box.innerHTML = `
      <div><span>Componentes</span><strong>${c.length}</strong></div>
      <div><span>Atrasados</span><strong class="${atrasados ? 'txt-perigo' : ''}">${atrasados}</strong></div>
      <div><span>Arrecadado</span><strong class="txt-ok">${brlCurto(pago)}</strong></div>
      <div><span>Projeção</span><strong>${brlCurto(meta)}</strong></div>
      <div><span>Despesas</span><strong class="txt-perigo">${brlCurto(gastos)}</strong></div>
      <div><span>Caixa</span><strong>${brlCurto(pago - gastos)}</strong></div>`;
  } catch (e) {
    box.innerHTML = '<div><span>Uso</span><strong>Não foi possível carregar</strong></div>';
  }
}

async function turmaRenovar(dias, cortesia = false) {
  if (!turmaAtual) return;
  if (await renovarTurma(turmaAtual.user, dias, cortesia)) preencherTurma();
}

async function turmaSalvar() {
  const u = turmaAtual;
  if (!u) return;
  const data = $('turma-expira').value;
  if (!data) { $('turma-expira').classList.add('invalido'); return toast('Informe a data de expiração.', 'erro'); }
  const patch = { data_expiracao: new Date(data + 'T23:59:00').toISOString(), status: $('turma-status').value };
  const obs = $('turma-obs').value.trim();
  const mudouObs = obs !== (u.observacao || '');
  if (mudouObs) patch.observacao = obs;

  await comCarregando($('btn-turma-salvar'), async () => {
    let { error } = await supabaseInstance.from(TABELA_USUARIOS).update(patch).eq('user', u.user);
    if (error && mudouObs && /observacao/i.test(error.message || '')) {
      // coluna ainda não criada: salva o resto e avisa
      delete patch.observacao;
      ({ error } = await supabaseInstance.from(TABELA_USUARIOS).update(patch).eq('user', u.user));
      if (!error) toast('Prazo salvo. Para anotações, rode o supabase/schema.sql.', 'info');
    } else if (!error) {
      toast('Turma atualizada.');
    }
    if (error) return toast('Erro ao salvar.', 'erro');
    Object.assign(u, patch);
    preencherTurma();
    renderizarUsuariosAdmin(false);
  });
}

function turmaWhats(tipo) {
  if (!turmaAtual) return;
  if (tipo === 'lembrete') { enviarLembrete(turmaAtual.user); return; }
  falarComLider(turmaAtual.whatsapp, mensagemMaster(tipo, turmaAtual));
}

async function turmaNovaSenha() {
  const u = turmaAtual;
  if (!u) return;
  const sugestao = Math.random().toString(36).slice(2, 8);
  const nova = await perguntar({ titulo: `Nova senha para ${u.user.toUpperCase()}`, texto: 'Envie a senha nova para o líder da turma depois de salvar.', rotulo: 'Nova senha', valor: sugestao, tipo: 'texto', ok: 'Salvar senha' });
  if (!nova) return;
  if (nova.length < 4) return toast('Use pelo menos 4 caracteres.', 'erro');
  const { error } = await supabaseInstance.from(TABELA_USUARIOS).update({ pass: nova }).eq('user', u.user);
  if (error) return toast('Erro ao trocar a senha.', 'erro');
  toast('Senha alterada.');
  if (u.whatsapp && await confirmar({ titulo: 'Enviar a senha pelo WhatsApp?', texto: 'Abre a conversa com o líder já com a mensagem pronta.', ok: 'Abrir WhatsApp', tom: 'ok' })) {
    falarComLider(u.whatsapp, `Olá, turma *${u.user.toUpperCase()}*! Sua senha do Bate-Controle foi redefinida.\n👤 Usuário: ${u.user}\n🔑 Nova senha: ${nova}`);
  }
}

async function turmaEditarWhats() {
  const u = turmaAtual;
  if (!u) return;
  const tel = await perguntar({ titulo: 'Trocar WhatsApp do líder', rotulo: 'WhatsApp com DDD', valor: u.whatsapp ? formatarTel(u.whatsapp) : '', placeholder: '(21) 98888-7777', tipo: 'tel', ok: 'Salvar' });
  if (!tel) return;
  const d = soDigitos(tel);
  const { error } = await supabaseInstance.from(TABELA_USUARIOS).update({ whatsapp: d }).eq('user', u.user);
  if (error) return toast('Erro ao salvar.', 'erro');
  u.whatsapp = d;
  toast('WhatsApp atualizado.');
  preencherTurma();
  renderizarUsuariosAdmin(false);
}

async function turmaApagar() {
  if (turmaAtual && await deletarUsuarioAdmin(turmaAtual.user)) { turmaAtual = null; fecharOverlay('drawer-turma'); }
}

// ---------- abrir / fechar o painel ----------
function acessarPainelDono() {
  mostrarTela('master');
  $('painel-dono').classList.remove('oculto');
  renderizarUsuariosAdmin();
}

function fecharPainelDono() {
  $('painel-dono').classList.add('oculto');
  atualizarVisualizacao();
}

// ---------- eventos ----------
$('busca-admin').addEventListener('input', () => renderizarUsuariosAdmin(false));
$('ordem-admin').addEventListener('change', () => renderizarUsuariosAdmin(false));

$('painel-dono').addEventListener('click', (e) => {
  const filtro = e.target.closest('[data-mfiltro]');
  if (filtro) {
    filtroMaster = filtro.dataset.mfiltro === filtroMaster && !filtro.classList.contains('seg-opt') ? 'todas' : filtro.dataset.mfiltro;
    renderizarUsuariosAdmin(false);
    if (!filtro.classList.contains('seg-opt')) $('seg-master').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const item = e.target.closest('[data-turma]');
  if (!item) return;
  const acao = e.target.closest('[data-acao]');
  const u = usuariosAdmin.find((x) => x.user === item.dataset.turma);
  if (acao && u) {
    if (acao.dataset.acao === 'whats') falarComLider(u.whatsapp, mensagemMaster('cobranca', u));
    if (acao.dataset.acao === 'renovar') renovarTurma(u.user, 30);
    if (acao.dataset.acao === 'lembrar') enviarLembrete(u.user);
    return;
  }
  abrirTurma(item.dataset.turma);
});

$('painel-dono').addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.master-item')) { e.preventDefault(); abrirTurma(e.target.dataset.turma); }
});
