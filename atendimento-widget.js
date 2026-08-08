/* atendimento-widget.js — bolha de chat da atendente virtual.
   Auto-contido: injeta CSS + HTML, pega a cor da loja do :root (--ac) e conversa
   com /api/atendimento. Basta 1 linha no final do body:
     <script src="/atendimento-widget.js" defer></script>

   Detalhes que fazem parecer gente: delay de "digitando" proporcional ao tamanho
   da resposta, e resposta longa quebrada em 2 balões. */
(function () {
  if (window.__atdOn) return; window.__atdOn = true;

  var css = document.createElement('style');
  css.textContent = [
    '.atd-btn{position:fixed;right:14px;bottom:86px;z-index:58;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;',
    'background:var(--ac,#e26c8e);color:#fff;box-shadow:0 8px 24px -6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;',
    'transition:transform .2s cubic-bezier(.2,.8,.3,1)}',
    '.atd-btn:hover{transform:scale(1.07)}.atd-btn svg{width:27px;height:27px;fill:#fff}',
    '.atd-dot{position:absolute;top:1px;right:1px;width:14px;height:14px;border-radius:50%;background:#22c55e;border:2.5px solid #fff}',
    '.atd-box{position:fixed;right:14px;bottom:86px;z-index:59;width:340px;max-width:calc(100vw - 28px);height:472px;max-height:calc(100vh - 130px);',
    'background:#fff;border-radius:16px;box-shadow:0 20px 60px -12px rgba(0,0,0,.45);display:none;flex-direction:column;overflow:hidden;',
    'font-family:system-ui,-apple-system,"Segoe UI",sans-serif}',
    '.atd-box.on{display:flex;animation:atd-up .28s cubic-bezier(.16,1,.3,1)}',
    '@keyframes atd-up{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:none}}',
    '.atd-hd{background:var(--ac,#e26c8e);color:#fff;padding:13px 15px;display:flex;align-items:center;gap:10px;flex-shrink:0}',
    '.atd-av{width:37px;height:37px;border-radius:50%;background:rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px}',
    '.atd-hd b{font-size:14px;display:block;line-height:1.25}.atd-hd small{font-size:11px;opacity:.9;display:flex;align-items:center;gap:4px}',
    '.atd-on{width:7px;height:7px;border-radius:50%;background:#4ade80;display:inline-block}',
    '.atd-x{margin-left:auto;background:none;border:none;color:#fff;font-size:23px;cursor:pointer;line-height:1;opacity:.85;padding:0 2px}',
    '.atd-msgs{flex:1;overflow-y:auto;padding:14px;background:#f4f6f8;display:flex;flex-direction:column;gap:8px}',
    '.atd-m{max-width:82%;padding:9px 12px;border-radius:14px;font-size:13.5px;line-height:1.45;word-wrap:break-word;white-space:pre-wrap;animation:atd-in .2s ease}',
    '@keyframes atd-in{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}',
    '.atd-m.bot{background:#fff;color:#1e293b;align-self:flex-start;border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,.09)}',
    '.atd-m.me{background:var(--ac,#e26c8e);color:#fff;align-self:flex-end;border-bottom-right-radius:4px}',
    '.atd-typ{background:#fff;align-self:flex-start;padding:11px 14px;border-radius:14px;border-bottom-left-radius:4px;display:flex;gap:4px;box-shadow:0 1px 2px rgba(0,0,0,.09)}',
    '.atd-typ i{width:6px;height:6px;border-radius:50%;background:#94a3b8;animation:atd-bl 1.3s infinite}',
    '.atd-typ i:nth-child(2){animation-delay:.18s}.atd-typ i:nth-child(3){animation-delay:.36s}',
    '@keyframes atd-bl{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}',
    '.atd-ft{padding:9px;background:#fff;border-top:1px solid #e8edf2;display:flex;gap:7px;flex-shrink:0}',
    '.atd-in{flex:1;border:1px solid #dde4ea;border-radius:100px;padding:10px 14px;font-size:13.5px;outline:none;font-family:inherit;min-width:0}',
    '.atd-in:focus{border-color:var(--ac,#e26c8e)}',
    '.atd-snd{background:var(--ac,#e26c8e);border:none;border-radius:50%;width:38px;height:38px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center}',
    '.atd-snd svg{width:17px;height:17px;fill:#fff}.atd-snd:disabled{opacity:.45}',
    '@media(max-width:420px){.atd-box{right:8px;left:8px;width:auto;bottom:80px}.atd-btn{right:10px;bottom:80px}}',
  ].join('');
  document.head.appendChild(css);

  var NOME = window.ATD_NOME || 'Bia';
  var OI   = window.ATD_SAUDACAO || ('Oi! Sou a ' + NOME + ' 😊 Posso te ajudar com alguma dúvida ou com o seu pedido?');

  var wrap = document.createElement('div');
  wrap.innerHTML =
    '<button class="atd-btn" id="atdBtn" aria-label="Falar com atendimento">' +
      '<svg viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>' +
      '<span class="atd-dot"></span></button>' +
    '<div class="atd-box" id="atdBox">' +
      '<div class="atd-hd"><div class="atd-av">' + NOME.charAt(0).toUpperCase() + '</div>' +
        '<div><b>' + NOME + '</b><small><span class="atd-on"></span>online agora</small></div>' +
        '<button class="atd-x" id="atdX" aria-label="Fechar">&times;</button></div>' +
      '<div class="atd-msgs" id="atdMsgs"></div>' +
      '<div class="atd-ft"><input class="atd-in" id="atdIn" placeholder="Escreva sua mensagem..." autocomplete="off">' +
        '<button class="atd-snd" id="atdSnd" aria-label="Enviar"><svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg></button></div>' +
    '</div>';
  document.body.appendChild(wrap);

  var btn = document.getElementById('atdBtn'), box = document.getElementById('atdBox'),
      msgs = document.getElementById('atdMsgs'), inp = document.getElementById('atdIn'),
      snd = document.getElementById('atdSnd'), fechar = document.getElementById('atdX');

  var hist = [];
  try { hist = JSON.parse(sessionStorage.getItem('atd_hist') || '[]'); } catch (e) { hist = []; }
  var sessao = sessionStorage.getItem('atd_sid');
  if (!sessao) { sessao = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('atd_sid', sessao); }

  // Transforma URL / caminho interno em link clicável. Monta por DOM (nunca innerHTML
  // com texto do modelo) — sem isso o link do checkout e do WhatsApp chegavam como
  // texto morto e a pessoa não conseguia clicar.
  var RE_LINK = /(https?:\/\/[^\s<>"')]+|\/(?:checkout|rastreio|oferta)\.html[^\s<>"')]*)/g;
  function comLinks(el, txt) {
    var ultimo = 0, m;
    RE_LINK.lastIndex = 0;
    while ((m = RE_LINK.exec(txt)) !== null) {
      if (m.index > ultimo) el.appendChild(document.createTextNode(txt.slice(ultimo, m.index)));
      var url = m[0].replace(/[.,;:!?]+$/, '');       // não engole a pontuação da frase
      var a = document.createElement('a');
      a.href = url;
      a.textContent = url.indexOf('wa.me') > -1 ? 'falar no WhatsApp'
                    : url.indexOf('checkout') > -1 ? 'ir para o checkout'
                    : url.indexOf('rastreio') > -1 ? 'acompanhar meu pedido' : url;
      a.style.cssText = 'color:inherit;font-weight:800;text-decoration:underline';
      if (/^https?:/.test(url)) { a.target = '_blank'; a.rel = 'noopener'; }
      el.appendChild(a);
      ultimo = m.index + m[0].length - (m[0].length - url.length);
    }
    if (ultimo < txt.length) el.appendChild(document.createTextNode(txt.slice(ultimo)));
  }

  function balao(txt, quem) {
    var d = document.createElement('div');
    d.className = 'atd-m ' + quem;
    if (quem === 'bot') comLinks(d, txt); else d.textContent = txt;
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight;
  }
  function digitando(on) {
    var t = document.getElementById('atdTyp');
    if (on && !t) {
      t = document.createElement('div'); t.className = 'atd-typ'; t.id = 'atdTyp';
      t.innerHTML = '<i></i><i></i><i></i>'; msgs.appendChild(t); msgs.scrollTop = msgs.scrollHeight;
    } else if (!on && t) t.remove();
  }
  function salvar() { try { sessionStorage.setItem('atd_hist', JSON.stringify(hist.slice(-14))); } catch (e) {} }

  // Resposta longa vira 2 balões, com pausa — é como gente manda no zap.
  function responder(txt) {
    var partes = [txt];
    if (txt.length > 130) {
      var corte = txt.lastIndexOf('. ', Math.floor(txt.length * 0.6));
      if (corte > 40) partes = [txt.slice(0, corte + 1).trim(), txt.slice(corte + 1).trim()];
    }
    var i = 0;
    (function proximo() {
      if (i >= partes.length) { inp.disabled = snd.disabled = false; inp.focus(); return; }
      var p = partes[i++];
      digitando(true);
      setTimeout(function () { digitando(false); balao(p, 'bot'); setTimeout(proximo, 260); },
        Math.min(1900, 420 + p.length * 22));
    })();
  }

  // O que a pessoa está vendo agora — deixa a Bia específica em vez de genérica.
  function contexto() {
    var c = { pagina: location.pathname.indexOf('checkout') > -1 ? 'checkout' : 'landing' };
    try {
      if (typeof selIdx !== 'undefined' && typeof KITS !== 'undefined' && KITS[selIdx]) {
        c.kit_selecionado = KITS[selIdx].n || ('kit ' + selIdx);
        c.link_checkout = 'checkout.html?k=' + selIdx;
      }
    } catch (e) {}
    return c;
  }

  async function enviar() {
    var txt = inp.value.trim(); if (!txt) return;
    inp.value = ''; balao(txt, 'me');
    hist.push({ role: 'user', content: txt }); salvar();
    inp.disabled = snd.disabled = true; digitando(true);
    try {
      var r = await fetch('/api/atendimento', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessao: sessao, messages: hist.slice(-14), contexto: contexto() }),
      });
      var d = await r.json();
      digitando(false);
      var reply = (d && d.reply) || 'Opa, pode repetir? 😅';
      hist.push({ role: 'assistant', content: reply }); salvar();
      responder(reply);
    } catch (e) {
      digitando(false); balao('Opa, caiu minha conexão 😅 tenta de novo?', 'bot');
      inp.disabled = snd.disabled = false;
    }
  }

  btn.onclick = function () {
    box.classList.add('on'); btn.style.display = 'none';
    if (!msgs.children.length) {
      if (hist.length) hist.forEach(function (m) { balao(m.content, m.role === 'user' ? 'me' : 'bot'); });
      else { balao(OI, 'bot'); hist.push({ role: 'assistant', content: OI }); salvar(); }
    }
    setTimeout(function () { inp.focus(); }, 180);
  };
  fechar.onclick = function () { box.classList.remove('on'); btn.style.display = 'flex'; abriuTeaser(); };
  snd.onclick = enviar;
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); enviar(); } });

  // ── Teaser proativo ───────────────────────────────────────────────────────
  // Quase ninguém clica na bolha sozinho. Um balãozinho puxando conversa multiplica
  // a taxa de chat iniciado — que é o funil inteiro da atendente. Uma vez por sessão.
  function abriuTeaser() { try { sessionStorage.setItem('atd_teaser', '1'); } catch (e) {} }
  function jaViu() { try { return sessionStorage.getItem('atd_teaser') === '1'; } catch (e) { return true; } }

  function teaser() {
    if (jaViu() || box.classList.contains('on')) return;
    abriuTeaser();
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;right:78px;bottom:96px;z-index:57;max-width:210px;background:#fff;color:#1e293b;' +
      'padding:11px 13px;border-radius:14px;border-bottom-right-radius:4px;font:500 13px/1.4 system-ui,-apple-system,sans-serif;' +
      'box-shadow:0 10px 30px -8px rgba(0,0,0,.35);cursor:pointer;animation:atd-up .3s cubic-bezier(.16,1,.3,1)';
    t.textContent = window.ATD_TEASER || ('Oi! Alguma dúvida sobre o ' + (window.ATD_PRODUTO || 'produto') + '? Me chama 😊');
    t.onclick = function () { t.remove(); btn.click(); };
    document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.style.opacity = '0'; }, 12000);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 12600);
  }

  setTimeout(teaser, 22000);                                   // ficou um tempo lendo
  document.addEventListener('mouseout', function (e) {          // desktop: indo embora
    if (!e.relatedTarget && e.clientY < 12) teaser();
  });
})();
