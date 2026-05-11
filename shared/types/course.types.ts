export type BadgeVariant = 'accent' | 'secondary' | 'point' | 'outline';

export type Place = {
  id: string;
  cat: string;
  name: string;
  addr: string;
  hours: string;
  time: string;
  dur: string;
  travel: string;
  badge: { text: string; variant: BadgeVariant };
  desc: string;
};

export type NearbyCategory = 'all' | 'cafe' | 'restroom' | 'convenience' | 'pharmacy';

export type NearbyPoi = {
  id: string;
  category: Exclude<NearbyCategory, 'all'>;
  name: string;
  dist: string;
  isOpen: boolean;
};
