export type PlaceKind = 'fishing' | 'restaurant' | 'etc';

export type Place = {
  id: string;
  name: string;
  kind: PlaceKind;
  address: string;
  latitude: number;
  longitude: number;
  memo: string;
  photo_path: string | null;
  created_at?: string;
  /** 화면에 보여 줄 서명된 사진 주소 (저장하지 않습니다) */
  photo_url?: string;
};

/** 아직 저장하지 않았을 수 있는 장소. id가 있으면 저장된 장소입니다. */
export type PlaceDraft = Omit<Place, 'id' | 'memo' | 'photo_path' | 'photo_url' | 'created_at'> & { id?: string; memo?: string; photo_path?: string | null };

export type RecordPhoto = { id: string; storage_path: string; position: number; url: string };

/** 낚시 기록에 딸린 잡은 물고기 한 마리. 조사는 '김 조사', '류 조사' 둘 중 하나입니다. */
export type FishCatch = {
  id: string;
  angler: string;
  species: string;
  length_cm: number;
  photo_path: string | null;
  position: number;
  photo_url?: string;
};

/** 조사별 평점 (0.5점 단위, 0.5~5점). 준 사람만 들어 있습니다. */
export type AnglerRatings = Partial<Record<string, number>>;

/** 맛집 기록의 메뉴 한 개 */
export type MenuItem = {
  id: string;
  name: string;
  price: number | null;
  /** 두 조사가 모두 준 평점의 평균. 한 사람만 주면 비어 있습니다. (예전 기록은 하나만 준 평점) */
  rating: number | null;
  angler_ratings: AnglerRatings;
  photo_path: string | null;
  position: number;
  photo_url?: string;
};

/** 조사의 장비 세트. items는 세트에 넣은 장비입니다. */
export type GearSet = {
  id: string;
  angler: string;
  name: string;
  position: number;
  created_at: string;
  items: { gear_id: string; position: number }[];
};

/** 기록에 남긴 장비 세트. 그때의 장비 이름을 그대로 담아 장비를 고치거나 지워도 기록은 그대로입니다. */
export type RecordGearSet = {
  angler: string;
  name: string;
  items: { gear_id: string | null; category: string; subcategory: string; label: string }[];
};

/** 조사별 장비 한 개 */
export type Gear = {
  id: string;
  angler: string;
  /** 로드, 릴, 라인, 채비, 미끼, 기타 */
  category: string;
  /** 라인의 세부 분류(원줄, 목줄). 다른 분류는 빈 문자열입니다. */
  subcategory: string;
  brand: string;
  name: string;
  memo: string;
  photo_path: string | null;
  position: number;
  created_at: string;
  photo_url?: string;
};

/** 기록의 자세한 항목. 낚시는 인원부터 수온까지, 맛집은 메뉴와 가격을 씁니다. */
export type RecordDetails = {
  people: number | null;
  companions: string;
  gear: string;
  rig: string;
  bait: string;
  weather: string;
  tide: string;
  wind: string;
  water_temp: string;
  menu: string;
  price: number | null;
};

export type PlaceRecord = RecordDetails & {
  id: string;
  place_id: string;
  visited_on: string;
  /** 연박이면 마지막 날, 당일이면 visited_on과 같습니다. */
  end_date: string;
  catches: string;
  memo: string;
  rating: number | null;
  event_id: string | null;
  place: Pick<Place, 'id' | 'name' | 'kind'>;
  photos: RecordPhoto[];
  fish: FishCatch[];
  menu_items: MenuItem[];
  gear_sets: RecordGearSet[];
  angler_ratings: AnglerRatings;
};

export type CalendarEvent = {
  id: string;
  date: string;
  /** 연박이면 마지막 날, 당일이면 date와 같습니다. */
  end_date: string;
  start_time: string;
  end_time: string | null;
  title: string;
  place_id: string | null;
  memo: string;
  /** 조사마다 고른 장비 세트 */
  gear_set_ids: string[];
  place: Place | null;
};

