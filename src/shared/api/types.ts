export type PlaceKind = 'fishing' | 'restaurant' | 'etc';

export type Place = {
  id: string;
  name: string;
  kind: PlaceKind;
  address: string;
  latitude: number;
  longitude: number;
  memo: string;
  tags: string[];
  photo_path: string | null;
  created_at?: string;
  /** 화면에 보여 줄 서명된 사진 주소 (저장하지 않습니다) */
  photo_url?: string;
};

/** 아직 저장하지 않았을 수 있는 장소. id가 있으면 저장된 장소입니다. */
export type PlaceDraft = Omit<Place, 'id' | 'memo' | 'tags' | 'photo_path' | 'photo_url' | 'created_at'> & { id?: string; memo?: string; tags?: string[]; photo_path?: string | null };

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
  place: Pick<Place, 'id' | 'name' | 'kind' | 'tags'>;
  photos: RecordPhoto[];
  fish: FishCatch[];
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
  place: Place | null;
};

export type ChecklistItem = {
  id: string;
  date: string;
  title: string;
  category: string;
  checked: boolean;
  position: number;
};
