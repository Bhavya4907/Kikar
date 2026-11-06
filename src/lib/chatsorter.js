/**
 * ChatSorter AI Memory Layer Integration (https://chatsorter.com)
 *
 * Scores incoming chat turns and extracts structured facts, narrative summaries,
 * and profile traits to provide persistent long-term memory for Kikar AI personas.
 */

const CHATSORTER_API_URL = "https://api.chatsorter.com";

export function getChatSorterApiKey() {
  const key = process.env.CHATSORTER_API_KEY || "";
  if (!key || key.includes("your_")) return "";
  return key.trim();
}

export function isChatSorterEnabled() {
  return Boolean(getChatSorterApiKey());
}

/**
 * Searches ChatSorter for relevant long-term memories matching the current message.
 * Default 15s timeout to allow semantic indexing across ChatSorter cloud tiers.
 */
export async function searchMemories(chatId, query, timeoutMs = 15000) {
  const apiKey = getChatSorterApiKey();
  if (!apiKey || !chatId || !query) return [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${CHATSORTER_API_URL}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        chat_id: String(chatId),
        query: String(query).slice(0, 1000),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`ChatSorter search failed with status: ${res.status}`);
      return [];
    }

    const data = await res.json();
    if (data?.success && Array.isArray(data.memories)) {
      return data.memories
        .map(m => m.summary || m.content || "")
        .filter(s => typeof s === "string" && s.length > 0);
    }

    return [];
  } catch (err) {
    if (err?.name === "AbortError") {
      console.warn("ChatSorter search timed out (proceeding without memory injection)");
    } else {
      console.warn("ChatSorter search error:", err?.message || err);
    }
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Sends a message turn to ChatSorter to be scored (1-10) and indexed for long-term memory.
 * Runs non-blocking / asynchronously so it doesn't delay chat responses.
 */
export async function processMessage(chatId, message) {
  const apiKey = getChatSorterApiKey();
  if (!apiKey || !chatId || !message) return false;

  try {
    const res = await fetch(`${CHATSORTER_API_URL}/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        chat_id: String(chatId),
        message: String(message).slice(0, 2000),
      }),
    });

    if (!res.ok) {
      console.warn(`ChatSorter process returned status: ${res.status}`);
      return false;
    }

    const data = await res.json();
    return Boolean(data?.success);
  } catch (err) {
    console.warn("ChatSorter process error:", err?.message || err);
    return false;
  }
}
