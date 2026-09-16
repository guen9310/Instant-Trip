export type AvailabilityStatus =
  | "open" // 지금 입장 가능 + (검사했다면) 체류시간도 확보됨
  | "closed_restday" // 오늘이 휴무일
  | "before_open" // 오늘 아직 문을 열기 전이거나 휴게시간 — 곧 연다(opensAt)
  | "closed_hours" // 오늘 운영이 끝났거나 이후 다시 열지 않음
  | "past_admission_cutoff" // 이용시간 내지만 입장마감을 지남
  | "insufficient_time" // 입장은 가능하지만 폐관까지 예상 체류시간을 못 채움
  | "no_data" // usetime/restdate 자체가 없음 (파싱 실패와 구분)
  | "uncertain"; // usetime은 있지만 형식을 해석하지 못함
