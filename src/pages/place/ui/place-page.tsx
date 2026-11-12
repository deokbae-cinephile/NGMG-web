import { Writable } from '@/entities/session';
import { useState } from 'react';
import { ClosedToday, KindBadge, PlaceActions, useDeletePlace, usePlaces, formatHours } from '@/entities/place';
import { FishPhotoGrid, RecordCard, summarizeRecords, usePlaceRecords } from '@/entities/record';
import { PlaceForm } from '@/features/place-form';
import { RecordForm } from '@/features/record-form';
import type { PlaceRecord } from '@/shared/api';
import { formatDate, navigate } from '@/shared/lib';
import { ErrorText, IconButton, Modal, PageSkeleton } from '@/shared/ui';

export const PlacePage = ({ id }: { id: string }) => {
  const places = usePlaces();
  const records = usePlaceRecords(id);
  const remove = useDeletePlace();
  const [editing, setEditing] = useState(false);
  const [recordForm, setRecordForm] = useState<{ record?: PlaceRecord }>();

  const place = places.data?.find((item) => item.id === id);
  const summary = summarizeRecords(records.data ?? []);

  if (places.isPending) return <PageSkeleton variant="place" />;
  if (!place) {
    return (
      <div className="cell-body">
        <title>장소 없음 | 낚고먹고</title>
        <h1 className="title text-2xl">장소를 찾을 수 없습니다</h1>
        <ErrorText error={places.error} />
      </div>
    );
  }

  const onDelete = () => {
    if (window.confirm(`${place.name}과 이 장소의 기록, 사진을 모두 삭제할까요? 이 장소를 쓰던 일정은 장소만 비워집니다.`)) {
      remove.mutate(place, { onSuccess: () => navigate('/') });
    }
  };

  return (
    <div className="panes lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <title>{`${place.name} | 낚고먹고`}</title>
      <h1 className="sr-only">{`${place.name} 장소 상세`}</h1>
      <section aria-labelledby="place-title" className="pane">
        <div className="cell-head">
          <KindBadge kind={place.kind} />
        </div>
        {place.photo_url && <img src={place.photo_url} alt={`${place.name} 사진`} className="aspect-[3/2] w-full border-b border-line object-cover" />}
        <div className="cell-body flex flex-col gap-4">
          <h2 id="place-title" className="title border-b border-line pb-2 text-4xl lg:text-5xl">{place.name}</h2>
          <p className="text-lg">{place.address || '주소 없음'}</p>
          {formatHours(place) && (
            <p>
              <span className="mono-label mr-2">영업</span>
              {formatHours(place)} <ClosedToday place={place} />
            </p>
          )}
          {place.memo && <p className="whitespace-pre-wrap break-words">{place.memo}</p>}
          <PlaceActions place={place} />
          <Writable>
            <div className="flex flex-wrap gap-2">
              <IconButton icon="pencil" label="장소 수정" onClick={() => setEditing(true)} />
              <IconButton icon="trash" label="장소 삭제" className="button-accent" disabled={remove.isPending} onClick={onDelete} />
            </div>
          </Writable>
          <ErrorText error={remove.error} />
        </div>
        {place.kind === 'fishing' && (
          <section aria-labelledby="place-fish-title" className="border-t border-line">
            <div className="cell-head">
              <h2 id="place-fish-title" className="title text-xl">잡은 물고기 사진</h2>
            </div>
            <div className="cell-body">
              <FishPhotoGrid placeId={place.id} />
            </div>
          </section>
        )}
      </section>

      <section aria-labelledby="place-records-title" className="pane">
        <div className="cell-head">
          <div className="flex items-baseline gap-3">
            <h2 id="place-records-title" className="title text-xl">기록</h2>
          </div>
          <Writable>
            <IconButton icon="notePlus" label="기록 추가" primary onClick={() => setRecordForm({})} />
          </Writable>
        </div>
        <div className="cell-body flex flex-col gap-4">
          <ErrorText error={records.error} />
          {records.data?.length === 0 && <p className="text-muted">아직 기록이 없습니다.</p>}
          {summary.count > 0 && (
            <dl className="grid grid-cols-3 border-y border-line">
              {[
                ['방문', `${summary.count}건`],
                ['평점', summary.averageRating === null ? '없음' : `${summary.averageRating.toFixed(1)}점`],
                ['마지막 방문', summary.lastVisited ? formatDate(summary.lastVisited) : ''],
              ].map(([label, value], index) => (
                <div key={label} className={`flex flex-col gap-1 p-3 ${index ? 'border-l border-line' : ''}`}>
                  <dt className="mono-label">{label}</dt>
                  <dd className="text-lg">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="record-list">
            {records.data?.map((record) => (
              <RecordCard
                key={record.id}
                record={record}
                actions={
                  <Writable>
                    <IconButton icon="pencil" label={`${formatDate(record.visited_on)} 기록 수정`} onClick={() => setRecordForm({ record })} />
                  </Writable>
                }
              />
            ))}
          </div>
        </div>
      </section>

      {editing && (
        <Modal title="장소 수정" onClose={() => setEditing(false)}>
          <PlaceForm initial={place} onDone={() => setEditing(false)} />
        </Modal>
      )}
      {recordForm && (
        <Modal title={recordForm.record ? '기록 수정' : '새 기록'} onClose={() => setRecordForm(undefined)}>
          <RecordForm place={place} record={recordForm.record} onDone={() => setRecordForm(undefined)} />
        </Modal>
      )}
    </div>
  );
};
