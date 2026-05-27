export type WeatherItem = {
  baseDate: string; // YYYYMMDD
  baseTime: string; // HHMM
  category: string;
  nx: number;
  ny: number;
  obsrValue?: string; // 초단기실황 전용
  fcstDate?: string;
  fcstTime?: string;
  fcstValue?: string;
};

export type GridXY = {
  nx: number;
  ny: number;
};
