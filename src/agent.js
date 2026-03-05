(function() {
// agent.js — Lógica do agente. Todas as chamadas passam pelo proxy /.netlify/functions/proxy.

const API_CONFIGS = {
  groq: {
    base: "https://api.groq.com/openai/v1",
    url:  "https://api.groq.com/openai/v1/chat/completions",
    headers: (key) => ({ "Authorization": "Bearer " + key })
  },
  gemini: {
    base: "https://generativelanguage.googleapis.com/v1beta/openai",
    url:  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    headers: (key) => ({ "Authorization": "Bearer " + key })
  },
  openrouter: {
    base: "https://openrouter.ai/api/v1",
    url:  "https://openrouter.ai/api/v1/chat/completions",
    headers: (key) => ({
      "Authorization": "Bearer " + key,
      "HTTP-Referer": typeof location !== "undefined" ? location.origin : "",
      "X-Title": "Agente Dev"
    })
  },
  scitely: {
    base: "https://api.scitely.com/v1",
    url:  "https://api.scitely.com/v1/chat/completions",
    headers: (key) => ({ "Authorization": "Bearer " + key, "X-Title": "Agente Dev" })
  },
  llmapi: {
    base: "https://internal.llmapi.ai/v1",
    url:  "https://internal.llmapi.ai/v1/chat/completions",
    headers: (key) => ({ "Authorization": "Bearer " + key, "X-Title": "Agente Dev" })
  },
  puter: {
    base: "https://api.puter.com/puterai/openai/v1",
    url:  "https://api.puter.com/puterai/openai/v1/chat/completions",
    headers: (key) => ({ "Authorization": "Bearer " + key, "X-Title": "Agente Dev" })
  },
  custom: {
    base: null,
    url:  null,
    headers: (key) => ({ "Authorization": "Bearer " + (key || "sk-no-key") })
  }
};

window.AgenteDev_API_CONFIGS = API_CONFIGS;

// ── Tools ──────────────────────────────────────────────────────────────────────
const TOOLS = [
  {
    type: "function",
    function: {
      name: "pensar",
      description: "Use ANTES de tarefas complexas. Estrutura raciocínio e define plano.",
      parameters: {
        type: "object",
        properties: {
          objetivo:    { type: "string" },
          contexto:    { type: "string" },
          plano:       { type: "string" },
          verificacao: { type: "string" }
        },
        required: ["objetivo", "contexto", "plano", "verificacao"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "criar_todo",
      description: "Cria lista de tarefas para projetos com 3+ passos.",
      parameters: {
        type: "object",
        properties: {
          tarefas: { type: "string", description: "Tarefas separadas por '|'" }
        },
        required: ["tarefas"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "marcar_todo",
      description: "Marca tarefa como concluída.",
      parameters: {
        type: "object",
        properties: {
          indice:    { type: "integer" },
          resultado: { type: "string" }
        },
        required: ["indice", "resultado"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "listar_arquivos",
      description: "Lista arquivos do projeto virtual. Use sempre antes de criar arquivos.",
      parameters: {
        type: "object",
        properties: { caminho: { type: "string" } },
        required: ["caminho"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "ler_arquivo",
      description: "Lê conteúdo de um arquivo do projeto virtual.",
      parameters: {
        type: "object",
        properties: { caminho: { type: "string" } },
        required: ["caminho"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "escrever_arquivo",
      description: "Cria ou sobrescreve arquivo com conteúdo COMPLETO. Nunca use placeholders.",
      parameters: {
        type: "object",
        properties: {
          caminho:  { type: "string" },
          conteudo: { type: "string" }
        },
        required: ["caminho", "conteudo"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "criar_estrutura_projeto",
      description: "Cria múltiplos arquivos de uma vez.",
      parameters: {
        type: "object",
        properties: {
          caminho_base: { type: "string" },
          estrutura:    { type: "string", description: "'arquivo.ext::conteudo|||outro.ext::conteudo'" }
        },
        required: ["caminho_base", "estrutura"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "verificar_arquivo",
      description: "Verifica se arquivo existe e tem o conteúdo esperado.",
      parameters: {
        type: "object",
        properties: {
          caminho:     { type: "string" },
          deve_conter: { type: "string" }
        },
        required: ["caminho", "deve_conter"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "usar_template",
      description: "Retorna estrutura recomendada para um tipo de projeto.",
      parameters: {
        type: "object",
        properties: {
          tipo: { type: "string", description: "jogo | site | app | crud | react | mobile" }
        },
        required: ["tipo"]
      }
    }
  }
];

// ── Executar tool ──────────────────────────────────────────────────────────────
function norm(p) { return (p || "").replace(/^\/+/, "").replace(/^\.\//, "").trim(); }

function executarTool(nome, args, state) {
  const { vfs, todos } = state;

  switch (nome) {
    case "pensar":
      return `✅ PLANO\nObjetivo: ${args.objetivo}\nContexto: ${args.contexto}\nPassos:\n${args.plano}\nVerificação: ${args.verificacao}`;

    case "criar_todo":
      state.todos = args.tarefas.split("|").map(t => t.trim()).filter(Boolean)
        .map(t => ({ tarefa: t, feita: false, resultado: "" }));
      return `📋 Todo (${state.todos.length} tarefas):\n` +
        state.todos.map((t, i) => `  ○ [${i}] ${t.tarefa}`).join("\n");

    case "marcar_todo": {
      const t = state.todos[args.indice];
      if (!t) return `⚠ Índice ${args.indice} inválido`;
      t.feita = true; t.resultado = args.resultado;
      const feitas = state.todos.filter(t => t.feita).length;
      const prox = state.todos.filter(t => !t.feita).slice(0, 3)
        .map(t => `  → [${state.todos.indexOf(t)}] ${t.tarefa}`).join("\n");
      return `✓ [${args.indice}] concluída (${feitas}/${state.todos.length})` +
        (prox ? `\nPróximas:\n${prox}` : "\n🎉 Todas concluídas!");
    }

    case "listar_arquivos": {
      const arqs = Object.keys(vfs);
      if (!arqs.length) return "📁 Projeto vazio.";
      return "📁 Arquivos:\n" + arqs.map(f => {
        const ext = f.split(".").pop();
        const icon = { html:"🌐",css:"🎨",js:"🟨",ts:"🔷",py:"🐍",json:"📋",md:"📝" }[ext] || "📄";
        const sz = vfs[f].length;
        return `  ${icon} ${f}  (${sz < 1024 ? sz + "B" : Math.round(sz/1024) + "KB"})`;
      }).join("\n");
    }

    case "ler_arquivo": {
      const cam = norm(args.caminho);
      if (!(cam in vfs)) return `❌ Não encontrado: ${cam}\nDisponíveis: ${Object.keys(vfs).join(", ") || "(nenhum)"}`;
      return `[${cam} — ${vfs[cam].split("\n").length} linhas]\n${vfs[cam]}`;
    }

    case "escrever_arquivo": {
      const cam = norm(args.caminho);
      const avisos = [];
      if (args.conteudo.length < 20) avisos.push("⚠ Conteúdo muito curto.");
      for (const ph of ["// TODO", "placeholder", "your_code", "..."])
        if (args.conteudo.toLowerCase().includes(ph.toLowerCase())) avisos.push(`⚠ Placeholder: '${ph}'`);
      vfs[cam] = args.conteudo;
      return `✅ Salvo: ${cam} (${args.conteudo.split("\n").length} linhas)` +
        (avisos.length ? "\n" + avisos.join("\n") : "");
    }

    case "criar_estrutura_projeto": {
      const criados = [];
      for (const item of args.estrutura.split("|||")) {
        if (!item.includes("::")) continue;
        const [rel, cont] = item.split("::", 2);
        const cam = norm(rel.trim());
        if (!cam || !cont?.trim()) continue;
        vfs[cam] = cont.trim();
        criados.push(`  ✅ ${cam}`);
      }
      return `📁 Estrutura criada:\n${criados.join("\n")}`;
    }

    case "verificar_arquivo": {
      const cam = norm(args.caminho);
      if (!(cam in vfs)) return `❌ NÃO EXISTE: ${cam} → Reescreva com escrever_arquivo.`;
      const problemas = [];
      if (vfs[cam].length < 20) problemas.push("❌ Arquivo vazio.");
      for (const kw of args.deve_conter.split(",")) {
        const k = kw.trim();
        if (k && !vfs[cam].toLowerCase().includes(k.toLowerCase()))
          problemas.push(`⚠ Não encontrado: '${k}'`);
      }
      return problemas.length
        ? `⚠ PROBLEMAS:\n${problemas.join("\n")}`
        : `✅ OK — ${cam} (${vfs[cam].split("\n").length} linhas)`;
    }

    case "usar_template": {
      const T = {
        jogo:   { a: ["index.html","game.js","style.css"],        d: "Jogo web com canvas" },
        site:   { a: ["index.html","style.css","script.js"],      d: "Site estático responsivo" },
        app:    { a: ["index.html","app.js","style.css"],         d: "App vanilla JS" },
        react:  { a: ["index.html","src/App.jsx","package.json"], d: "React + Vite" },
        crud:   { a: ["index.html","app.js","style.css"],         d: "CRUD com localStorage" },
        mobile: { a: ["index.html","app.js","style.css","manifest.json"], d: "PWA mobile-first" },
      };
      const tp = T[args.tipo?.toLowerCase()] || T.site;
      return `📐 Template ${args.tipo?.toUpperCase()}: ${tp.d}\nArquivos:\n${tp.a.map(a => `  • ${a}`).join("\n")}`;
    }

    default:
      return `⚠ Ferramenta '${nome}' desconhecida.`;
  }
}

// ── Ler stream SSE ─────────────────────────────────────────────────────────────
async function* lerSSE(body) {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const linhas = buf.split("\n");
    buf = linhas.pop() || "";
    for (const l of linhas) {
      if (!l.startsWith("data: ")) continue;
      const d = l.slice(6).trim();
      if (d === "[DONE]") return;
      try { yield JSON.parse(d); } catch {}
    }
  }
}

// ── System prompt ──────────────────────────────────────────────────────────────
function getSystemPrompt(projetoNome, vfs) {
  const arqs = Object.keys(vfs);
  const estrutura = arqs.length
    ? arqs.map(f => `  • ${f}`).join("\n")
    : "  (vazio)";

  return `Você é um engenheiro de software sênior e agente autônomo.

## CONTEXTO
Data: ${new Date().toLocaleString("pt-BR")}
Projeto: ${projetoNome || "Novo Projeto"}
Arquivos existentes:\n${estrutura}

## FLUXO (ReAct)

Tarefas SIMPLES (1-2 arquivos):
1. listar_arquivos → escrever_arquivo → verificar_arquivo

Tarefas COMPLEXAS (3+ arquivos):
1. pensar → criar_todo → executar cada tarefa → marcar_todo → verificar

## REGRAS
- Código COMPLETO: zero placeholders, zero "// TODO"
- Caminhos relativos (sem barra inicial): index.html, src/app.js
- Sempre verificar_arquivo após escrever
- HTML + CSS + JS em arquivos separados

## RESPOSTA FINAL
**✅ O que foi feito:** lista de arquivos criados
**📋 Como usar:** instruções claras
**⚠️ Observações:** dependências ou "Nenhuma."`;
}

// ── Traduzir erros ─────────────────────────────────────────────────────────────
function traduzirErro(status, body) {
  const b = (body || "").toLowerCase();
  if (b.includes('just a moment') || b.includes('cf-browser-verification') || b.includes('cloudflare'))
    return '🛡️ Scitely/Cloudflare bloqueou a requisição do servidor Netlify. Tente: Groq, OpenRouter ou Gemini.';
  if (status === 401 || (b.includes("invalid") && b.includes("key")))
    return "🔑 API Key inválida. Verifique nas configurações.";
  if (status === 402 || (b.includes("insufficient") && b.includes("credit")))
    return "💳 Créditos insuficientes neste provedor.";
  if (status === 404 || (b.includes("not found") && b.includes("model")))
    return "❌ Modelo não encontrado. Verifique o nome do modelo.";
  if (status === 429 || (b.includes("rate") && b.includes("limit")))
    return "⏳ Limite de requisições. Aguarde 30s e tente novamente.";
  if (status === 503)
    return "🔧 Provedor temporariamente fora do ar. Tente outro modelo.";
  return `❌ Erro ${status}: ${(body || "").slice(0, 200)}`;
}

// ── Loop principal ─────────────────────────────────────────────────────────────
async function runAgent({
  pergunta, fonte, modelo, apiKey, apiUrlCustom,
  historico, projetoNome, vfs, todos,
  onToken, onThinkStart, onThinkToken, onThinkDone,
  onToolStart, onToolEnd, onArquivosCriados,
  onStatus, onAviso, onFim, onErro,
  signal
}) {
  const MAX_STEPS = 12;
  const state = { vfs, todos };

  const API_CONFIGS = window.AgenteDev_API_CONFIGS;
  const cfg = API_CONFIGS[fonte] || API_CONFIGS.groq;

  // URL final de chat completions
  let chatUrl;
  if (fonte === "custom") {
    chatUrl = (apiUrlCustom || "").replace(/\/+$/, "") + "/chat/completions";
  } else {
    chatUrl = cfg.url;
  }

  if (!apiKey && fonte !== "custom") {
    onErro(`🔑 Nenhuma API Key para '${fonte}'. Cole a chave e clique em Salvar.`);
    onFim(); return;
  }

  const msgs = [
    { role: "system", content: getSystemPrompt(projetoNome, vfs) },
    ...(historico || []).slice(-14),
    { role: "user", content: pergunta }
  ];

  // Monta headers extras (sem Authorization — o proxy adiciona)
  const extraHeaders = {};
  for (const [k, v] of Object.entries(cfg.headers(apiKey || ""))) {
    if (k !== "Authorization") extraHeaders[k] = v;
  }

  onStatus("pensando");

  for (let step = 0; step < MAX_STEPS; step++) {
    if (signal?.aborted) break;

    let resp;
    try {
      resp = await fetch("/.netlify/functions/proxy", {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl: chatUrl,
          apiKey,
          extraHeaders,
          payload: {
            model: modelo,
            messages: msgs,
            tools: TOOLS,
            tool_choice: "auto",
            stream: true,
            max_tokens: 4096,
            temperature: 0
          }
        })
      });
    } catch (e) {
      if (e.name === "AbortError") break;
      onErro(`Falha de conexão: ${e.message}`);
      onFim(); return;
    }

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      onErro(traduzirErro(resp.status, errBody));
      onFim(); return;
    }

    let textContent = "";
    let toolCalls = [];
    let finishReason = null;
    let inThink = false;
    let thinkBuf = "";

    for await (const chunk of lerSSE(resp.body)) {
      if (signal?.aborted) break;
      const choice = chunk.choices?.[0];
      if (!choice) continue;
      if (choice.finish_reason) finishReason = choice.finish_reason;
      const delta = choice.delta || {};

      if (delta.content) {
        textContent += delta.content;
        let raw = delta.content;
        let visible = "";

        while (raw.length > 0) {
          if (!inThink) {
            const openIdx = raw.indexOf("<think>");
            if (openIdx === -1) { visible += raw; break; }
            visible += raw.slice(0, openIdx);
            raw = raw.slice(openIdx + 7);
            inThink = true;
            onThinkStart();
          } else {
            const closeIdx = raw.indexOf("</think>");
            if (closeIdx === -1) { thinkBuf += raw; onThinkToken(raw); break; }
            const chunk2 = raw.slice(0, closeIdx);
            thinkBuf += chunk2; onThinkToken(chunk2); onThinkDone();
            raw = raw.slice(closeIdx + 8);
            inThink = false; thinkBuf = "";
          }
        }
        if (visible) { onStatus("respondendo"); onToken(visible); }
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          if (!toolCalls[idx]) toolCalls[idx] = { id: "", name: "", args: "" };
          if (tc.id) toolCalls[idx].id = tc.id;
          if (tc.function?.name) toolCalls[idx].name += tc.function.name;
          if (tc.function?.arguments) toolCalls[idx].args += tc.function.arguments;
        }
      }
    }

    if (inThink && thinkBuf) { onThinkDone(); inThink = false; }

    const validTools = toolCalls.filter(tc => tc?.name);
    const aMsg = { role: "assistant", content: textContent || null };
    if (validTools.length > 0) {
      aMsg.tool_calls = validTools.map(tc => ({
        id: tc.id || ("call_" + Date.now()),
        type: "function",
        function: { name: tc.name, arguments: tc.args }
      }));
    }
    msgs.push(aMsg);

    if (validTools.length === 0 || finishReason === "stop" || finishReason === "end_turn") break;

    for (const tc of validTools) {
      if (signal?.aborted) break;
      onToolStart(tc.name, tc.id);
      let resultado;
      try {
        const args = JSON.parse(tc.args || "{}");
        resultado = executarTool(tc.name, args, state);
      } catch (e) {
        resultado = `❌ Erro ao executar '${tc.name}': ${e.message}`;
      }
      onToolEnd(tc.name, tc.id, resultado);
      const toolCallId = aMsg.tool_calls?.find(t => t.function.name === tc.name)?.id || tc.id;
      msgs.push({ role: "tool", tool_call_id: toolCallId, content: resultado });
    }
  }

  if (Object.keys(state.vfs).length > 0) {
    onArquivosCriados(Object.keys(state.vfs), state.vfs);
  }

  onFim();
}

window.AgenteDev = { runAgent, executarTool, TOOLS };

})();
