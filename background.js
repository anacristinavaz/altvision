// ============ CONFIG ============
const OPENAI_API_KEY = "<seu-token-aqui>";
const OPENAI_MODEL = "gpt-4o";
const FALLBACK_MODEL = "gpt-4o-mini";
const TIMEOUT_MS = 30000;
const MAX_IMAGES_PER_RUN = 5;

const MAX_MONTHLY_CALLS = 150;
const FALLBACK_COOLDOWN_MS = 10 * 60 * 1000;

const CACHE_KEY = "altvision_cache_v1";
const CACHE_MAX_ENTRIES = 500;
// =================================

console.log("🔄 AltVision background v4 — compatível GPT-4o e 4o-mini");

if (typeof OPENAI_API_KEY !== "string" || OPENAI_API_KEY.length < 20) {
  console.warn("⚠️ OPENAI_API_KEY aparentemente inválida ou ausente.");
}

// ---------- Storage helpers ----------
function getLocal(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}
function setLocal(obj) {
  return new Promise(resolve => chrome.storage.local.set(obj, resolve));
}

// ---------- Limite mensal ----------
async function getUsageState() {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const { billingMonth, callsUsed } = await getLocal(["billingMonth", "callsUsed"]);
  if (billingMonth !== monthKey) {
    await setLocal({ billingMonth: monthKey, callsUsed: 0 });
    return { billingMonth: monthKey, callsUsed: 0 };
  }
  return { billingMonth: billingMonth || monthKey, callsUsed: callsUsed || 0 };
}
async function addUsage(count = 1) {
  const s = await getUsageState();
  const newCalls = (s.callsUsed || 0) + count;
  await setLocal({ billingMonth: s.billingMonth, callsUsed: newCalls });
  return newCalls;
}
async function canUseMore(callsNeeded = 1) {
  const s = await getUsageState();
  return (s.callsUsed || 0) + callsNeeded <= MAX_MONTHLY_CALLS;
}

// ---------- Cooldown ----------
async function getCooldownUntil() {
  const { cooldownUntil } = await getLocal(["cooldownUntil"]);
  return cooldownUntil || 0;
}
async function setCooldownFor(ms) {
  const until = Date.now() + ms;
  await setLocal({ cooldownUntil: until });
  return until;
}
async function clearCooldown() {
  await setLocal({ cooldownUntil: 0 });
}

// ---------- Cache ----------
async function getCache() {
  const obj = await getLocal([CACHE_KEY]);
  return obj[CACHE_KEY] || {};
}
async function setCacheEntry(url, caption) {
  const cache = await getCache();
  cache[url] = caption;
  const keys = Object.keys(cache);
  if (keys.length > CACHE_MAX_ENTRIES) delete cache[keys[0]];
  await setLocal({ [CACHE_KEY]: cache });
}

// ---------- Utils ----------
function isSupportedImageUrl(url) {
  if (!url || typeof url !== "string") return false;
  const lower = url.toLowerCase();
  if (lower.startsWith("data:") || lower.startsWith("blob:")) return false;
  if (lower.includes("chrome-extension://")) return false;
  const okExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
  return okExt.some(ext => lower.includes(ext));
}

// ---------- Função genérica de chamada OpenAI ----------
// A função chamarOpenAI (apenas a seção do system prompt foi alterada)
async function chamarOpenAI(model, urls) {
  const system = {
    role: "system",
    content: `Você é um assistente que analisa imagens e gera descrições curtas e objetivas em português.
    Retorne **somente** texto puro contendo um JSON válido no formato:
    [
      {"caption":"<legenda_curta>"} // <-- A URL FOI REMOVIDA AQUI!
    ]
    - máximo 12 palavras por legenda.
    - O número de objetos JSON deve ser EXATAMENTE igual ao número de imagens de entrada.
    - se não conseguir identificar, use "Imagem não identificada".
    - não adicione texto fora do JSON.`
  };

  const userContent = [
    { type: "text", text: "Analise as imagens a seguir e gere as legendas conforme instruções." },
    ...urls.map(u => ({ type: "image_url", image_url: { url: u } }))
  ];

  // usamos 'text' para evitar erros de parsing do SDK e tratar JSON manualmente
  const body = {
    model,
    messages: [system, { role: "user", content: userContent }],
    temperature: 0.2,
    response_format: { type: "text" }
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "OpenAI-Organization": "org-5YzrC1hJHKWSqeCnPRL8BEL1"
    },
    body: JSON.stringify(body),
    signal: controller.signal
  });

  clearTimeout(timeout);
  const text = await resp.text();

  if (text.trim().startsWith("<!DOCTYPE html>") || text.toLowerCase().includes("<html")) {
    throw new Error("HTML recebido em vez de JSON (bloqueio ou proxy).");
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    // fallback para quando a API responde com texto em vez de JSON
    json = { choices: [{ message: { content: text } }] };
  }

  return { resp, json };
}

// ---------- Principal ----------
async function gerarDescricoesOpenAI_batched(urls) {
  const unique = [...new Set(urls)].filter(isSupportedImageUrl);
  if (typeof OPENAI_API_KEY !== "string" || OPENAI_API_KEY.length < 20) {
    return unique.map(u => ({
      url: u,
      caption: "⚠️ Chave da OpenAI inválida ou não configurada corretamente."
    }));
  }

  try {
    let { resp, json } = await chamarOpenAI(OPENAI_MODEL, unique);

    if (resp.status === 429 || json?.error?.message?.includes("Rate limit")) {
      console.warn("⚠️ Rate limit no modelo principal. Alternando para fallback...");
      await setCooldownFor(FALLBACK_COOLDOWN_MS);
      try {
        const { json: fallbackJson } = await chamarOpenAI(FALLBACK_MODEL, unique);
        json = fallbackJson;
      } catch (e) {
        console.error("🚨 Falha ao chamar modelo de fallback:", e);
        throw e;
      }
    }

    const raw = json?.choices?.[0]?.message?.content || "";
    const clean = raw.trim();

    const match = clean.match(/\[[\s\S]*\]/);
    if (!match) {
      return unique.map(u => ({
        url: u,
        caption: "Não foi possível interpretar a resposta da IA (sem JSON válido)."
      }));
    }

    let arr;
    try {
      arr = JSON.parse(match[0]);
    } catch (e) {
      console.warn("⚠️ Falha ao parsear JSON:", e);
      return unique.map(u => ({
        url: u,
        caption: "Erro ao interpretar JSON retornado pela IA (JSON inválido)."
      }));
    }
    
    if (unique.length !== arr.length) {
         console.warn(`⚠️ O número de URLs (${unique.length}) não corresponde ao número de legendas retornadas (${arr.length}).`);
         return unique.map(u => ({
            url: u,
            caption: "Falha no mapeamento: Contagem de descrições diferente da contagem de imagens."
         }));
    }


    return unique.map((u, index) => {
        const item = arr[index];
        return {
            url: u,
            caption: item && item.caption
                ? String(item.caption).trim()
                : "Descrição não disponível (Índice)." // <-- Último fallback
        };
    });


  } catch (e) {
    console.error("🚨 Erro ao chamar OpenAI:", e);
    return urls.map(u => ({ url: u, caption: `Erro ao gerar descrição: ${e.message}` }));
  }
}

// ---------- Listener ----------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "analyzeImages") {
    (async () => {
      try {
        const until = await getCooldownUntil();
        if (until && Date.now() < until) {
          const secs = Math.ceil((until - Date.now()) / 1000);
          sendResponse({
            success: true,
            descriptions: [{
              url: "—",
              description: `Rate limit recente. Aguarde ~${secs}s ou reduza o número de imagens / adicione billing.`
            }]
          });
          return;
        }

        if (!(await canUseMore(1))) {
          sendResponse({
            success: true,
            descriptions: [{
              url: "—",
              description: `Limite mensal atingido (${MAX_MONTHLY_CALLS} chamadas).`
            }]
          });
          return;
        }

        const urlsAll = Array.isArray(message.imageUrls)
          ? message.imageUrls.slice(0, MAX_IMAGES_PER_RUN)
          : [];
        const urls = urlsAll.filter(isSupportedImageUrl);

        if (urls.length === 0) {
          sendResponse({ success: true, descriptions: [{ url: "—", description: "Nenhuma imagem válida encontrada." }] });
          return;
        }

        const cache = await getCache();
        const fromCache = [];
        const toFetch = [];
        for (const u of urls) {
          if (cache[u]) fromCache.push({ url: u, caption: cache[u] });
          else toFetch.push(u);
        }

        let fetched = [];
        if (toFetch.length > 0) {
          fetched = await gerarDescricoesOpenAI_batched(toFetch);
          for (const item of fetched) await setCacheEntry(item.url, item.caption);
          await addUsage(1);
        } else {
          await clearCooldown();
        }

        const finalList = [...fromCache, ...fetched].map(x => ({
          url: x.url,
          description: x.caption
        }));

        console.log("✅ Descrições geradas:", finalList);
        sendResponse({ success: true, descriptions: finalList });
      } catch (err) {
        console.error("🚨 Erro no background:", err);
        sendResponse({ success: false, error: err?.message || "Erro desconhecido." });
      }
    })();
    return true;
  }
});
