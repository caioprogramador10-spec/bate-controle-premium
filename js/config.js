// =====================================================================
// BATE-CONTROLE ELITE — CONFIGURAÇÕES
// Tudo o que muda de uma instalação para outra fica aqui.
// =====================================================================

// ---------- Supabase ----------
const SUPABASE_URL = 'https://ovrkpnusgulvkjtnhcsr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92cmtwbnVzZ3VsdmtqdG5oY3NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1ODI2NTEsImV4cCI6MjA4NjE1ODY1MX0.EF4opjkiJfSi4Nr3M4DDTvhZnM8itILurG_OTLw_q-I';
const TABELA_USUARIOS = 'batecontroleusers';

// ---------- Venda e assinatura ----------
const DIAS_TRIAL = 15;
const DIAS_INATIVIDADE = 1;   // painel master: turma sem entrar há X dias aparece como "sem acesso"
const VALOR_MENSALIDADE = 39.90;
const MEU_PIX = 'caio.programador10@gmail.com';
const WHATSAPP_DONO = '5521985072328';

// ---------- Acesso master ----------
// ATENÇÃO: login conferido no navegador — qualquer pessoa que abrir o código
// consegue ver. Veja o README (seção "Segurança") para mover isso ao Supabase.
const ADMIN_USER = 'caio';
const ADMIN_PASS = 'caio1010';

// ---------- Notificações no Telegram ----------
const TELEGRAM_TOKEN = '8646880823:AAG8F1oClLVjqrH4PggfqYeevpaaq2RxyeI';
const TELEGRAM_CHAT_ID = '6924491541';
