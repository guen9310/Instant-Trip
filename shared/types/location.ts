export type LocationSource = "geo" | "manual" | "restored";

export type LocationState =
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "granted"; city: string; source: LocationSource; lat?: number; lng?: number }
  | { status: "denied" }
  | { status: "timeout" }
  | { status: "unavailable" };
