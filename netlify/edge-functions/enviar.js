// netlify/edge-functions/enviar.js
// Agente Dev — Edge Function para Netlify
// Substitui o backend Python FastAPI com Virtual Filesystem

export const config = { path: "/api/enviar" };

const MAX_STEPS = 10;
const MAX_TOKENS = 4096;

// ── Tool definitions (formato OpenAI) ─────────────────────────────────────────
const TOOLS = [
  {
    type: "function",
    function: {
      name: "pensar",
      description: "Use ANTES de começar qualquer tarefa complexa. Estrutura o raciocínio e define o plano.",
      parameters: {
        type: "object",
        properties: {
          objetivo:     { type: "string", description: "O que o usuário quer" },
          contexto:     { type: "string", description: "O que já existe no projeto" },
          plano:        { type: "string", description: "Lista numerada de passos" },
          verificacao:  { type: "string", description: "Como confirmar sucesso" }
        },
        required: ["objetivo", "contexto", "plano", "verificacao"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "criar_todo",
      description: "Cria uma lista de tarefas para acompanhar progresso em tarefas complexas.",
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
      description: "Marca uma tarefa do todo como concluída.",
      parameters: {
        type: "object",
        properties: {
          indice:    { type: "integer", description: "Índice (0-based) da tarefa" },
          resultado: { type: "string",  description: "Resultado obtido" }
        },
        required: ["indice", "resultado"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "listar_arquivos",
      description: "Lista arquivos do projeto virtual. SEMPRE use antes de criar arquivos.",
      parameters: {
        type: "object",
        properties: {
          caminho: { type: "string", description: "Use '.' para listar todos os arquivos" }
        },
        required: ["caminho"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "ler_arquivo",
      description: "Lê o conteúdo completo de um arquivo do projeto.",
      parameters: {
        type: "object",
        properties: {
          caminho: { type: "string", description: "Caminho do arquivo (ex: index.html)" }
        },
        required: ["caminho"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "escrever_arquivo",
      description: "Cria ou sobrescreve um arquivo com conteúdo COMPLETO. Nunca use placeholders.",
      parameters: {
        type: "object",
        properties: {
          caminho:  { type: "string", description: "Caminho do arquivo (ex: index.html, src/app.js)" },
          conteudo: { type: "string", description: "Conteúdo 100% completo e funcional do arquivo" }
        },
        required: ["caminho", "conteudo"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "criar_estrutura_projeto",
      description: "Cria múltiplos arquivos de uma vez. Ideal para scaffolding.",
      parameters: {
        type: "object",
        properties: {
          caminho_base: { type: "string", description: "Pasta base (use '.' ou nome do projeto)" },
          estrutura:    { type: "string", description: "Formato: 'arquivo.ext::conteudo|||outro.ext::conteudo'" }
        },
        required: ["caminho_base", "estrutura"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "verificar_arquivo",
      description: "Verifica se um arquivo existe e contém o esperado. Use após escrever arquivos.",
      parameters: {
        type: "object",
        properties: {
          caminho:      { type: "string", description: "Caminho do arquivo a verificar" },
          deve_conter:  { type: "string", description: "Palavras-chave separadas por vírgula" }
        },
        required: ["caminho", "deve_conter"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "usar_template",
      description: "Retorna estrutura recomendada para tipos de projeto.",
      parameters: {
        type: "object",
        properties: {
          tipo: { type: "string", description: "jogo | site | app | crud | api | react | nextjs | mobile" }
        },
        required: ["tipo"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "busca_web",
      description: "Pesquisa na internet. Use para APIs, erros, melhores práticas.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termos de busca" }
        },
        required: ["query"]
      }
    }
  }
];

// ── Configuração por provedor ──────────────────────────────────────────────────
function getAPIConfig(fonte, modelo, creds) {
  const map = {
    groq: {
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: creds.groq_api_key || "",
      headers: {}
    },
    gemini: {
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: creds.gemini_api_key || "",
      headers: {}
    },
    openrouter: {
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: creds.openrouter_api_key || "",
      headers: { "HTTP-Referer": "https://agente-dev.netlify.app", "X-Title": "Agente Dev" }
    },
    scitely: {
      url: "https://api.scitely.com/v1/chat/completions",
      key: creds.scitely_api_key || "",
      headers: { "X-Title": "Agente Dev" }
    },
    llmapi: {
      url: "https://internal.llmapi.ai/v1/chat/completions",
      key: creds.llmapi_api_key || "",
      headers: { "X-Title": "Agente Dev" }
    },
    puter: {
      url: "https://api.puter.com/puterai/openai/v1/chat/completions",
      key: creds.puter_auth_token || "",
      headers: { "X-Title": "Agente Dev" }
    },
    custom: {
      url: (creds.custom_api_url || "").replace(/\/+$/, "") + "/chat/completions",
      key: creds.custom_api_key || "sk-no-key",
      headers: {}
    }
  };
  return map[fonte] || map.groq;
}

// ── Virtual Filesystem + estado do agente ─────────────────────────────────────
function criarEstado() {
  return {
    vfs: {},   // { [caminho]: conteudo }
    todos: []  // [{ tarefa, feita, resultado }]
  };
}

// ── Executar tool no VFS ───────────────────────────────────────────────────────
function executarTool(nome, args, state) {
  const { vfs, todos } = state;

  switch (nome) {
    case "pensar":
      return (
        `✅ PLANO APROVADO\n` +
        `Objetivo: ${args.objetivo}\n` +
        `Contexto: ${args.contexto}\n` +
        `Passos:\n${args.plano}\n` +
        `Verificação: ${args.verificacao}\n\n` +
        `Prossiga executando os passos na ordem definida.`
      );

    case "criar_todo": {
      state.todos = args.tarefas.split("|")
        .map(t => t.trim()).filter(Boolean)
        .map(tarefa => ({ tarefa, feita: false, resultado: "" }));
      const linhas = state.todos.map((t, i) => `  ○ [${i}] ${t.tarefa}`).join("\n");
      return `📋 Todo criado com ${state.todos.length} tarefas:\n${linhas}\nExecute cada tarefa em ordem.`;
    }

    case "marcar_todo": {
      const idx = args.indice;
      if (!state.todos[idx]) return `⚠ Índice ${idx} inválido (total: ${state.todos.length})`;
      state.todos[idx].feita = true;
      state.todos[idx].resultado = args.resultado;
      const feitas = state.todos.filter(t => t.feita).length;
      const pendentes = state.todos
        .filter(t => !t.feita)
        .slice(0, 3)
        .map((t, i) => `  → [${state.todos.indexOf(t)}] ${t.tarefa}`)
        .join("\n");
      let status = `✓ [${idx}] concluída (${feitas}/${state.todos.length})`;
      if (pendentes) status += `\nPróximas:\n${pendentes}`;
      else status += `\n🎉 Todas as tarefas concluídas!`;
      return status;
    }

    case "listar_arquivos": {
      const arquivos = Object.keys(vfs);
      if (arquivos.length === 0) {
        return `📁 Projeto vazio.\nCrie arquivos com escrever_arquivo ou criar_estrutura_projeto.`;
      }
      const lines = arquivos.map(f => {
        const size = vfs[f].length;
        const sizeStr = size < 1024 ? `${size}B` : `${Math.round(size / 1024)}KB`;
        const ext = f.split(".").pop().toLowerCase();
        const icon = { html: "🌐", css: "🎨", js: "🟨", ts: "🔷", py: "🐍", json: "📋", md: "📝" }[ext] || "📄";
        return `  ${icon} ${f}  (${sizeStr})`;
      });
      return `📁 Projeto virtual:\n${lines.join("\n")}`;
    }

    case "ler_arquivo": {
      const cam = normalizar(args.caminho);
      const cont = vfs[cam];
      if (cont === undefined) {
        const disponíveis = Object.keys(vfs).join(", ") || "(nenhum)";
        return `❌ Arquivo não encontrado: ${cam}\nArquivos disponíveis: ${disponíveis}`;
      }
      const linhas = cont.split("\n").length;
      return `[${cam} — ${linhas} linhas]\n${cont}`;
    }

    case "escrever_arquivo": {
      const cam = normalizar(args.caminho);
      const alertas = [];
      const linhas = args.conteudo.split("\n").length;

      if (args.conteudo.length < 20) alertas.push("⚠ Conteúdo muito curto.");
      for (const ph of ["// TODO", "# TODO", "placeholder", "your_code"]) {
        if (args.conteudo.toLowerCase().includes(ph.toLowerCase())) {
          alertas.push(`⚠ Placeholder detectado: '${ph}'`);
        }
      }

      vfs[cam] = args.conteudo;
      let resultado = `✅ Salvo: ${cam}\n   ${linhas} linhas, ${args.conteudo.length} chars`;
      if (alertas.length) resultado += "\n" + alertas.join("\n");
      return resultado;
    }

    case "criar_estrutura_projeto": {
      const criados = [];
      const erros = [];
      for (const item of args.estrutura.split("|||")) {
        if (!item.includes("::")) continue;
        const [rel, cont] = item.split("::", 2);
        const cam = normalizar(rel.trim());
        if (!cam || !cont?.trim()) { erros.push(`⚠ Item inválido: '${rel}'`); continue; }
        vfs[cam] = cont.trim();
        criados.push(`  ✅ ${cam} (${cont.split("\n").length} linhas)`);
      }
      let resultado = `📁 Estrutura criada:\n${criados.join("\n")}`;
      if (erros.length) resultado += "\n" + erros.join("\n");
      return resultado;
    }

    case "verificar_arquivo": {
      const cam = normalizar(args.caminho);
      const cont = vfs[cam];
      if (!cont) return `❌ ARQUIVO NÃO EXISTE: ${cam}\n→ Reescreva com escrever_arquivo.`;
      const problemas = [];
      if (cont.length < 20) problemas.push("❌ Arquivo vazio ou quase vazio.");
      for (const kw of args.deve_conter.split(",")) {
        const k = kw.trim();
        if (k && !cont.toLowerCase().includes(k.toLowerCase())) {
          problemas.push(`⚠ Não encontrado: '${k}'`);
        }
      }
      if (problemas.length) {
        const preview = cont.slice(0, 300) + (cont.length > 300 ? "..." : "");
        return `⚠ PROBLEMAS:\n${problemas.join("\n")}\n\nPreview:\n${preview}`;
      }
      return `✅ OK — ${cam} (${cont.split("\n").length} linhas)`;
    }

    case "usar_template": {
      const TEMPLATES = {
        jogo:    { arqs: ["index.html", "game.js", "style.css"], desc: "Jogo web com canvas 800x600, loop, score e controles", dica: "Use requestAnimationFrame para o loop." },
        site:    { arqs: ["index.html", "style.css", "script.js"], desc: "Site estático responsivo", dica: "CSS variables + Flexbox/Grid" },
        app:     { arqs: ["index.html", "app.js", "style.css"], desc: "Aplicação web com JS vanilla", dica: "Use ES6+ modules" },
        react:   { arqs: ["index.html", "src/App.jsx", "src/main.jsx", "src/index.css", "package.json"], desc: "App React com Vite", dica: "useState, useEffect nos componentes" },
        crud:    { arqs: ["index.html", "app.js", "style.css"], desc: "CRUD completo com localStorage", dica: "Sem banco de dados — usa localStorage" },
        api:     { arqs: ["index.html", "api.js", "style.css"], desc: "Interface de API REST", dica: "Fetch API para chamadas HTTP" },
        nextjs:  { arqs: ["pages/index.js", "package.json"], desc: "App Next.js", dica: "getServerSideProps para SSR" },
        mobile:  { arqs: ["index.html", "app.js", "style.css", "manifest.json"], desc: "PWA mobile-first", dica: "meta viewport obrigatório" },
      };
      const t = TEMPLATES[args.tipo?.toLowerCase()] || TEMPLATES.site;
      const arqs = t.arqs.map(a => `  • ${a}`).join("\n");
      return `📐 Template: ${args.tipo?.toUpperCase()}\n${t.desc}\n\nArquivos:\n${arqs}\n\n💡 ${t.dica}`;
    }

    default:
      return `⚠ Ferramenta '${nome}' retornou sem resultado.`;
  }
}

async function buscarWeb(query) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    const data = await res.json();

    const partes = [];
    if (data.AbstractText) partes.push(data.AbstractText);
    if (data.RelatedTopics?.length) {
      for (const t of data.RelatedTopics.slice(0, 4)) {
        if (t.Text) partes.push(t.Text);
      }
    }
    return partes.length ? partes.join("\n\n") : `Busca por "${query}" não retornou resultados diretos.`;
  } catch (e) {
    return `Busca indisponível: ${e.message}`;
  }
}

function normalizar(caminho) {
  return caminho.replace(/^\/+/, "").replace(/^\.\//, "").trim();
}

// ── Ler stream SSE do LLM ─────────────────────────────────────────────────────
async function* lerSSE(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const linhas = buf.split("\n");
    buf = linhas.pop() || "";
    for (const linha of linhas) {
      if (!linha.startsWith("data: ")) continue;
      const dado = linha.slice(6).trim();
      if (dado === "[DONE]") return;
      try { yield JSON.parse(dado); } catch {}
    }
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────
function getSystemPrompt(projetoNome) {
  const now = new Date().toLocaleString("pt-BR");
  return `Você é um engenheiro de software sênior e agente autônomo de desenvolvimento.

## CONTEXTO
Data: ${now}
Projeto: ${projetoNome || "Novo Projeto"}
Ambiente: Web (Netlify) — Virtual Filesystem
IMPORTANTE: Não há filesystem local. Use as ferramentas virtuais para criar arquivos.
Ao final, o usuário poderá baixar todos os arquivos como ZIP.

## FLUXO DE TRABALHO (ReAct)

### Tarefas SIMPLES (1-2 arquivos):
1. listar_arquivos → entender o que existe
2. escrever_arquivo → código completo
3. verificar_arquivo → confirmar

### Tarefas COMPLEXAS (3+ arquivos):
1. pensar → planejar
2. criar_todo → listar tarefas
3. Para cada tarefa: executar → marcar_todo → verificar
4. Responder com resumo

## REGRAS DE QUALIDADE
- Código COMPLETO: zero placeholders, zero "// TODO", zero "..."
- Caminhos relativos (ex: index.html, src/app.js — sem barra inicial)
- Após escrever qualquer arquivo → chamar verificar_arquivo
- Projetos web: HTML + CSS + JS em arquivos SEPARADOS

## RESPOSTA FINAL OBRIGATÓRIA
**✅ O que foi feito:**
- [arquivo]: [descrição]

**📋 Como usar:**
- [instrução objetiva]

**⚠️ Observações:**
- [dependências ou "Nenhuma."]`;
}

// ── Loop do agente ─────────────────────────────────────────────────────────────
async function runAgent({ pergunta, fonte, modelo, credenciais, modo_agente, historico, projeto_nome, sse }) {
  const apiCfg = getAPIConfig(fonte, modelo, credenciais);
  const state = criarEstado();

  if (!apiCfg.key && !["custom"].includes(fonte)) {
    sse("erro", { msg: `🔑 Credencial não encontrada para '${fonte}'. Verifique a API Key nas configurações.` });
    sse("fim", { msg: "ok" });
    return;
  }

  // Montar histórico de mensagens
  const msgs = [
    { role: "system", content: getSystemPrompt(projeto_nome) },
    ...(historico || []).slice(-14),
    { role: "user", content: pergunta }
  ];

  sse("status", { fase: "pensando" });

  for (let step = 0; step < MAX_STEPS; step++) {
    // Chamar LLM com streaming
    let llmResp;
    try {
      llmResp = await fetch(apiCfg.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiCfg.key}`,
          ...apiCfg.headers
        },
        body: JSON.stringify({
          model: modelo,
          messages: msgs,
          tools: TOOLS,
          tool_choice: "auto",
          stream: true,
          max_tokens: MAX_TOKENS,
          temperature: 0
        })
      });
    } catch (e) {
      sse("erro", { msg: `❌ Erro de conexão: ${e.message}` });
      sse("fim", { msg: "ok" });
      return;
    }

    if (!llmResp.ok) {
      const errTxt = await llmResp.text().catch(() => "");
      sse("erro", { msg: traduzirErro(llmResp.status, errTxt) });
      sse("fim", { msg: "ok" });
      return;
    }

    // Ler stream de resposta
    let textContent = "";
    let toolCalls = [];
    let finishReason = null;

    for await (const chunk of lerSSE(llmResp.body)) {
      const choice = chunk.choices?.[0];
      if (!choice) continue;

      const delta = choice.delta || {};
      if (choice.finish_reason) finishReason = choice.finish_reason;

      // Texto visível
      if (delta.content) {
        textContent += delta.content;
        // Filtrar tags <think>
        const visivel = delta.content.replace(/<think>.*?<\/think>/gs, "");
        if (visivel) {
          sse("status", { fase: "respondendo" });
          sse("token", { text: visivel });
        }
      }

      // Tool calls (acumular argumentos)
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          if (!toolCalls[idx]) {
            toolCalls[idx] = { id: tc.id || `call_${idx}`, name: "", args: "" };
          }
          if (tc.id) toolCalls[idx].id = tc.id;
          if (tc.function?.name) toolCalls[idx].name += tc.function.name;
          if (tc.function?.arguments) toolCalls[idx].args += tc.function.arguments;
        }
      }
    }

    // Adicionar mensagem do assistente ao histórico
    const assistantMsg = { role: "assistant" };
    if (textContent) assistantMsg.content = textContent;
    if (toolCalls.length > 0) {
      assistantMsg.content = textContent || null;
      assistantMsg.tool_calls = toolCalls.filter(tc => tc?.name).map(tc => ({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: tc.args }
      }));
    }
    msgs.push(assistantMsg);

    // Se não há tool calls → agente terminou
    const validToolCalls = toolCalls.filter(tc => tc?.name);
    if (validToolCalls.length === 0 || finishReason === "stop" || finishReason === "end_turn") {
      break;
    }

    // Executar tools
    for (const tc of validToolCalls) {
      sse("tool_start", { nome: tc.name, id: tc.id });

      let resultado;
      try {
        const args = JSON.parse(tc.args || "{}");
        if (tc.name === "busca_web") {
          resultado = await buscarWeb(args.query);
        } else {
          resultado = executarTool(tc.name, args, state);
        }
      } catch (e) {
        resultado = `❌ Erro ao executar '${tc.name}': ${e.message}`;
      }

      sse("tool_end", { id: tc.id, nome: tc.name, resultado: resultado.slice(0, 500) });

      msgs.push({
        role: "tool",
        tool_call_id: tc.id,
        content: resultado
      });
    }
  }

  // Emitir arquivos criados (com conteúdos para download)
  const arquivos = Object.keys(state.vfs);
  if (arquivos.length > 0) {
    sse("arquivos_criados", {
      arquivos,
      conteudos: state.vfs,
      total: arquivos.length,
      status: "✓ Completo"
    });
  }

  sse("fim", { msg: "ok" });
}

// ── Tradução de erros ─────────────────────────────────────────────────────────
function traduzirErro(status, body) {
  const b = body.toLowerCase();
  if (status === 401) return "🔑 API Key inválida ou expirada. Verifique nas configurações.";
  if (status === 402) return "💳 Créditos insuficientes. Adicione créditos ou use outro provedor.";
  if (status === 404) return "❌ Modelo não encontrado ou removido. Selecione outro modelo.";
  if (status === 429) return "⏳ Limite de requisições atingido. Aguarde 30s e tente novamente.";
  if (status === 503) return "🔧 Provedor temporariamente fora do ar. Tente novamente em alguns minutos.";
  if (b.includes("model") && b.includes("not")) return "❌ Modelo não disponível neste provedor. Selecione outro modelo.";
  return `❌ Erro ${status}: ${body.slice(0, 200)}`;
}

// ── Handler principal ─────────────────────────────────────────────────────────
export default async function handler(request) {
  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { pergunta, fonte, modelo, credenciais = {}, modo_agente, historico, projeto_nome } = body;

  if (!pergunta || !fonte || !modelo) {
    return new Response("Missing required fields", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sse = (event, data) => {
    const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    writer.write(encoder.encode(chunk)).catch(() => {});
  };

  // Rodar agente de forma assíncrona
  runAgent({ pergunta, fonte, modelo, credenciais, modo_agente, historico, projeto_nome, sse })
    .catch(e => {
      sse("erro", { msg: `❌ Erro interno: ${e.message}` });
      sse("fim", { msg: "ok" });
    })
    .finally(() => writer.close().catch(() => {}));

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
      "X-Accel-Buffering": "no"
    }
  });
}
