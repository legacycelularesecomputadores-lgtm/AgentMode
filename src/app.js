// app.js — Agente Dev (Versão Netlify)
// Backend Python → Netlify Edge Functions + Virtual Filesystem

const API = "";  // URLs relativas — funciona em qualquer domínio

// ── PROVEDORES (apenas nuvem disponível no Netlify) ──────────────────────────
const PROVEDORES = {
  local: [
    { value: "ollama",   label: "Ollama (local)" },
    { value: "lmstudio", label: "LM Studio (local)" },
  ],
  nuvem: [
    { value: "groq",       label: "🔑 Groq (com API Key)" },
    { value: "gemini",     label: "🔑 Gemini (com API Key)" },
    { value: "openrouter", label: "🔑 OpenRouter (grátis + pago)" },
    { value: "scitely",    label: "🆓 Scitely (grátis ilimitado)" },
    { value: "llmapi",     label: "🆓 LLM API (200+ modelos grátis)" },
    { value: "puter",      label: "🆓 Puter AI (sem key, user-pays)" },
    { value: "custom",     label: "Custom API" },
  ],
};

// ── MODELOS ───────────────────────────────────────────────────────────────────
const MODELOS_FRONTEND = {
  ollama:   ["llama3.2:3b","llama3.1:8b","mistral:7b","neural-chat:7b"],
  lmstudio: ["local-model"],
  groq: [
    "llama-3.3-70b-versatile","llama-3.1-70b-versatile",
    "mixtral-8x7b-32768","gemma2-9b-it","llama-3.1-8b-instant",
    "deepseek-r1-distill-llama-70b",
  ],
  gemini: [
    "gemini-2.0-flash","gemini-2.0-flash-lite","gemini-1.5-pro","gemini-1.5-flash",
  ],
  openrouter: [
    "openrouter/free","openrouter/optimus-alpha","openrouter/quasar-alpha",
    "deepseek/deepseek-r1:free","deepseek/deepseek-chat-v3-0324:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "openai/gpt-oss-120b:free",
    "qwen/qwen3-235b-a22b:free","qwen/qwq-32b:free","qwen/qwen2.5-coder-32b-instruct:free",
    "mistralai/mistral-small-3.1-24b-instruct:free","mistralai/mistral-7b-instruct:free",
    "anthropic/claude-3.5-sonnet","openai/gpt-4o","openai/gpt-4o-mini",
    "google/gemini-2.0-flash-001","mistralai/mistral-large",
  ],
  scitely: [
    "deepseek-chat","deepseek-reasoner","qwen-plus","qwen-max",
    "kimi-latest","glm-4-flash","llama-3.3-70b","mixtral-8x7b",
  ],
  llmapi: [
    "gpt-4o-mini","gpt-4o","gpt-4.1-nano","gpt-4.1-mini","gpt-4.1",
    "gpt-5-nano","gpt-5-mini","gpt-5","o3-mini","o3",
    "claude-3-haiku-20240307","claude-3-5-sonnet-20241022","claude-3-7-sonnet-20250219",
    "gemini-2.0-flash","gemini-2.5-flash","qwen-max","qwen-plus","grok-3","grok-3-mini",
  ],
  puter: [
    "gpt-5-nano","gpt-5-mini","gpt-5","gpt-4.1-nano","gpt-4o","gpt-4o-mini",
    "claude-sonnet-4-5","claude-haiku-4-5",
    "google/gemini-2.5-flash","google/gemini-2.0-flash",
    "meta-llama/llama-3.3-70b-instruct",
    "deepseek/deepseek-chat-v3-0324","deepseek/deepseek-r1",
    "mistralai/mistral-large-2512","grok-4-1-fast","grok-3","z-ai/glm-5",
  ],
  custom: ["gpt-4o","gpt-4o-mini","claude-3-5-sonnet-20241022"],
};

const PRECISA_API_KEY   = new Set(["openrouter","custom","groq","gemini","scitely","llmapi","puter"]);
const PRECISA_URL       = new Set(["custom"]);
const GRATIS_AUTOMATICO = new Set(["ollama","lmstudio"]);

const LABELS_KEY = {
  groq:       "Groq API Key",
  gemini:     "Gemini API Key",
  openrouter: "OpenRouter API Key",
  scitely:    "Scitely API Key — platform.scitely.com (grátis)",
  llmapi:     "LLM API Key — app.llmapi.ai (grátis)",
  puter:      "Puter Auth Token — puter.com/dashboard (grátis, user-pays)",
  custom:     "API Key",
};

const LS_PREFIX = "agente_dev_";
function lsSet(k, v) { try { localStorage.setItem(LS_PREFIX + k, v); } catch(_) {} }
function lsGet(k)    { try { return localStorage.getItem(LS_PREFIX + k) || ""; } catch(_) { return ""; } }

// ── Estado ────────────────────────────────────────────────────────────────────
let tipoAtual      = "nuvem";      // Netlify: nuvem por padrão
let provedorAtual  = "groq";
let modeloAtual    = "";
let gerando        = false;
let modoAgente     = "agente";
let apiKeyAtual    = "";
let _abortController = null;       // Para parar geração

// ── Virtual Filesystem ────────────────────────────────────────────────────────
let _virtualFS     = {};           // { [caminho]: conteudo }
let _projetoNome   = "Meu Projeto";

// ── LLM Histórico (enviado com cada request) ──────────────────────────────────
let _llmHistorico  = [];           // [{role, content}] últimas N msgs

// ── DOM refs ──────────────────────────────────────────────────────────────────
const btnLocal        = document.getElementById("btnLocal");
const btnNuvem        = document.getElementById("btnNuvem");
const selProvedor     = document.getElementById("selProvedor");
const selModelo       = document.getElementById("selModelo");
const chatInner       = document.getElementById("chatInner");
const inputMsg        = document.getElementById("inputMsg");
const btnEnviar       = document.getElementById("btnEnviar");
const btnParar        = document.getElementById("btnParar");
const credsBar        = document.getElementById("credsBar");
const credsKey        = document.getElementById("credsKey");
const credsUrl        = document.getElementById("credsUrl");
const credsKeyLabel   = document.getElementById("credsKeyLabel");
const inputApiKey     = document.getElementById("inputApiKey");
const inputApiUrl     = document.getElementById("inputApiUrl");
const btnMostrarKey   = document.getElementById("btnMostrarKey");
const btnSalvarLogin  = document.getElementById("btnSalvarLogin");
const statusDot       = document.getElementById("statusDot");
const statusTxt       = document.getElementById("statusTxt");

// ── STATUS API NO HEADER ──────────────────────────────────────────────────────
let statusAPIElement = null;

function criarStatusAPI() {
  const container = document.createElement("div");
  container.id = "status-api-container";
  container.style.cssText = `
    display: flex; align-items: center; gap: 12px; padding: 0 12px;
    border-left: 1px solid var(--border); margin-left: auto;
    font-size: 11px; color: var(--text2); font-family: var(--font-mono);
  `;
  const nomeAPI = document.createElement("div");
  nomeAPI.id = "status-api-nome";
  nomeAPI.textContent = "nuvem";
  const indicador = document.createElement("div");
  indicador.id = "status-api-indicador";
  indicador.style.cssText = "display: none; align-items: center; gap: 6px; font-size: 9px;";
  indicador.innerHTML = `<span id="api-status">automático</span>`;
  container.appendChild(nomeAPI);
  container.appendChild(indicador);
  return container;
}

function atualizarStatusAPI() {
  if (!statusAPIElement) return;
  const nomeEl     = statusAPIElement.querySelector("#status-api-nome");
  const indicadorEl = statusAPIElement.querySelector("#status-api-indicador");
  const statusEl   = indicadorEl.querySelector("#api-status");
  nomeEl.textContent = provedorAtual.toUpperCase();
  if (GRATIS_AUTOMATICO.has(provedorAtual)) {
    indicadorEl.style.display = "flex";
    statusEl.textContent = "⚠ local indisponível no Netlify";
    statusEl.style.color = "var(--red)";
  } else if (PRECISA_API_KEY.has(provedorAtual)) {
    indicadorEl.style.display = "flex";
    statusEl.textContent = lsGet(`key_${provedorAtual}`) ? "⚙️ key salva" : "⚠ sem key";
    statusEl.style.color = lsGet(`key_${provedorAtual}`) ? "var(--text2)" : "var(--orange)";
  } else {
    indicadorEl.style.display = "none";
  }
}

function setTipo(tipo) {
  tipoAtual = tipo;
  btnLocal.classList.toggle("active", tipo === "local");
  btnNuvem.classList.toggle("active", tipo === "nuvem");
  const opts = PROVEDORES[tipo];
  selProvedor.innerHTML = opts.map(o => `<option value="${o.value}">${o.label}</option>`).join("");
  provedorAtual = opts[0].value;
  selProvedor.value = provedorAtual;
  onProvedorMudou();
}

btnLocal.addEventListener("click", () => {
  setTipo("local");
  addAviso("⚠ Provedores locais (Ollama/LM Studio) não funcionam no Netlify — requerem backend Python local. Use provedores de nuvem.");
});
btnNuvem.addEventListener("click", () => setTipo("nuvem"));
selProvedor.addEventListener("change", () => {
  provedorAtual = selProvedor.value;
  onProvedorMudou();
});

function onProvedorMudou() {
  mostrarCredsBar(provedorAtual);
  carregarModelos(provedorAtual);
  atualizarStatusAPI();
}

// ── MOSTRAR/ESCONDER CAMPO DE API KEY ─────────────────────────────────────────
function mostrarCredsBar(prov) {
  if (GRATIS_AUTOMATICO.has(prov)) {
    credsBar.style.display = "none";
    return;
  }
  const precKey = PRECISA_API_KEY.has(prov);
  const precUrl = PRECISA_URL.has(prov);
  credsBar.style.display = (precKey || precUrl) ? "block" : "none";
  credsKey.style.display = precKey ? "flex" : "none";
  credsUrl.style.display = precUrl ? "flex" : "none";
  const credsKeyNameEl = document.getElementById("credsKeyName");
  if (credsKeyNameEl) credsKeyNameEl.style.display = precKey ? "flex" : "none";
  if (precKey) {
    credsKeyLabel.textContent = LABELS_KEY[prov] || "API Key";
    inputApiKey.value = "";
    inputApiKey.type = "password";
    const savedKey = lsGet(`key_${prov}`);
    inputApiKey.placeholder = savedKey ? "••• salva ✓" : "cole aqui";
  }
  if (precUrl) {
    inputApiUrl.value = lsGet(`url_${prov}`) || "";
  }
  renderChavesSalvas(prov);
}

btnMostrarKey?.addEventListener("click", () => {
  const v = inputApiKey.type === "text";
  inputApiKey.type = v ? "password" : "text";
});

btnSalvarLogin?.addEventListener("click", () => {
  const key  = inputApiKey.value.trim();
  const url  = inputApiUrl.value.trim();
  const nome = document.getElementById("inputKeyName")?.value.trim() || "";

  if (PRECISA_API_KEY.has(provedorAtual) && !key) {
    addAviso("⚠ Cole a API Key antes de salvar.");
    return;
  }

  if (key && nome) {
    salvarChaveNomeada(provedorAtual, nome, key, url);
    addAviso(`✓ Chave "${nome}" salva`);
  } else {
    if (key) lsSet(`key_${provedorAtual}`, key);
    if (url) lsSet(`url_${provedorAtual}`, url);
    addAviso("✓ Salvo");
  }
  if (document.getElementById("inputKeyName")) document.getElementById("inputKeyName").value = "";
  atualizarStatusAPI();
  renderChavesSalvas(provedorAtual);
});

// ── CARREGAR MODELOS (apenas frontend — sem backend local) ────────────────────
async function carregarModelos(prov) {
  selModelo.innerHTML = "";

  if (GRATIS_AUTOMATICO.has(prov)) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "⚠ Local indisponível no Netlify";
    opt.disabled = true;
    selModelo.appendChild(opt);
    modeloAtual = "";
    return;
  }

  const modelos = MODELOS_FRONTEND[prov] || [];
  modelos.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    selModelo.appendChild(opt);
  });
  modeloAtual = selModelo.value || modelos[0] || "";
  selModelo.value = modeloAtual;
}

selModelo.addEventListener("change", () => { modeloAtual = selModelo.value; });


// ── RACIOCÍNIO COLAPSÁVEL ─────────────────────────────────────────────────────
let _thinkBlock = null;
let _thinkContentEl = null;
let _thinkStatusEl  = null;

function _resetThink() { _thinkBlock = null; _thinkContentEl = null; _thinkStatusEl = null; }

function _getOrCreateThinkBlock(agRow, agBubble) {
  if (_thinkBlock) return;
  const uid = "ts" + Date.now();
  const block = document.createElement("div");
  block.className = "agent-section thinking collapsed";
  block.innerHTML = `
    <div class="agent-section-header" onclick="this.parentElement.classList.toggle('collapsed')">
      <div class="agent-section-toggle">▶</div>
      <div class="agent-section-title">raciocínio</div>
      <div class="agent-section-status" id="${uid}">•••</div>
    </div>
    <div class="agent-section-content">
      <div class="agent-section-text"></div>
    </div>`;
  agRow.insertBefore(block, agBubble);
  _thinkBlock    = block;
  _thinkContentEl = block.querySelector(".agent-section-text");
  _thinkStatusEl  = document.getElementById(uid);
}

function _appendThinkText(text, agRow, agBubble) {
  _getOrCreateThinkBlock(agRow, agBubble);
  _thinkContentEl.textContent += text;
  scrollToBottom();
}

function _finalizeThinkBlock() {
  if (!_thinkBlock) return;
  if (_thinkStatusEl) _thinkStatusEl.textContent = "ver";
  _thinkBlock.classList.add("collapsed");
}

function _criarBotaoCopiar(getBubble) {
  const btn = document.createElement("button");
  btn.className = "copy-btn";
  btn.title = "Copiar mensagem";
  btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;
  btn.addEventListener("click", () => {
    const bubble = getBubble();
    const txt = bubble ? (bubble.textContent || bubble.innerText || "") : "";
    navigator.clipboard.writeText(txt).then(() => {
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
      btn.classList.add("copied");
      setTimeout(() => {
        btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;
        btn.classList.remove("copied");
      }, 1800);
    }).catch(() => {});
  });
  return btn;
}

function addMensagem(quem, texto) {
  const row = document.createElement("div");
  row.className = `msg-row ${quem}`;
  const label = document.createElement("div");
  label.className = "msg-label";
  label.textContent = quem === "user" ? "você" : "agente";
  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.textContent = texto;
  bubble.style.whiteSpace = "pre-wrap";
  bubble.style.wordWrap = "break-word";
  const copyBtn = _criarBotaoCopiar(() => bubble);
  row.appendChild(label);
  row.appendChild(bubble);
  row.appendChild(copyBtn);
  chatInner.appendChild(row);
  scrollToBottom();
}

function addAviso(texto) {
  const el = document.createElement("div");
  el.className = "inline-aviso";
  el.textContent = texto;
  chatInner.appendChild(el);
  scrollToBottom();
}

function scrollToBottom() {
  const chatArea = document.getElementById("chatArea");
  setTimeout(() => { chatArea.scrollTop = chatArea.scrollHeight; }, 0);
}

function setStatus(fase, texto) {
  statusDot.className = "status-dot " + (fase || "");
  statusTxt.textContent = texto || fase || "pronto";
}

// ── ENVIAR MENSAGEM ───────────────────────────────────────────────────────────
async function enviarMensagem(texto) {
  const welcome = chatInner.querySelector(".welcome-msg");
  if (welcome) welcome.remove();

  if (!modeloAtual) { addAviso("⚠ Selecione um modelo antes de enviar"); return; }

  if (GRATIS_AUTOMATICO.has(provedorAtual)) {
    addAviso("⚠ Provedores locais (Ollama/LM Studio) não estão disponíveis no Netlify. Selecione um provedor de nuvem.");
    return;
  }

  addMensagem("user", texto);
  _registrarMensagem("user", texto);
  inputMsg.value = "";
  inputMsg.style.height = "auto";
  gerando = true;
  _resetThink();
  btnEnviar.disabled = true;
  btnParar.disabled  = false;
  setStatus("pensando", "pensando…");
  mostrarSpinner();

  // Credenciais do provedor atual
  const credenciais = _getCreds();

  // Criar AbortController para poder parar
  _abortController = new AbortController();

  // Adicionar ao histórico LLM
  _llmHistorico.push({ role: "user", content: texto });
  if (_llmHistorico.length > 16) _llmHistorico.splice(0, _llmHistorico.length - 16);

  console.log("📡 Enviando:", { provedor: provedorAtual, modelo: modeloAtual });

  try {
    const response = await fetch(`/api/enviar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: _abortController.signal,
      body: JSON.stringify({
        pergunta: texto,
        fonte:      provedorAtual,
        modelo:     modeloAtual,
        credenciais,
        modo_agente: modoAgente,
        historico:  _llmHistorico.slice(0, -1), // sem a msg atual (já em pergunta)
        projeto_nome: _projetoNome,
      }),
    });

    if (!response.ok) throw new Error("HTTP " + response.status);

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer    = "";
    let agentRow     = null;
    let agentBubble  = null;
    let bufferTexto  = "";

    function garantirBolha() {
      if (agentRow) return;
      const r = document.createElement("div");
      r.className = "msg-row agent";
      const l = document.createElement("div");
      l.className = "msg-label";
      l.textContent = "agente";
      const b = document.createElement("div");
      b.className = "msg-bubble";
      b.style.whiteSpace = "pre-wrap";
      b.style.wordWrap   = "break-word";
      const copyBtn = _criarBotaoCopiar(() => b);
      r.appendChild(l);
      r.appendChild(b);
      r.appendChild(copyBtn);
      chatInner.appendChild(r);
      agentRow    = r;
      agentBubble = b;
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      sseBuffer += decoder.decode(value, { stream: true });
      const events = sseBuffer.split("\n\n");
      sseBuffer = events.pop();

      for (const bloco of events) {
        if (!bloco.trim()) continue;

        let eventName = "message";
        let eventData = "";
        for (const line of bloco.split("\n")) {
          if (line.startsWith("event: ")) eventName = line.slice(7).trim();
          if (line.startsWith("data: "))  eventData = line.slice(6).trim();
        }

        let payload = {};
        try { payload = JSON.parse(eventData); } catch {}

        switch (eventName) {
          case "think_start":
            if (_spinnerEl) {
              _spinnerEl.querySelector(".spinner-bubble").innerHTML =
                `<span class="spin-raciocinio">🧠</span><span class="spin-label">raciocinando…</span>`;
            }
            setStatus("pensando", "raciocinando…");
            garantirBolha();
            _getOrCreateThinkBlock(agentRow, agentBubble);
            if (_thinkStatusEl) _thinkStatusEl.classList.add("live");
            break;

          case "think_token":
            if (payload.text) {
              removerSpinner();
              garantirBolha();
              _appendThinkText(payload.text, agentRow, agentBubble);
            }
            break;

          case "think_done":
            if (_thinkStatusEl) _thinkStatusEl.classList.remove("live");
            _finalizeThinkBlock();
            break;

          case "token":
            removerSpinner();
            setStatus("respondendo", "respondendo…");
            if (payload.text) {
              garantirBolha();
              bufferTexto += payload.text;
              agentBubble.textContent = bufferTexto;
              scrollToBottom();
            }
            break;

          case "tool_start":
            removerSpinner();
            if (payload.nome) {
              garantirBolha();
              const toolIndicator = document.createElement("div");
              toolIndicator.className = "tool-indicator";
              toolIndicator.dataset.toolId = payload.id || "";
              toolIndicator.innerHTML = `
                <span class="tool-spin">⟳</span>
                <span class="tool-nome">${payload.nome}</span>
                <span class="tool-status">executando…</span>`;
              agentRow.insertBefore(toolIndicator, agentBubble);
            }
            break;

          case "tool_end":
            if (payload.id || payload.nome) {
              const toolEl = agentRow?.querySelector(`.tool-indicator[data-tool-id="${payload.id || ""}"]`)
                || agentRow?.querySelector(".tool-indicator:last-of-type");
              if (toolEl) {
                toolEl.querySelector(".tool-spin").textContent   = "✓";
                toolEl.querySelector(".tool-status").textContent = payload.resultado?.slice(0, 60) || "ok";
                toolEl.classList.add("done");
              }
            }
            // Atualizar explorer de arquivos se arquivo foi criado
            if (payload.nome === "escrever_arquivo" || payload.nome === "criar_estrutura_projeto") {
              if (typeof renderVirtualFS === "function") renderVirtualFS();
            }
            break;

          case "arquivos_criados":
            removerSpinner();
            // Mesclar arquivos no Virtual FS
            if (payload.conteudos) {
              Object.assign(_virtualFS, payload.conteudos);
              renderVirtualFS();
              // Atualizar lista para autocomplete
              _arquivosFlat = Object.keys(_virtualFS).map(cam => ({
                nome: cam.split("/").pop(),
                caminho: cam,
                ext: cam.includes(".") ? cam.split(".").pop().toLowerCase() : ""
              }));
            }
            // Card de arquivos criados na bolha
            if (payload.arquivos && payload.arquivos.length > 0) {
              garantirBolha();
              const card = document.createElement("div");
              card.className = "arquivos-card";
              const titulo = document.createElement("div");
              titulo.className = "arquivos-card-titulo";
              titulo.textContent = `${payload.status} — ${payload.total} arquivo(s) criado(s)`;
              card.appendChild(titulo);
              payload.arquivos.forEach(arq => {
                const item = document.createElement("div");
                item.className = "arquivos-card-item";
                const nome = arq.split(/[/\\]/).pop();
                item.innerHTML = `<span class="arq-icon">📄</span><span class="arq-nome" title="${arq}">${nome}</span><span class="arq-path">${arq}</span>`;
                item.style.cursor = "pointer";
                item.addEventListener("click", () => {
                  if (_virtualFS[arq]) abrirNoEditor(arq, nome);
                });
                card.appendChild(item);
              });
              // Botão download ZIP
              const btnDownload = document.createElement("button");
              btnDownload.className = "arquivos-card-download";
              btnDownload.innerHTML = `⬇ Baixar como ZIP`;
              btnDownload.style.cssText = "margin-top:8px;padding:5px 12px;border-radius:6px;background:var(--accent);color:#fff;border:none;cursor:pointer;font-size:11px;";
              btnDownload.addEventListener("click", () => downloadAsZip(_virtualFS, _projetoNome));
              card.appendChild(btnDownload);
              agentRow.insertBefore(card, agentBubble);
            }
            break;

          case "status":
            setStatus("pensando", payload.fase || "processando…");
            break;

          case "aviso":
            removerSpinner();
            if (payload.msg) addAviso(payload.msg);
            break;

          case "fim":
          case "done":
            if (bufferTexto.trim()) {
              _registrarMensagem("agente", bufferTexto.trim());
              // Adicionar ao histórico LLM
              _llmHistorico.push({ role: "assistant", content: bufferTexto.trim() });
              if (_llmHistorico.length > 16) _llmHistorico.splice(0, _llmHistorico.length - 16);
              _salvarConversaAtual();
            }
            setStatus("pronto", "pronto");
            gerando      = false;
            btnEnviar.disabled = false;
            btnParar.disabled  = true;
            break;

          case "erro":
          case "error":
            removerSpinner();
            setStatus("erro", "erro");
            addAviso("❌ " + (payload.msg || payload.error || "erro desconhecido"));
            gerando      = false;
            btnEnviar.disabled = false;
            btnParar.disabled  = true;
            break;
        }
      }
    }
  } catch (erro) {
    if (erro.name === "AbortError") {
      addAviso("⏹ Geração interrompida.");
    } else {
      console.error("❌ Erro:", erro);
      addAviso("❌ " + erro.message);
    }
  } finally {
    gerando      = false;
    btnEnviar.disabled = false;
    btnParar.disabled  = true;
    setStatus("pronto", "pronto");
  }
}

// Obter credenciais do provedor atual do localStorage
function _getCreds() {
  return {
    groq_api_key:       lsGet("key_groq"),
    gemini_api_key:     lsGet("key_gemini"),
    openrouter_api_key: lsGet("key_openrouter"),
    scitely_api_key:    lsGet("key_scitely"),
    llmapi_api_key:     lsGet("key_llmapi"),
    puter_auth_token:   lsGet("key_puter"),
    custom_api_key:     lsGet("key_custom"),
    custom_api_url:     lsGet("url_custom"),
  };
}

// ── DOWNLOAD COMO ZIP ─────────────────────────────────────────────────────────
async function downloadAsZip(vfs, projetoNome) {
  const arquivos = Object.entries(vfs);
  if (arquivos.length === 0) { addAviso("⚠ Nenhum arquivo para baixar."); return; }

  // Usa JSZip se disponível, senão faz download individual
  if (window.JSZip) {
    const zip = new JSZip();
    const pasta = zip.folder(projetoNome || "projeto");
    for (const [caminho, conteudo] of arquivos) {
      pasta.file(caminho, conteudo);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(projetoNome || "projeto").replace(/[^a-z0-9_-]/gi, "_")}.zip`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  } else {
    // Fallback: gera HTML com todos os arquivos embutidos
    const conteudo = arquivos.map(([cam, cont]) =>
      `<!-- === ${cam} === -->\n<!-- Para usar: salve o conteúdo abaixo como "${cam}" -->\n${cont}`
    ).join("\n\n\n");
    const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projetoNome || "projeto"}-arquivos.txt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }
}

btnEnviar.addEventListener("click", () => {
  const texto = inputMsg.value.trim();
  if (texto && !gerando) {
    const ctx = typeof montarContextoRefs === "function" ? montarContextoRefs() : "";
    if (ctx && typeof _refs !== "undefined") { _refs = []; renderRefs(); }
    enviarMensagem(ctx ? texto + ctx : texto);
  }
});

inputMsg.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !gerando) {
    if (typeof _acAtivo !== "undefined" && _acAtivo) return;
    e.preventDefault();
    const texto = inputMsg.value.trim();
    if (texto) {
      const ctx = typeof montarContextoRefs === "function" ? montarContextoRefs() : "";
      if (ctx && typeof _refs !== "undefined") { _refs = []; renderRefs(); }
      enviarMensagem(ctx ? texto + ctx : texto);
    }
  }
});

inputMsg.addEventListener("input", () => {
  inputMsg.style.height = "auto";
  inputMsg.style.height = inputMsg.scrollHeight + "px";
});

// Botão parar
btnParar?.addEventListener("click", () => {
  if (_abortController) _abortController.abort();
  gerando = false;
  btnEnviar.disabled = false;
  btnParar.disabled  = true;
  setStatus("pronto", "pronto");
});

// ── MODO DO AGENTE ───────────────────────────────────────────────────────────
function setModoAgente(modo) {
  modoAgente = modo;
  document.querySelectorAll("#segModo .seg-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.modo === modo);
  });
  lsSet("modo_agente", modo);
}

document.querySelectorAll("#segModo .seg-btn").forEach(btn => {
  btn.addEventListener("click", () => setModoAgente(btn.dataset.modo));
});

// ── PROJETO (nome apenas — sem filesystem local) ───────────────────────────────
const btnProjeto  = document.getElementById("btnProjeto");
const projetoNome = document.getElementById("projetoNome");
const projetoPath = document.getElementById("projetoPath");

btnProjeto?.addEventListener("click", () => {
  const novo = prompt("Nome do projeto:", _projetoNome);
  if (novo?.trim()) {
    _projetoNome = novo.trim();
    lsSet("projeto_nome", _projetoNome);
    if (projetoNome) { projetoNome.textContent = _projetoNome; projetoNome.title = _projetoNome; }
    if (projetoPath) projetoPath.textContent = "(virtual)";
    addAviso(`📁 Projeto: ${_projetoNome}`);
  }
});

// Limpar
const btnLimpar = document.getElementById("btnLimpar");
btnLimpar?.addEventListener("click", () => {
  _salvarConversaAtual();
  _llmHistorico = [];
  _iniciarNovaConversa();
  chatInner.innerHTML = `<div class="welcome-msg"><div class="welcome-icon">⬡</div><p>Nova conversa iniciada.</p></div>`;
  renderizarConvSidebar();
});

// ══════════════════════════════════════════════════════════════════════════════
// SISTEMA DE HISTÓRICO — SIDEBAR PERSISTENTE
// ══════════════════════════════════════════════════════════════════════════════

const HIST_LS_KEY   = "agente_dev_conversas";
const MAX_CONVERSAS = 100;
let _conversaAtual  = null;
let _convSidebarAberta = true;

function _carregarConversas() {
  try { return JSON.parse(localStorage.getItem(HIST_LS_KEY) || "[]"); }
  catch { return []; }
}
function _salvarConversas(lista) {
  try { localStorage.setItem(HIST_LS_KEY, JSON.stringify(lista)); }
  catch(e) { console.warn("localStorage cheio?", e); }
}

function _gerarId() { return "c" + Date.now() + Math.random().toString(36).slice(2,6); }

function _iniciarNovaConversa() {
  _conversaAtual = {
    id:        _gerarId(),
    titulo:    "",
    data:      new Date().toISOString(),
    provedor:  provedorAtual,
    modelo:    modeloAtual,
    projeto:   _projetoNome || "",
    mensagens: []
  };
}

function _registrarMensagem(quem, texto) {
  if (!texto?.trim()) return;
  if (!_conversaAtual) _iniciarNovaConversa();
  if (!_conversaAtual.titulo && quem === "user") {
    _conversaAtual.titulo = texto.slice(0, 70) + (texto.length > 70 ? "…" : "");
  }
  _conversaAtual.mensagens.push({ quem, texto: texto.trim(), ts: Date.now() });
}

function _salvarConversaAtual() {
  if (!_conversaAtual || _conversaAtual.mensagens.length < 2) return;
  const lista = _carregarConversas();
  const idx   = lista.findIndex(c => c.id === _conversaAtual.id);
  if (idx >= 0) lista[idx] = _conversaAtual;
  else {
    lista.unshift(_conversaAtual);
    if (lista.length > MAX_CONVERSAS) lista.splice(MAX_CONVERSAS);
  }
  _salvarConversas(lista);
  renderizarConvSidebar();
}

function _exportarConversa(conversa) {
  const data  = new Date(conversa.data).toLocaleString("pt-BR");
  const linhas = [
    `# ${conversa.titulo || "Conversa sem título"}`,
    `\n**Data:** ${data}  `,
    `**Modelo:** ${conversa.provedor} / ${conversa.modelo}`,
    conversa.projeto ? `**Projeto:** \`${conversa.projeto}\`` : "",
    `\n---\n`
  ];
  for (const msg of conversa.mensagens) {
    const ts = msg.ts ? new Date(msg.ts).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}) : "";
    linhas.push(msg.quem === "user" ? `### 👤 Você _(${ts})_` : `### 🤖 Agente _(${ts})_`);
    linhas.push("", msg.texto, "\n---\n");
  }
  const blob = new Blob([linhas.join("\n")], { type:"text/markdown;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `agente_${(conversa.titulo||"conversa").slice(0,40).replace(/[^\w\s-]/g,"").trim().replace(/\s+/g,"_")}.md`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

function _carregarConversaNoChat(conversa) {
  _salvarConversaAtual();
  _conversaAtual = JSON.parse(JSON.stringify(conversa));
  _llmHistorico  = conversa.mensagens.map(m => ({
    role: m.quem === "user" ? "user" : "assistant",
    content: m.texto
  }));
  chatInner.innerHTML = "";
  for (const msg of conversa.mensagens) addMensagem(msg.quem, msg.texto);
  renderizarConvSidebar();
  addAviso(`📂 "${conversa.titulo || "conversa"}" carregada`);
}

function _agrupar(lista) {
  const hoje   = new Date(); hoje.setHours(0,0,0,0);
  const ontem  = new Date(hoje); ontem.setDate(ontem.getDate()-1);
  const semana = new Date(hoje); semana.setDate(semana.getDate()-7);
  const mes    = new Date(hoje); mes.setDate(mes.getDate()-30);

  const grupos = { "Hoje":[], "Ontem":[], "Últimos 7 dias":[], "Últimos 30 dias":[], "Mais antigas":[] };
  for (const c of lista) {
    const d = new Date(c.data); d.setHours(0,0,0,0);
    if (d >= hoje)   grupos["Hoje"].push(c);
    else if (d >= ontem)  grupos["Ontem"].push(c);
    else if (d >= semana) grupos["Últimos 7 dias"].push(c);
    else if (d >= mes)    grupos["Últimos 30 dias"].push(c);
    else grupos["Mais antigas"].push(c);
  }
  return grupos;
}

function renderizarConvSidebar() {
  const container = document.getElementById("convLista");
  if (!container) return;

  const lista = _carregarConversas();
  if (lista.length === 0) {
    container.innerHTML = `<div class="conv-lista-vazio">Nenhuma conversa ainda.<br>Envie uma mensagem para começar.</div>`;
    return;
  }

  container.innerHTML = "";
  const grupos = _agrupar(lista);

  for (const [label, convs] of Object.entries(grupos)) {
    if (convs.length === 0) continue;

    const grpLabel = document.createElement("div");
    grpLabel.className = "conv-grupo-label";
    grpLabel.textContent = label;
    container.appendChild(grpLabel);

    for (const conv of convs) {
      const isAtual = _conversaAtual && conv.id === _conversaAtual.id;
      const item    = document.createElement("div");
      item.className = "conv-item" + (isAtual ? " ativa" : "");
      item.title = conv.titulo || "Conversa sem título";

      const hora   = new Date(conv.data).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
      const modelo = conv.modelo.split("/").pop().split(":")[0];

      item.innerHTML = `
        <div class="conv-item-texto">
          <div class="conv-item-titulo">${conv.titulo || "Conversa sem título"}</div>
          <div class="conv-item-sub">${hora} · ${modelo}</div>
        </div>
        <div class="conv-item-acoes">
          <button class="conv-item-btn exp" title="Exportar .md">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          <button class="conv-item-btn del" title="Apagar">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>`;

      item.querySelector(".conv-item-texto").addEventListener("click", () => _carregarConversaNoChat(conv));
      item.querySelector(".conv-item-btn.exp").addEventListener("click", e => {
        e.stopPropagation();
        _exportarConversa(conv);
      });
      item.querySelector(".conv-item-btn.del").addEventListener("click", e => {
        e.stopPropagation();
        const novaLista = _carregarConversas().filter(c => c.id !== conv.id);
        _salvarConversas(novaLista);
        item.style.opacity   = "0";
        item.style.transform = "translateX(-8px)";
        item.style.transition = "opacity .18s, transform .18s";
        setTimeout(() => renderizarConvSidebar(), 200);
      });

      container.appendChild(item);
    }
  }
}

// ── Toggle sidebar ────────────────────────────────────────────────────────────
function toggleConvSidebar() {
  const sidebar = document.getElementById("convSidebar");
  if (!sidebar) return;
  _convSidebarAberta = !_convSidebarAberta;
  sidebar.classList.toggle("collapsed", !_convSidebarAberta);
  lsSet("conv_sidebar_aberta", _convSidebarAberta ? "1" : "0");
}

document.getElementById("btnToggleConvSidebar")?.addEventListener("click", toggleConvSidebar);
document.getElementById("btnTopbarMenu")?.addEventListener("click", toggleConvSidebar);

document.getElementById("btnNovaConversa")?.addEventListener("click", () => {
  _salvarConversaAtual();
  _llmHistorico = [];
  _iniciarNovaConversa();
  chatInner.innerHTML = `<div class="welcome-msg"><div class="welcome-icon">⬡</div><p>Nova conversa.</p><p class="welcome-hint">O que você quer criar hoje?</p></div>`;
  renderizarConvSidebar();
});

document.getElementById("btnConvLimparTudo")?.addEventListener("click", () => {
  if (confirm("Apagar TODAS as conversas salvas? Não pode ser desfeito.")) {
    _salvarConversas([]);
    renderizarConvSidebar();
  }
});

(function() {
  const salvo   = lsGet("conv_sidebar_aberta");
  _convSidebarAberta = salvo !== "0";
  const sidebar = document.getElementById("convSidebar");
  if (sidebar && !_convSidebarAberta) sidebar.classList.add("collapsed");
})();

// ── SPINNER DE LOADING ────────────────────────────────────────────────────────
let _spinnerEl = null;

function mostrarSpinner() {
  if (_spinnerEl) return;
  const row = document.createElement("div");
  row.className = "msg-row agent";
  row.id = "loadingSpinner";
  row.innerHTML = `
    <div class="msg-label">agente</div>
    <div class="spinner-bubble">
      <span class="spin-dot"></span>
      <span class="spin-dot"></span>
      <span class="spin-dot"></span>
    </div>`;
  chatInner.appendChild(row);
  _spinnerEl = row;
  scrollToBottom();
}

function removerSpinner() {
  if (_spinnerEl) { _spinnerEl.remove(); _spinnerEl = null; }
}

document.addEventListener("DOMContentLoaded", () => {
  const statusPill = document.querySelector(".status-pill");
  if (statusPill && statusPill.parentElement) {
    statusAPIElement = criarStatusAPI();
    statusPill.parentElement.appendChild(statusAPIElement);
  }

  // Netlify: começa na aba nuvem
  setTipo("nuvem");
  setStatus("pronto", "pronto");
  atualizarStatusAPI();

  const savedModo = lsGet("modo_agente") || "agente";
  setModoAgente(savedModo);

  // Restaurar nome do projeto
  const savedProjeto = lsGet("projeto_nome");
  if (savedProjeto) {
    _projetoNome = savedProjeto;
    if (projetoNome) { projetoNome.textContent = _projetoNome; projetoNome.title = _projetoNome; }
    if (projetoPath) projetoPath.textContent = "(virtual)";
  }

  _iniciarNovaConversa();
  renderizarConvSidebar();
  renderVirtualFS();
});

// ══════════════════════════════════════════════════════════════════════════════
// CHAVES API NOMEADAS
// ══════════════════════════════════════════════════════════════════════════════

function _keysStorageKey(prov) { return `agente_dev_named_keys_${prov}`; }

function getChavesNomeadas(prov) {
  try { return JSON.parse(localStorage.getItem(_keysStorageKey(prov)) || "[]"); }
  catch { return []; }
}

function salvarChaveNomeada(prov, nome, key, url) {
  const lista = getChavesNomeadas(prov);
  const idx   = lista.findIndex(k => k.nome === nome);
  const item  = { nome, key, url: url || "" };
  if (idx >= 0) lista[idx] = item; else lista.push(item);
  localStorage.setItem(_keysStorageKey(prov), JSON.stringify(lista));
}

function deletarChaveNomeada(prov, nome) {
  const lista = getChavesNomeadas(prov).filter(k => k.nome !== nome);
  localStorage.setItem(_keysStorageKey(prov), JSON.stringify(lista));
}

function renderChavesSalvas(prov) {
  const container = document.getElementById("credsSavedKeys");
  const sel       = document.getElementById("selSavedKey");
  if (!container || !sel) return;
  const lista = getChavesNomeadas(prov);
  if (lista.length === 0) { container.style.display = "none"; return; }
  container.style.display = "flex";
  sel.innerHTML = `<option value="">— selecionar —</option>` +
    lista.map(k => `<option value="${k.nome}">${k.nome}</option>`).join("");
}

document.getElementById("selSavedKey")?.addEventListener("change", () => {
  const sel     = document.getElementById("selSavedKey");
  const nome    = sel.value;
  const btnDel  = document.getElementById("btnDeletarKey");
  if (!nome) { if (btnDel) btnDel.style.display = "none"; return; }
  const lista   = getChavesNomeadas(provedorAtual);
  const item    = lista.find(k => k.nome === nome);
  if (!item) return;
  inputApiKey.value = item.key;
  if (item.url) inputApiUrl.value = item.url;
  lsSet(`key_${provedorAtual}`, item.key);
  if (item.url) lsSet(`url_${provedorAtual}`, item.url);
  if (btnDel) btnDel.style.display = "flex";
  addAviso(`✓ Chave "${nome}" carregada`);
});

document.getElementById("btnDeletarKey")?.addEventListener("click", () => {
  const sel  = document.getElementById("selSavedKey");
  const nome = sel.value;
  if (!nome) return;
  deletarChaveNomeada(provedorAtual, nome);
  renderChavesSalvas(provedorAtual);
  addAviso(`✓ Chave "${nome}" removida`);
  document.getElementById("btnDeletarKey").style.display = "none";
});


// ══════════════════════════════════════════════════════════════════════════════
// VIRTUAL FILESYSTEM EXPLORER (substitui explorador de arquivos do backend)
// ══════════════════════════════════════════════════════════════════════════════

const sidebar     = document.getElementById("sidebar");
const btnExplorer = document.getElementById("btnExplorer");
const sidebarTree = document.getElementById("sidebarTree");
const btnSidebarRef = document.getElementById("btnSidebarRefresh");

let _arquivosFlat = [];   // para autocomplete
let _explorerRaizAtual = null;

function toggleSidebar(force) {
  const abrir = force !== undefined ? force : sidebar.classList.contains("collapsed");
  sidebar.classList.toggle("collapsed", !abrir);
  btnExplorer.classList.toggle("active", abrir);
  if (abrir) renderVirtualFS();
}

btnExplorer?.addEventListener("click", () => toggleSidebar());
btnSidebarRef?.addEventListener("click", () => renderVirtualFS());

document.addEventListener("keydown", e => {
  if (e.altKey && e.key.toLowerCase() === "e") { e.preventDefault(); toggleSidebar(); }
});

function iconePorExt(nome, isDir) {
  if (isDir) return "📁";
  const ext = nome.includes(".") ? nome.split(".").pop().toLowerCase() : "";
  const mapa = {
    html:"🌐",htm:"🌐",js:"🟨",ts:"🔷",jsx:"⚛️",tsx:"⚛️",
    py:"🐍",css:"🎨",scss:"🎨",json:"📋",md:"📝",
    txt:"📄",sh:"⚙️",bat:"⚙️",png:"🖼️",jpg:"🖼️",
    jpeg:"🖼️",gif:"🖼️",svg:"🖼️",mp4:"🎬",mp3:"🎵"
  };
  return mapa[ext] || "📄";
}

function extClass(nome) {
  if (!nome.includes(".")) return "";
  return `ext-${nome.split(".").pop().toLowerCase()}`;
}

function renderVirtualFS() {
  if (!sidebarTree) return;
  sidebarTree.innerHTML = "";

  const arquivos = Object.keys(_virtualFS);

  // Cabeçalho com download
  const header = document.createElement("div");
  header.style.cssText = "padding:8px 10px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:6px;";
  header.innerHTML = `
    <span style="font-size:10px;color:var(--text2);flex:1;font-family:var(--font-mono);">
      ${arquivos.length} arquivo(s) virtual(is)
    </span>`;
  if (arquivos.length > 0) {
    const btnDown = document.createElement("button");
    btnDown.style.cssText = "background:var(--accent);color:#fff;border:none;border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer;";
    btnDown.textContent = "⬇ ZIP";
    btnDown.title = "Baixar todos os arquivos como ZIP";
    btnDown.addEventListener("click", () => downloadAsZip(_virtualFS, _projetoNome));
    header.appendChild(btnDown);
  }
  sidebarTree.appendChild(header);

  if (arquivos.length === 0) {
    const empty = document.createElement("div");
    empty.className = "sidebar-empty";
    empty.innerHTML = `<div style="text-align:center;padding:20px 10px;">
      <div style="font-size:24px;margin-bottom:8px;">📁</div>
      <div style="font-size:11px;color:var(--text2);">Nenhum arquivo criado ainda.</div>
      <div style="font-size:10px;color:var(--text3);margin-top:4px;">Os arquivos criados pelo agente<br>aparecerão aqui.</div>
    </div>`;
    sidebarTree.appendChild(empty);
    return;
  }

  // Organizar em árvore
  const tree = {};
  for (const cam of arquivos) {
    const partes = cam.split("/");
    let no = tree;
    for (let i = 0; i < partes.length - 1; i++) {
      if (!no[partes[i]]) no[partes[i]] = { _isDir: true };
      no = no[partes[i]];
    }
    no[partes[partes.length - 1]] = cam; // folha = caminho completo
  }

  function renderNode(node, prefix = "") {
    const frag = document.createDocumentFragment();
    for (const [nome, val] of Object.entries(node)) {
      if (nome === "_isDir") continue;

      if (typeof val === "object") {
        // Diretório
        const wrapper = document.createElement("div");
        wrapper.className = "tree-dir open";
        const row = document.createElement("div");
        row.className = "tree-item";
        row.style.paddingLeft = `${8 + prefix.length * 12}px`;
        row.innerHTML = `
          <span class="tree-dir-toggle">▾</span>
          <span class="tree-item-icon">📁</span>
          <span class="tree-item-name">${nome}</span>`;
        row.addEventListener("click", () => wrapper.classList.toggle("open"));
        const children = document.createElement("div");
        children.className = "tree-dir-children";
        children.appendChild(renderNode(val, prefix + " "));
        wrapper.appendChild(row);
        wrapper.appendChild(children);
        frag.appendChild(wrapper);
      } else {
        // Arquivo
        const caminho = val;
        const row = document.createElement("div");
        row.className = `tree-item ${extClass(nome)}`;
        row.style.paddingLeft = `${8 + prefix.length * 12}px`;
        row.dataset.caminho = caminho;
        row.dataset.nome    = nome;
        row.innerHTML = `
          <span class="tree-item-icon">${iconePorExt(nome, false)}</span>
          <span class="tree-item-name" title="${caminho}">${nome}</span>
          <span class="tree-item-ref" title="Referenciar no chat">@</span>`;

        row.addEventListener("click", e => {
          if (e.target.classList.contains("tree-item-ref")) return;
          document.querySelectorAll(".tree-item.active").forEach(el => el.classList.remove("active"));
          row.classList.add("active");
          abrirNoEditor(caminho, nome);
        });

        row.querySelector(".tree-item-ref").addEventListener("click", e => {
          e.stopPropagation();
          adicionarReferencia(caminho, nome);
        });

        frag.appendChild(row);
      }
    }
    return frag;
  }

  sidebarTree.appendChild(renderNode(tree));

  // Atualizar lista para autocomplete
  _arquivosFlat = arquivos.map(cam => ({
    nome:    cam.split("/").pop(),
    caminho: cam,
    ext:     cam.includes(".") ? cam.split(".").pop().toLowerCase() : ""
  }));
}


// ══════════════════════════════════════════════════════════════════════════════
// EDITOR INLINE (usando Virtual FS)
// ══════════════════════════════════════════════════════════════════════════════

const editorPanel         = document.getElementById("editorPanel");
const editorTabs          = document.getElementById("editorTabs");
const editorTextarea      = document.getElementById("editorTextarea");
const editorHighlight     = document.getElementById("editorHighlight");
const editorHighlightCode = document.getElementById("editorHighlightCode");
const editorGutter        = document.getElementById("editorGutter");
const editorPath          = document.getElementById("editorPath");
const editorStatus        = document.getElementById("editorStatus");
const btnEditorSave       = document.getElementById("btnEditorSave");
const btnEditorClose      = document.getElementById("btnEditorClose");

const EXT_LANG = {
  js:"javascript",jsx:"jsx",ts:"typescript",tsx:"tsx",
  py:"python",html:"html",htm:"html",css:"css",scss:"scss",
  json:"json",md:"markdown",sh:"bash",bat:"batch",
  rs:"rust",go:"go",java:"java",cpp:"cpp",c:"c",
  php:"php",rb:"ruby",yaml:"yaml",yml:"yaml",toml:"toml",
  sql:"sql",xml:"xml",vue:"markup",svelte:"markup"
};

function extParaLang(nome) {
  const ext = nome.includes(".") ? nome.split(".").pop().toLowerCase() : "";
  return EXT_LANG[ext] || "plaintext";
}

function escapeHtml(txt) {
  return txt.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function atualizarHighlight(conteudo, lang) {
  if (!editorHighlightCode || !editorHighlight) return;
  const texto = conteudo.endsWith("\n") ? conteudo + " " : conteudo;
  if (lang !== "plaintext" && window.Prism && Prism.languages[lang]) {
    editorHighlightCode.innerHTML = Prism.highlight(texto, Prism.languages[lang], lang);
  } else {
    editorHighlightCode.textContent = texto;
  }
  editorHighlight.className = `editor-highlight language-${lang}`;
  atualizarGutter(conteudo);
}

function atualizarGutter(conteudo) {
  if (!editorGutter) return;
  const linhas = conteudo.split("\n").length;
  let html = "";
  for (let i = 1; i <= linhas; i++) html += `<span>${i}</span>`;
  editorGutter.innerHTML = html;
}

function syncScroll() {
  if (!editorHighlight) return;
  editorHighlight.scrollTop  = editorTextarea.scrollTop;
  editorHighlight.scrollLeft = editorTextarea.scrollLeft;
  if (editorGutter) editorGutter.scrollTop = editorTextarea.scrollTop;
}

let _editorTabs    = [];
let _editorTabAtual = null;

// Abrir arquivo do Virtual FS no editor
function abrirNoEditor(caminho, nome) {
  const existente = _editorTabs.find(t => t.caminho === caminho);
  if (existente) { ativarTab(caminho); return; }

  const conteudo = _virtualFS[caminho] || "";
  const tab = { nome, caminho, conteudo, conteudoOrig: conteudo, dirty: false };
  _editorTabs.push(tab);
  renderTabs();
  ativarTab(caminho);
  abrirEditorPanel();
}

function abrirEditorPanel()  { editorPanel.classList.add("open"); }

function fecharEditorPanel() {
  editorPanel.classList.remove("open");
  _editorTabs     = [];
  _editorTabAtual = null;
  if (editorTabs)     editorTabs.innerHTML   = "";
  if (editorTextarea) editorTextarea.value   = "";
  if (editorPath)     editorPath.textContent = "";
  if (editorStatus)   editorStatus.textContent = "";
}

function ativarTab(caminho) {
  if (_editorTabAtual) {
    const curr = _editorTabs.find(t => t.caminho === _editorTabAtual);
    if (curr) curr.conteudo = editorTextarea.value;
  }
  _editorTabAtual = caminho;
  const tab = _editorTabs.find(t => t.caminho === caminho);
  if (!tab) return;
  const lang = extParaLang(tab.nome);
  editorTextarea.value   = tab.conteudo;
  editorPath.textContent = tab.caminho;
  editorStatus.textContent = `${tab.conteudo.split("\n").length} linhas · ${lang}`;
  setTimeout(() => {
    atualizarHighlight(tab.conteudo, lang);
    if (lang !== "plaintext" && window.Prism && !Prism.languages[lang] && Prism.plugins?.autoloader) {
      Prism.plugins.autoloader.loadLanguages([lang], () => atualizarHighlight(tab.conteudo, lang));
    }
  }, 0);
  renderTabs();
}

function renderTabs() {
  if (!editorTabs) return;
  editorTabs.innerHTML = "";
  _editorTabs.forEach(tab => {
    const el = document.createElement("div");
    el.className = `editor-tab${tab.caminho === _editorTabAtual ? " active" : ""}${tab.dirty ? " dirty" : ""}`;
    el.innerHTML = `<span class="editor-tab-name">${tab.nome}</span><span class="editor-tab-close">×</span>`;
    el.addEventListener("click", e => {
      if (e.target.classList.contains("editor-tab-close")) fecharTab(tab.caminho);
      else ativarTab(tab.caminho);
    });
    editorTabs.appendChild(el);
  });
}

function fecharTab(caminho) {
  _editorTabs = _editorTabs.filter(t => t.caminho !== caminho);
  if (_editorTabs.length === 0) { fecharEditorPanel(); return; }
  if (_editorTabAtual === caminho) ativarTab(_editorTabs[0].caminho);
  else renderTabs();
}

editorTextarea?.addEventListener("input", () => {
  const tab = _editorTabs.find(t => t.caminho === _editorTabAtual);
  if (tab) {
    tab.dirty   = tab.conteudoOrig !== editorTextarea.value;
    tab.conteudo = editorTextarea.value;
    const linhas = editorTextarea.value.split("\n").length;
    const lang   = extParaLang(tab.nome);
    editorStatus.textContent = `${linhas} linhas${tab.dirty ? " · não salvo" : ""} · ${lang}`;
    atualizarHighlight(tab.conteudo, lang);
    renderTabs();
  }
});

editorTextarea?.addEventListener("scroll", syncScroll);

editorTextarea?.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    salvarArquivoEditor();
  }
  if (e.key === "Tab") {
    e.preventDefault();
    const start = editorTextarea.selectionStart;
    const end   = editorTextarea.selectionEnd;
    editorTextarea.value = editorTextarea.value.substring(0, start) + "  " + editorTextarea.value.substring(end);
    editorTextarea.selectionStart = editorTextarea.selectionEnd = start + 2;
  }
});

// Salvar no Virtual FS (sem backend)
function salvarArquivoEditor() {
  const tab = _editorTabs.find(t => t.caminho === _editorTabAtual);
  if (!tab) return;
  const conteudo = editorTextarea.value;
  _virtualFS[tab.caminho] = conteudo;
  tab.conteudoOrig = conteudo;
  tab.dirty = false;
  const linhas = conteudo.split("\n").length;
  editorStatus.textContent = `✓ Salvo · ${linhas} linhas`;
  if (btnEditorSave) {
    btnEditorSave.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> salvo`;
    btnEditorSave.classList.add("saved");
    setTimeout(() => {
      btnEditorSave.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg> salvar`;
      btnEditorSave.classList.remove("saved");
    }, 2500);
  }
  renderTabs();
  renderVirtualFS();
}

btnEditorSave?.addEventListener("click", salvarArquivoEditor);
btnEditorClose?.addEventListener("click", fecharEditorPanel);


// ══════════════════════════════════════════════════════════════════════════════
// REFERÊNCIA DE ARQUIVO (@) NO CHAT — usando Virtual FS
// ══════════════════════════════════════════════════════════════════════════════

const refsBar          = document.getElementById("refsBar");
const fileAutocomplete = document.getElementById("fileAutocomplete");
let _refs     = [];
let _acAtivo  = false;
let _acQuery  = "";
let _acSelecionado = -1;

function adicionarReferencia(caminho, nome) {
  if (_refs.find(r => r.caminho === caminho)) return;
  const conteudo = _virtualFS[caminho] || "(arquivo não encontrado no projeto virtual)";
  _refs.push({ nome, caminho, conteudo });
  renderRefs();
  addAviso(`📎 @${nome} referenciado`);
}

function removerReferencia(caminho) {
  _refs = _refs.filter(r => r.caminho !== caminho);
  renderRefs();
}

function renderRefs() {
  if (!refsBar) return;
  if (_refs.length === 0) { refsBar.innerHTML = ""; return; }
  refsBar.innerHTML = _refs.map(r => `
    <div class="ref-chip">
      <span>📎 @${r.nome}</span>
      <span class="ref-chip-remove" data-caminho="${r.caminho}">×</span>
    </div>`).join("");
  refsBar.querySelectorAll(".ref-chip-remove").forEach(el => {
    el.addEventListener("click", () => removerReferencia(el.dataset.caminho));
  });
}

function montarContextoRefs() {
  if (_refs.length === 0) return "";
  return "\n\n---\n" + _refs.map(r =>
    `📎 Arquivo: ${r.nome} (${r.caminho})\n\`\`\`\n${r.conteudo.slice(0, 8000)}\n\`\`\``
  ).join("\n\n---\n");
}

// Autocomplete
inputMsg?.addEventListener("input", e => {
  const val    = inputMsg.value;
  const cursor = inputMsg.selectionStart;
  const before = val.slice(0, cursor);
  const match  = before.match(/@(\w*)$/);
  if (match) {
    _acQuery = match[1].toLowerCase();
    _acAtivo = true;
    renderAutocomplete(_acQuery);
  } else {
    fecharAutocomplete();
  }
});

inputMsg?.addEventListener("keydown", e => {
  if (!_acAtivo) return;
  const itens = fileAutocomplete.querySelectorAll(".file-ac-item");
  if (e.key === "ArrowDown") {
    e.preventDefault();
    _acSelecionado = Math.min(_acSelecionado + 1, itens.length - 1);
    itens.forEach((el, i) => el.classList.toggle("selected", i === _acSelecionado));
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    _acSelecionado = Math.max(_acSelecionado - 1, 0);
    itens.forEach((el, i) => el.classList.toggle("selected", i === _acSelecionado));
  } else if (e.key === "Enter" || e.key === "Tab") {
    const sel = fileAutocomplete.querySelector(".file-ac-item.selected");
    if (sel) { e.preventDefault(); selecionarAutocompletItem(sel.dataset.caminho, sel.dataset.nome); }
  } else if (e.key === "Escape") {
    fecharAutocomplete();
  }
});

function renderAutocomplete(query) {
  const filtrado = query
    ? _arquivosFlat.filter(f => f.nome.toLowerCase().includes(query))
    : _arquivosFlat.slice(0, 12);
  if (filtrado.length === 0) { fecharAutocomplete(); return; }
  fileAutocomplete.innerHTML = filtrado.slice(0, 12).map((f, i) => `
    <div class="file-ac-item${i === 0 ? " selected" : ""}" data-caminho="${f.caminho}" data-nome="${f.nome}">
      <span class="file-ac-icon">${iconePorExt(f.nome, false)}</span>
      <span class="file-ac-name">${f.nome}</span>
      <span class="file-ac-path">${f.caminho}</span>
    </div>`).join("");
  _acSelecionado = 0;
  fileAutocomplete.classList.add("visible");
  fileAutocomplete.style.display = "block";
  fileAutocomplete.querySelectorAll(".file-ac-item").forEach(el => {
    el.addEventListener("click", () => selecionarAutocompletItem(el.dataset.caminho, el.dataset.nome));
    el.addEventListener("mouseenter", () => {
      fileAutocomplete.querySelectorAll(".file-ac-item").forEach(e => e.classList.remove("selected"));
      el.classList.add("selected");
    });
  });
}

function selecionarAutocompletItem(caminho, nome) {
  const val    = inputMsg.value;
  const cursor = inputMsg.selectionStart;
  const before = val.slice(0, cursor);
  const after  = val.slice(cursor);
  inputMsg.value = before.replace(/@\w*$/, "") + after;
  fecharAutocomplete();
  adicionarReferencia(caminho, nome);
  inputMsg.focus();
}

function fecharAutocomplete() {
  _acAtivo = false;
  _acSelecionado = -1;
  if (fileAutocomplete) {
    fileAutocomplete.classList.remove("visible");
    fileAutocomplete.style.display = "none";
    fileAutocomplete.innerHTML = "";
  }
}

document.addEventListener("click", e => {
  if (fileAutocomplete && !fileAutocomplete.contains(e.target) && e.target !== inputMsg) fecharAutocomplete();
});


// ══════════════════════════════════════════════════════════════════════════════
// RESIZE HANDLES
// ══════════════════════════════════════════════════════════════════════════════

function criarResizeHandle(targetEl, side) {
  const handle = document.createElement("div");
  handle.className = "resize-handle";
  handle.dataset.side = side;

  let startX, startW;

  handle.addEventListener("mousedown", e => {
    e.preventDefault();
    startX = e.clientX;
    startW = targetEl.offsetWidth;

    const onMove = e => {
      const dx   = e.clientX - startX;
      const newW = side === "right" ? startW + dx : startW - dx;
      if (newW > 80) {
        targetEl.style.width    = newW + "px";
        targetEl.style.minWidth = newW + "px";
      }
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  });

  handle.addEventListener("dblclick", () => {
    const defaults = { sidebar: "240px", editorPanel: "420px" };
    const def = defaults[targetEl.id];
    if (def) { targetEl.style.width = def; targetEl.style.minWidth = def; }
  });

  return handle;
}

document.addEventListener("DOMContentLoaded", () => {
  const sb = document.getElementById("sidebar");
  const ep = document.getElementById("editorPanel");
  if (sb) {
    sb.style.maxWidth = "none";
    const h = criarResizeHandle(sb, "right");
    sb.appendChild(h);
  }
  if (ep) {
    ep.style.maxWidth = "none";
    const h = criarResizeHandle(ep, "left");
    ep.appendChild(h);
  }
});

document.addEventListener("mousedown", e => {
  if (e.target.classList.contains("resize-handle")) {
    const panel = e.target.closest(".sidebar, .editor-panel");
    if (panel) panel.classList.add("resizing-active");
  }
});
document.addEventListener("mouseup", () => {
  document.querySelectorAll(".resizing-active").forEach(el => el.classList.remove("resizing-active"));
});
