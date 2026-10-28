// =====================================================================
// BATE-CONTROLE ELITE — APLICAÇÃO
//  1. Utilidades (formatação, máscaras, avisos, modais)
//  2. Camada de dados (Supabase ou demonstração local)
//  3. Login, cadastro e assinatura
//  4. Painel master
//  5. Navegação e tema
//  6. Lógica financeira e telas
//  7. Ações (componentes, pagamentos, extras, despesas)
//  8. Relatórios
// =====================================================================

const supabaseInstance = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// =====================================================================
// 1. UTILIDADES
// =====================================================================
const $ = (id) => document.getElementById(id);

function esc(txt) {
  return String(txt ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function brl(v) { return fmtBRL.format(Number(v) || 0); }
function brlCurto(v) {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 100000) return 'R$ ' + (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
  if (Math.abs(n) >= 1000) return 'R$ ' + Math.round(n).toLocaleString('pt-BR');
  return brl(n);
}

// aceita "39,90", "R$ 1.234,56", "39.9"
function parseMoeda(txt) {
  if (typeof txt === 'number') return txt;
  let s = String(txt || '').replace(/[^\d,.-]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  return parseFloat(s);
}

function soDigitos(txt) { return String(txt || '').replace(/\D/g, ''); }

function formatarTel(txt) {
  let d = soDigitos(txt);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function telWhats(txt) {
  let d = soDigitos(txt);
  if (!d) return '';
  if (!(d.startsWith('55') && d.length >= 12)) d = '55' + d;
  return d;
}

function iniciais(nome) {
  const p = String(nome || '?').trim().split(/\s+/);
  return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

function corAvatar(txt) {
  let h = 0;
  for (const c of String(txt || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 'av-' + (h % 6);
}

// datas sempre no fuso local (evita o "amanhã" virar "depois de amanhã" à noite)
function isoLocal(d) {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
function hojeISO() { return isoLocal(new Date()); }
function somarDias(iso, dias) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + dias); return isoLocal(d); }
function somarMes(iso) {
  const d = new Date(iso + 'T12:00:00');
  const dia = d.getDate();
  d.setMonth(d.getMonth() + 1);
  if (d.getDate() !== dia) d.setDate(0); // 31/01 -> 28/02, não 03/03
  return isoLocal(d);
}
function diasAte(iso) {
  if (!iso) return null;
  const a = new Date(hojeISO() + 'T12:00:00'), b = new Date(iso + 'T12:00:00');
  return Math.round((b - a) / 86400000);
}
function dataBR(iso) { return iso ? iso.split('T')[0].split('-').reverse().join('/') : '—'; }
function dataCurta(iso) { return iso ? dataBR(iso).slice(0, 5) : '—'; }

function iconeSvg(nome) { return `<svg class="ico"><use href="#i-${nome}"/></svg>`; }

// ---------- aviso flutuante ----------
let toastTimer;
function toast(msg, tipo = 'sucesso') {
  const t = $('toast');
  $('toast-texto').textContent = msg;
  t.className = 'toast toast-' + tipo;
  requestAnimationFrame(() => t.classList.add('visivel'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('visivel'), 3200);
}

// ---------- botão "carregando" ----------
async function comCarregando(btn, fn) {
  if (btn) { btn.classList.add('carregando'); btn.disabled = true; }
  try { return await fn(); }
  finally { if (btn) { btn.classList.remove('carregando'); btn.disabled = false; } }
}

// ---------- modais ----------
function abrirOverlay(id) {
  $(id).classList.add('show');
  document.body.classList.add('overlay-aberto');
  const foco = $(id).querySelector('input:not([type=hidden]):not([type=checkbox]), .btn-accent, .btn-danger-solid');
  if (foco && window.matchMedia('(min-width: 761px)').matches) setTimeout(() => foco.focus(), 60);
}

function fecharOverlay(id) {
  $(id).classList.remove('show');
  if (!document.querySelector('.modal-overlay.show')) document.body.classList.remove('overlay-aberto');
  const cb = fecharOverlay.callbacks[id];
  if (cb) { delete fecharOverlay.callbacks[id]; cb(); }
}
fecharOverlay.callbacks = {};

document.addEventListener('click', (e) => {
  const fechar = e.target.closest('[data-fechar]');
  if (fechar) { fecharOverlay(fechar.closest('.modal-overlay').id); return; }
  if (e.target.classList.contains('modal-overlay')) fecharOverlay(e.target.id);
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const abertos = document.querySelectorAll('.modal-overlay.show');
  if (abertos.length) fecharOverlay(abertos[abertos.length - 1].id);
});

// confirmação — substitui confirm()
function confirmar({ titulo, texto = '', ok = 'Confirmar', tom = 'perigo' }) {
  return new Promise((resolve) => {
    $('confirmar-titulo').textContent = titulo;
    $('confirmar-texto').textContent = texto;
    $('confirmar-ico').dataset.tom = tom;
    $('confirmar-ico').innerHTML = iconeSvg(tom === 'ok' ? 'check' : 'alerta');
    const btn = $('confirmar-ok');
    btn.textContent = ok;
    btn.className = 'btn ' + (tom === 'perigo' ? 'btn-danger-solid' : 'btn-accent');
    let decidido = false;
    btn.onclick = () => { decidido = true; fecharOverlay('modal-confirmar'); resolve(true); };
    fecharOverlay.callbacks['modal-confirmar'] = () => { if (!decidido) resolve(false); };
    abrirOverlay('modal-confirmar');
  });
}

// pergunta com campo — substitui prompt()
function perguntar({ titulo, texto = '', rotulo = 'Valor', valor = '', placeholder = '', ok = 'Salvar', tipo = 'moeda' }) {
  return new Promise((resolve) => {
    $('pergunta-titulo').textContent = titulo;
    $('pergunta-texto').textContent = texto;
    $('pergunta-label').textContent = rotulo;
    $('pergunta-ok').textContent = ok;
    const inp = $('pergunta-input');
    inp.value = valor;
    inp.placeholder = placeholder;
    inp.classList.remove('invalido');
    inp.removeAttribute('data-mascara-moeda');
    inp.removeAttribute('data-mascara-tel');
    inp.inputMode = tipo === 'texto' ? 'text' : (tipo === 'tel' ? 'tel' : 'decimal');
    if (tipo === 'moeda') inp.setAttribute('data-mascara-moeda', '');
    if (tipo === 'tel') inp.setAttribute('data-mascara-tel', '');
    let decidido = false;
    $('form-pergunta').onsubmit = (e) => {
      e.preventDefault();
      const v = tipo === 'moeda' ? parseMoeda(inp.value) : inp.value.trim();
      if ((tipo === 'moeda' && (isNaN(v) || v < 0)) || (tipo === 'tel' && soDigitos(v).length < 10) || v === '') {
        inp.classList.add('invalido'); inp.focus(); return;
      }
      decidido = true; fecharOverlay('modal-pergunta'); resolve(v);
    };
    fecharOverlay.callbacks['modal-pergunta'] = () => { if (!decidido) resolve(null); };
    abrirOverlay('modal-pergunta');
  });
}

// ---------- máscaras ----------
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.matches('[data-mascara-tel]')) el.value = formatarTel(el.value);
  if (el.matches('[data-mascara-moeda]')) el.value = el.value.replace(/[^\d,.R$\s]/g, '');
  if (el.classList.contains('invalido')) el.classList.remove('invalido');
});

document.addEventListener('focusout', (e) => {
  const el = e.target;
  if (el.matches && el.matches('[data-mascara-moeda]') && el.value.trim()) {
    const v = parseMoeda(el.value);
    if (!isNaN(v)) el.value = brl(v);
  }
});

// =====================================================================
// 2. CAMADA DE DADOS — Supabase ou demonstração (localStorage)
// =====================================================================
const DEMO_KEY = 'bc_demo_v1';

function demoCarregar() {
  try {
    const salvo = JSON.parse(localStorage.getItem(DEMO_KEY));
    if (salvo && salvo.componentes) return salvo;
  } catch (e) { /* sem armazenamento: recria */ }
  const h = hojeISO();
  const base = [
    ['Rafael Nascimento', 450, 570, 26, '21987654321'],
    ['Bruno Henrique Costa', 450, 150, -6, '21976543210'],
    ['Thiago Martins', 450, 300, 1, '21965432109'],
    ['Lucas Ferreira', 500, 100, 1, '21954321098'],
    ['Diego Almeida', 450, 225, 4, '21943210987'],
    ['Matheus Oliveira', 450, 0, -12, '21932109876'],
    ['Gabriel Souza', 450, 350, 12, '21921098765'],
    ['Pedro Santana', 500, 620, 20, '21910987654'],
    ['Vinícius Rocha', 450, 200, 9, '21909876543'],
    ['Leandro Pires', 450, 90, -3, '21998765432']
  ];
  return {
    componentes: base.map((b, i) => ({ id: 'd' + i, turma_id: 'demo', nome: b[0], valor_total: b[1], valor_pago: b[2], vencimento: somarDias(h, b[3]), telefone: b[4] })),
    extras: [
      { id: 'e1', turma_id: 'demo', descricao: 'Ônibus do desfile', valor: 800 },
      { id: 'e2', turma_id: 'demo', descricao: 'Bateria e som', valor: 400 }
    ],
    gastos_manuais: [
      { id: 'g1', turma_id: 'demo', item: 'Tecido de cetim', valor: 980, responsavel: 'Rafael' },
      { id: 'g2', turma_id: 'demo', item: 'Bolas e sombrinhas', valor: 420, responsavel: 'Bruno' },
      { id: 'g3', turma_id: 'demo', item: 'Costureira (sinal)', valor: 600, responsavel: 'Thiago' }
    ]
  };
}

let demoDados = null;
function demoSalvar() { try { localStorage.setItem(DEMO_KEY, JSON.stringify(demoDados)); } catch (e) { /* ok */ } }

const api = {
  get demo() { return !!(usuarioLogado && usuarioLogado.demo); },
  get turma() { return usuarioLogado.user; },

  async listar(tabela) {
    if (this.demo) return [...demoDados[tabela]];
    const { data, error } = await supabaseInstance.from(tabela).select('*').eq('turma_id', this.turma);
    if (error) throw error;
    return data || [];
  },
  async inserir(tabela, obj) {
    const linha = { ...obj, turma_id: this.turma };
    if (this.demo) { demoDados[tabela].push({ id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...linha }); demoSalvar(); return; }
    const { error } = await supabaseInstance.from(tabela).insert([linha]);
    if (error) throw error;
  },
  async atualizar(tabela, id, patch) {
    if (this.demo) { const l = demoDados[tabela].find((x) => x.id == id); if (l) Object.assign(l, patch); demoSalvar(); return; }
    const { error } = await supabaseInstance.from(tabela).update(patch).eq('id', id);
    if (error) throw error;
  },
  async atualizarTodos(tabela, patch) {
    if (this.demo) { demoDados[tabela].forEach((l) => Object.assign(l, patch)); demoSalvar(); return; }
    const { error } = await supabaseInstance.from(tabela).update(patch).eq('turma_id', this.turma);
    if (error) throw error;
  },
  async remover(tabela, id) {
    if (this.demo) { demoDados[tabela] = demoDados[tabela].filter((x) => x.id != id); demoSalvar(); return; }
    const { error } = await supabaseInstance.from(tabela).delete().eq('id', id);
    if (error) throw error;
  },
  async removerTodos(tabela) {
    if (this.demo) { demoDados[tabela] = []; demoSalvar(); return; }
    const { error } = await supabaseInstance.from(tabela).delete().eq('turma_id', this.turma);
    if (error) throw error;
  }
};

// notificação para o dono (não roda na demonstração)
async function enviarNotificacaoTelegram(mensagem) {
  if (api.demo) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: mensagem, parse_mode: 'Markdown' })
    });
  } catch (e) { console.error('Erro Telegram:', e); }
}

// =====================================================================
// 3. LOGIN, CADASTRO E ASSINATURA
// =====================================================================
let usuarioLogado = null;
try { usuarioLogado = JSON.parse(localStorage.getItem('bateControleSessao')) || null; } catch (e) { usuarioLogado = null; }
let modoCadastro = false;
// com sessão salva, não mostra o login enquanto confere a assinatura
if (usuarioLogado) $('tela-acesso').classList.add('oculto');

function salvarSessao(u) {
  const { pass, ...semSenha } = u; // a senha não fica salva no aparelho
  usuarioLogado = semSenha;
  try { localStorage.setItem('bateControleSessao', JSON.stringify(semSenha)); } catch (e) { /* ok */ }
}

function definirModoAcesso(cadastro) {
  modoCadastro = cadastro;
  $('aba-entrar').setAttribute('aria-pressed', String(!cadastro));
  $('aba-cadastrar').setAttribute('aria-pressed', String(cadastro));
  $('campos-cadastro').classList.toggle('oculto', !cadastro);
  $('login-eyebrow').textContent = cadastro ? 'Nova turma' : 'Área da turma';
  $('login-titulo').textContent = cadastro ? 'Cadastre sua turma' : 'Entrar no Bate-Controle';
  $('login-subtitulo').textContent = cadastro ? 'Crie o acesso e comece a organizar o caixa hoje.' : 'Acesse para gerenciar o caixa da sua turma.';
  $('btn-login-texto').textContent = cadastro ? 'Criar turma' : 'Entrar';
  $('senha').autocomplete = cadastro ? 'new-password' : 'current-password';
}

// compatibilidade com o nome antigo
function alternarTelaLogin() { definirModoAcesso(!modoCadastro); }

function erroLogin(msg) {
  toast(msg, 'erro');
  const c = document.querySelector('.cartao-acesso');
  c.classList.remove('tremer'); void c.offsetWidth; c.classList.add('tremer');
}

async function executarAcaoPrincipal() {
  const user = $('usuario').value.trim().toLowerCase();
  const pass = $('senha').value.trim();
  const whatsappLider = soDigitos($('whatsapp_lider').value);
  const indicado = document.querySelector('#seg-indicacao [aria-pressed="true"]').dataset.indicado === 'sim';
  const idIndicador = $('id_indicador').value.trim().toLowerCase();
  const valorIndicacao = indicado ? (idIndicador || 'Sim (Sem ID)') : 'Nenhum';

  if (!user || !pass) { if (!user) $('usuario').classList.add('invalido'); if (!pass) $('senha').classList.add('invalido'); return erroLogin('Preencha usuário e senha.'); }
  if (modoCadastro && whatsappLider.length < 10) { $('whatsapp_lider').classList.add('invalido'); return erroLogin('Informe o WhatsApp do líder com DDD.'); }
  if (modoCadastro && pass.length < 4) { $('senha').classList.add('invalido'); return erroLogin('Use uma senha com pelo menos 4 caracteres.'); }

  if (!modoCadastro && user === ADMIN_USER && pass === ADMIN_PASS) {
    salvarSessao({ user: ADMIN_USER, status: 'admin' });
    acessarPainelDono();
    return;
  }

  if (!supabaseInstance) return erroLogin('Sem conexão com o servidor. Verifique a internet.');

  await comCarregando($('btn-login-entrar'), async () => {
    try {
      if (modoCadastro) {
        const { data: exist } = await supabaseInstance.from(TABELA_USUARIOS).select('user').eq('user', user).maybeSingle();
        if (exist) return erroLogin('Já existe uma turma com esse nome.');

        const expiraInicial = new Date();
        expiraInicial.setDate(expiraInicial.getDate() + DIAS_TRIAL);
        const novo = {
          user, pass, whatsapp: whatsappLider,
          indicado_por: valorIndicacao,
          criacao: new Date().toISOString(),
          data_expiracao: expiraInicial.toISOString(), status: 'gratis'
        };
        const { error: insErr } = await supabaseInstance.from(TABELA_USUARIOS).insert([novo]);
        if (insErr) throw insErr;

        let alertaMeta = '';
        if (valorIndicacao !== 'Nenhum' && valorIndicacao !== 'Sim (Sem ID)') {
          const { count, error: countErr } = await supabaseInstance
            .from(TABELA_USUARIOS).select('*', { count: 'exact', head: true }).eq('indicado_por', valorIndicacao);
          if (!countErr) {
            if (count === 5) alertaMeta = `\n\n🎯 *META DE 5 ATINGIDA!* \nO padrinho *${valorIndicacao.toUpperCase()}* ganhou *50% DE DESCONTO*! 💸`;
            else if (count === 10) alertaMeta = `\n\n🔥 *META DE 10 ATINGIDA!* \nO padrinho *${valorIndicacao.toUpperCase()}* ganhou *100% DE DESCONTO (GRÁTIS)*! 🏆`;
            else alertaMeta = `\n(Total do padrinho: ${count} indicações)`;
          }
        }

        enviarNotificacaoTelegram(`*NOVA TURMA CADASTRADA!*\n👑 Turma: ${user.toUpperCase()}\n📱 Whats: ${whatsappLider}\n🎁 Indicação: ${valorIndicacao}${alertaMeta}\n📅 Expira em: ${expiraInicial.toLocaleDateString('pt-BR')}`);

        salvarSessao(novo);
        toast(`Turma ${user.toUpperCase()} criada! ${DIAS_TRIAL} dias grátis.`);
        await atualizarVisualizacao();
      } else {
        const { data: valid } = await supabaseInstance.from(TABELA_USUARIOS).select('*').eq('user', user).eq('pass', pass).maybeSingle();
        if (valid) {
          salvarSessao(valid);
          await atualizarVisualizacao();
        } else {
          $('senha').classList.add('invalido');
          erroLogin('Usuário ou senha incorretos.');
        }
      }
    } catch (e) {
      console.error(e);
      erroLogin('Erro ao falar com o banco. Tente de novo.');
    }
  });
}

function entrarModoDemo() {
  demoDados = demoCarregar();
  salvarSessao({ user: 'demo', demo: true, status: 'demo' });
  atualizarVisualizacao();
}

// registra o último acesso da turma (no máximo 1 vez por hora; ignora se a coluna não existir)
let ultimoRegistroAcesso = 0;
function registrarAcesso() {
  if (!usuarioLogado || usuarioLogado.demo || usuarioLogado.user === ADMIN_USER || !supabaseInstance) return;
  if (Date.now() - ultimoRegistroAcesso < 3600000) return;
  ultimoRegistroAcesso = Date.now();
  supabaseInstance.from(TABELA_USUARIOS).update({ ultimo_acesso: new Date().toISOString() }).eq('user', usuarioLogado.user).then(() => {}, () => {});
}

// app deixado aberto no celular: conta como acesso quando a turma volta para ele
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && document.body.classList.contains('acesso-liberado')) registrarAcesso();
});

async function verificarStatusAssinatura() {
  const { data: userDB, error } = await supabaseInstance.from(TABELA_USUARIOS).select('*').eq('user', usuarioLogado.user).maybeSingle();
  if (error || !userDB) return false;
  salvarSessao(userDB);
  registrarAcesso();
  return new Date() <= dataLimiteAssinatura(userDB);
}

function dataLimiteAssinatura(u) {
  if (u.data_expiracao) return new Date(u.data_expiracao);
  const d = new Date(u.criacao || Date.now());
  d.setDate(d.getDate() + DIAS_TRIAL);
  return d;
}

async function checarWhatsAppPendente() {
  if (!usuarioLogado || usuarioLogado.demo || usuarioLogado.user === ADMIN_USER || usuarioLogado.whatsapp) return;
  const numero = await perguntar({
    titulo: 'Cadastre seu WhatsApp',
    texto: 'Precisamos do número do líder da turma para avisos da assinatura.',
    rotulo: 'WhatsApp com DDD', placeholder: '(21) 98888-7777', tipo: 'tel', ok: 'Salvar número'
  });
  if (!numero) return;
  const d = soDigitos(numero);
  const { error } = await supabaseInstance.from(TABELA_USUARIOS).update({ whatsapp: d }).eq('user', usuarioLogado.user);
  if (!error) {
    usuarioLogado.whatsapp = d;
    salvarSessao(usuarioLogado);
    toast('WhatsApp atualizado!');
    enviarNotificacaoTelegram(`📱 *ZAP ATUALIZADO*\n👤 Turma: ${usuarioLogado.user.toUpperCase()}\n✅ Número: ${d}`);
  }
}

function mostrarTela(qual) {
  $('tela-acesso').classList.toggle('oculto', qual !== 'login');
  $('bloqueio-assinatura').classList.toggle('oculto', qual !== 'bloqueio');
  document.body.classList.toggle('acesso-liberado', qual === 'app');
  $('fab-suporte').classList.toggle('oculto', qual === 'bloqueio');
}

async function atualizarVisualizacao() {
  if (!usuarioLogado) { mostrarTela('login'); return; }

  if (usuarioLogado.demo) {
    if (!demoDados) demoDados = demoCarregar();
  } else if (usuarioLogado.user !== ADMIN_USER) {
    let acessoValido = false;
    try { acessoValido = await verificarStatusAssinatura(); } catch (e) { console.error(e); }
    if (!acessoValido) {
      $('bloqueio-valor').textContent = brl(VALOR_MENSALIDADE);
      $('bloqueio-pix').textContent = MEU_PIX;
      mostrarTela('bloqueio');
      return;
    }
  }

  mostrarTela('app');
  prepararCabecalhoUsuario();
  irPara(rotaDaUrl() || 'painel', false);
  await atualizarTabela();
  checarWhatsAppPendente();
}

function prepararCabecalhoUsuario() {
  const nome = usuarioLogado.demo ? 'Turma Demonstração' : usuarioLogado.user;
  $('nome-turma-sb').textContent = nome;
  $('mobile-turma').textContent = nome;
  $('avatar-turma').textContent = iniciais(nome);
  $('faixa-demo').classList.toggle('oculto', !usuarioLogado.demo);
  $('nav-master').classList.toggle('oculto', usuarioLogado.user !== ADMIN_USER);
  renderizarPlano();
}

function infoPlano() {
  const u = usuarioLogado;
  if (u.demo) return { classe: '', titulo: 'Modo demonstração', texto: 'Crie sua turma para salvar de verdade.', pct: null };
  if (u.user === ADMIN_USER) return { classe: 'ok', titulo: 'Conta master', texto: 'Acesso completo ao sistema.', pct: null };
  const limite = dataLimiteAssinatura(u);
  const dias = Math.max(0, Math.ceil((limite - new Date()) / 86400000));
  if (u.status === 'pago') {
    return { classe: dias <= 5 ? 'alerta' : 'ok', titulo: 'Assinante Elite', texto: `Renova em ${limite.toLocaleDateString('pt-BR')} (${dias} dia${dias === 1 ? '' : 's'})`, pct: null };
  }
  return {
    classe: dias <= 3 ? 'alerta' : '',
    titulo: `Teste grátis · ${dias} dia${dias === 1 ? '' : 's'}`,
    texto: `Termina em ${limite.toLocaleDateString('pt-BR')}`,
    pct: Math.min(100, Math.max(0, (dias / DIAS_TRIAL) * 100))
  };
}

function renderizarPlano() {
  const p = infoPlano();
  const sb = $('sb-plano');
  sb.className = 'sb-plano ' + p.classe;
  sb.innerHTML = `<strong>${esc(p.titulo)}</strong>${esc(p.texto)}${p.pct !== null ? `<div class="meter"><span class="meter-seg" style="width:${p.pct}%;background:var(--gold)"></span></div>` : ''}`;

  const nome = usuarioLogado.demo ? 'Turma Demonstração' : usuarioLogado.user;
  const zap = usuarioLogado.whatsapp ? formatarTel(usuarioLogado.whatsapp) : '';
  $('conta-card').innerHTML = `
    <span class="avatar-usuario">${esc(iniciais(nome))}</span>
    <div class="conta-info"><strong>${esc(nome)}</strong><span>${zap ? 'Líder: ' + esc(zap) : 'Bate-Controle Elite'}</span></div>
    <div class="conta-plano">
      <span class="tag ${p.classe === 'alerta' ? 'tag-vencido' : p.classe === 'ok' ? 'tag-ok' : 'tag-ouro'}">${esc(p.titulo)}</span>
      <p class="form-dica">${esc(p.texto)}</p>
      ${p.pct !== null ? `<div class="meter"><span class="meter-seg" style="width:${p.pct}%;background:var(--gold)"></span></div>` : ''}
    </div>
    ${!usuarioLogado.demo && usuarioLogado.status !== 'pago' && usuarioLogado.user !== ADMIN_USER ? `<button type="button" class="btn btn-ouro" onclick="pagarComCartao()">${iconeSvg('coroa')}Assinar por ${brl(VALOR_MENSALIDADE)}/mês</button>` : ''}
    ${usuarioLogado.demo ? `<button type="button" class="btn btn-accent" onclick="sairDemoParaCadastro()">${iconeSvg('mascara')}Criar minha turma</button>` : ''}`;
}

function sairDemoParaCadastro() {
  usuarioLogado = null;
  mostrarTela('login');
  definirModoAcesso(true);
  $('usuario').focus();
}

function fazerLogout() {
  try { localStorage.removeItem('bateControleSessao'); } catch (e) { /* ok */ }
  usuarioLogado = null;
  history.replaceState(null, '', location.pathname);
  window.location.reload();
}

function abrirSuporte(texto) {
  const msg = texto || 'Olá! Preciso de suporte com o Bate-Controle.';
  window.open(`https://api.whatsapp.com/send?phone=${WHATSAPP_DONO}&text=${encodeURIComponent(msg)}`, '_blank');
}

async function copiarPix() {
  try { await navigator.clipboard.writeText(MEU_PIX); toast('Chave PIX copiada!'); }
  catch (e) { toast('Chave PIX: ' + MEU_PIX, 'info'); }
}

// 4. PAINEL MASTER — veja js/admin.js

// =====================================================================
// 5. NAVEGAÇÃO E TEMA
// =====================================================================
const TITULOS = { painel: 'Visão geral', componentes: 'Componentes', caixa: 'Custos & despesas', mais: 'Relatórios & ajustes' };

function rotaDaUrl() { const r = location.hash.replace('#', ''); return TITULOS[r] ? r : null; }

function irPara(rota, registrar = true) {
  if (!TITULOS[rota]) rota = 'painel';
  document.querySelectorAll('.pagina').forEach((p) => p.classList.toggle('ativa', p.id === 'pagina-' + rota));
  document.querySelectorAll('[data-rota]').forEach((b) => b.classList.toggle('ativo', b.dataset.rota === rota));
  $('mobile-titulo').textContent = TITULOS[rota];
  if (registrar && location.hash !== '#' + rota) history.pushState(null, '', '#' + rota);
  window.scrollTo(0, 0);
}

window.addEventListener('popstate', () => { if (document.body.classList.contains('acesso-liberado')) irPara(rotaDaUrl() || 'painel', false); });

document.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-rota]');
  if (nav) { irPara(nav.dataset.rota); return; }
  const ir = e.target.closest('[data-ir]');
  if (ir) {
    if (ir.dataset.filtro) filtrar(ir.dataset.filtro);
    irPara(ir.dataset.ir);
  }
});

function alternarTema() {
  const atual = document.documentElement.getAttribute('data-theme')
    || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const novo = atual === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', novo);
  try { localStorage.setItem('bc_tema', novo); } catch (e) { /* ok */ }
  document.querySelector('meta[name="theme-color"]').content = novo === 'dark' ? '#0b0716' : '#7c3aed';
}

// =====================================================================
// 6. LÓGICA FINANCEIRA E TELAS
// =====================================================================
let componentes = [], custosExtras = [], gastosManuais = [], filtroAtual = 'todos';

async function carregarDadosUsuario() {
  if (!usuarioLogado) return;
  const [comp, extr, gast] = await Promise.all([api.listar('componentes'), api.listar('extras'), api.listar('gastos_manuais')]);
  componentes = comp.map((c) => ({ ...c, valor_total: Number(c.valor_total) || 0, valor_pago: Number(c.valor_pago) || 0 }));
  custosExtras = extr.map((e) => ({ ...e, valor: Number(e.valor) || 0 }));
  gastosManuais = gast.map((g) => ({ ...g, valor: Number(g.valor) || 0 }));
}

function calcularRateio() {
  const totalExtras = custosExtras.reduce((s, e) => s + e.valor, 0);
  return { totalExtras, rateio: componentes.length ? totalExtras / componentes.length : 0 };
}

// situação de cada componente
function situacao(c, rateio) {
  const total = c.valor_total + rateio;
  const saldo = total - c.valor_pago;
  const dias = diasAte(c.vencimento);
  const pct = total > 0 ? Math.min(100, (c.valor_pago / total) * 100) : 0;
  let st;
  if (saldo <= 0.009) st = { chave: 'quitado', tag: 'tag-ok', txt: 'Quitado', linha: 'linha-ok' };
  else if (dias !== null && dias < 0) st = { chave: 'atrasado', tag: 'tag-vencido', txt: `Atrasado ${-dias}d`, linha: 'linha-vencida' };
  else if (dias === 0) st = { chave: 'em-dia', tag: 'tag-alerta', txt: 'Vence hoje', linha: 'linha-alerta' };
  else if (dias === 1) st = { chave: 'em-dia', tag: 'tag-alerta', txt: 'Vence amanhã', linha: 'linha-alerta' };
  else if (dias !== null && dias <= 7) st = { chave: 'em-dia', tag: 'tag-info', txt: `Em ${dias} dias`, linha: '' };
  else st = { chave: 'em-dia', tag: 'tag-neutro', txt: 'Em dia', linha: '' };
  return { total, saldo: Math.max(0, saldo), credito: saldo < 0 ? -saldo : 0, dias, pct, ...st };
}

function atualizarResumo() {
  const { totalExtras, rateio } = calcularRateio();
  let pago = 0, metaFanta = 0, quitados = 0, atrasados = 0, restante = 0;
  componentes.forEach((c) => {
    metaFanta += c.valor_total;
    pago += c.valor_pago;
    const s = situacao(c, rateio);
    restante += s.saldo;
    if (s.chave === 'quitado') quitados++;
    if (s.chave === 'atrasado') atrasados++;
  });
  const projecao = metaFanta + totalExtras;
  const totalGastos = gastosManuais.reduce((s, g) => s + g.valor, 0);

  $('total-componentes').textContent = componentes.length;
  $('meta-componentes').textContent = componentes.length === 1 ? 'pessoa na turma' : 'pessoas na turma';
  $('meta-total').textContent = brlCurto(projecao);
  $('total-pago').textContent = brlCurto(pago);
  $('meta-quitados').textContent = `${quitados} quitado${quitados === 1 ? '' : 's'}`;
  $('total-devedor').textContent = brlCurto(restante);
  $('meta-atrasados').textContent = `${atrasados} atrasado${atrasados === 1 ? '' : 's'}`;

  // rateio
  $('valorExtraPorPessoa').textContent = brl(rateio);
  $('rateio-detalhe').textContent = `total de ${brl(totalExtras)} ÷ ${componentes.length} componente${componentes.length === 1 ? '' : 's'}`;

  // contadores do menu
  $('nav-count-atrasados').textContent = atrasados || '';
  $('tab-dot-atrasados').classList.toggle('on', atrasados > 0);

  // balanço
  const saldoFinal = pago - totalGastos;
  const pct = projecao > 0 ? Math.min(100, (pago / projecao) * 100) : 0;
  const valor = $('valor-balanco');
  valor.textContent = brl(saldoFinal);
  valor.classList.toggle('negativo', saldoFinal < 0);
  const st = $('status-financeiro');
  st.classList.toggle('negativo', saldoFinal < 0);
  st.innerHTML = saldoFinal < 0
    ? `${iconeSvg('tendencia-baixo')}Prejuízo: os gastos passaram das entradas`
    : `${iconeSvg('tendencia')}Lucro: o caixa está positivo`;
  $('hero-pct').textContent = pct.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + '%';
  $('hero-faltam').textContent = 'faltam ' + brl(Math.max(0, projecao - pago));
  $('hero-meter').style.width = pct + '%';
  $('hero-entradas').textContent = brl(pago);
  $('hero-saidas').textContent = brl(totalGastos);
  $('hero-extras').textContent = brl(totalExtras);

  // lista de custos extras
  $('listaExtras').innerHTML = custosExtras.length ? custosExtras.map((e) => `
    <li class="item-linha">
      <span class="item-ico">${iconeSvg('rateio')}</span>
      <div class="item-txt"><strong>${esc(e.descricao)}</strong><span>${brl(rateio > 0 && componentes.length ? e.valor / componentes.length : 0)} por pessoa</span></div>
      <span class="item-valor">${brl(e.valor)}</span>
      <button type="button" class="btn-mini perigo" onclick='removerExtra(${esc(JSON.stringify(e.id))})' aria-label="Remover custo">${iconeSvg('lixeira')}</button>
    </li>`).join('') : vazio('rateio', 'Nenhum custo extra', 'Ônibus, bateria e outros custos divididos entre todos.');

  // despesas
  $('total-gastos-manuais').textContent = brl(totalGastos);
  $('gastos-detalhe').textContent = `${gastosManuais.length} lançamento${gastosManuais.length === 1 ? '' : 's'}`;
  $('lista-gastos-manuais').innerHTML = gastosManuais.length ? gastosManuais.map((g) => `
    <li class="item-linha">
      <span class="item-ico perigo">${iconeSvg('recibo')}</span>
      <div class="item-txt"><strong>${esc(g.item)}</strong><span>Responsável: ${esc(g.responsavel || '—')}</span></div>
      <span class="item-valor txt-perigo">− ${brl(g.valor)}</span>
      <button type="button" class="btn-mini perigo" onclick='removerGastoManual(${esc(JSON.stringify(g.id))})' aria-label="Remover despesa">${iconeSvg('lixeira')}</button>
    </li>`).join('') : vazio('recibo', 'Nenhuma despesa registrada', 'Lance aqui as compras feitas com o dinheiro da turma.');

  renderizarPainel(rateio);
  return rateio;
}

function vazio(ico, titulo, texto, extra = '') {
  return `<li class="empty"><div class="empty-ico ${extra}">${iconeSvg(ico)}</div><strong>${titulo}</strong>${texto}</li>`;
}

function pessoaHTML(c, sub) {
  return `<div class="pessoa"><span class="av ${corAvatar(c.nome)}">${esc(iniciais(c.nome))}</span><div class="pessoa-txt"><strong>${esc(c.nome)}</strong><span>${sub}</span></div></div>`;
}

function renderizarPainel(rateio) {
  const agora = new Date();
  const hora = agora.getHours();
  const saud = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const nome = usuarioLogado.demo ? 'turma' : usuarioLogado.user.toUpperCase();
  $('painel-saudacao').textContent = `${saud}, ${nome}`;
  $('painel-data').textContent = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  const comSit = componentes.map((c) => ({ c, s: situacao(c, rateio) }));

  const atencao = comSit.filter(({ s }) => s.chave !== 'quitado' && s.dias !== null && s.dias <= 7).sort((a, b) => a.s.dias - b.s.dias).slice(0, 6);
  $('painel-vencimentos').innerHTML = atencao.length ? atencao.map(({ c, s }) => `
    <li class="atencao-item">
      ${pessoaHTML(c, `Saldo ${brl(s.saldo)} · venc. ${dataCurta(c.vencimento)}`)}
      <div class="atencao-fim">
        <span class="tag ${s.tag}">${s.txt}</span>
        <button type="button" class="btn-mini whats" onclick='cobrarWhatsApp(${esc(JSON.stringify(c.id))})' aria-label="Cobrar no WhatsApp">${iconeSvg('whats')}</button>
      </div>
    </li>`).join('') : (componentes.length
    ? vazio('check', 'Tudo em dia', 'Ninguém atrasado nem vencendo nos próximos 7 dias.', 'ok')
    : vazio('pessoa-mais', 'Comece cadastrando a turma', 'Adicione o primeiro componente pelo botão “Novo componente”.'));

  const devedores = comSit.filter(({ s }) => s.saldo > 0).sort((a, b) => b.s.saldo - a.s.saldo).slice(0, 6);
  $('painel-devedores').innerHTML = devedores.length ? devedores.map(({ c, s }) => `
    <li class="atencao-item">
      ${pessoaHTML(c, `<span class="progresso"><span style="display:block">${s.pct.toFixed(0)}% pago</span><span class="meter"><span class="meter-seg ${s.pct >= 100 ? 'ok' : ''}" style="width:${s.pct}%"></span></span></span>`)}
      <div class="atencao-fim">
        <strong class="num txt-perigo">${brl(s.saldo)}</strong>
        <button type="button" class="btn-mini" onclick='registrarPagamento(${esc(JSON.stringify(c.id))})' aria-label="Registrar pagamento">${iconeSvg('dinheiro')}</button>
      </div>
    </li>`).join('') : vazio('check', componentes.length ? 'Todo mundo quitado!' : 'Sem saldos em aberto', componentes.length ? 'Caixa completo. Bora pro desfile.' : 'Os saldos aparecem aqui assim que houver componentes.', 'ok');
}

async function atualizarTabela() {
  try {
    await carregarDadosUsuario();
  } catch (e) {
    console.error(e);
    toast('Não foi possível carregar os dados. Verifique a internet.', 'erro');
  }
  renderizarTabela();
}

function renderizarTabela() {
  const rateio = atualizarResumo();
  const corpo = $('corpoTabela');
  const busca = ($('buscaNome').value || '').toLowerCase().trim();
  const buscaDig = soDigitos(busca);

  const contagem = { todos: 0, atrasado: 0, 'em-dia': 0, quitado: 0 };
  const linhas = componentes
    .map((c) => ({ c, s: situacao(c, rateio) }))
    .sort((a, b) => {
      const ordem = { atrasado: 0, 'em-dia': 1, quitado: 2 };
      return ordem[a.s.chave] - ordem[b.s.chave] || (a.c.vencimento || '').localeCompare(b.c.vencimento || '') || a.c.nome.localeCompare(b.c.nome);
    });

  linhas.forEach(({ s }) => { contagem.todos++; contagem[s.chave]++; });
  Object.keys(contagem).forEach((k) => { $('cnt-' + k).textContent = contagem[k] || ''; });

  const visiveis = linhas.filter(({ c, s }) => {
    if (busca && !c.nome.toLowerCase().includes(busca) && !(buscaDig && soDigitos(c.telefone).includes(buscaDig))) return false;
    if (filtroAtual !== 'todos' && s.chave !== filtroAtual) return false;
    return true;
  });

  if (!visiveis.length) {
    const semNada = !componentes.length;
    corpo.innerHTML = `<tr class="linha-vazia"><td colspan="6" class="celula-vazia">
      <div class="empty-ico">${iconeSvg(semNada ? 'pessoa-mais' : 'busca')}</div>
      <strong>${semNada ? 'Nenhum componente ainda' : 'Nada encontrado'}</strong>
      ${semNada ? 'Cadastre quem vai sair na turma para começar o controle.' : 'Tente outro nome ou troque o filtro.'}
      ${semNada ? `<div style="margin-top:14px"><button type="button" class="btn btn-accent" onclick="abrirFormComponente()">${iconeSvg('pessoa-mais')}Novo componente</button></div>` : ''}
    </td></tr>`;
    return;
  }

  corpo.innerHTML = visiveis.map(({ c, s }) => {
    const idJs = esc(JSON.stringify(c.id));
    return `
      <tr class="${s.linha}">
        <td class="cel-nome">${pessoaHTML(c, esc(c.telefone ? formatarTel(c.telefone) : 'Sem WhatsApp'))}</td>
        <td data-label="Total" class="num-cel">${brl(s.total)}<span class="sub-txt">F ${brl(c.valor_total)} + E ${brl(rateio)}</span></td>
        <td data-label="Pago" class="num-cel txt-ok">${brl(c.valor_pago)}<span class="progresso"><span class="meter"><span class="meter-seg ok" style="width:${s.pct}%"></span></span></span></td>
        <td data-label="Saldo" class="num-cel ${s.saldo > 0 ? 'txt-perigo' : 'txt-ok'}">${brl(s.saldo)}${s.credito ? `<span class="sub-txt">crédito ${brl(s.credito)}</span>` : ''}</td>
        <td class="cel-situacao"><span class="tag ${s.tag}">${s.txt}</span><span class="sub-txt mono">venc. ${dataBR(c.vencimento)}</span></td>
        <td class="col-acoes">
          <div class="acoes">
            <button type="button" class="btn btn-sm btn-success btn-pagar" onclick='registrarPagamento(${idJs})'>${iconeSvg('dinheiro')}Pagar</button>
            <button type="button" class="btn-mini whats" onclick='cobrarWhatsApp(${idJs})' title="Cobrar no WhatsApp" aria-label="Cobrar no WhatsApp">${iconeSvg('whats')}</button>
            <button type="button" class="btn-mini" onclick='editarComponente(${idJs})' title="Editar" aria-label="Editar">${iconeSvg('editar')}</button>
            <button type="button" class="btn-mini perigo" onclick='removerComponente(${idJs})' title="Remover" aria-label="Remover">${iconeSvg('lixeira')}</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function filtrar(t) {
  filtroAtual = t;
  document.querySelectorAll('#seg-filtro .seg-opt').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filtro === t)));
  renderizarTabela();
}

// =====================================================================
// 7. AÇÕES
// =====================================================================
async function executar(fn, msgOk) {
  try {
    await fn();
    if (msgOk) toast(msgOk);
    await atualizarTabela();
    return true;
  } catch (e) {
    console.error(e);
    toast('Não foi possível salvar. Tente novamente.', 'erro');
    return false;
  }
}

// ---------- componente: novo / editar ----------
function abrirFormComponente(c = null) {
  $('componente-titulo').textContent = c ? 'Editar componente' : 'Novo componente';
  $('componente-id').value = c ? c.id : '';
  $('nome').value = c ? c.nome : '';
  $('telefone').value = c ? formatarTel(c.telefone) : '';
  $('valorTotal').value = c ? brl(c.valor_total) : (componentes.length ? brl(valorMaisComum()) : '');
  $('dataVencimento').value = c ? c.vencimento : (componentes.length ? vencimentoMaisComum() : somarDias(hojeISO(), 30));
  $('valorPagoEdit').value = c ? brl(c.valor_pago) : '';
  $('grupo-valor-pago').classList.toggle('oculto', !c);
  document.querySelectorAll('#form-componente .invalido').forEach((el) => el.classList.remove('invalido'));
  abrirOverlay('drawer-componente');
}

function valorMaisComum() {
  const cont = {};
  componentes.forEach((c) => { cont[c.valor_total] = (cont[c.valor_total] || 0) + 1; });
  return Number(Object.keys(cont).sort((a, b) => cont[b] - cont[a])[0]) || 0;
}

function vencimentoMaisComum() {
  const dias = {};
  componentes.forEach((c) => { const d = (c.vencimento || '').slice(8, 10); if (d) dias[d] = (dias[d] || 0) + 1; });
  const dia = Object.keys(dias).sort((a, b) => dias[b] - dias[a])[0];
  if (!dia) return somarDias(hojeISO(), 30);
  const h = hojeISO();
  let alvo = h.slice(0, 8) + dia;
  if (alvo < h) alvo = somarMes(alvo);
  return alvo;
}

function editarComponente(id) { const c = componentes.find((x) => x.id == id); if (c) abrirFormComponente(c); }
// compatibilidade com o nome antigo
function editarValorFantasia(id) { editarComponente(id); }

$('form-componente').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('componente-id').value;
  const nome = $('nome').value.trim();
  const valor = parseMoeda($('valorTotal').value);
  const tel = soDigitos($('telefone').value);
  const data = $('dataVencimento').value;

  let invalido = false;
  if (!nome) { $('nome').classList.add('invalido'); invalido = true; }
  if (tel.length < 10) { $('telefone').classList.add('invalido'); invalido = true; }
  if (isNaN(valor) || valor < 0) { $('valorTotal').classList.add('invalido'); invalido = true; }
  if (!data) { $('dataVencimento').classList.add('invalido'); invalido = true; }
  if (invalido) return toast('Confira os campos destacados.', 'erro');

  await comCarregando($('btn-cadastrar'), async () => {
    let ok;
    if (id) {
      const patch = { nome, valor_total: valor, telefone: tel, vencimento: data };
      const pagoEdit = parseMoeda($('valorPagoEdit').value);
      if (!isNaN(pagoEdit) && pagoEdit >= 0) patch.valor_pago = pagoEdit;
      ok = await executar(() => api.atualizar('componentes', id, patch), 'Componente atualizado.');
    } else {
      ok = await executar(() => api.inserir('componentes', { nome, valor_total: valor, valor_pago: 0, telefone: tel, vencimento: data }), `${nome.split(' ')[0]} entrou na turma!`);
    }
    if (ok) fecharOverlay('drawer-componente');
  });
});

// compatibilidade com o nome antigo
function adicionarComponente() { abrirFormComponente(); }

// ---------- pagamento ----------
let pagamentoAtual = null;

function registrarPagamento(id) {
  const c = componentes.find((x) => x.id == id);
  if (!c) return;
  pagamentoAtual = c;
  const { rateio } = calcularRateio();
  const s = situacao(c, rateio);
  $('pag-resumo').innerHTML = `
    <div class="nome">${pessoaHTML(c, 'Vencimento ' + dataBR(c.vencimento))}</div>
    <div><span>Total</span><strong>${brl(s.total)}</strong></div>
    <div><span>Pago</span><strong class="txt-ok">${brl(c.valor_pago)}</strong></div>
    <div><span>Saldo</span><strong class="txt-perigo">${brl(s.saldo)}</strong></div>`;
  const sugestoes = new Set();
  if (s.saldo > 0) sugestoes.add(Math.round(s.saldo * 100) / 100);
  [50, 100, 150].forEach((v) => { if (v < s.saldo) sugestoes.add(v); });
  $('pag-chips').innerHTML = [...sugestoes].map((v, i) => `<button type="button" class="chip" data-valor="${v}">${i === 0 && s.saldo > 0 ? 'Quitar · ' : ''}${brl(v)}</button>`).join('');
  $('pag-valor').value = '';
  $('pag-avancar').checked = true;
  $('pag-novo-venc').textContent = c.vencimento ? `de ${dataBR(c.vencimento)} para ${dataBR(somarMes(c.vencimento))}` : '';
  abrirOverlay('modal-pagamento');
}

$('pag-chips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (chip) { $('pag-valor').value = brl(Number(chip.dataset.valor)); $('pag-valor').classList.remove('invalido'); }
});

$('form-pagamento').addEventListener('submit', async (e) => {
  e.preventDefault();
  const v = parseMoeda($('pag-valor').value);
  if (isNaN(v) || v <= 0) { $('pag-valor').classList.add('invalido'); return toast('Informe o valor recebido.', 'erro'); }
  const c = pagamentoAtual;
  const patch = { valor_pago: Math.round(((c.valor_pago || 0) + v) * 100) / 100 };
  if ($('pag-avancar').checked && c.vencimento) patch.vencimento = somarMes(c.vencimento);
  const btn = e.submitter || $('form-pagamento').querySelector('.btn-accent');
  await comCarregando(btn, async () => {
    const ok = await executar(() => api.atualizar('componentes', c.id, patch), `Pagamento de ${brl(v)} registrado para ${c.nome.split(' ')[0]}.`);
    if (ok) fecharOverlay('modal-pagamento');
  });
});

// ---------- cobrança no WhatsApp ----------
function mensagemCobranca(c, s) {
  const turma = usuarioLogado.demo ? 'nossa turma' : `a turma ${usuarioLogado.user.toUpperCase()}`;
  const primeiro = c.nome.split(' ')[0];
  let quando;
  if (s.dias < 0) quando = `está *em atraso* desde ${dataBR(c.vencimento)}`;
  else if (s.dias === 0) quando = '*vence hoje*';
  else if (s.dias === 1) quando = `*vence amanhã* (${dataBR(c.vencimento)})`;
  else quando = `vence em ${dataBR(c.vencimento)}`;
  return `Olá, *${primeiro}*! 🎭\nPassando para lembrar que a sua parcela da fantasia com ${turma} ${quando}.\n\n💰 Saldo em aberto: *${brl(s.saldo)}*\n✅ Já pago: ${brl(c.valor_pago)}\n\nQualquer dúvida é só chamar!`;
}

function cobrarWhatsApp(id) {
  const c = componentes.find((x) => x.id == id);
  if (!c) return;
  if (!c.telefone) return toast('Esse componente não tem WhatsApp.', 'erro');
  const s = situacao(c, calcularRateio().rateio);
  if (s.saldo <= 0) return toast(`${c.nome.split(' ')[0]} já está quitado.`, 'info');
  window.open(`https://api.whatsapp.com/send?phone=${telWhats(c.telefone)}&text=${encodeURIComponent(mensagemCobranca(c, s))}`, '_blank');
}

// lista de quem vence amanhã — cada envio é um toque (navegadores bloqueiam várias abas automáticas)
function avisarVencimentosAmanha() {
  const amanha = somarDias(hojeISO(), 1);
  const { rateio } = calcularRateio();
  const avisados = componentes.filter((c) => c.vencimento === amanha && situacao(c, rateio).saldo > 0.1);
  if (!avisados.length) return toast('Ninguém com saldo vence amanhã.', 'info');
  $('avisos-titulo').textContent = 'Avisar vencimentos';
  $('avisos-texto').textContent = `${avisados.length} componente${avisados.length === 1 ? '' : 's'} vence${avisados.length === 1 ? '' : 'm'} amanhã (${dataBR(amanha)}). Toque em “Enviar” para abrir a mensagem pronta de cada um.`;
  $('avisos-lista').innerHTML = avisados.map((c) => `
    <li class="atencao-item">
      ${pessoaHTML(c, 'Saldo ' + brl(situacao(c, rateio).saldo))}
      <div class="atencao-fim"><button type="button" class="btn btn-sm btn-success" onclick='cobrarWhatsApp(${esc(JSON.stringify(c.id))}); marcarEnviado(this)'>${iconeSvg('whats')}Enviar</button></div>
    </li>`).join('');
  abrirOverlay('modal-avisos');
}

function marcarEnviado(btn) {
  btn.innerHTML = iconeSvg('check') + 'Enviado';
  btn.className = 'btn btn-sm btn-ghost';
}

// ---------- remover componente ----------
async function removerComponente(id) {
  const c = componentes.find((x) => x.id == id);
  if (!c) return;
  const ok = await confirmar({ titulo: `Remover ${c.nome}?`, texto: `O histórico de pagamentos (${brl(c.valor_pago)}) dessa pessoa sai do caixa.`, ok: 'Remover' });
  if (ok) executar(() => api.remover('componentes', id), 'Componente removido.');
}

// ---------- valor global ----------
async function editarValorGlobal() {
  if (!componentes.length) return toast('Cadastre componentes primeiro.', 'info');
  const novo = await perguntar({
    titulo: 'Valor da fantasia para todos',
    texto: `Atualiza o valor da fantasia dos ${componentes.length} componentes. Os pagamentos já feitos continuam registrados.`,
    rotulo: 'Novo valor', valor: brl(valorMaisComum()), ok: 'Continuar'
  });
  if (novo === null) return;
  const ok = await confirmar({ titulo: `Aplicar ${brl(novo)} para todos?`, texto: 'Essa alteração vale para toda a turma.', ok: 'Aplicar para todos', tom: 'alerta' });
  if (ok) executar(() => api.atualizarTodos('componentes', { valor_total: novo }), 'Valor atualizado para toda a turma.');
}

// ---------- custos extras ----------
$('form-extra').addEventListener('submit', async (e) => {
  e.preventDefault();
  const desc = $('descExtra').value.trim();
  const valor = parseMoeda($('valorExtra').value);
  if (!desc) $('descExtra').classList.add('invalido');
  if (isNaN(valor) || valor <= 0) $('valorExtra').classList.add('invalido');
  if (!desc || isNaN(valor) || valor <= 0) return toast('Informe descrição e valor.', 'erro');
  await comCarregando(e.submitter, async () => {
    const ok = await executar(() => api.inserir('extras', { descricao: desc, valor }), 'Custo extra adicionado e rateado.');
    if (ok) { $('descExtra').value = ''; $('valorExtra').value = ''; }
  });
});
function adicionarCustoExtra() { $('form-extra').requestSubmit(); }

async function removerExtra(id) {
  const e = custosExtras.find((x) => x.id == id);
  const ok = await confirmar({ titulo: 'Remover custo extra?', texto: e ? `${e.descricao} — ${brl(e.valor)}` : '', ok: 'Remover' });
  if (ok) executar(() => api.remover('extras', id), 'Custo extra removido.');
}

// ---------- despesas ----------
$('form-gasto').addEventListener('submit', async (e) => {
  e.preventDefault();
  const item = $('gasto-item').value.trim();
  const valor = parseMoeda($('gasto-valor').value);
  const responsavel = $('gasto-delegado').value.trim();
  if (!item) $('gasto-item').classList.add('invalido');
  if (isNaN(valor) || valor <= 0) $('gasto-valor').classList.add('invalido');
  if (!responsavel) $('gasto-delegado').classList.add('invalido');
  if (!item || isNaN(valor) || valor <= 0 || !responsavel) return toast('Preencha item, valor e responsável.', 'erro');
  await comCarregando(e.submitter, async () => {
    const ok = await executar(() => api.inserir('gastos_manuais', { item, valor, responsavel }), 'Despesa registrada.');
    if (ok) { $('gasto-item').value = ''; $('gasto-valor').value = ''; $('gasto-delegado').value = ''; }
  });
});
function adicionarGastoManual() { $('form-gasto').requestSubmit(); }

async function removerGastoManual(id) {
  const g = gastosManuais.find((x) => x.id == id);
  const ok = await confirmar({ titulo: 'Apagar despesa?', texto: g ? `${g.item} — ${brl(g.valor)}` : '', ok: 'Apagar' });
  if (ok) executar(() => api.remover('gastos_manuais', id), 'Despesa apagada.');
}

// ---------- zerar temporada ----------
async function zerarTemporada() {
  const ok = await confirmar({
    titulo: 'Zerar a temporada?',
    texto: 'Os pagamentos de todos voltam para R$ 0,00 e os custos extras e despesas são apagados. Os componentes continuam cadastrados.\n\nDica: baixe o relatório em PDF antes.',
    ok: 'Zerar temporada'
  });
  if (!ok) return;
  executar(async () => {
    await api.removerTodos('extras');
    await api.atualizarTodos('componentes', { valor_pago: 0 });
    await api.removerTodos('gastos_manuais');
  }, 'Temporada zerada. Boa folia!');
}

// =====================================================================
// 8. RELATÓRIOS
// =====================================================================
function gerarRelatorioPDF() {
  if (!window.jspdf) return toast('Gerador de PDF ainda carregando. Tente em instantes.', 'erro');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const { totalExtras, rateio } = calcularRateio();
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  const nomeTurma = usuarioLogado.demo ? 'DEMONSTRACAO' : usuarioLogado.user.toUpperCase();
  const ROXO = [124, 58, 237], OURO = [242, 176, 17], NOITE = [20, 11, 38];

  // faixa de topo
  doc.setFillColor(...NOITE); doc.rect(0, 0, 210, 30, 'F');
  doc.setFillColor(...OURO); doc.rect(0, 30, 210, 1.5, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(255, 255, 255);
  doc.text('BATE-CONTROLE ELITE', 14, 14);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(255, 217, 120);
  doc.text(`Turma ${nomeTurma}  ·  Relatório gerado em ${dataAtual}`, 14, 22);

  const pago = componentes.reduce((s, c) => s + c.valor_pago, 0);
  const meta = componentes.reduce((s, c) => s + c.valor_total, 0) + totalExtras;
  const gastos = gastosManuais.reduce((s, g) => s + g.valor, 0);
  const restante = componentes.reduce((s, c) => s + situacao(c, rateio).saldo, 0);

  doc.autoTable({
    startY: 38,
    head: [['Indicador', 'Valor']],
    body: [
      ['Componentes', String(componentes.length)],
      ['Projeção de caixa (fantasias + extras)', brl(meta)],
      ['Total recebido', brl(pago)],
      ['Restante a receber', brl(restante)],
      ['Custos extras (rateio de ' + brl(rateio) + ' por pessoa)', brl(totalExtras)],
      ['Despesas', brl(gastos)],
      ['BALANÇO EM CAIXA', brl(pago - gastos)]
    ],
    theme: 'striped',
    headStyles: { fillColor: ROXO },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
  });

  let y = doc.lastAutoTable.finalY + 12;
  doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...NOITE);
  doc.text('Compras & despesas', 14, y);
  doc.autoTable({
    startY: y + 4,
    head: [['Item', 'Responsável', 'Valor']],
    body: gastosManuais.length ? gastosManuais.map((g) => [g.item, g.responsavel || '-', brl(g.valor)]) : [['Nenhuma despesa registrada', '-', '-']],
    headStyles: { fillColor: NOITE },
    columnStyles: { 2: { halign: 'right' } }
  });

  y = doc.lastAutoTable.finalY + 12;
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text('Lista de pagamentos', 14, y);
  const linhas = componentes.map((c) => ({ c, s: situacao(c, rateio) })).sort((a, b) => a.c.nome.localeCompare(b.c.nome));
  doc.autoTable({
    startY: y + 4,
    head: [['Nome', 'Total', 'Pago', 'Saldo', 'Venc.', 'Situação']],
    body: linhas.map(({ c, s }) => [c.nome, brl(s.total), brl(c.valor_pago), brl(s.saldo), dataBR(c.vencimento), s.txt]),
    headStyles: { fillColor: ROXO },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 5) {
        const t = d.cell.raw;
        if (t.startsWith('Atrasado')) d.cell.styles.textColor = [220, 53, 69];
        else if (t === 'Quitado') d.cell.styles.textColor = [18, 146, 79];
      }
    }
  });

  const paginas = doc.internal.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(140);
    doc.text(`Bate-Controle Elite · página ${i} de ${paginas}`, 105, 290, { align: 'center' });
  }

  doc.save(`Relatorio_BateControle_${nomeTurma}_${hojeISO()}.pdf`);
  toast('Relatório em PDF gerado.');
}

function exportarCSV() {
  const { rateio } = calcularRateio();
  const cel = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const num = (v) => (Number(v) || 0).toFixed(2).replace('.', ',');
  const linhas = [['Nome', 'WhatsApp', 'Fantasia', 'Rateio extras', 'Total', 'Pago', 'Saldo', 'Vencimento', 'Situação']];
  componentes.forEach((c) => {
    const s = situacao(c, rateio);
    linhas.push([c.nome, formatarTel(c.telefone), num(c.valor_total), num(rateio), num(s.total), num(c.valor_pago), num(s.saldo), dataBR(c.vencimento), s.txt]);
  });
  linhas.push([]);
  linhas.push(['Despesa', 'Responsável', 'Valor']);
  gastosManuais.forEach((g) => linhas.push([g.item, g.responsavel, num(g.valor)]));
  linhas.push([]);
  linhas.push(['Custo extra', 'Valor']);
  custosExtras.forEach((e) => linhas.push([e.descricao, num(e.valor)]));

  const csv = '﻿' + linhas.map((l) => l.map(cel).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `BateControle_${usuarioLogado.demo ? 'demo' : usuarioLogado.user}_${hojeISO()}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Planilha exportada.');
}

// =====================================================================
// INICIALIZAÇÃO
// =====================================================================
$('form-acesso').addEventListener('submit', (e) => { e.preventDefault(); executarAcaoPrincipal(); });

$('mostrar-senha').addEventListener('click', () => {
  const inp = $('senha');
  const ver = inp.type === 'password';
  inp.type = ver ? 'text' : 'password';
  $('mostrar-senha').innerHTML = iconeSvg(ver ? 'olho-off' : 'olho');
  $('mostrar-senha').setAttribute('aria-label', ver ? 'Ocultar senha' : 'Mostrar senha');
});

$('seg-indicacao').addEventListener('click', (e) => {
  const b = e.target.closest('.seg-opt');
  if (!b) return;
  document.querySelectorAll('#seg-indicacao .seg-opt').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  $('wrapper-id-indicador').classList.toggle('oculto', b.dataset.indicado !== 'sim');
});

$('seg-filtro').addEventListener('click', (e) => { const b = e.target.closest('.seg-opt'); if (b) filtrar(b.dataset.filtro); });

let buscaTimer;
$('buscaNome').addEventListener('input', () => { clearTimeout(buscaTimer); buscaTimer = setTimeout(renderizarTabela, 120); });

// ---------- funciona como app no celular (instalável e abre sem internet) ----------
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker:', e)));
}

function atualizarConexao() {
  const off = !navigator.onLine;
  const antes = document.body.classList.contains('offline');
  document.body.classList.toggle('offline', off);
  if (antes && !off) {
    toast('Internet de volta.');
    if (usuarioLogado && document.body.classList.contains('acesso-liberado')) atualizarTabela();
  }
}
window.addEventListener('online', atualizarConexao);
window.addEventListener('offline', atualizarConexao);
atualizarConexao();

window.addEventListener('load', () => {
  if (usuarioLogado && usuarioLogado.user === ADMIN_USER && !location.hash) { acessarPainelDono(); return; }
  atualizarVisualizacao();
});
