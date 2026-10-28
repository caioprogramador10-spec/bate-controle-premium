// ==========================================
// LÓGICA DE PAGAMENTO - MERCADO PAGO
// ==========================================

window.pagarComCartao = function() {
    // Link direto do seu Checkout Pro
    const linkMercadoPago = "https://mpago.la/2zHDQ9Y"; 
    
    // Abre a aba de pagamento
    window.open(linkMercadoPago, '_blank');
    
    // Puxa os dados da sessão atual para te avisar no Telegram
    const sessao = JSON.parse(localStorage.getItem('bateControleSessao'));
    const nomeTurma = sessao ? sessao.user.toUpperCase() : "DESCONHECIDO";
    const zapTurma = sessao ? sessao.whatsapp : "SEM WHATSAPP";
    
    // Mensagem para o seu Bot
    const msg = `💳 *CLICOU EM PAGAR (CARTÃO)*\n👑 Turma: ${nomeTurma}\n📱 Whats: ${zapTurma}\n🔗 _Verifique no painel do Mercado Pago_`;
    
    // Envia a notificação (Usando seus dados do Telegram)
    const TELEGRAM_TOKEN = "8646880823:AAG8F1oClLVjqrH4PggfqYeevpaaq2RxyeI"; 
    const TELEGRAM_CHAT_ID = "6924491541";

    fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: 'Markdown' })
    }).catch(e => console.error("Erro ao notificar Telegram:", e));
};