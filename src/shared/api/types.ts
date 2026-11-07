export type PlaceKind = 'fishing' | 'restaurant';

export type Place = {
  id: string;
  name: string;
  kind: PlaceKind;
  address: string;
  latitude: number;
  longitude: number;
  memo: string;
};

/** 아직 저장하지 않았을 수 있는 장소. id가 있으면 저장된 장소입니다. */
export type PlaceDraft = Omit<Place, 'id' | 'memo'> & { id?: string; memo?: string };

export type RecordPhoto = { id: string; storage_path: string; position: number; url: string };

export type PlaceRecord = {
  id: string;
  place_id: string;
  visited_on: string;
  catches: string;
  memo: string;
  rating: number | null;
  place: Pick<Place, 'id' | 'name' | 'kind'>;
  photos: RecordPhoto[];
};

export type CalendarEvent = {
  id: string;
  date: string;
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
