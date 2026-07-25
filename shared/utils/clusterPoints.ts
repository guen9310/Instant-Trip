export type ClusterPoint = { id: string; x: number; y: number };

export type PointCluster<T extends ClusterPoint> = {
  key: string;
  members: T[];
};

// 그리드 기반이 아니라 실제 픽셀 거리 기반 BFS로 연결 요소를 묶는다 — 카카오
// MarkerClusterer의 격자(gridSize) 방식은 칸 경계에 걸린 두 점이 가까워도
// 서로 다른 클러스터로 갈리는 비직관적 결과를 냈다. 여기서는 "실제로 가까운
// 점끼리" 묶이는 걸 보장하되, maxSize에 닿으면 그 클러스터는 더 이상 키우지
// 않고 다음 시드로 넘어가 대규모 밀집 지역에서 배지 하나가 무한정 커지는 걸
// 막는다.
export function clusterPoints<T extends ClusterPoint>(
  points: T[],
  { thresholdPx, maxSize }: { thresholdPx: number; maxSize: number },
): PointCluster<T>[] {
  const assigned = new Array(points.length).fill(false);
  const clusters: PointCluster<T>[] = [];

  for (let seedIdx = 0; seedIdx < points.length; seedIdx++) {
    if (assigned[seedIdx]) continue;
    assigned[seedIdx] = true;

    const memberIdxs = [seedIdx];
    let frontier = [seedIdx];

    while (frontier.length > 0 && memberIdxs.length < maxSize) {
      const nextFrontier: number[] = [];
      for (const idx of frontier) {
        for (let otherIdx = 0; otherIdx < points.length; otherIdx++) {
          if (memberIdxs.length >= maxSize) break;
          if (assigned[otherIdx]) continue;

          const dx = points[idx].x - points[otherIdx].x;
          const dy = points[idx].y - points[otherIdx].y;
          if (Math.hypot(dx, dy) <= thresholdPx) {
            assigned[otherIdx] = true;
            memberIdxs.push(otherIdx);
            nextFrontier.push(otherIdx);
          }
        }
      }
      frontier = nextFrontier;
    }

    const members = memberIdxs.map((i) => points[i]);
    const key = members
      .map((m) => m.id)
      .sort()
      .join(",");
    clusters.push({ key, members });
  }

  return clusters;
}
