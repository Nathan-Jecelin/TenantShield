import { getSupabase } from "./supabase";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("ts_session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("ts_session_id", id);
  }
  return id;
}

/** Send a custom event to Google Analytics 4 */
function sendToGA(
  eventName: string,
  params: Record<string, unknown> = {}
) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", eventName, params);
  }
}

export function trackEvent(
  eventType: string,
  eventData: Record<string, unknown> = {},
  userId?: string
) {
  // --- Google Analytics ---
  sendToGA(eventType, eventData);

  // --- Supabase analytics ---
  const sb = getSupabase();
  if (!sb) return;

  const sessionId = getSessionId();

  sb.from("analytics_events")
    .insert({
      event_type: eventType,
      event_data: { ...eventData, ...(sessionId ? { sessionId } : {}) },
      ...(userId ? { user_id: userId } : {}),
    })
    .then(() => {});
}
