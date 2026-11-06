/**
 * ChatSorter AI Memory Layer Client
 * API Documentation: https://chatsorter.com
 */

function getChatSorterApiKey() {
  const key = process.env.CHATSORTER_API_KEY || "";
  if (!key || key.includes("your_chatsorter_api_key")) return "";
  return key;
}

const CHATSORTER_BASE_URL = "https://chatsorter.com";

export function isChatSorterEnabled() {
  return Boolean(getChatSorterApiKey());
}

/**
 * Ensures chatId is always namespaced by userId so memories from one user
 * chatting with a public character never leak into another user's prompt context.
 */
export function buildScopedChatId(userId, rawChatId) {
  const cleanRaw = String(rawChatId || "default").trim();
  if (!userId) return cleanRaw;
  const cleanUser = String(userId).trim();
  if (cleanRaw.startsWith(`${cleanUser}_`)) return cleanRaw;
  return `${cleanUser}_${cleanRaw}`;
}

/**
 * Searches ChatSorter for relevant long-term memories matching the current message.
 * Default 5000ms timeout provides good balance between cloud recall and fast latency.
 */
export async function searchMemories(chatId, query, timeoutMs = 5000) {
  const apiKey = getChatSorterApiKey();
  if (!apiKey || !chatId || !query) return [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${CHATSORTER_BASE_URL}/api/v1/memories/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        chat_id: String(chatId),
        query: String(query),
        limit: 5,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`ChatSorter search failed with status ${res.status}`);
      return [];
    }

    const data = await res.json();
    if (Array.isArray(data.memories)) {
      return data.memories
        .map(m => (typeof m === "string" ? m : m.fact || m.memory || m.text || ""))
        .filter(Boolean);
    }
    return [];
  } catch (err) {
    if (err?.name === "AbortError") {
      console.warn("ChatSorter search timed out (proceeding without memory injection)");
    } else {
      console.warn("ChatSorter search error:", err?.message || err);
    }
    return [];
  }
}

/**
 * Sends a message turn to ChatSorter to be indexed into memory in the background.
 */
export async function processMessage(chatId, content) {
  const apiKey = getChatSorterApiKey();
  if (!apiKey || !chatId || !content) return null;

  try {
    const res = await fetch(`${CHATSORTER_BASE_URL}/api/v1/memories/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        chat_id: String(chatId),
        message: String(content),
      }),
    });

    if (!res.ok) {
      console.warn(`ChatSorter process failed with status ${res.status}`);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.warn("ChatSorter process error:", err?.message || err);
    return null;
  }
}
