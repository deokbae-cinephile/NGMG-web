import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/shared/api';
import { toDateKey } from '@/shared/lib';
import { ErrorText } from '@/shared/ui';

const TABLES = ['places', 'records', 'record_photos', 'events', 'checklist_items'] as const;
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

const downloadBackup = async () => {
  const tables = Object.fromEntries(await Promise.all(TABLES.map(async (table) => [table, await fetchAll(table)])));
  const today = toDateKey(new Date());
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), tables }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ngmg-backup-${today}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

export const ExportButton = () => {
  const { mutate, isPending, isSuccess, error } = useMutation({ mutationFn: downloadBackup });

  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" className="button" disabled={isPending} onClick={() => mutate()}>
        {isPending ? '백업 파일 만드는 중' : '데이터 백업'}
      </button>
      <p className="text-sm text-muted">장소, 기록, 일정, 준비물을 JSON 파일로 저장합니다. 사진 파일은 포함되지 않습니다.</p>
      <p role="status" className="text-sm text-muted">{isSuccess ? '백업 파일을 저장했습니다.' : ''}</p>
      <ErrorText error={error} />
    </div>
  );
};
