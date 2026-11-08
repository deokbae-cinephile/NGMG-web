import { useMutation } from '@tanstack/react-query';
import { supabase, type PlaceRecord } from '@/shared/api';
import { toDateKey } from '@/shared/lib';
import { ErrorText } from '@/shared/ui';

const TABLES = ['places', 'records', 'record_photos', 'fish_catches', 'menu_items', 'angler_gear', 'events', 'checklist_items'] as const;
const PAGE = 1000; // Supabase가 한 번에 돌려주는 기본 최대 행 수

const fetchAll = async (table: (typeof TABLES)[number]) => {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').order('id').range(from, from + PAGE - 1);
    if (error) throw new Error('백업 파일을 만들지 못했습니다.');
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
};

const download = (content: string, type: string, name: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};

/** 기록 하나(물고기 포함)를 JSON 파일로 내려받습니다. 잠깐만 유효한 사진 주소는 뺍니다. */
export const DownloadRecordButton = ({ record }: { record: PlaceRecord }) => (
  <button
    type="button"
    className="text-action"
    aria-label={`${record.place.name} ${record.visited_on} 기록 내려받기`}
    onClick={() =>
      download(
        JSON.stringify(record, (key, value: unknown) => (key === 'url' || key === 'photo_url' ? undefined : value), 2),
        'application/json',
        `ngmg-record-${record.visited_on}-${record.id.slice(0, 8)}.json`,
      )
    }
  >
    내려받기
  </button>
);

const downloadBackup = async () => {
  const tables = Object.fromEntries(await Promise.all(TABLES.map(async (table) => [table, await fetchAll(table)])));
  download(JSON.stringify({ exportedAt: new Date().toISOString(), tables }, null, 2), 'application/json', `ngmg-backup-${toDateKey(new Date())}.json`);
};

const COLUMNS: [string, string][] = [
  ['visited_on', '날짜'], ['place_name', '장소'], ['catches', '조과'], ['people', '인원'], ['companions', '동행'],
  ['gear', '장비'], ['rig', '채비'], ['bait', '미끼'], ['weather', '날씨'], ['tide', '물때'], ['wind', '바람'],
  ['water_temp', '수온'], ['menu', '메뉴'], ['price', '가격'], ['rating', '평점'], ['memo', '메모'],
];
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

/** 기록을 표 계산 프로그램에서 열 수 있는 CSV로 저장합니다. 한글이 깨지지 않도록 BOM을 붙입니다. */
const downloadCsv = async () => {
  const [records, places] = (await Promise.all([fetchAll('records'), fetchAll('places')])) as Record<string, unknown>[][];
  const names = new Map(places.map((place) => [place.id, place.name]));
  const rows = records
    .map((record): Record<string, unknown> => ({ ...record, place_name: names.get(record.place_id) }))
    .sort((a, b) => String(a.visited_on).localeCompare(String(b.visited_on)));
  const lines = [COLUMNS.map(([, label]) => label), ...rows.map((row) => COLUMNS.map(([key]) => row[key]))];
  download('\uFEFF' + lines.map((line) => line.map(csvCell).join(',')).join('\r\n'), 'text/csv', `ngmg-records-${toDateKey(new Date())}.csv`);
};

export const ExportButton = () => {
  const json = useMutation({ mutationFn: downloadBackup });
  const csv = useMutation({ mutationFn: downloadCsv });

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="button" disabled={json.isPending} onClick={() => json.mutate()}>
          {json.isPending ? '백업 파일 만드는 중' : '전체 백업 (JSON)'}
        </button>
        <button type="button" className="button" disabled={csv.isPending} onClick={() => csv.mutate()}>
          {csv.isPending ? '표 만드는 중' : '기록 표 (CSV)'}
        </button>
      </div>
      <p className="text-sm text-muted">JSON은 장소, 기록, 잡은 물고기, 일정, 준비물 전체를, CSV는 기록만 표로 저장합니다. 사진 파일은 포함되지 않습니다.</p>
      <p role="status" className="text-sm text-muted empty:hidden">{json.isSuccess || csv.isSuccess ? '파일을 저장했습니다.' : ''}</p>
      <ErrorText error={json.error ?? csv.error} />
    </div>
  );
};
