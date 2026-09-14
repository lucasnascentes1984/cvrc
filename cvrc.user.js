// ==UserScript==
// @name         Envio em Massa - Centro Veterinário Dr. Roger Coura
// @namespace    adapta
// @version      1.0.0
// @description  Envia as 3 mensagens padrão (e o PDF) para vários números pelo WhatsApp Web
// @match        https://web.whatsapp.com/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ============================================================
  // MENSAGENS PADRÃO - edite aqui se quiser mudar o texto
  // ============================================================
  const MENSAGENS = {
    1: `Boa tarde 🐾 Informamos que devido ao alto número de animais, solicitamos que não venham com acompanhantes, somente caso necessário. 
Solicitamos também que tragam os documentos originais, juntamente com a cópia do mesmo. 
Fiquem atentos aos avisos enviados previamente, como orientações!!!
Aguardamos vocês 🐾🐶🐱`,

    2: `Prezado(a) tutor(a), 
Esperamos que este contato o(a) encontre bem. 
Gostaríamos de formalizar uma orientação importante a respeito do procedimento de castração e microchipagem do seu animal de estimação, que será realizado em nossa clínica. Para que possamos ativar com sucesso o microchip que será implantado, é imprescindível realizar o cadastro prévio do tutor no sistema oficial do Governo do Distrito Federal. 
Solicitamos a gentileza de acessar o link abaixo para criar a sua conta e registrar o seu pet antes da data do procedimento:
🔗 https://cria.df.gov.br/Cadastro 
*Não se preocupe com o número do microchip durante o preenchimento; esse dado será inserido no sistema após o animal passar pelo procedimento e ser microchipado em nossa clínica.* 
Ressaltamos que a conclusão desse cadastro inicial é fundamental para a viabilidade da ativação do chip no dia da cirurgia. 
Agradecemos antecipadamente pela sua colaboração e nos colocamos à inteira disposição para esclarecer qualquer dúvida. 
Atenciosamente,
Centro Veterinário Dr. Roger Coura
📲 (61) 99811-9153
📍 QNP 16  conjunto B Lote 10`,

    3: `🐾 *CONFIRMAÇÃO DE CASTRAÇÃO*
Olá! Tudo bem? 😊
*Somos o Centro Veterinário Dr. Roger Coura* e estamos entrando em contato para *confirmar a castração do seu pet para o dia 10/09*.
Para que o procedimento ocorra com segurança e tranquilidade, pedimos atenção às seguintes orientações:
🔹 *Jejum:*
* Jejum alimentar de *8 horas* antes do procedimento;
* Jejum hídrico (água) de *4 horas* antes do procedimento.
🔹 *Guia e focinheira:*
É *obrigatório manter o animal com guia durante todo o atendimento*.
Em caso de animais reativos, agressivos ou que apresentem dificuldade de manejo, é *indispensável o uso de focinheira*, visando a segurança do próprio animal, dos tutores e da equipe.
📄 *Documentos necessários:*
*1. Comprovante de Agendamento:*
Exigido apenas para vagas oriundas do *Agenda-DF*.
*2. Documento Oficial de Identificação:*
Documento com *foto do tutor*.
*3. Comprovante de Residência:*
Comprovante de residência no *Distrito Federal* ou, na sua ausência, *declaração de residência*, nos termos da legislação vigente.
*4. Representação por Terceiros:*
Caso o tutor titular não possa comparecer para entregar ou receber o animal, será obrigatória a apresentação de *Procuração com firma reconhecida em cartório ou assinada eletronicamente pelo portal Gov.br*.
⚠️ *Atenção:* A apresentação da documentação completa e o cumprimento das orientações de jejum são fundamentais para a realização do procedimento.
📎 *Para mais informações e orientações importantes, solicitamos que leia com atenção o documento anexado.*
Contamos com a colaboração de todos para que o atendimento seja realizado da melhor forma possível. 🐶🐱💙
*Nos vemos no dia 10/09!*
Atenciosamente,
*Centro Veterinário Dr. Roger Coura* 🐾`
  };

  // ============================================================
  // NORMALIZAÇÃO DE TELEFONES (qualquer formato)
  // ============================================================
  const DDDS = new Set(["11","12","13","14","15","16","17","18","19","21","22","24","27","28","31","32","33","34","35","37","38","41","42","43","44","45","46","47","48","49","51","53","54","55","61","62","63","64","65","66","67","68","69","71","73","74","75","77","79","81","82","83","84","85","86","87","88","89","91","92","93","94","95","96","97","98","99"]);

  function normalizar(numero, dddPadrao, add9) {
    let d = String(numero == null ? '' : numero).replace(/\D/g, '');
    if (!d) return null;
    if (d.startsWith('55') && (d.length === 12 || d.length === 13)) d = d.slice(2);
    if (d.startsWith('0')) d = d.slice(1);
    if (d.length === 8 || d.length === 9) d = dddPadrao + d;
    if (d.length === 10 && add9) d = d.slice(0, 2) + '9' + d.slice(2);
    if (d.length !== 11 || !DDDS.has(d.slice(0, 2))) return null;
    return '55' + d;
  }

  // ============================================================
  // ESTADO (localStorage) - guarda a lista de envio
  // ============================================================
  const CHAVE = 'wa_envio_';
  function obterEstado() {
    try { return JSON.parse(localStorage.getItem(CHAVE + 'estado')) || {}; }
    catch (e) { return {}; }
  }
  function salvarEstado(p) {
    localStorage.setItem(CHAVE + 'estado', JSON.stringify(Object.assign(obterEstado(), p)));
  }
  function limparEstado() { localStorage.removeItem(CHAVE + 'estado'); }

  function obterLog() {
    try { return JSON.parse(localStorage.getItem(CHAVE + 'log')) || []; }
    catch (e) { return []; }
  }
  function adicionarLog(msg) {
    const log = obterLog();
    log.push(msg);
    if (log.length > 80) log.shift();
    localStorage.setItem(CHAVE + 'log', JSON.stringify(log));
    const el = document.getElementById('wa-log');
    if (el) { el.textContent = log.join('\n'); el.scrollTop = el.scrollHeight; }
  }

  // ============================================================
  // PDF (IndexedDB) - guarda o arquivo da Mensagem 3
  // ============================================================
  function salvarPdf(file) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('wa_envio_db', 1);
      req.onupgradeneeded = () => { req.result.createObjectStore('arquivos', { keyPath: 'id' }); };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('arquivos', 'readwrite');
        tx.objectStore('arquivos').put({ id: 'pdf', nome: file.name, tipo: file.type, blob: file });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  }
  function obterPdf() {
    return new Promise((resolve) => {
      const req = indexedDB.open('wa_envio_db', 1);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('arquivos', 'readonly');
        const get = tx.objectStore('arquivos').get('pdf');
        get.onsuccess = () => resolve(get.result || null);
        get.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  }

  // ============================================================
  // UTILITÁRIOS
  // ============================================================
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function esperarElemento(seletor, timeoutMs) {
    const fim = Date.now() + timeoutMs;
    while (Date.now() < fim) {
      const el = document.querySelector(seletor);
      if (el) return el;
      await sleep(300);
    }
    return null;
  }

  async function esperarCaixa(timeoutMs) {
    const fim = Date.now() + timeoutMs;
    while (Date.now() < fim) {
      const caixa = document.querySelector('div[contenteditable="true"][data-tab="10"]');
      if (caixa) return caixa;
      await sleep(400);
    }
    return null;
  }

  // ============================================================
  // PAINEL FLUTUANTE (a tela do app)
  // ============================================================
  function criarPainel() {
    if (document.getElementById('wa-painel')) return;

    const estilos = document.createElement('style');
    estilos.textContent = `
      #wa-painel { position: fixed; top: 10px; right: 10px; z-index: 999999; width: 330px;
        background: #fff; border: 1px solid #ccc; border-radius: 8px;
        font-family: Arial, sans-serif; font-size: 13px; box-shadow: 0 2px 12px rgba(0,0,0,.35); }
      #wa-cabecalho { background: #25D366; color: #fff; padding: 8px 10px; border-radius: 8px 8px 0 0;
        font-weight: bold; display: flex; justify-content: space-between; align-items: center; }
      #wa-corpo { padding: 10px; }
      #wa-corpo label { display: block; margin: 6px 0 2px; font-weight: bold; }
      #wa-numeros { width: 100%; height: 90px; font-family: Consolas, monospace; font-size: 12px; box-sizing: border-box; }
      #wa-corpo select, #wa-corpo input[type=text] { font-size: 12px; padding: 4px; }
      .wa-btn { border: none; border-radius: 6px; padding: 8px 14px; font-weight: bold; cursor: pointer; font-size: 13px; }
      #wa-enviar { background: #25D366; color: #fff; }
      #wa-parar { background: #e74c3c; color: #fff; }
      #wa-planilha-btn, #wa-pdf-btn { background: #eee; color: #333; }
      #wa-status { padding: 4px 8px; border-radius: 12px; font-weight: bold; display: inline-block; margin-bottom: 6px; }
      .wa-ok { background: #d4edda; color: #155724; }
      .wa-erro { background: #f8d7da; color: #721c24; }
      #wa-log { background: #111; color: #0f0; font-family: Consolas, monospace; font-size: 11px;
        padding: 6px; height: 130px; overflow-y: auto; white-space: pre-wrap; margin-top: 8px; }
    `;
    document.head.appendChild(estilos);

    const painel = document.createElement('div');
    painel.id = 'wa-painel';
    painel.innerHTML = `
      <div id="wa-cabecalho">
        <span>🐾 Envio em Massa</span>
        <button id="wa-recolher" style="background:transparent;border:none;color:#fff;font-size:16px;cursor:pointer;">—</button>
      </div>
      <div id="wa-corpo">
        <div><span id="wa-status" class="wa-erro">Verificando...</span></div>
        <label>Telefones (um por linha) ou planilha:</label>
        <textarea id="wa-numeros" placeholder="(61) 99811-9153&#10;61998119153&#10;61 99811 9153"></textarea>
        <button class="wa-btn" id="wa-planilha-btn">📄 Carregar planilha</button>
        <input type="file" id="wa-planilha" accept=".xlsx,.xls,.csv" style="display:none">
        <label>Mensagem:</label>
        <select id="wa-msg">
          <option value="1">Mensagem 1</option>
          <option value="2">Mensagem 2</option>
          <option value="3">Mensagem 3 (+ PDF)</option>
        </select>
        <div id="wa-pdf-area" style="display:none; margin-top:4px;">
          <button class="wa-btn" id="wa-pdf-btn">📎 Selecionar PDF</button>
          <input type="file" id="wa-pdf" accept=".pdf" style="display:none">
          <span id="wa-pdf-nome" style="font-size:11px;color:#555;"></span>
        </div>
        <div style="margin-top:6px;">
          DDD padrão: <input type="text" id="wa-ddd" value="61" size="3">
          Intervalo (s): <input type="text" id="wa-intervalo" value="10" size="3">
        </div>
        <div style="margin-top:8px;">
          <button class="wa-btn" id="wa-enviar">▶ Enviar</button>
          <button class="wa-btn" id="wa-parar">⏹ Parar</button>
        </div>
        <div id="wa-log"></div>
      </div>
    `;
    document.body.appendChild(painel);

    document.getElementById('wa-recolher').addEventListener('click', () => {
      const corpo = document.getElementById('wa-corpo');
      corpo.style.display = corpo.style.display === 'none' ? 'block' : 'none';
    });
    document.getElementById('wa-enviar').addEventListener('click', aoClicarEnviar);
    document.getElementById('wa-parar').addEventListener('click', () => {
      limparEstado();
      adicionarLog('⏹ Envio interrompido.');
    });
    document.getElementById('wa-msg').addEventListener('change', () => {
      document.getElementById('wa-pdf-area').style.display =
        document.getElementById('wa-msg').value === '3' ? 'block' : 'none';
    });
    document.getElementById('wa-planilha-btn').addEventListener('click', () => {
      document.getElementById('wa-planilha').click();
    });
    document.getElementById('wa-planilha').addEventListener('change', aoCarregarPlanilha);
    document.getElementById('wa-pdf-btn').addEventListener('click', () => {
      document.getElementById('wa-pdf').click();
    });
    document.getElementById('wa-pdf').addEventListener('change', async (e) => {
      const arquivo = e.target.files[0];
      if (!arquivo) return;
      await salvarPdf(arquivo);
      document.getElementById('wa-pdf-nome').textContent = '✅ ' + arquivo.name;
      adicionarLog('📎 PDF salvo: ' + arquivo.name);
    });
  }

  // ============================================================
  // PLANILHA
  // ============================================================
  async function aoCarregarPlanilha(e) {
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    try {
      const dados = await arquivo.arrayBuffer();
      const wb = XLSX.read(dados);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      let coluna = -1;
      if (linhas.length) {
        const cab = linhas[0].map((c) => String(c).toLowerCase());
        for (let i = 0; i < cab.length; i++) {
          if (/telefone|celular|whats|fone|contato/.test(cab[i])) { coluna = i; break; }
        }
        if (coluna === -1) {
          let melhor = 0, melhorQtd = 0;
          for (let c = 0; c < cab.length; c++) {
            let qtd = 0;
            for (let r = 1; r < linhas.length; r++) {
              const v = String(linhas[r][c] || '').replace(/\D/g, '');
              if (v.length >= 8 && v.length <= 13) qtd++;
            }
            if (qtd > melhorQtd) { melhor = c; melhorQtd = qtd; }
          }
          coluna = melhor;
        }
      }
      const nums = [];
      for (let r = 1; r < linhas.length; r++) {
        const v = String(linhas[r][coluna] || '').trim();
        if (v) nums.push(v);
      }
      document.getElementById('wa-numeros').value = nums.join('\n');
      adicionarLog('📄 Planilha carregada: ' + nums.length + ' telefone(s).');
    } catch (erro) {
      adicionarLog('❌ Erro ao ler a planilha: ' + erro.message);
    }
    e.target.value = '';
  }

  // ============================================================
  // ENVIO
  // ============================================================
  function digitarMensagem(caixa, texto) {
    caixa.focus();
    const linhas = texto.split('\n');
    for (let i = 0; i < linhas.length; i++) {
      document.execCommand('insertText', false, linhas[i]);
      if (i < linhas.length - 1) document.execCommand('insertLineBreak');
    }
    caixa.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async function anexarPdf(pdf) {
    const clip = await esperarElemento('span[data-icon="clip"]', 10000);
    if (!clip) return false;
    clip.click();
    await sleep(800);
    const inputs = document.querySelectorAll('input[type="file"]');
    let alvo = null;
    for (const inp of inputs) {
      const acc = (inp.getAttribute('accept') || '').toLowerCase();
      if (acc.includes('pdf') || acc.includes('document') || acc.includes('application')) { alvo = inp; break; }
    }
    if (!alvo && inputs.length) alvo = inputs[inputs.length - 1];
    if (!alvo) return false;
    const dt = new DataTransfer();
    dt.items.add(new File([pdf.blob], pdf.nome, { type: pdf.tipo || 'application/pdf' }));
    alvo.files = dt.files;
    alvo.dispatchEvent(new Event('change', { bubbles: true }));
    const botao = await esperarElemento('span[data-icon="send"]', 15000);
    if (!botao) return false;
    await sleep(1500);
    botao.click();
    return true;
  }

  async function aoClicarEnviar() {
    const numerosBrutos = document.getElementById('wa-numeros').value.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!numerosBrutos.length) { adicionarLog('❌ Cole os números ou carregue a planilha.'); return; }
    const ddd = document.getElementById('wa-ddd').value.trim() || '61';
    const indiceMsg = parseInt(document.getElementById('wa-msg').value, 10);
    const intervalo = parseFloat(document.getElementById('wa-intervalo').value) || 10;

    const invalidos = [];
    const numeros = [];
    for (const n of numerosBrutos) {
      const nn = normalizar(n, ddd, true);
      if (nn) numeros.push(nn);
      else invalidos.push(n);
    }
    if (invalidos.length) adicionarLog('⚠️ ' + invalidos.length + ' número(s) ignorado(s): ' + invalidos.slice(0, 3).join(', ') + (invalidos.length > 3 ? '...' : ''));
    const unicos = [...new Set(numeros)];
    if (unicos.length !== numeros.length) adicionarLog('🔁 ' + (numeros.length - unicos.length) + ' duplicado(s) removido(s).');
    if (!unicos.length) { adicionarLog('❌ Nenhum número válido.'); return; }

    if (indiceMsg === 3) {
      const pdfInput = document.getElementById('wa-pdf');
      if (!pdfInput.files.length) { adicionarLog('❌ Selecione o PDF para a Mensagem 3.'); return; }
      await salvarPdf(pdfInput.files[0]);
    }

    salvarEstado({ ativo: true, numeros: unicos, indice: 0, msg: indiceMsg, intervalo });
    adicionarLog('▶ Iniciando envio da Mensagem ' + indiceMsg + ' para ' + unicos.length + ' número(s)...');
    location.href = 'https://web.whatsapp.com/send?phone=' + unicos[0];
  }

  async function continuarEnvio() {
    const estado = obterEstado();
    if (!estado.ativo) return;
    if (!/\/send\?phone=/.test(location.href)) return;

    const numeros = estado.numeros || [];
    const i = estado.indice || 0;
    const indiceMsg = estado.msg || 1;
    const intervalo = (estado.intervalo || 10) * 1000;
    const pdf = indiceMsg === 3 ? await obterPdf() : null;

    if (i >= numeros.length) {
      limparEstado();
      adicionarLog('🏁 Envio concluído!');
      return;
    }

    const numero = numeros[i];
    adicionarLog('[' + (i + 1) + '/' + numeros.length + '] Enviando para ' + numero + '...');

    const caixa = await esperarCaixa(20000);
    if (!caixa) {
      adicionarLog('❌ ' + numero + ': não encontrado no WhatsApp (pulando).');
    } else {
      digitarMensagem(caixa, MENSAGENS[indiceMsg]);
      await sleep(500);
      const botao = document.querySelector('span[data-icon="send"]');
      if (botao) botao.click();
      else caixa.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      adicionarLog('✅ Mensagem enviada!');
      if (indiceMsg === 3 && pdf) {
        await sleep(2500);
        const okPdf = await anexarPdf(pdf);
        adicionarLog(okPdf ? '📎 PDF enviado!' : '❌ Falha ao anexar o PDF.');
      }
    }

    await sleep(2000);
    if (i + 1 < numeros.length) {
      salvarEstado({ indice: i + 1 });
      adicionarLog('⏳ Aguardando ' + Math.round(intervalo / 1000) + 's...');
      await sleep(intervalo);
      location.href = 'https://web.whatsapp.com/send?phone=' + numeros[i + 1];
    } else {
      limparEstado();
      adicionarLog('🏁 Envio concluído!');
    }
  }

  // ============================================================
  // INÍCIO
  // ============================================================
  function iniciar() {
    criarPainel();
    const log = obterLog();
    const el = document.getElementById('wa-log');
    if (el) { el.textContent = log.join('\n'); el.scrollTop = el.scrollHeight; }
    const status = document.getElementById('wa-status');
    if (document.querySelector('#side')) {
      status.textContent = '✅ Conectado';
      status.className = 'wa-ok';
    } else {
      status.textContent = '❌ Não conectado (escaneie o QR Code)';
      status.className = 'wa-erro';
    }
    continuarEnvio();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
