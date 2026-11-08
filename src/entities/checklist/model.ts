import type { ChecklistItem } from '@/shared/api';

export const DEFAULT_CHECKLIST: { category: string; titles: string[] }[] = [
  { category: '장비', titles: ['낚싯대', '릴', '받침대', '뜰채', '두레박', '아이스박스'] },
  { category: '채비·소품', titles: ['원줄·목줄', '찌', '바늘', '봉돌', '가위·니퍼', '칼'] },
  { category: '미끼', titles: ['크릴', '집어제', '밑밥통·주걱'] },
  { category: '안전', titles: ['구명조끼', '갯바위 신발', '장갑', '구급약', '보조 배터리'] },
  { category: '개인 물품', titles: ['모자', '방한복·우비', '물과 식사', '쓰레기봉투'] },
];

export const CHECKLIST_CATEGORIES = [...DEFAULT_CHECKLIST.map((group) => group.category), '기타'];

/** gear는 장비 화면에 등록한 로드와 릴입니다. 있으면 '낚싯대'와 '릴' 대신 넣습니다. */
export const defaultChecklistItems = (date: string, gear: string[] = []) =>
  DEFAULT_CHECKLIST.flatMap((group) => {
    const titles = group.category === '장비' && gear.length ? [...gear, ...group.titles.filter((title) => title !== '낚싯대' && title !== '릴')] : group.titles;
    return titles.map((title) => ({ category: group.category, title }));
  }).map((item, position) => ({ ...item, date, position }));

/** 분류 순서대로 묶고, 없는 분류는 뺍니다. */
export const groupByCategory = (items: ChecklistItem[]) =>
  CHECKLIST_CATEGORIES.map((category) => ({
    category,
    items: items.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0);
