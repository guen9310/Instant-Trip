import type { Place, NearbyPoi } from '@/shared/types/course.types';

export const MOCK_PLACES: Place[] = [
  {
    id: 'p1',
    cat: '문화',
    name: '삼청동 한옥마을',
    addr: '서울 종로구 삼청로',
    hours: '09:00 - 18:00',
    time: '14:00',
    dur: '60분',
    travel: '도보 10분',
    badge: { text: '영업중', variant: 'accent' },
    desc: '북촌의 좁은 골목과 한옥이 만드는 풍경. 천천히 걸으며 사진 찍기 좋은 코스의 시작점이에요.',
  },
  {
    id: 'p2',
    cat: '카페',
    name: '익선동 골목 카페',
    addr: '서울 종로구 익선동',
    hours: '11:00 - 22:00',
    time: '15:20',
    dur: '50분',
    travel: '차량 15분',
    badge: { text: '영업중', variant: 'accent' },
    desc: '오래된 한옥을 개조한 작은 카페들이 모여있는 골목. 따뜻한 차 한 잔과 함께 쉬어가기 좋아요.',
  },
  {
    id: 'p3',
    cat: '야경',
    name: '낙산공원 성곽길',
    addr: '서울 종로구 낙산길',
    hours: '24시간',
    time: '16:30',
    dur: '50분',
    travel: '차량 20분',
    badge: { text: '오늘 축제', variant: 'point' },
    desc: '서울의 동쪽 성곽을 따라 걷는 길. 해 질 무렵 도시의 윤곽이 가장 아름답게 보이는 시간이에요.',
  },
];

export const MOCK_NEARBY: Record<string, NearbyPoi[]> = {
  p1: [
    { id: 'n1', category: 'cafe', name: '블루보틀 삼청점', dist: '120m', isOpen: true },
    { id: 'n2', category: 'cafe', name: '커피리브레', dist: '85m', isOpen: true },
    { id: 'n3', category: 'restroom', name: '삼청공원 공중화장실', dist: '200m', isOpen: true },
    { id: 'n4', category: 'convenience', name: 'CU 삼청로점', dist: '310m', isOpen: true },
    { id: 'n5', category: 'pharmacy', name: '삼청약국', dist: '450m', isOpen: false },
  ],
  p2: [
    { id: 'n6', category: 'cafe', name: '익선다옥', dist: '50m', isOpen: true },
    { id: 'n7', category: 'cafe', name: '카페 어니언', dist: '130m', isOpen: true },
    { id: 'n8', category: 'restroom', name: '익선동 공중화장실', dist: '90m', isOpen: true },
    { id: 'n9', category: 'convenience', name: 'GS25 익선점', dist: '200m', isOpen: true },
    { id: 'n10', category: 'pharmacy', name: '종로중앙약국', dist: '380m', isOpen: true },
  ],
  p3: [
    { id: 'n11', category: 'cafe', name: '낙산 테라스 카페', dist: '80m', isOpen: true },
    { id: 'n12', category: 'restroom', name: '낙산공원 화장실', dist: '150m', isOpen: true },
    { id: 'n13', category: 'convenience', name: '세븐일레븐 낙산점', dist: '250m', isOpen: true },
    { id: 'n14', category: 'pharmacy', name: '혜화약국', dist: '500m', isOpen: false },
  ],
};
