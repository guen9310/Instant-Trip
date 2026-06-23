// ============================================================
// Tour API 공통 응답 구조
// ============================================================

export interface TourApiResponse<T> {
  response: {
    header: {
      resultCode: string; // "0000" = 성공
      resultMsg: string; // "OK"
    };
    body: {
      items: { item: T[] } | ""; // 결과 없으면 "" 빈 문자열로 옴 (주의)
      numOfRows: number;
      pageNo: number;
      totalCount: number;
    };
  };
}

// ============================================================
// 공통 파라미터
// ============================================================

export interface CommonParams {
  serviceKey: string;
  numOfRows?: number; // 기본값 10, 최대 제한 없음(단 너무 크면 느림)
  pageNo?: number; // 기본값 1
  MobileOS: "IOS" | "AND" | "WIN" | "ETC";
  MobileApp: string; // 앱 이름
  _type: "json" | "xml"; // json 추천
}

// ============================================================
// 지역코드 (areaCode)
// ============================================================

export const AREA_CODES = {
  서울: "1",
  인천: "2",
  대전: "3",
  대구: "4",
  광주: "5",
  부산: "6",
  울산: "7",
  세종: "8",
  경기: "31",
  강원: "32",
  충북: "33",
  충남: "34",
  경북: "35",
  경남: "36",
  전북: "37",
  전남: "38",
  제주: "39",
} as const;

export type AreaCode = (typeof AREA_CODES)[keyof typeof AREA_CODES];

// ============================================================
// 콘텐츠 타입 (contentTypeId)
// 이게 핵심 - 어떤 종류의 장소인지 구분
// ============================================================

export const CONTENT_TYPE = {
  관광지: "12",
  문화시설: "14",
  행사공연축제: "15",
  여행코스: "25",
  레포츠: "28",
  숙박: "32",
  쇼핑: "38",
  음식점: "39",
} as const;

export type ContentTypeId = (typeof CONTENT_TYPE)[keyof typeof CONTENT_TYPE];

// ============================================================
// areaBasedList / locationBasedList / searchKeyword 공통 item
// ============================================================

export interface TourItem {
  // 식별자
  contentid: string; // 콘텐츠 고유 ID
  contenttypeid: string; // 콘텐츠 타입

  // 기본 정보
  title: string; // 장소명 - 거의 항상 있음
  addr1: string; // 주소 - 거의 항상 있음
  addr2: string; // 상세주소 - 종종 비어있음

  // 좌표 - 핵심이지만 품질 문제 있음
  mapx: string; // 경도 (longitude) - 없는 경우 있음
  mapy: string; // 위도 (latitude) - 없는 경우 있음

  // 이미지 - 가장 품질 편차가 큰 필드
  firstimage: string; // 대표 이미지 URL - 없는 경우 많음
  firstimage2: string; // 썸네일 URL - 없는 경우 많음

  // 분류
  cat1: string; // 대분류 코드 (A, B, C...)
  cat2: string; // 중분류 코드
  cat3: string; // 소분류 코드

  // 지역
  areacode: string;
  sigungucode: string; // 시군구 코드

  // 메타
  createdtime: string; // 생성일 (YYYYMMDDHHmmss)
  modifiedtime: string; // 수정일
  tel: string; // 전화번호 - 종종 비어있음

  // 법정동 코드 (v2 신규 필드, AreaTar API 연동에 필요)
  lDongRegnCd?: string; // 시도코드 e.g. "11" (서울)
  lDongSignguCd?: string; // 시군구코드 e.g. "110" → signguCd = lDongRegnCd + lDongSignguCd
  lclsSystm1?: string; // 분류체계1
  lclsSystm2?: string; // 분류체계2
  lclsSystm3?: string; // 분류체계3

  // 카카오 로컬 출처 장소 전용 (source='kakao'일 때만 유효)
  source?: "tour" | "kakao";
  kakaoCategory?: string; // 카카오 category 버킷: AT4(관광명소) | CT1(문화시설)
  placeUrl?: string; // 카카오 장소 상세 페이지 URL
}

// ============================================================
// detailCommon 응답 - 공통 상세 정보
// ============================================================

export interface TourDetailCommon {
  contentid: string;
  contenttypeid: string;
  title: string;
  createdtime: string;
  modifiedtime: string;
  tel: string;
  telname: string;
  homepage: string; // HTML 태그 포함된 문자열로 옴 (주의!)
  booktour: string; // 교과서 속 여행지 여부
  firstimage: string;
  firstimage2: string;
  cpyrhtDivCd: string; // 저작권 유형
  addr1: string;
  addr2: string;
  zipcode: string;
  mapx: string;
  mapy: string;
  mlevel: string; // 지도 레벨
  overview: string; // 소개글 - HTML 태그 포함 (주의!)
}

// ============================================================
// detailIntro 응답 - 타입별 상세 정보
// contentTypeId마다 필드가 완전히 다름
// ============================================================

// 관광지 (12)
export interface TourDetailIntroAttraction {
  contentid: string;
  contenttypeid: "12";
  accomcount: string; // 수용 인원
  chkbabycarriage: string; // 유모차 대여
  chkcreditcard: string; // 신용카드 가능
  chkpet: string; // 애완동물 동반
  expagerange: string; // 체험 연령대
  expguide: string; // 체험 안내
  heritage1: string; // 세계문화유산
  heritage2: string; // 세계자연유산
  heritage3: string; // 세계기록유산
  infocenter: string; // 문의/안내
  opendate: string; // 개장일
  parking: string; // 주차 정보
  restdate: string; // 쉬는날
  useseason: string; // 이용 시기
  usetime: string; // 이용 시간
}

// 문화시설 (14)
export interface TourDetailIntroCulture {
  contentid: string;
  contenttypeid: "14";
  usetimeculture: string; // 이용 시간
  restdateculture: string; // 쉬는날
}

// 레포츠 (28)
export interface TourDetailIntroLeports {
  contentid: string;
  contenttypeid: "28";
  usetimeleports: string; // 이용 시간
  restdateleports: string; // 쉬는날
}

// 음식점 (39)
export interface TourDetailIntroRestaurant {
  contentid: string;
  contenttypeid: "39";
  chkcreditcardrestaurant: string; // 신용카드
  discountinfofood: string; // 할인 정보
  firstmenu: string; // 대표 메뉴 - 있으면 유용
  infocenterfood: string; // 문의
  opendatefood: string; // 개업일
  opentimefood: string; // 영업 시간 - 구조화 안 된 텍스트
  packing: string; // 포장 가능
  parkingfood: string; // 주차
  reservationfood: string; // 예약
  restdatefood: string; // 쉬는날 - 구조화 안 된 텍스트
  scalefood: string; // 규모
  seat: string; // 좌석 수
  smoking: string; // 금연/흡연
  treatmenu: string; // 취급 메뉴
}

// 행사/축제 (15)
export interface TourDetailIntroFestival {
  contentid: string;
  contenttypeid: "15";
  eventenddate: string; // 종료일 (YYYYMMDD)
  eventstartdate: string; // 시작일 (YYYYMMDD)
  eventplace: string; // 행사 장소
  eventhomepage: string; // 행사 홈페이지
  playtime: string; // 공연 시간
  program: string; // 행사 프로그램
  sponsor1: string; // 주최자
  sponsor1tel: string; // 주최자 연락처
  usetimefestival: string; // 이용 요금
}

// ============================================================
// detailImage 응답
// ============================================================

export interface TourImage {
  contentid: string;
  imgname: string; // 이미지 설명
  originimgurl: string; // 원본 이미지 URL
  serialnum: string; // 순번
  smallimageurl: string; // 썸네일 URL
  cpyrhtDivCd: string; // 저작권 (Type1=저작권 없음, Type3=저작권 있음)
}

// ============================================================
// locationBasedList 추가 파라미터
// ============================================================

export interface LocationBasedParams {
  mapx: string; // 경도
  mapy: string; // 위도
  radius: string; // 반경 (단위: m, 최대 20000)
}
