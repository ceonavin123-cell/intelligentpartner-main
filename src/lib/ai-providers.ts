// ============================================================
// AI PROVIDER ABSTRACTION LAYER
// Supports: NVIDIA NIM (free), Gemini, OpenRouter (free models), MiniMax
// ============================================================

export type AIProvider = "gemini" | "openrouter" | "minimax" | "nvidia";

export interface AIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
}

export interface AITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: any;
  };
}

export interface AICompletionOptions {
  provider?: AIProvider;
  model?: string;
  messages: AIMessage[];
  tools?: AITool[];
  tool_choice?: "auto" | "none" | "required";
  temperature?: number;
  max_tokens?: number;
}

export interface AICompletionResponse {
  choices: Array<{
    message: {
      content: string | null;
      tool_calls?: Array<{
        id: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ─── PROVIDER CONFIGURATION ──────────────────────────────────

const PROVIDERS: Record<
  AIProvider,
  {
    baseUrl: string;
    getApiKey: () => string;
    defaultModel: string;
    headers: (apiKey: string) => Record<string, string>;
  }
> = {
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    getApiKey: () => {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new Error("GEMINI_API_KEY missing");
      return key;
    },
    defaultModel: "gemini-2.5-flash",
    headers: (apiKey: string) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    }),
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    getApiKey: () => {
      const key = process.env.OPENROUTER_API_KEY;
      if (!key) throw new Error("OPENROUTER_API_KEY missing");
      return key;
    },
    defaultModel: "nex-agi/nex-n2-pro:free",
    headers: (apiKey: string) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://intelligentpartner.ai",
      "X-Title": "Intelligent Partner",
    }),
  },
  minimax: {
    baseUrl: "https://api.minimax.io/v1/chat/completions",
    getApiKey: () => {
      const key = process.env.MINIMAX_API_KEY;
      if (!key) throw new Error("MINIMAX_API_KEY missing");
      return key;
    },
    defaultModel: "MiniMax-M3",
    headers: (apiKey: string) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    }),
  },
  nvidia: {
    baseUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
    getApiKey: () => {
      const key = process.env.NVIDIA_API_KEY;
      if (!key) throw new Error("NVIDIA_API_KEY missing - get free key at build.nvidia.com");
      return key;
    },
    defaultModel: "minimaxai/minimax-m3",
    headers: (apiKey: string) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    }),
  },
};

// ─── FREE MODELS LIST ────────────────────────────────────────

export const FREE_MODELS = [
  { id: "openrouter/free", name: "Auto-select free model", provider: "openrouter" as AIProvider },
  { id: "google/gemma-4-31b-it:free", name: "Google Gemma 4 31B", provider: "openrouter" as AIProvider },
  { id: "nvidia/nemotron-3-ultra-550b-a55b:free", name: "NVIDIA Nemotron 3 Ultra", provider: "openrouter" as AIProvider },
  { id: "nvidia/nemotron-3-super-120b-a12b:free", name: "NVIDIA Nemotron 3 Super", provider: "openrouter" as AIProvider },
  { id: "google/gemma-4-26b-a4b-it:free", name: "Google Gemma 4 26B", provider: "openrouter" as AIProvider },
  { id: "poolside/laguna-m.1:free", name: "Poolside Laguna M.1", provider: "openrouter" as AIProvider },
  { id: "nex-agi/nex-n2-pro:free", name: "Nex AGI Nex-N2-Pro", provider: "openrouter" as AIProvider },
  { id: "minimaxai/minimax-m3", name: "MiniMax M3 (NIM)", provider: "nvidia" as AIProvider },
  { id: "nvidia/nemotron-3-ultra-550b-a55b", name: "NVIDIA Nemotron 3 Ultra (NIM)", provider: "nvidia" as AIProvider },
  { id: "nvidia/llama-3.3-nemotron-super-49b-v1.5", name: "NVIDIA Nemotron Super 49B (NIM)", provider: "nvidia" as AIProvider },
  { id: "meta/llama-3.1-8b-instruct", name: "Meta Llama 3.1 8B (NIM)", provider: "nvidia" as AIProvider },
  { id: "nvidia/nemotron-3-super-120b-a12b", name: "NVIDIA Nemotron 3 Super (NIM)", provider: "nvidia" as AIProvider },
];

// ─── PROVIDER SELECTION ──────────────────────────────────────

let defaultProvider: AIProvider = "minimax";

export function setDefaultProvider(provider: AIProvider) {
  defaultProvider = provider;
}

export function getDefaultProvider(): AIProvider {
  return defaultProvider;
}

// ─── MAIN AI CALL FUNCTION ───────────────────────────────────
// Includes retry with exponential backoff + Gemini fallback for MiniMax failures

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 1500;

async function doAiComplete(options: AICompletionOptions, provider: AIProvider): Promise<AICompletionResponse> {
  const config = PROVIDERS[provider];
  const apiKey = config.getApiKey();
  const model = options.model || config.defaultModel;
  const headers = config.headers(apiKey);

  const body: any = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 8192,
  };

  // MiniMax doesn't support tool calling — skip tools
  if (options.tools && options.tools.length > 0 && provider !== "minimax") {
    body.tools = options.tools;
    body.tool_choice = options.tool_choice || "auto";
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`[ai] retry ${attempt}/${MAX_RETRIES} after ${delay}ms for ${provider}`);
      await new Promise((r) => setTimeout(r, delay));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    let response;
    try {
      response = await fetch(config.baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (e: any) {
      clearTimeout(timeout);
      if (e.name === "AbortError") {
        console.warn(`[ai] ${provider} timed out after 60s`);
        lastError = new Error(`${provider} timed out`);
        continue;
      }
      lastError = new Error(`${provider} network error: ${e.message}`);
      continue;
    }
    clearTimeout(timeout);

    if (response.status === 429) {
      const text = await response.text().catch(() => "");
      console.warn(`[ai] ${provider} 429 (attempt ${attempt + 1}):`, text.slice(0, 100));
      lastError = new Error(`${provider} rate limited`);
      continue;
    }

    if (!response.ok) {
      const text = await response.text();
      console.warn(`[ai] ${provider} error ${response.status}:`, text.slice(0, 100));
      lastError = new Error(`${provider} error ${response.status}`);
      continue;
    }

    return response.json();
  }

  throw lastError ?? new Error(`${provider} failed`);
}

export async function aiComplete(options: AICompletionOptions): Promise<AICompletionResponse> {
  const primary = options.provider || defaultProvider;

  try {
    return await doAiComplete(options, primary);
  } catch (primaryError: any) {
    // If primary is minimax and fails, fallback to gemini
    if (primary === "minimax") {
      console.warn(`[ai] MiniMax failed (${primaryError.message}), falling back to Gemini`);
      try {
        return await doAiComplete(options, "gemini");
      } catch (fallbackError: any) {
        throw new Error(`Both MiniMax and Gemini failed. MiniMax: ${primaryError.message}. Gemini: ${fallbackError.message}`);
      }
    }
    throw primaryError;
  }
}

// ─── HELPER: Simple chat (no tools) ─────────────────────────

export async function aiChat(
  messages: AIMessage[],
  options: {
    provider?: AIProvider;
    model?: string;
    temperature?: number;
    max_tokens?: number;
  } = {},
): Promise<string> {
  const result = await aiComplete({
    ...options,
    messages,
  });

  const content = result.choices?.[0]?.message?.content ?? "";
  // Strip MiniMax thinking tags
  return content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

// ─── HELPER: Chat with tool calls ────────────────────────────

export async function aiChatWithTools(
  messages: AIMessage[],
  tools: AITool[],
  tool_choice: "auto" | "none" | "required" = "auto",
  options: {
    provider?: AIProvider;
    model?: string;
    systemPrompt?: string;
  } = {},
): Promise<AICompletionResponse> {
  const allMessages: AIMessage[] = [];
  if (options.systemPrompt) {
    allMessages.push({ role: "system", content: options.systemPrompt });
  }
  allMessages.push(...messages);

  return aiComplete({
    provider: options.provider,
    model: options.model,
    messages: allMessages,
    tools,
    tool_choice,
  });
}

// ─── ROUTER FUNCTION: Gemini with MiniMax fallback ──────────
// Uses Gemini tool calling for reliable agent selection
// Falls back to MiniMax if Gemini fails

const ROUTER_TOOLS: AITool[] = [
  {
    type: "function",
    function: {
      name: "select_agents",
      description: "Select which specialist agents should respond to the user's question",
      parameters: {
        type: "object",
        properties: {
          agents: {
            type: "array",
            items: { type: "string", enum: ["cfo", "coo", "tax", "marketing", "bizdev"] },
            description: "List of agent keys to consult",
          },
          reason: {
            type: "string",
            description: "Brief reason for agent selection",
          },
        },
        required: ["agents", "reason"],
      },
    },
  },
];

export async function aiRouter(
  company_name: string,
  userMessage: string,
): Promise<{ agents: string[]; reason: string }> {
  const routerPrompt = `You are a consulting router for ${company_name}.
Based on the user's question, decide which specialist agents should respond.
Available agents: cfo (finance), coo (operations), tax (tax & compliance), marketing (digital marketing), bizdev (business development).
If no specialist needed (simple question), return empty agents array.`;

  // Try Gemini first (supports tool calling)
  try {
    const result = await aiChatWithTools(
      [{ role: "user", content: userMessage }],
      ROUTER_TOOLS,
      "auto",
      { provider: "gemini", systemPrompt: routerPrompt },
    );

    if (result.toolCalls && result.toolCalls.length > 0) {
      const call = result.toolCalls[0];
      const args = JSON.parse(call.function.arguments);
      const validAgents = (args.agents ?? []).filter((a: string) =>
        ["cfo", "coo", "tax", "marketing", "bizdev"].includes(a),
      );
      console.log(`[router] Gemini selected agents: ${validAgents.join(", ") || "none"}`);
      return { agents: validAgents, reason: args.reason || "routing" };
    }
    // Gemini returned text instead of tool call — parse it
    const text = result.text || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      const validAgents = (parsed.agents ?? []).filter((a: string) =>
        ["cfo", "coo", "tax", "marketing", "bizdev"].includes(a),
      );
      console.log(`[router] Gemini (text) selected agents: ${validAgents.join(", ") || "none"}`);
      return { agents: validAgents, reason: parsed.reason || "routing" };
    }
    console.log("[router] Gemini returned no agents, using general answer");
    return { agents: [], reason: "general knowledge sufficient" };
  } catch (e: any) {
    console.warn(`[router] Gemini failed (${e.message}), falling back to MiniMax`);
  }

  // Fallback to MiniMax (no tool calling, parse JSON from text)
  try {
    const routerResp = await aiChat([
      { role: "user", content: `${routerPrompt}\n\nUser question: ${userMessage}\n\nReply with ONLY a JSON object (no other text):\n{"agents":["cfo","coo"],"reason":"brief reason"}\nIf no specialist needed, reply:\n{"agents":[],"reason":"general knowledge sufficient"}` },
    ], { provider: "minimax" });

    const match = routerResp.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      const validAgents = (parsed.agents ?? []).filter((a: string) =>
        ["cfo", "coo", "tax", "marketing", "bizdev"].includes(a),
      );
      console.log(`[router] MiniMax fallback selected agents: ${validAgents.join(", ") || "none"}`);
      return { agents: validAgents, reason: parsed.reason || "routing" };
    }
    console.log("[router] MiniMax fallback returned no agents");
    return { agents: [], reason: "general knowledge sufficient" };
  } catch (e: any) {
    console.warn(`[router] MiniMax fallback also failed (${e.message}), defaulting to cfo+coo`);
    return { agents: ["cfo", "coo"], reason: "fallback default" };
  }
}

// ─── PROVIDER HEALTH CHECK ───────────────────────────────────

export async function checkProviderHealth(provider: AIProvider): Promise<boolean> {
  try {
    const result = await aiChat([{ role: "user", content: "Say 'ok'" }], {
      provider,
      max_tokens: 10,
    });
    return result.toLowerCase().includes("ok");
  } catch {
    return false;
  }
}

// ─── GET AVAILABLE PROVIDERS ─────────────────────────────────

export function getAvailableProviders(): Array<{
  id: AIProvider;
  name: string;
  hasKey: boolean;
  defaultModel: string;
}> {
  return [
    {
      id: "nvidia",
      name: "NVIDIA NIM (Free)",
      hasKey: !!process.env.NVIDIA_API_KEY,
    defaultModel: "minimaxai/minimax-m3",
    },
    {
      id: "gemini",
      name: "Google Gemini",
      hasKey: !!process.env.GEMINI_API_KEY,
      defaultModel: "gemini-2.5-flash",
    },
    {
      id: "openrouter",
      name: "OpenRouter (Free Models)",
      hasKey: !!process.env.OPENROUTER_API_KEY,
      defaultModel: "nex-agi/nex-n2-pro:free",
    },
    {
      id: "minimax",
      name: "MiniMax",
      hasKey: !!process.env.MINIMAX_API_KEY,
      defaultModel: "MiniMax-M3",
    },
  ];
}
