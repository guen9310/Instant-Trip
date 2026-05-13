import type { Prefs } from "@/shared/constants/preferences";

export function buildProfileSummary(prefs: Prefs) {
  const vibe =
    prefs.vibe === "quiet"
      ? "조용한 분위기의 장소를 좋아하고,"
      : "활기찬 분위기의 장소를 좋아하고,";

  const party = prefs.party === "solo" ? "혼자" : "함께";
  const travel =
    prefs.travel === "walk" ? "천천히 걸으며" : "이동을 최소화해서";
  const preference = `${party} ${travel} 둘러보는 코스를 선호하시네요.`;

  const radius =
    prefs.radius === "near" ? "가까운 거리 안에서" : "근교까지 넓게";
  const food = prefs.food === "matjip" ? "맛집이 포함된 " : "";
  const course = prefs.travel === "walk" ? "도보 코스" : "코스";
  const recommend = `${radius} ${food}${course}를 추천해드릴게요.`;

  return { vibe, preference, recommend };
}

export function buildReexplorationText(prefs: Prefs) {
  const vibe = prefs.vibe === "quiet" ? "조용한 분위기의" : "활기찬 분위기의";
  const travel = prefs.travel === "walk" ? "도보 코스" : "코스";
  const line1 = `${vibe} ${travel}를 좋아하시죠.`;

  const radius = prefs.radius === "near" ? "가까운 거리 안에서" : "근교까지 넓게";
  const food = prefs.food === "matjip" ? "맛집이 포함된 " : "";
  const line2 = `${radius} ${food}새로운 코스를 추천해드릴까요?`;

  return { line1, line2 };
}
