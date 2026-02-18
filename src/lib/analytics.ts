import { getSupabase } from "./supabase";

export function trackEvent(
  eventType: string,
  eventData: Record<string, unknown> = {},
  userId?: string
) {
  const sb = getSupabase();
  if (!sb) return;

  sb.from("analytics_events")
    .insert({
      event_type: eventType,
      event_data: eventData,
      ...(userId ? { user_id: userId } : {}),
    })
    .then(() => {});
}
