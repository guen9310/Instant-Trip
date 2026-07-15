export type LocationSource = "geo" | "manual" | "restored";

export type LocationState =
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "granted"; city: string; sidoName?: string | null; source: LocationSource; lat?: number; lng?: number }
  | { status: "denied" }
  | { status: "system-denied" }
  | { status: "timeout" }
  | { status: "unavailable" };
