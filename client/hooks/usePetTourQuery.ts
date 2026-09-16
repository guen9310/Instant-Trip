import { useQuery } from "@tanstack/react-query";
import { fetchPetTourAction } from "@/app/actions/course";
import { tourContentIdSchema } from "@/shared/schemas/actionInputs";

// 장소 id가 TourAPI contentid일 때만 조회한다 — 카카오 출처("kakao_…")·미매칭 축제 id는
// 반려동물 동반여행 서비스에 존재할 수 없어 요청 자체를 보내지 않는다.
export function usePetTourQuery(placeId: string) {
  return useQuery({
    queryKey: ["place", placeId, "petTour"],
    queryFn: () => fetchPetTourAction({ contentId: placeId }),
    enabled: tourContentIdSchema.safeParse(placeId).success,
    // 원천 데이터 갱신주기가 일 1회라 한 세션 안에서 다시 받을 이유가 없다.
    staleTime: 60 * 60 * 1000,
  });
}
