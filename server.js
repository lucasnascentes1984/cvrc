// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const QRCode = require("qrcode");

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.static("public"));

const server = http.createServer(app);
const io = new Server(server);
const PORTA = process.env.PORT || 3000;

// ============================================================
// MENSAGENS PADRAO - edite aqui quando quiser mudar o texto
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
const NOME_ARQUIVO_3 = "ORIENTACOES_CASTRACAO_RC.pdf";

// ============================================================
// Normalizacao de telefones (qualquer formato)
// ============================================================
const DDDS = new Set(["11","12","13","14","15","16","17","18","19","21","22","24","27","28","31","32","33","34","35","37","38","41","42","43","44","45","46","47","48","49","51","53","54","55","61","62","63","64","65","66","67","68","69","71","73","74","75","77","79","81","82","83","84","85","86","87","88","89","91","92","93","94","95","96","97","98","99"]);

function normalizar(numero, dddPadrao = "61", add9 = true) {
  let d = String(numero == null ? "" : numero).replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  if (d.length === 8 || d.length === 9) d = dddPadrao + d;
  if (d.length === 10 && add9) d = d.slice(0, 2) + "9" + d.slice(2);
  if (d.length !== 11 || !DDDS.has(d.slice(0, 2))) return null;
  return "55" + d;
}

// ============================================================
// WhatsApp (o robo)
// ============================================================
let client = null;
let qrAtual = null;
let conectado = false;
let anexoBase64 = null;

async function criarClient() {
  client = new Client({
    authStrategy: new LocalAuth({ dataPath: "./sessao" }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    },
  });

  client.on("qr", async (qr) => {
    qrAtual = qr;
    const dataUrl = await QRCode.toDataURL(qr);
    io.emit("qr", dataUrl);
  });

  client.on("ready", () => {
    conectado = true;
    qrAtual = null;
    io.emit("status", "conectado");
  });

  client.on("disconnected", (motivo) => {
    conectado = false;
    io.emit("status", "desconectado: " + motivo);
  });

  try {
    await client.initialize();
  } catch (e) {
    console.error("Falha ao iniciar o WhatsApp:", e.message);
  }
}

function aguardar(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function enviarTodos(socket, numeros, indiceMsg, dddPadrao, intervalo) {
  const msg = MENSAGENS[indiceMsg];
  const comAnexo = indiceMsg === 3;

  const invalidos = [];
  const lista = [];
  for (const n of numeros) {
    const nn = normalizar(n, dddPadrao);
    if (nn) lista.push(nn);
    else invalidos.push(String(n).trim());
  }
  if (invalidos.length) {
    socket.emit("log", `⚠️ ${invalidos.length} numero(s) ignorado(s) (sem DDD valido): ${invalidos.slice(0, 5).join(", ")}${invalidos.length > 5 ? "..." : ""}`);
  }
  const unicos = [...new Set(lista)];
  if (lista.length !== unicos.length) {
    socket.emit("log", `🔁 ${lista.length - unicos.length} duplicado(s) removido(s).`);
  }
  if (!unicos.length) {
    socket.emit("log", "Nenhum numero valido para enviar.");
    return;
  }

  socket.emit("log", `📋 ${unicos.length} numero(s) valido(s). Enviando Mensagem ${indiceMsg}...`);

  for (let i = 0; i < unicos.length; i++) {
    const numero = unicos[i];
    socket.emit("log", `[${i + 1}/${unicos.length}] Enviando para ${numero}...`);
    try {
      await client.sendMessage(`${numero}@c.us`, msg);
      if (comAnexo && anexoBase64) {
        const media = new MessageMedia(anexoBase64.mime, anexoBase64.data, anexoBase64.nome);
        await client.sendMessage(`${numero}@c.us`, media);
        socket.emit("log", "📎 PDF enviado junto.");
      }
      socket.emit("log", "✅ Enviado!");
    } catch (e) {
      socket.emit("log", `❌ Falha ao enviar para ${numero}: ${e.message}`);
    }
    if (i < unicos.length - 1) await aguardar((intervalo || 10) * 1000);
  }
  socket.emit("log", "🏁 Lote concluido!");
}

// ============================================================
// Rotas da API
// ============================================================
app.get("/api/status", (req, res) => res.json({ conectado, possuiQr: !!qrAtual }));

app.post("/api/anexo", (req, res) => {
  const { base64, nome, tipo } = req.body || {};
  if (!base64) return res.status(400).json({ erro: "Nenhum arquivo recebido." });
  anexoBase64 = {
    data: String(base64).split(",")[1] || base64,
    nome: nome || NOME_ARQUIVO_3,
    mime: tipo || "application/pdf",
  };
  res.json({ ok: true });
});

app.post("/api/enviar", (req, res) => {
  const { numeros, mensagem, dddPadrao, intervalo } = req.body || {};
  if (!Array.isArray(numeros) || !numeros.length) {
    return res.status(400).json({ erro: "Nenhum numero recebido." });
  }
  const indice = Number(mensagem);
  if (!MENSAGENS[indice]) return res.status(400).json({ erro: "Mensagem invalida." });
  if (!conectado) return res.status(400).json({ erro: "WhatsApp nao conectado. Escaneie o QR Code." });
  res.json({ ok: true });
  io.emit("log", `▶ Iniciando envio da Mensagem ${indice} para ${numeros.length} numero(s)...`);
  void enviarTodos(io, numeros, indice, dddPadrao || "61", Number(intervalo) || 10);
});

io.on("connection", (socket) => {
  socket.emit("estado", { conectado, qr: qrAtual });
});

server.listen(PORTA, () => {
  console.log(`Rodando na porta ${PORTA}`);
  criarClient();
});
