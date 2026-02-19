import { getSupabase } from "./supabase";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("ts_session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("ts_session_id", id);
  }
  return id;
}

export function trackEvent(
  eventType: string,
  eventData: Record<string, unknown> = {},
  userId?: string
) {
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
