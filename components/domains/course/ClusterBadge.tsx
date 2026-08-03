import type { NearbyPoi } from "@/shared/types/course.types";
import type { PoiCategory } from "@/shared/constants/poiCategory";

// 클러스터 배지 — 멤버 카테고리가 전부 같으면 그 카테고리 색(POI_CATEGORY_COLOR, 범례·
// 개별 핀과 동일 출처), 섞여 있으면 중립색. CustomOverlayMap은 데이터 URI 마커와 달리
// 실제 DOM이라 text-secondary 테마 토큰 클래스를 그대로 쓸 수 있어 라이트/다크 양쪽에
// 자동 대응된다(개별 핀의 hex 고정값 제약이 배지에는 적용되지 않음).
// isOpen이면 배지 아래에 인라인 목록을 펼쳐 개별 장소를 바로 선택할 수 있게 한다 —
// 부채꼴 펼치기 대신 이 방식을 택해 상태 관리를 단순하게 유지한다.
export function ClusterBadge({
  members,
  categoryColor,
  isOpen,
  onToggle,
  onSelectMember,
}: {
  members: NearbyPoi[];
  categoryColor: Record<PoiCategory, string>;
  isOpen: boolean;
  onToggle: () => void;
  onSelectMember: (id: string) => void;
}) {
  const categories = new Set(members.map((m) => m.category));
  const uniformCategory = categories.size === 1 ? members[0].category : null;

  return (
    <div className="relative flex flex-col items-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white shadow-md ring-2 ring-white active:scale-95 transition-transform bg-text-secondary"
        style={uniformCategory ? { backgroundColor: categoryColor[uniformCategory] } : undefined}
      >
        {members.length}
      </button>

      {isOpen && (
        <div className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 w-44 rounded-lg border border-border bg-card shadow-lg overflow-hidden z-10">
          {members.map((poi) => (
            <button
              key={poi.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectMember(poi.id);
              }}
              className="flex items-center gap-2 w-full text-left px-2.5 py-1.5 hover:bg-background transition-colors"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: categoryColor[poi.category] }}
              />
              <span className="flex-1 min-w-0 text-[12px] font-medium text-text-primary truncate">
                {poi.name}
              </span>
              <span className="text-[10px] text-text-secondary shrink-0">{poi.dist}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
