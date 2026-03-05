// app.js — Agente Dev (GitHub + Netlify Functions)

// ── Storage: memória + localStorage como bônus ────────────────────────────────
const _store = (() => {
  const mem = {};
  let _ls = null;
  try {
    localStorage.setItem("__probe", "1");
    localStorage.removeItem("__probe");
    _ls = localStorage;
    // Copia tudo do localStorage para memória
    for (let i = 0; i < _ls.length; i++) {
      const k = _ls.key(i);
      if (k) mem[k] = _ls.getItem(k);
    }
  } catch {}
  return {
    set(k, v) {
      mem[k] = String(v);
      try { _ls?.setItem(k, String(v)); } catch {}
    },
    get(k) { return mem[k] ?? null; },
    remove(k) {
      delete mem[k];
      try { _ls?.removeItem(k); } catch {}
    },
    getItem(k) { return this.get(k); },
    setItem(k, v) { this.set(k, v); },
    removeItem(k) { this.remove(k); },
    key(i) { return Object.keys(mem)[i] ?? null; },
    get length() { return Object.keys(mem).length; },
  };
})();

const LS = "agente_dev_";
const lsSet = (k, v) => _store.set(LS + k, v);
const lsGet = (k)    => _store.get(LS + k) || "";

// ── Provedores ────────────────────────────────────────────────────────────────
const PROVEDORES = [
  { value: "groq",       label: "⚡ Groq (rápido, grátis)" },
  { value: "openrouter", label: "🌐 OpenRouter (grátis + pago)" },
  { value: "gemini",     label: "🔷 Gemini" },
  { value: "scitely",    label: "🔑 Scitely" },
  { value: "llmapi",     label: "🔑 LLM API" },
  { value: "puter",      label: "🔑 Puter AI" },
  { value: "custom",     label: "⚙️ Custom API" },
];

const MODELOS = {
  groq: [
    "llama-3.3-70b-versatile",
    "llama-3.1-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
    "deepseek-r1-distill-llama-70b",
  ],
  gemini: [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
  ],
  openrouter: [
    "deepseek/deepseek-r1:free",
    "deepseek/deepseek-chat-v3-0324:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "mistralai/mistral-small-3.1-24b-instruct:free",
    "qwen/qwq-32b:free",
    "qwen/qwen2.5-coder-32b-instruct:free",
    "google/gemini-2.0-flash-001",
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-4o",
    "openai/gpt-4o-mini",
  ],
  scitely: [
    "deepseek-v3",
    "deepseek-r1",
    "qwen-plus",
    "qwen-max",
    "qwen-turbo",
    "kimi-latest",
    "glm-4-flash",
    "glm-4",
    "llama-3.3-70b",
    "mixtral-8x7b",
  ],
  llmapi: [
    "gpt-4o-mini",
    "gpt-4o",
    "claude-3-5-sonnet-20241022",
    "gemini-2.0-flash",
    "qwen-max",
    "grok-3",
  ],
  puter: [
    "gpt-4o",
    "gpt-4o-mini",
    "claude-sonnet-4-5",
    "claude-haiku-4-5",
    "google/gemini-2.0-flash",
    "meta-llama/llama-3.3-70b-instruct",
    "deepseek/deepseek-r1",
    "grok-3",
  ],
  custom: [],
};

const LABELS_KEY = {
  groq:       "Groq API Key — console.groq.com (grátis)",
  gemini:     "Gemini API Key — aistudio.google.com (grátis)",
  openrouter: "OpenRouter API Key — openrouter.ai/keys",
  scitely:    "Scitely API Key — platform.scitely.com",
  llmapi:     "LLM API Key — app.llmapi.ai",
  puter:      "Puter Auth Token — puter.com/dashboard",
  custom:     "API Key",
};

const LINKS_KEY = {
  groq:       { url: "https://console.groq.com/keys",              label: "Obter chave grátis no Groq" },
  gemini:     { url: "https://aistudio.google.com/app/apikey",     label: "Obter chave grátis no Google AI Studio" },
  openrouter: { url: "https://openrouter.ai/keys",                 label: "Obter chave no OpenRouter" },
  scitely:    { url: "https://platform.scitely.com",               label: "Obter chave no Scitely" },
  llmapi:     { url: "https://app.llmapi.ai",                      label: "Obter chave no LLM API" },
  puter:      { url: "https://puter.com/dashboard",                label: "Obter token no Puter" },
  custom:     null,
};

const PRECISA_URL = new Set(["custom", "local_custom", "local_pocketpal"]);

// ── Provedores Locais (IA que roda no próprio dispositivo/rede local) ─────────
const PROVEDORES_LOCAL = [
  { value: "local_ollama",    label: "🦙 Ollama" },
  { value: "local_lmstudio",  label: "🖥️ LM Studio" },
  { value: "local_llamacpp",  label: "⚙️ llama.cpp" },
  { value: "local_pocketpal", label: "📱 Pocket Pal (Android)" },
  { value: "local_custom",    label: "🔧 URL Local Custom" },
];

const PROVEDORES_NUVEM = PROVEDORES; // alias

const MODELOS_LOCAL = {
  local_ollama:    ["llama3.2", "llama3.1", "llama3", "mistral", "mixtral", "codellama", "phi3", "gemma2", "qwen2.5", "deepseek-r1"],
  local_lmstudio:  ["local-model", "llama-3.2-3b", "mistral-7b", "phi-3-mini", "gemma-2-2b"],
  local_llamacpp:  ["local-model"],
  local_pocketpal: ["phi-3-mini-4k", "llama-3.2-1b", "gemma-2-2b", "mistral-7b"],
  local_custom:    [],
};

const LABELS_KEY_LOCAL = {
  local_ollama:    "URL do Ollama (padrão: localhost:11434)",
  local_lmstudio:  "URL do LM Studio (padrão: localhost:1234)",
  local_llamacpp:  "URL do llama.cpp (padrão: localhost:8080)",
  local_pocketpal: "IP do dispositivo Android (ex: 192.168.1.x:8080)",
  local_custom:    "URL base da API local",
};

const URLS_DEFAULT_LOCAL = {
  local_ollama:    "http://localhost:11434/v1",
  local_lmstudio:  "http://localhost:1234/v1",
  local_llamacpp:  "http://localhost:8080/v1",
  local_pocketpal: "",
  local_custom:    "",
};

// ── Estado ────────────────────────────────────────────────────────────────────
let tipoAtual     = "nuvem";   // "nuvem" | "local"
let provedorAtual = "groq";
let modeloAtual   = "";
let gerando       = false;
let _abort        = null;
let _virtualFS    = {};
let _todos        = [];
let _projetoNome  = lsGet("projeto_nome") || "Meu Projeto";
let _llmHist      = [];

// ── DOM ───────────────────────────────────────────────────────────────────────
const selProvedor    = document.getElementById("selProvedor");
const selModelo      = document.getElementById("selModelo");
const chatInner      = document.getElementById("chatInner");
const inputMsg       = document.getElementById("inputMsg");
const btnEnviar      = document.getElementById("btnEnviar");
const btnParar       = document.getElementById("btnParar");
const credsBar       = document.getElementById("credsBar");
const credsKey       = document.getElementById("credsKey");
const credsUrl       = document.getElementById("credsUrl");
const credsKeyLabel  = document.getElementById("credsKeyLabel");
const inputApiKey    = document.getElementById("inputApiKey");
const inputApiUrl    = document.getElementById("inputApiUrl");
const btnMostrarKey  = document.getElementById("btnMostrarKey");
const btnSalvarLogin = document.getElementById("btnSalvarLogin");
const statusDot      = document.getElementById("statusDot");
const statusTxt      = document.getElementById("statusTxt");

// ── Provedores ────────────────────────────────────────────────────────────────
function listaProvedoresAtual() {
  return tipoAtual === "local" ? PROVEDORES_LOCAL : PROVEDORES_NUVEM;
}

function initProvedor() {
  // Restaura tipo salvo
  tipoAtual = lsGet("tipo_provedor") || "nuvem";
  _sincTipoBtns();

  const lista = listaProvedoresAtual();
  selProvedor.innerHTML = lista.map(o =>
    `<option value="${o.value}">${o.label}</option>`).join("");

  provedorAtual = lsGet("provedor_atual") || "groq";
  const valido = lista.find(p => p.value === provedorAtual);
  if (!valido) provedorAtual = lista[0].value;
  selProvedor.value = provedorAtual;
  onProvedorMudou();
}

function _sincTipoBtns() {
  const btnL = document.getElementById("btnLocal");
  const btnN = document.getElementById("btnNuvem");
  if (!btnL || !btnN) return;
  const isLocal = tipoAtual === "local";
  btnL.classList.toggle("active", isLocal);
  btnN.classList.toggle("active", !isLocal);
  // Cor do select de provedor
  const pw = document.querySelector(".provedor-wrap");
  if (pw) pw.dataset.tipo = tipoAtual;
}

// Botão LOCAL
document.getElementById("btnLocal")?.addEventListener("click", () => {
  tipoAtual = "local";
  lsSet("tipo_provedor", "local");
  _sincTipoBtns();
  const lista = PROVEDORES_LOCAL;
  selProvedor.innerHTML = lista.map(o =>
    `<option value="${o.value}">${o.label}</option>`).join("");
  provedorAtual = lsGet("provedor_local_ultimo") || lista[0].value;
  selProvedor.value = provedorAtual;
  lsSet("provedor_atual", provedorAtual);
  onProvedorMudou();
});

// Botão NUVEM
document.getElementById("btnNuvem")?.addEventListener("click", () => {
  tipoAtual = "nuvem";
  lsSet("tipo_provedor", "nuvem");
  _sincTipoBtns();
  const lista = PROVEDORES_NUVEM;
  selProvedor.innerHTML = lista.map(o =>
    `<option value="${o.value}">${o.label}</option>`).join("");
  provedorAtual = lsGet("provedor_nuvem_ultimo") || "groq";
  if (!lista.find(p => p.value === provedorAtual)) provedorAtual = lista[0].value;
  selProvedor.value = provedorAtual;
  lsSet("provedor_atual", provedorAtual);
  onProvedorMudou();
});

selProvedor.addEventListener("change", () => {
  provedorAtual = selProvedor.value;
  lsSet("provedor_atual", provedorAtual);
  if (tipoAtual === "local") lsSet("provedor_local_ultimo", provedorAtual);
  else                       lsSet("provedor_nuvem_ultimo", provedorAtual);
  onProvedorMudou();
});

function onProvedorMudou() {
  mostrarCredsBar(provedorAtual);
  carregarModelos(provedorAtual);
  atualizarStatusAPI();
}

// ── Credenciais ───────────────────────────────────────────────────────────────
function mostrarCredsBar(prov) {
  if (credsBar) credsBar.style.display = "block";
  if (credsKey) credsKey.style.display = "flex";
  if (credsUrl) credsUrl.style.display = PRECISA_URL.has(prov) ? "flex" : "none";
  if (credsKeyLabel) credsKeyLabel.textContent = LABELS_KEY[prov] || "API Key";
  const saved = lsGet(`key_${prov}`);
  if (inputApiKey) {
    inputApiKey.value = "";
    inputApiKey.placeholder = saved ? "••• salva ✓" : "cole aqui";
  }
  if (PRECISA_URL.has(prov) && inputApiUrl) inputApiUrl.value = lsGet(`url_${prov}`) || "";
  renderChavesSalvas(prov);

  // Atualiza link para obter API key
  const linkDiv  = document.getElementById("credsApiLink");
  const linkEl   = document.getElementById("linkApiKey");
  const linkText = document.getElementById("linkApiKeyText");
  const info = LINKS_KEY[prov];
  if (linkDiv && linkEl && info) {
    linkEl.href = info.url;
    if (linkText) linkText.textContent = info.label;
    linkDiv.style.display = "block";
  } else if (linkDiv) {
    linkDiv.style.display = "none";
  }
}

// Override para provedores locais — sem API key, só URL
function mostrarCredsBar(prov) {
  const isLocal = prov.startsWith("local_");

  if (credsBar) credsBar.style.display = "block";

  if (isLocal) {
    // Local: mostra URL (obrigatório para pocketpal/custom, default para outros)
    if (credsKey)    credsKey.style.display = "none";
    if (credsKeyLabel) credsKeyLabel.textContent = "";
    if (credsUrl)    credsUrl.style.display = "flex";
    if (credsKeyLabel) credsKeyLabel.textContent = LABELS_KEY_LOCAL[prov] || "URL local";
    const defaultUrl = URLS_DEFAULT_LOCAL[prov] || "";
    const savedUrl   = lsGet(`url_${prov}`);
    if (inputApiUrl)  inputApiUrl.value = savedUrl || defaultUrl;
    if (inputApiUrl)  inputApiUrl.placeholder = defaultUrl || "http://192.168.x.x:8080/v1";
    // Mostra campo URL com label local
    const urlGroup = credsUrl?.parentElement ?? null;
    if (credsUrl) {
      const label = credsUrl.querySelector
        ? credsUrl.previousElementSibling
        : null;
    }
    // Esconde campo de key name (não faz sentido pra local)
    const keyNameGroup = document.getElementById("credsKeyName");
    if (keyNameGroup) keyNameGroup.style.display = "none";

    // Bloco de credenciais local: mostra instruções de CORS no lugar do link
    const linkDiv = document.getElementById("credsApiLink");
    const linkEl  = document.getElementById("linkApiKey");
    const linkText = document.getElementById("linkApiKeyText");
    if (linkDiv && linkEl) {
      linkEl.href = _corsHelpUrl(prov);
      if (linkText) linkText.textContent = _corsHelpLabel(prov);
      linkDiv.style.display = linkEl.href !== "#" ? "block" : "none";
    }
    // Botão salvar vira "Conectar"
    if (btnSalvarLogin) {
      btnSalvarLogin.innerHTML = btnSalvarLogin.innerHTML.replace(/salvar|conectar/gi, "conectar");
    }
    renderChavesSalvas(prov);
    return;
  }

  // Nuvem (comportamento original)
  if (credsKey) credsKey.style.display = "flex";
  if (credsUrl) credsUrl.style.display = PRECISA_URL.has(prov) ? "flex" : "none";
  if (credsKeyLabel) credsKeyLabel.textContent = LABELS_KEY[prov] || "API Key";
  const keyNameGroup = document.getElementById("credsKeyName");
  if (keyNameGroup) keyNameGroup.style.display = "flex";
  const saved = lsGet(`key_${prov}`);
  if (inputApiKey) {
    inputApiKey.value = "";
    inputApiKey.placeholder = saved ? "••• salva ✓" : "cole aqui";
  }
  if (PRECISA_URL.has(prov) && inputApiUrl) inputApiUrl.value = lsGet(`url_${prov}`) || "";
  renderChavesSalvas(prov);
  const linkDiv  = document.getElementById("credsApiLink");
  const linkEl   = document.getElementById("linkApiKey");
  const linkText = document.getElementById("linkApiKeyText");
  const info = LINKS_KEY[prov];
  if (linkDiv && linkEl && info) {
    linkEl.href = info.url;
    if (linkText) linkText.textContent = info.label;
    linkDiv.style.display = "block";
  } else if (linkDiv) {
    linkDiv.style.display = "none";
  }
  if (btnSalvarLogin) {
    btnSalvarLogin.innerHTML = btnSalvarLogin.innerHTML.replace(/conectar/gi, "salvar");
  }
}

function _corsHelpUrl(prov) {
  const map = {
    local_ollama:   "https://github.com/ollama/ollama/blob/main/docs/faq.md#how-do-i-configure-ollama-server",
    local_lmstudio: "https://lmstudio.ai/docs/advanced/api-cors",
    local_llamacpp: "https://github.com/ggerganov/llama.cpp/blob/master/examples/server/README.md",
  };
  return map[prov] || "#";
}
function _corsHelpLabel(prov) {
  const map = {
    local_ollama:    "Como habilitar CORS no Ollama",
    local_lmstudio:  "Como habilitar CORS no LM Studio",
    local_llamacpp:  "Docs llama.cpp server",
    local_pocketpal: "Pocket Pal: ative o modo servidor no app",
  };
  return map[prov] || "Documentação";
}

btnMostrarKey?.addEventListener("click", () => {
  if (inputApiKey) inputApiKey.type = inputApiKey.type === "text" ? "password" : "text";
});

btnSalvarLogin?.addEventListener("click", () => {
  const isLocal = provedorAtual.startsWith("local_");
  const key  = inputApiKey?.value.trim();
  const url  = inputApiUrl?.value.trim();
  const nome = document.getElementById("inputKeyName")?.value.trim() || "";

  if (isLocal) {
    // Local: salva URL, não precisa de key
    if (!url) { addAviso("⚠ Informe a URL do servidor local."); return; }
    lsSet(`url_${provedorAtual}`, url);
    addAviso(`✓ URL salva: ${url}`);
    if (inputApiUrl) inputApiUrl.placeholder = url;
    atualizarStatusAPI();
    carregarModelosLocal(provedorAtual);
    return;
  }

  // Nuvem (comportamento original)
  if (!key) { addAviso("⚠ Cole a API Key antes de salvar."); return; }
  if (nome) {
    salvarChaveNomeada(provedorAtual, nome, key, url);
    addAviso(`✓ Chave "${nome}" salva`);
  } else {
    lsSet(`key_${provedorAtual}`, key);
    if (url) lsSet(`url_${provedorAtual}`, url);
    addAviso("✓ Chave salva");
  }
  if (inputApiKey) { inputApiKey.value = ""; inputApiKey.placeholder = "••• salva ✓"; }
  if (document.getElementById("inputKeyName")) document.getElementById("inputKeyName").value = "";
  atualizarStatusAPI();
  renderChavesSalvas(provedorAtual);
  carregarModelosDaAPI(provedorAtual);
});

// ── Modelos ───────────────────────────────────────────────────────────────────
function carregarModelos(prov) {
  const isLocal = prov.startsWith("local_");
  const lista = isLocal ? (MODELOS_LOCAL[prov] || []) : (MODELOS[prov] || []);
  const saved = lsGet(`modelo_${prov}`);

  if (selModelo) {
    selModelo.innerHTML = lista.map(m => `<option value="${m}">${m}</option>`).join("");
  }

  modeloAtual = (saved && lista.includes(saved)) ? saved : (lista[0] || "");
  if (selModelo) selModelo.value = modeloAtual;

  // Para provedores locais, busca modelos diretamente sem proxy
  if (isLocal) { carregarModelosLocal(prov); return; }
  carregarModelosDaAPI(prov);
}

// Busca lista de modelos direto no endpoint local /v1/models
async function carregarModelosLocal(prov) {
  const savedUrl = lsGet(`url_${prov}`);
  const base = (savedUrl || URLS_DEFAULT_LOCAL[prov] || "").replace(/\\/+$/, "");
  if (!base) return;

  try {
    const resp = await fetch(`${base}/models`, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(4000)
    });
    if (!resp.ok) return;
    const data = await resp.json();
    const ids = (data.data || data.models || [])
      .map(m => m.id || m.name || m)
      .filter(id => typeof id === "string" && id.length > 0 &&
        !id.includes("embedding") && !id.includes("whisper"));

    if (ids.length === 0) return;
    const hardcoded = MODELOS_LOCAL[prov] || [];
    const merged = [...new Set([...ids, ...hardcoded])];
    if (selModelo) {
      const cur = selModelo.value;
      selModelo.innerHTML = merged.map(m => `<option value="${m}">${m}</option>`).join("");
      if (cur && merged.includes(cur)) selModelo.value = cur;
      else { modeloAtual = merged[0]; selModelo.value = modeloAtual; }
    }
    addAviso(`✓ ${merged.length} modelo(s) encontrado(s) no ${prov.replace("local_","")}`);
  } catch (e) {
    // silencioso — servidor pode não estar rodando
  }
}

}

async function carregarModelosDaAPI(prov) {
  const cfg    = window.AgenteDev_API_CONFIGS?.[prov];
  const apiKey = lsGet(`key_${prov}`);
  const base   = prov === "custom"
    ? (lsGet(`url_${prov}`) || "").replace(/\/chat\/completions.*/, "")
    : cfg?.base;

  if (!base || !apiKey) return;

  try {
    const params = new URLSearchParams({ base, key: apiKey });
    const resp = await fetch(`https://falling-shadow-94c.legacycelularesecomputadores.workers.dev?${params}`);
    if (!resp.ok) return;
    const data = await resp.json();
    const apiIds = (data.data || [])
      .map(m => m.id || m.name)
      .filter(id => id &&
        !id.includes("embedding") && !id.includes("tts") &&
        !id.includes("whisper")   && !id.includes("dall") &&
        !id.includes("image")     && !id.includes("video"));

    if (apiIds.length === 0) return;

    // MESCLA: hardcoded + da API, sem duplicatas
    const hardcoded = MODELOS[prov] || [];
    const merged = [...new Set([...hardcoded, ...apiIds])].sort();

    // Atualiza select com lista mesclada
    const dl = document.getElementById("modeloSugestoes");
    if (dl) dl.innerHTML = merged.map(m => `<option value="${m}">`).join("");
    if (selModelo && selModelo.tagName === "SELECT") {
      const currentVal = selModelo.value;
      selModelo.innerHTML = merged.map(m => `<option value="${m}">${m}</option>`).join("");
      if (currentVal && merged.includes(currentVal)) selModelo.value = currentVal;
    }

    // Só muda o valor selecionado se nenhum estiver salvo
    const saved = lsGet(`modelo_${prov}`);
    const current = selModelo?.value?.trim();
    if (!saved && !current) {
      modeloAtual = hardcoded[0] || merged[0];
      if (selModelo) selModelo.value = modeloAtual;
    }
  } catch {}
}

selModelo?.addEventListener("change", () => {
  modeloAtual = selModelo.value.trim();
  if (modeloAtual) lsSet(`modelo_${provedorAtual}`, modeloAtual);
});
selModelo?.addEventListener("input", () => {
  modeloAtual = selModelo.value.trim();
  if (modeloAtual) lsSet(`modelo_${provedorAtual}`, modeloAtual);
});

// ── Status ────────────────────────────────────────────────────────────────────
function atualizarStatusAPI() {
  const el = document.getElementById("status-api-nome");
  if (!el) return;
  const isLocal = provedorAtual.startsWith("local_");
  if (isLocal) {
    const url = lsGet(`url_${provedorAtual}`) || URLS_DEFAULT_LOCAL[provedorAtual];
    const nome = provedorAtual.replace("local_", "").toUpperCase();
    el.textContent = nome + (url ? " 🔗" : " ⚠");
    el.style.color = url ? "var(--green)" : "var(--amber)";
  } else {
    const key = lsGet(`key_${provedorAtual}`);
    el.textContent = provedorAtual.toUpperCase() + (key ? " ✓" : " ⚠");
    el.style.color = key ? "var(--green)" : "var(--amber)";
  }
}

// ── Medidor de contexto ───────────────────────────────────────────────────────
const CTX_LIMITS = {
  groq: 32768, gemini: 128000, openrouter: 32768,
  scitely: 32768, llmapi: 32768, puter: 32768, custom: 32768,
  local_ollama: 32768, local_lmstudio: 32768, local_llamacpp: 32768,
  local_pocketpal: 8192, local_custom: 32768,
};
let _ctxTokensAcum = 0;

function atualizarCtxMeter(tokens) {
  _ctxTokensAcum = Math.max(_ctxTokensAcum, tokens);
  const limit = CTX_LIMITS[provedorAtual] || 32768;
  const pct = Math.min(100, Math.round((_ctxTokensAcum / limit) * 100));
  const bar = document.getElementById("ctxBarInner");
  const lbl = document.getElementById("ctxPct");
  if (bar) {
    bar.style.width = pct + "%";
    bar.className = "ctx-bar-inner" + (pct >= 85 ? " danger" : pct >= 60 ? " warn" : "");
  }
  if (lbl) lbl.textContent = pct + "%";
  if (pct >= 85) addAviso("⚠️ Contexto quase cheio (" + pct + "%). Considere iniciar uma nova conversa.");
}

function resetCtxMeter() {
  _ctxTokensAcum = 0;
  const bar = document.getElementById("ctxBarInner");
  const lbl = document.getElementById("ctxPct");
  if (bar) { bar.style.width = "0%"; bar.className = "ctx-bar-inner"; }
  if (lbl) lbl.textContent = "0%";
}

function setStatus(fase, texto) {
  if (statusDot) statusDot.className = "status-dot " + (fase || "");
  if (statusTxt) statusTxt.textContent = texto || fase || "pronto";
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function _horaAgora() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function addMensagem(quem, texto, meta) {
  const row = document.createElement("div");
  row.className = `msg-row ${quem}`;
  const label = document.createElement("div");
  label.className = "msg-label";
  label.textContent = quem === "user" ? "você" : "agente";
  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.textContent = texto;
  bubble.style.cssText = "white-space:pre-wrap;word-wrap:break-word;";

  // Metadados da mensagem
  const metaEl = document.createElement("div");
  metaEl.className = "msg-meta";
  const hora = (meta && meta.hora) ? meta.hora : _horaAgora();
  let metaHtml = `<span class="msg-meta-hora">🕐 ${hora}</span>`;
  if (meta && meta.tokens)  metaHtml += `<span class="msg-meta-sep">·</span><span class="msg-meta-tokens">🔢 ${meta.tokens} tokens</span>`;
  if (meta && meta.tempo)   metaHtml += `<span class="msg-meta-sep">·</span><span class="msg-meta-tempo">⚡ ${meta.tempo}s</span>`;
  metaEl.innerHTML = metaHtml;

  row.appendChild(label);
  row.appendChild(bubble);
  row.appendChild(metaEl);
  row.appendChild(_criarBotaoCopiar(() => bubble));
  chatInner.appendChild(row);
  scrollToBottom();
  return row;
}

function addAviso(texto) {
  const el = document.createElement("div");
  el.className = "inline-aviso";
  el.textContent = texto;
  chatInner.appendChild(el);
  scrollToBottom();
}

function scrollToBottom() {
  const ca = document.getElementById("chatArea");
  setTimeout(() => { if (ca) ca.scrollTop = ca.scrollHeight; }, 0);
}

function _criarBotaoCopiar(getBubble) {
  const btn = document.createElement("button");
  btn.className = "copy-btn";
  btn.title = "Copiar";
  btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;
  btn.addEventListener("click", () => {
    navigator.clipboard.writeText(getBubble()?.textContent || "")
      .then(() => {
        btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
        setTimeout(() => {
          btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;
        }, 1800);
      }).catch(() => {});
  });
  return btn;
}

// ── Raciocínio ────────────────────────────────────────────────────────────────
let _thinkBlock = null, _thinkContentEl = null, _thinkStatusEl = null;
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
    <div class="agent-section-content"><div class="agent-section-text"></div></div>`;
  agRow.insertBefore(block, agBubble);
  _thinkBlock     = block;
  _thinkContentEl = block.querySelector(".agent-section-text");
  _thinkStatusEl  = document.getElementById(uid);
}

// ── Spinner ───────────────────────────────────────────────────────────────────
let _spinnerEl = null;
function mostrarSpinner() {
  if (_spinnerEl) return;
  const row = document.createElement("div");
  row.className = "msg-row agent";
  row.innerHTML = `<div class="msg-label">agente</div>
    <div class="spinner-bubble">
      <span class="spin-dot"></span><span class="spin-dot"></span><span class="spin-dot"></span>
    </div>`;
  chatInner.appendChild(row);
  _spinnerEl = row;
  scrollToBottom();
}
function removerSpinner() {
  if (_spinnerEl) { _spinnerEl.remove(); _spinnerEl = null; }
}

// ── ENVIAR ────────────────────────────────────────────────────────────────────
async function enviarMensagem(texto) {
  document.querySelector(".welcome-msg")?.remove();

  modeloAtual = selModelo?.value?.trim() || modeloAtual;
  if (!modeloAtual) { addAviso("⚠ Digite ou selecione um modelo."); return; }

  const apiKey = lsGet(`key_${provedorAtual}`);
  const apiUrl = provedorAtual.startsWith("local_")
    ? (lsGet(`url_${provedorAtual}`) || URLS_DEFAULT_LOCAL[provedorAtual] || "")
    : lsGet(`url_${provedorAtual}`);

  if (!apiKey && !provedorAtual.startsWith("local_") && provedorAtual !== "custom") {
    addAviso(`⚠ Cole a API Key do ${provedorAtual} acima e clique em Salvar.`);
    return;
  }
  if (provedorAtual.startsWith("local_") && !apiUrl) {
    addAviso(`⚠ Informe a URL do servidor local (ex: http://localhost:11434/v1).`);
    return;
  }

  addMensagem("user", texto, { hora: _horaAgora() });
  _registrarMensagem("user", texto);
  if (inputMsg) { inputMsg.value = ""; inputMsg.style.height = "auto"; }
  gerando = true;
  _resetThink();
  if (btnEnviar) btnEnviar.disabled = true;
  if (btnParar)  btnParar.disabled  = false;
  setStatus("pensando", "pensando…");
  mostrarSpinner();

  _llmHist.push({ role: "user", content: texto });
  if (_llmHist.length > 16) _llmHist.splice(0, _llmHist.length - 16);

  _abort = new AbortController();

  let agentRow = null, agentBubble = null, bufTxt = "";
  let _metaEl = null;
  let _inicioResposta = null;
  let _totalTokens = 0;

  function garantirBolha() {
    if (agentRow) return;
    _inicioResposta = Date.now();
    const r = document.createElement("div");
    r.className = "msg-row agent";
    const l = document.createElement("div");
    l.className = "msg-label";
    l.textContent = "agente";
    const b = document.createElement("div");
    b.className = "msg-bubble";
    b.style.cssText = "white-space:pre-wrap;word-wrap:break-word;";
    const m = document.createElement("div");
    m.className = "msg-meta";
    m.innerHTML = `<span class="msg-meta-hora">🕐 ${_horaAgora()}</span>`;
    r.appendChild(l); r.appendChild(b); r.appendChild(m); r.appendChild(_criarBotaoCopiar(() => b));
    chatInner.appendChild(r);
    agentRow = r; agentBubble = b; _metaEl = m;
  }

  const concluir = (usage) => {
    removerSpinner();
    if (bufTxt.trim()) {
      _registrarMensagem("agente", bufTxt.trim());
      _llmHist.push({ role: "assistant", content: bufTxt.trim() });
      if (_llmHist.length > 16) _llmHist.splice(0, _llmHist.length - 16);
      _salvarConversaAtual();
    }
    // Atualiza metadados finais
    if (_metaEl && _inicioResposta) {
      const tempoSeg = ((Date.now() - _inicioResposta) / 1000).toFixed(1);
      const tokens = (usage && (usage.total_tokens || usage.completion_tokens)) || _totalTokens || null;
      let metaHtml = `<span class="msg-meta-hora">🕐 ${_metaEl.querySelector(".msg-meta-hora")?.textContent?.replace("🕐 ","") || _horaAgora()}</span>`;
      metaHtml += `<span class="msg-meta-sep">·</span><span class="msg-meta-tempo">⚡ ${tempoSeg}s</span>`;
      if (tokens) metaHtml += `<span class="msg-meta-sep">·</span><span class="msg-meta-tokens">🔢 ${tokens} tokens</span>`;
      _metaEl.innerHTML = metaHtml;

      // Atualiza medidor de contexto
      if (tokens) atualizarCtxMeter(tokens);
    }
    setStatus("pronto", "pronto");
    gerando = false;
    if (btnEnviar) btnEnviar.disabled = false;
    if (btnParar)  btnParar.disabled  = true;
  };

  try {
    await window.AgenteDev.runAgent({
      pergunta:     texto,
      fonte:        provedorAtual,
      modelo:       modeloAtual,
      apiKey,
      apiUrlCustom: apiUrl,
      historico:    _llmHist.slice(0, -1),
      projetoNome:  _projetoNome,
      vfs:          _virtualFS,
      todos:        _todos,
      signal:       _abort.signal,

      onToken(t) {
        removerSpinner(); setStatus("respondendo", "respondendo…");
        garantirBolha(); bufTxt += t; agentBubble.textContent = bufTxt; scrollToBottom();
      },
      onThinkStart() {
        removerSpinner(); setStatus("pensando", "raciocinando…");
        garantirBolha(); _getOrCreateThinkBlock(agentRow, agentBubble);
        if (_thinkStatusEl) _thinkStatusEl.classList.add("live");
      },
      onThinkToken(t) {
        if (_thinkContentEl) { _thinkContentEl.textContent += t; scrollToBottom(); }
      },
      onThinkDone() {
        if (_thinkStatusEl) { _thinkStatusEl.classList.remove("live"); _thinkStatusEl.textContent = "ver"; }
        if (_thinkBlock) _thinkBlock.classList.add("collapsed");
      },
      onToolStart(nome, id) {
        removerSpinner(); garantirBolha();
        const ti = document.createElement("div");
        ti.className = "tool-indicator";
        ti.dataset.toolId = id || "";
        ti.innerHTML = `<span class="tool-spin">⟳</span><span class="tool-nome">${nome}</span><span class="tool-status">executando…</span>`;
        agentRow.insertBefore(ti, agentBubble);
      },
      onToolEnd(nome, id, resultado) {
        const el = agentRow?.querySelector(`.tool-indicator[data-tool-id="${id}"]`)
          || agentRow?.querySelector(".tool-indicator:last-of-type");
        if (el) {
          el.querySelector(".tool-spin").textContent   = "✓";
          el.querySelector(".tool-status").textContent = resultado?.split("\n")[0]?.slice(0, 60) || "ok";
          el.classList.add("done");
        }
        if (["escrever_arquivo","criar_estrutura_projeto","verificar_arquivo"].includes(nome)) {
          renderVirtualFS();
        }
      },
      onArquivosCriados(arquivos, vfsAtual) {
        Object.assign(_virtualFS, vfsAtual);
        renderVirtualFS();
        _arquivosFlat = Object.keys(_virtualFS).map(cam => ({
          nome: cam.split("/").pop(), caminho: cam,
          ext:  cam.includes(".") ? cam.split(".").pop().toLowerCase() : ""
        }));
        garantirBolha();
        const card = document.createElement("div");
        card.className = "arquivos-card";
        const titulo = document.createElement("div");
        titulo.className = "arquivos-card-titulo";
        titulo.textContent = `✓ ${arquivos.length} arquivo(s) criado(s)`;
        card.appendChild(titulo);
        arquivos.forEach(arq => {
          const item = document.createElement("div");
          item.className = "arquivos-card-item";
          item.style.cursor = "pointer";
          item.innerHTML = `<span class="arq-icon">📄</span><span class="arq-nome">${arq.split("/").pop()}</span><span class="arq-path">${arq}</span>`;
          item.addEventListener("click", () => abrirNoEditor(arq, arq.split("/").pop()));
          card.appendChild(item);
        });
        const btnDl = document.createElement("button");
        btnDl.style.cssText = "margin-top:8px;padding:5px 14px;border-radius:6px;background:var(--accent);color:#fff;border:none;cursor:pointer;font-size:11px;";
        btnDl.textContent = "⬇ Baixar ZIP";
        btnDl.addEventListener("click", downloadZip);
        card.appendChild(btnDl);
        agentRow.insertBefore(card, agentBubble);
      },
      onStatus(fase) { setStatus(fase, fase + "…"); },
      onAviso(msg)   { removerSpinner(); addAviso(msg); },
      onFim:  (usage) => concluir(usage),
      onErro(msg) { removerSpinner(); addAviso("❌ " + msg); concluir(); },
    });
  } catch (e) {
    removerSpinner();
    if (e.name !== "AbortError") addAviso("❌ " + e.message);
    concluir();
  }
}

btnEnviar?.addEventListener("click", () => {
  const txt = inputMsg?.value.trim();
  if (txt && !gerando) {
    const ctx = typeof montarContextoRefs === "function" ? montarContextoRefs() : "";
    if (ctx && typeof _refs !== "undefined") { _refs = []; renderRefs(); }
    enviarMensagem(ctx ? txt + ctx : txt);
  }
});

inputMsg?.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey && !gerando) {
    if (typeof _acAtivo !== "undefined" && _acAtivo) return;
    e.preventDefault();
    const txt = inputMsg.value.trim();
    if (txt) {
      const ctx = typeof montarContextoRefs === "function" ? montarContextoRefs() : "";
      if (ctx && typeof _refs !== "undefined") { _refs = []; renderRefs(); }
      enviarMensagem(ctx ? txt + ctx : txt);
    }
  }
});

inputMsg?.addEventListener("input", () => {
  if (inputMsg) { inputMsg.style.height = "auto"; inputMsg.style.height = inputMsg.scrollHeight + "px"; }
});

btnParar?.addEventListener("click", () => {
  _abort?.abort();
  gerando = false;
  if (btnEnviar) btnEnviar.disabled = false;
  if (btnParar)  btnParar.disabled  = true;
  setStatus("pronto", "pronto");
  addAviso("⏹ Interrompido.");
});

// ── Modo agente ───────────────────────────────────────────────────────────────
function setModoAgente(modo) {
  document.querySelectorAll("#segModo .seg-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.modo === modo));
  lsSet("modo_agente", modo);
}
document.querySelectorAll("#segModo .seg-btn").forEach(btn =>
  btn.addEventListener("click", () => setModoAgente(btn.dataset.modo)));

// ── Projeto ───────────────────────────────────────────────────────────────────
document.getElementById("btnProjeto")?.addEventListener("click", () => {
  const novo = prompt("Nome do projeto:", _projetoNome);
  if (novo?.trim()) {
    _projetoNome = novo.trim();
    lsSet("projeto_nome", _projetoNome);
    const el = document.getElementById("projetoNome");
    if (el) el.textContent = _projetoNome;
    addAviso(`📁 Projeto: ${_projetoNome}`);
  }
});

document.getElementById("btnLimpar")?.addEventListener("click", () => {
  _salvarConversaAtual(); _llmHist = [];
  _iniciarNovaConversa();
  resetCtxMeter();
  chatInner.innerHTML = `<div class="welcome-msg"><div class="welcome-icon">⬡</div><p>Nova conversa.</p></div>`;
  renderizarConvSidebar();
});

// ══════════════════════════════════════════════════════════════════════════════
// HISTÓRICO
// ══════════════════════════════════════════════════════════════════════════════
const HIST_KEY  = "agente_dev_conversas";
const MAX_CONV  = 100;
let _conversaAtual      = null;
let _convSidebarAberta  = true;

const _carregarConversas = () => {
  try { return JSON.parse(_store.getItem(HIST_KEY) || "[]"); } catch { return []; }
};
const _salvarConversas = (l) => {
  try { _store.setItem(HIST_KEY, JSON.stringify(l)); } catch {}
};
const _gerarId = () => "c" + Date.now() + Math.random().toString(36).slice(2,6);

function _iniciarNovaConversa() {
  _conversaAtual = { id: _gerarId(), titulo: "", data: new Date().toISOString(),
    provedor: provedorAtual, modelo: modeloAtual, mensagens: [] };
}

function _registrarMensagem(quem, texto) {
  if (!texto?.trim()) return;
  if (!_conversaAtual) _iniciarNovaConversa();
  if (!_conversaAtual.titulo && quem === "user")
    _conversaAtual.titulo = texto.slice(0, 70) + (texto.length > 70 ? "…" : "");
  _conversaAtual.mensagens.push({ quem, texto: texto.trim(), ts: Date.now() });
}

function _salvarConversaAtual() {
  if (!_conversaAtual || _conversaAtual.mensagens.length < 2) return;
  const lista = _carregarConversas();
  const idx   = lista.findIndex(c => c.id === _conversaAtual.id);
  if (idx >= 0) lista[idx] = _conversaAtual;
  else { lista.unshift(_conversaAtual); if (lista.length > MAX_CONV) lista.splice(MAX_CONV); }
  _salvarConversas(lista);
  renderizarConvSidebar();
}

function _carregarConversaNoChat(conv) {
  _salvarConversaAtual();
  _conversaAtual = JSON.parse(JSON.stringify(conv));
  _llmHist = conv.mensagens.map(m => ({ role: m.quem === "user" ? "user" : "assistant", content: m.texto }));
  chatInner.innerHTML = "";
  for (const msg of conv.mensagens) addMensagem(msg.quem, msg.texto);
  renderizarConvSidebar();
  addAviso(`📂 "${conv.titulo || "conversa"}" carregada`);
}

function _agrupar(lista) {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const ontem = new Date(hoje); ontem.setDate(ontem.getDate()-1);
  const semana = new Date(hoje); semana.setDate(semana.getDate()-7);
  const g = { "Hoje":[], "Ontem":[], "Últimos 7 dias":[], "Mais antigas":[] };
  for (const c of lista) {
    const d = new Date(c.data); d.setHours(0,0,0,0);
    if      (d >= hoje)   g["Hoje"].push(c);
    else if (d >= ontem)  g["Ontem"].push(c);
    else if (d >= semana) g["Últimos 7 dias"].push(c);
    else                  g["Mais antigas"].push(c);
  }
  return g;
}

function renderizarConvSidebar() {
  const container = document.getElementById("convLista");
  if (!container) return;
  const lista = _carregarConversas();
  if (!lista.length) {
    container.innerHTML = `<div class="conv-lista-vazio">Nenhuma conversa ainda.</div>`;
    return;
  }
  container.innerHTML = "";
  for (const [label, convs] of Object.entries(_agrupar(lista))) {
    if (!convs.length) continue;
    const grp = document.createElement("div");
    grp.className = "conv-grupo-label"; grp.textContent = label;
    container.appendChild(grp);
    for (const conv of convs) {
      const isAtual = _conversaAtual?.id === conv.id;
      const item = document.createElement("div");
      item.className = "conv-item" + (isAtual ? " ativa" : "");
      const hora   = new Date(conv.data).toLocaleTimeString("pt-BR", {hour:"2-digit",minute:"2-digit"});
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
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div>`;
      item.querySelector(".conv-item-texto").addEventListener("click", () => _carregarConversaNoChat(conv));
      item.querySelector(".exp").addEventListener("click", e => { e.stopPropagation(); _exportarConversa(conv); });
      item.querySelector(".del").addEventListener("click", e => {
        e.stopPropagation();
        _salvarConversas(_carregarConversas().filter(c => c.id !== conv.id));
        item.style.cssText = "opacity:0;transform:translateX(-8px);transition:.18s";
        setTimeout(() => renderizarConvSidebar(), 200);
      });
      container.appendChild(item);
    }
  }
}

function _exportarConversa(conv) {
  const data = new Date(conv.data).toLocaleString("pt-BR");
  const linhas = [`# ${conv.titulo || "Conversa"}\n\n**Data:** ${data}  \n**Modelo:** ${conv.provedor}/${conv.modelo}\n\n---\n`];
  for (const msg of conv.mensagens) {
    const ts = msg.ts ? new Date(msg.ts).toLocaleTimeString("pt-BR", {hour:"2-digit",minute:"2-digit"}) : "";
    linhas.push(msg.quem === "user" ? `### 👤 Você _(${ts})_` : `### 🤖 Agente _(${ts})_`);
    linhas.push("", msg.texto, "\n---\n");
  }
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([linhas.join("\n")], { type: "text/markdown;charset=utf-8" })),
    download: `agente_${(conv.titulo||"conversa").slice(0,40).replace(/[^\w]/g,"_")}.md`
  });
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function toggleConvSidebar() {
  const sb = document.getElementById("convSidebar");
  if (!sb) return;
  _convSidebarAberta = !_convSidebarAberta;
  sb.classList.toggle("collapsed", !_convSidebarAberta);
  lsSet("conv_sidebar_aberta", _convSidebarAberta ? "1" : "0");
}
document.getElementById("btnToggleConvSidebar")?.addEventListener("click", toggleConvSidebar);
document.getElementById("btnTopbarMenu")?.addEventListener("click", toggleConvSidebar);

document.getElementById("btnNovaConversa")?.addEventListener("click", () => {
  _salvarConversaAtual(); _llmHist = [];
  _iniciarNovaConversa();
  chatInner.innerHTML = `<div class="welcome-msg"><div class="welcome-icon">⬡</div><p>Nova conversa.</p></div>`;
  renderizarConvSidebar();
});

document.getElementById("btnConvLimparTudo")?.addEventListener("click", () => {
  if (confirm("Apagar TODAS as conversas?")) { _salvarConversas([]); renderizarConvSidebar(); }
});

// ══════════════════════════════════════════════════════════════════════════════
// DOWNLOAD ZIP
// ══════════════════════════════════════════════════════════════════════════════
async function downloadZip() {
  const arqs = Object.entries(_virtualFS);
  if (!arqs.length) { addAviso("⚠ Nenhum arquivo para baixar."); return; }

  if (window.JSZip) {
    const zip   = new JSZip();
    const pasta = zip.folder(_projetoNome || "projeto");
    for (const [cam, cont] of arqs) pasta.file(cam, cont);
    const blob = await zip.generateAsync({ type: "blob" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: (_projetoNome || "projeto").replace(/[^a-z0-9_-]/gi, "_") + ".zip"
    });
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  } else {
    const txt = arqs.map(([cam, cont]) => `// ===== ${cam} =====\n${cont}`).join("\n\n\n");
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([txt], { type: "text/plain" })),
      download: (_projetoNome || "projeto") + "-arquivos.txt"
    });
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// VIRTUAL FS EXPLORER
// ══════════════════════════════════════════════════════════════════════════════
const sidebar     = document.getElementById("sidebar");
const btnExplorer = document.getElementById("btnExplorer");
const sidebarTree = document.getElementById("sidebarTree");
let _arquivosFlat = [];

function iconePorExt(nome) {
  const ext = nome.includes(".") ? nome.split(".").pop().toLowerCase() : "";
  return { html:"🌐",css:"🎨",js:"🟨",ts:"🔷",jsx:"⚛️",py:"🐍",json:"📋",md:"📝",svg:"🖼️" }[ext] || "📄";
}

function toggleSidebar(force) {
  if (!sidebar) return;
  const abrir = force !== undefined ? force : sidebar.classList.contains("collapsed");
  sidebar.classList.toggle("collapsed", !abrir);
  if (btnExplorer) btnExplorer.classList.toggle("active", abrir);
  if (abrir) renderVirtualFS();
}
btnExplorer?.addEventListener("click", () => toggleSidebar());
document.getElementById("btnSidebarRefresh")?.addEventListener("click", renderVirtualFS);

function renderVirtualFS() {
  if (!sidebarTree) return;
  sidebarTree.innerHTML = "";
  const arqs = Object.keys(_virtualFS);

  const hdr = document.createElement("div");
  hdr.style.cssText = "padding:8px 10px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:6px;";
  hdr.innerHTML = `<span style="font-size:10px;color:var(--text2);flex:1;font-family:var(--font-mono);">${arqs.length} arquivo(s)</span>`;
  if (arqs.length > 0) {
    const bd = document.createElement("button");
    bd.style.cssText = "background:var(--accent);color:#fff;border:none;border-radius:4px;padding:2px 8px;font-size:10px;cursor:pointer;";
    bd.textContent = "⬇ ZIP";
    bd.addEventListener("click", downloadZip);
    hdr.appendChild(bd);
  }
  sidebarTree.appendChild(hdr);

  if (!arqs.length) {
    const empty = document.createElement("div");
    empty.innerHTML = `<div style="text-align:center;padding:20px 10px;font-size:11px;color:var(--text2);">Nenhum arquivo criado.<br>Os arquivos do agente aparecerão aqui.</div>`;
    sidebarTree.appendChild(empty);
    return;
  }

  // Monta árvore
  const tree = {};
  for (const cam of arqs) {
    const parts = cam.split("/");
    let node = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node[parts[i]]) node[parts[i]] = { _dir: true };
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = cam;
  }

  function renderNode(node, depth = 0) {
    const frag = document.createDocumentFragment();
    for (const [nome, val] of Object.entries(node)) {
      if (nome === "_dir") continue;
      if (typeof val === "object") {
        const wrap = document.createElement("div");
        wrap.className = "tree-dir open";
        const row = document.createElement("div");
        row.className = "tree-item";
        row.style.paddingLeft = `${8 + depth * 14}px`;
        row.innerHTML = `<span class="tree-dir-toggle">▾</span><span class="tree-item-icon">📁</span><span class="tree-item-name">${nome}</span>`;
        row.addEventListener("click", () => wrap.classList.toggle("open"));
        const ch = document.createElement("div");
        ch.className = "tree-dir-children";
        ch.appendChild(renderNode(val, depth + 1));
        wrap.appendChild(row); wrap.appendChild(ch);
        frag.appendChild(wrap);
      } else {
        const cam = val;
        const row = document.createElement("div");
        row.className = "tree-item";
        row.style.paddingLeft = `${8 + depth * 14}px`;
        row.innerHTML = `<span class="tree-item-icon">${iconePorExt(nome)}</span>
          <span class="tree-item-name" title="${cam}">${nome}</span>
          <span class="tree-item-ref" title="Referenciar no chat">@</span>`;
        row.addEventListener("click", e => {
          if (e.target.classList.contains("tree-item-ref")) return;
          document.querySelectorAll(".tree-item.active").forEach(el => el.classList.remove("active"));
          row.classList.add("active");
          abrirNoEditor(cam, nome);
        });
        row.querySelector(".tree-item-ref").addEventListener("click", e => {
          e.stopPropagation(); adicionarReferencia(cam, nome);
        });
        frag.appendChild(row);
      }
    }
    return frag;
  }

  sidebarTree.appendChild(renderNode(tree));
  _arquivosFlat = arqs.map(cam => ({
    nome: cam.split("/").pop(), caminho: cam,
    ext:  cam.includes(".") ? cam.split(".").pop().toLowerCase() : ""
  }));
}

// ══════════════════════════════════════════════════════════════════════════════
// EDITOR
// ══════════════════════════════════════════════════════════════════════════════
const editorPanel     = document.getElementById("editorPanel");
const editorTabs      = document.getElementById("editorTabs");
const editorTextarea  = document.getElementById("editorTextarea");
const editorHighlight = document.getElementById("editorHighlight");
const editorHighCode  = document.getElementById("editorHighlightCode");
const editorGutter    = document.getElementById("editorGutter");
const editorPath      = document.getElementById("editorPath");
const editorStatus    = document.getElementById("editorStatus");
const btnEditorSave   = document.getElementById("btnEditorSave");
const btnEditorClose  = document.getElementById("btnEditorClose");

const EXT_LANG = { js:"javascript",jsx:"jsx",ts:"typescript",py:"python",html:"html",css:"css",
  json:"json",md:"markdown",sh:"bash",rs:"rust",go:"go",java:"java",cpp:"cpp",php:"php",
  yaml:"yaml",yml:"yaml",toml:"toml",sql:"sql",xml:"xml" };

const extParaLang = nome =>
  EXT_LANG[nome.includes(".") ? nome.split(".").pop().toLowerCase() : ""] || "plaintext";

function atualizarHighlight(cont, lang) {
  if (!editorHighCode) return;
  const txt = cont.endsWith("\n") ? cont + " " : cont;
  if (lang !== "plaintext" && window.Prism?.languages?.[lang])
    editorHighCode.innerHTML = Prism.highlight(txt, Prism.languages[lang], lang);
  else editorHighCode.textContent = txt;
  if (editorHighlight) editorHighlight.className = `editor-highlight language-${lang}`;
  if (editorGutter) {
    const n = cont.split("\n").length;
    editorGutter.innerHTML = Array.from({ length: n }, (_, i) => `<span>${i+1}</span>`).join("");
  }
}

let _tabs = [], _tabAtual = null;

function abrirNoEditor(cam, nome) {
  const ex = _tabs.find(t => t.caminho === cam);
  if (ex) { ativarTab(cam); return; }
  const cont = _virtualFS[cam] || "";
  _tabs.push({ nome, caminho: cam, conteudo: cont, conteudoOrig: cont, dirty: false });
  renderTabs(); ativarTab(cam);
  if (editorPanel) editorPanel.classList.add("open");
}

function ativarTab(cam) {
  if (_tabAtual) { const ct = _tabs.find(t=>t.caminho===_tabAtual); if (ct) ct.conteudo = editorTextarea?.value || ct.conteudo; }
  _tabAtual = cam;
  const tab = _tabs.find(t=>t.caminho===cam); if (!tab) return;
  const lang = extParaLang(tab.nome);
  if (editorTextarea) editorTextarea.value = tab.conteudo;
  if (editorPath)   editorPath.textContent = tab.caminho;
  if (editorStatus) editorStatus.textContent = `${tab.conteudo.split("\n").length} linhas · ${lang}`;
  setTimeout(() => {
    atualizarHighlight(tab.conteudo, lang);
    if (lang !== "plaintext" && window.Prism && !Prism.languages?.[lang] && Prism.plugins?.autoloader)
      Prism.plugins.autoloader.loadLanguages([lang], () => atualizarHighlight(tab.conteudo, lang));
  }, 0);
  renderTabs();
}

function renderTabs() {
  if (!editorTabs) return;
  editorTabs.innerHTML = "";
  _tabs.forEach(tab => {
    const el = document.createElement("div");
    el.className = `editor-tab${tab.caminho===_tabAtual?" active":""}${tab.dirty?" dirty":""}`;
    el.innerHTML = `<span class="editor-tab-name">${tab.nome}</span><span class="editor-tab-close">×</span>`;
    el.addEventListener("click", e => e.target.classList.contains("editor-tab-close") ? fecharTab(tab.caminho) : ativarTab(tab.caminho));
    editorTabs.appendChild(el);
  });
}

function fecharTab(cam) {
  _tabs = _tabs.filter(t=>t.caminho!==cam);
  if (!_tabs.length) {
    if (editorPanel) editorPanel.classList.remove("open");
    _tabAtual = null;
    if (editorTabs)    editorTabs.innerHTML = "";
    if (editorTextarea) editorTextarea.value = "";
    return;
  }
  if (_tabAtual === cam) ativarTab(_tabs[0].caminho); else renderTabs();
}

editorTextarea?.addEventListener("input", () => {
  const tab = _tabs.find(t=>t.caminho===_tabAtual); if (!tab) return;
  tab.dirty = tab.conteudoOrig !== editorTextarea.value;
  tab.conteudo = editorTextarea.value;
  if (editorStatus) editorStatus.textContent = `${editorTextarea.value.split("\n").length} linhas${tab.dirty?" · não salvo":""} · ${extParaLang(tab.nome)}`;
  atualizarHighlight(tab.conteudo, extParaLang(tab.nome));
  renderTabs();
});

editorTextarea?.addEventListener("scroll", () => {
  if (editorHighlight) { editorHighlight.scrollTop = editorTextarea.scrollTop; editorHighlight.scrollLeft = editorTextarea.scrollLeft; }
  if (editorGutter)    editorGutter.scrollTop = editorTextarea.scrollTop;
});

editorTextarea?.addEventListener("keydown", e => {
  if ((e.ctrlKey||e.metaKey) && e.key==="s") { e.preventDefault(); salvarEditor(); }
  if (e.key==="Tab") {
    e.preventDefault();
    const s = editorTextarea.selectionStart;
    editorTextarea.value = editorTextarea.value.slice(0,s) + "  " + editorTextarea.value.slice(editorTextarea.selectionEnd);
    editorTextarea.selectionStart = editorTextarea.selectionEnd = s + 2;
  }
});

function salvarEditor() {
  const tab = _tabs.find(t=>t.caminho===_tabAtual); if (!tab) return;
  _virtualFS[tab.caminho] = editorTextarea?.value || "";
  tab.conteudoOrig = editorTextarea?.value || ""; tab.dirty = false;
  if (editorStatus) editorStatus.textContent = `✓ Salvo · ${(editorTextarea?.value||"").split("\n").length} linhas`;
  if (btnEditorSave) {
    btnEditorSave.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> salvo`;
    btnEditorSave.classList.add("saved");
    setTimeout(() => {
      btnEditorSave.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg> salvar`;
      btnEditorSave.classList.remove("saved");
    }, 2500);
  }
  renderTabs(); renderVirtualFS();
}

btnEditorSave?.addEventListener("click", salvarEditor);
btnEditorClose?.addEventListener("click", () => {
  if (editorPanel) editorPanel.classList.remove("open");
  _tabs = []; _tabAtual = null;
});

// ══════════════════════════════════════════════════════════════════════════════
// REFERÊNCIAS @ NO CHAT
// ══════════════════════════════════════════════════════════════════════════════
const refsBar          = document.getElementById("refsBar");
const fileAutocomplete = document.getElementById("fileAutocomplete");
let _refs = [], _acAtivo = false, _acSel = -1;

function adicionarReferencia(cam, nome) {
  if (_refs.find(r=>r.caminho===cam)) return;
  _refs.push({ nome, caminho: cam, conteudo: _virtualFS[cam] || "(vazio)" });
  renderRefs(); addAviso(`📎 @${nome} referenciado`);
}
function removerReferencia(cam) { _refs = _refs.filter(r=>r.caminho!==cam); renderRefs(); }
function renderRefs() {
  if (!refsBar) return;
  refsBar.innerHTML = _refs.map(r =>
    `<div class="ref-chip"><span>📎 @${r.nome}</span><span class="ref-chip-remove" data-cam="${r.caminho}">×</span></div>`
  ).join("");
  refsBar.querySelectorAll(".ref-chip-remove").forEach(el =>
    el.addEventListener("click", () => removerReferencia(el.dataset.cam)));
}
function montarContextoRefs() {
  if (!_refs.length) return "";
  return "\n\n---\n" + _refs.map(r =>
    `📎 Arquivo: ${r.nome} (${r.caminho})\n\`\`\`\n${r.conteudo.slice(0, 8000)}\n\`\`\``
  ).join("\n\n---\n");
}

inputMsg?.addEventListener("input", () => {
  const before = inputMsg.value.slice(0, inputMsg.selectionStart);
  const match  = before.match(/@(\w*)$/);
  if (match) { _acAtivo = true; renderAC(match[1].toLowerCase()); }
  else fecharAC();
});
inputMsg?.addEventListener("keydown", e => {
  if (!_acAtivo) return;
  const items = fileAutocomplete?.querySelectorAll(".file-ac-item") || [];
  if      (e.key === "ArrowDown")  { e.preventDefault(); _acSel=Math.min(_acSel+1,items.length-1); items.forEach((el,i)=>el.classList.toggle("selected",i===_acSel)); }
  else if (e.key === "ArrowUp")    { e.preventDefault(); _acSel=Math.max(_acSel-1,0); items.forEach((el,i)=>el.classList.toggle("selected",i===_acSel)); }
  else if (e.key==="Enter"||e.key==="Tab") { const s=fileAutocomplete?.querySelector(".selected"); if(s){e.preventDefault();selAC(s.dataset.cam,s.dataset.nome);} }
  else if (e.key === "Escape") fecharAC();
});

function renderAC(q) {
  const f = (q ? _arquivosFlat.filter(f=>f.nome.toLowerCase().includes(q)) : _arquivosFlat).slice(0,12);
  if (!f.length || !fileAutocomplete) { fecharAC(); return; }
  fileAutocomplete.innerHTML = f.map((f,i) =>
    `<div class="file-ac-item${i===0?" selected":""}" data-cam="${f.caminho}" data-nome="${f.nome}">
      <span>${iconePorExt(f.nome)}</span>
      <span class="file-ac-name">${f.nome}</span>
      <span class="file-ac-path">${f.caminho}</span>
    </div>`).join("");
  _acSel = 0;
  fileAutocomplete.classList.add("visible"); fileAutocomplete.style.display = "block";
  fileAutocomplete.querySelectorAll(".file-ac-item").forEach(el => {
    el.addEventListener("click", () => selAC(el.dataset.cam, el.dataset.nome));
    el.addEventListener("mouseenter", () => { fileAutocomplete.querySelectorAll(".file-ac-item").forEach(e=>e.classList.remove("selected")); el.classList.add("selected"); });
  });
}
function selAC(cam, nome) {
  if (!inputMsg) return;
  const before = inputMsg.value.slice(0, inputMsg.selectionStart);
  inputMsg.value = before.replace(/@\w*$/, "") + inputMsg.value.slice(inputMsg.selectionStart);
  fecharAC(); adicionarReferencia(cam, nome); inputMsg.focus();
}
function fecharAC() {
  _acAtivo = false; _acSel = -1;
  if (fileAutocomplete) { fileAutocomplete.classList.remove("visible"); fileAutocomplete.style.display = "none"; fileAutocomplete.innerHTML = ""; }
}
document.addEventListener("click", e => { if (fileAutocomplete && !fileAutocomplete.contains(e.target) && e.target !== inputMsg) fecharAC(); });

// ══════════════════════════════════════════════════════════════════════════════
// CHAVES NOMEADAS
// ══════════════════════════════════════════════════════════════════════════════
const _keysKey = prov => `agente_dev_named_keys_${prov}`;
const getChavesNomeadas = prov => {
  try { return JSON.parse(_store.getItem(_keysKey(prov)) || "[]"); } catch { return []; }
};
const salvarChaveNomeada = (prov, nome, key, url) => {
  const lista = getChavesNomeadas(prov);
  const idx   = lista.findIndex(k=>k.nome===nome);
  const item  = { nome, key, url: url||"" };
  if (idx>=0) lista[idx]=item; else lista.push(item);
  _store.setItem(_keysKey(prov), JSON.stringify(lista));
};

function renderChavesSalvas(prov) {
  const container = document.getElementById("credsSavedKeys");
  const sel       = document.getElementById("selSavedKey");
  if (!container || !sel) return;
  const lista = getChavesNomeadas(prov);
  container.style.display = lista.length ? "flex" : "none";
  sel.innerHTML = `<option value="">— selecionar —</option>` +
    lista.map(k => `<option value="${k.nome}">${k.nome}</option>`).join("");
}

document.getElementById("selSavedKey")?.addEventListener("change", () => {
  const sel  = document.getElementById("selSavedKey");
  const btnD = document.getElementById("btnDeletarKey");
  const item = getChavesNomeadas(provedorAtual).find(k=>k.nome===sel.value);
  if (!item) { if (btnD) btnD.style.display="none"; return; }
  if (inputApiKey) inputApiKey.value = item.key;
  if (item.url && inputApiUrl) inputApiUrl.value = item.url;
  lsSet(`key_${provedorAtual}`, item.key);
  if (item.url) lsSet(`url_${provedorAtual}`, item.url);
  if (btnD) btnD.style.display = "flex";
  addAviso(`✓ Chave "${item.nome}" carregada`);
  atualizarStatusAPI();
  carregarModelosDaAPI(provedorAtual);
});

document.getElementById("btnDeletarKey")?.addEventListener("click", () => {
  const sel = document.getElementById("selSavedKey");
  if (!sel?.value) return;
  const lista = getChavesNomeadas(provedorAtual).filter(k=>k.nome!==sel.value);
  _store.setItem(_keysKey(provedorAtual), JSON.stringify(lista));
  renderChavesSalvas(provedorAtual);
  addAviso("✓ Chave removida");
  const btnD = document.getElementById("btnDeletarKey");
  if (btnD) btnD.style.display = "none";
});

// ══════════════════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  // Badge de status da API
  const pill = document.querySelector(".status-pill");
  if (pill?.parentElement) {
    const badge = document.createElement("div");
    badge.id = "status-api-nome";
    badge.style.cssText = "font-size:10px;font-family:var(--font-mono);color:var(--text2);padding:0 8px;border-left:1px solid var(--border);margin-left:4px;";
    pill.parentElement.appendChild(badge);
  }

  initProvedor();
  setStatus("pronto", "pronto");
  setModoAgente(lsGet("modo_agente") || "agente");

  const pnEl = document.getElementById("projetoNome");
  if (pnEl) pnEl.textContent = _projetoNome;
  const ppEl = document.getElementById("projetoPath");
  if (ppEl) ppEl.textContent = "(virtual)";

  _convSidebarAberta = lsGet("conv_sidebar_aberta") !== "0";
  const sb = document.getElementById("convSidebar");
  if (sb && !_convSidebarAberta) sb.classList.add("collapsed");

  _iniciarNovaConversa();
  renderizarConvSidebar();
  renderVirtualFS();
});
