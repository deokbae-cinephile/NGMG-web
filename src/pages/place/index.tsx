import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { KindBadge, useDeletePlace, usePlaces } from '@/entities/place';
import { RecordCard, summarizeRecords, usePlaceRecords } from '@/entities/record';
import { PlaceForm } from '@/features/place-form';
import { RecordForm } from '@/features/record-form';
import type { PlaceRecord } from '@/shared/api';
import { formatDate } from '@/shared/lib';
import { ErrorText, Modal } from '@/shared/ui';

export const PlacePage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const places = usePlaces();
  const records = usePlaceRecords(id);
  const remove = useDeletePlace();
  const [editing, setEditing] = useState(false);
  const [recordForm, setRecordForm] = useState<{ record?: PlaceRecord }>();

  const place = places.data?.find((item) => item.id === id);
  const summary = summarizeRecords(records.data ?? []);

  if (places.isPending) return <p className="p-4 text-muted">불러오는 중입니다.</p>;
  if (!place) {
    return (
      <div className="p-4">
        <title>장소 없음 | 낚고먹고</title>
        <h1 className="page-title">장소를 찾을 수 없습니다</h1>
        <ErrorText error={places.error} />
      </div>
    );
  }

  const onDelete = () => {
    if (window.confirm(`${place.name}과 이 장소의 기록, 사진을 모두 삭제할까요? 이 장소를 쓰던 일정은 장소만 비워집니다.`)) {
      remove.mutate(place.id, { onSuccess: () => navigate('/') });
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 lg:py-8">
      <title>{`${place.name} | 낚고먹고`}</title>
      <section className="flex flex-col gap-3">
        <span className="self-start">
          <KindBadge kind={place.kind} />
        </span>
        <h1 className="page-title">{place.name}</h1>
        <p>{place.address || '주소 없음'}</p>
        <p className="mono-label">{`${place.latitude.toFixed(5)}, ${place.longitude.toFixed(5)}`}</p>
        {place.memo && <p className="whitespace-pre-wrap break-words">{place.memo}</p>}
        <div className="flex flex-wrap gap-2">
          <a
            className="button"
            target="_blank"
            rel="noreferrer"
            href={`https://map.kakao.com/link/to/${encodeURIComponent(place.name)},${place.latitude},${place.longitude}`}
          >
            길찾기 (새 창)
          </a>
          <button type="button" className="button" onClick={() => setEditing(true)}>
            장소 수정
          </button>
          <button type="button" className="button button-danger" disabled={remove.isPending} onClick={onDelete}>
            장소 삭제
          </button>
        </div>
        <ErrorText error={remove.error} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="title text-xl">기록</h2>
          <button type="button" className="button button-primary" onClick={() => setRecordForm({})}>
            기록 추가
          </button>
        </div>
        <ErrorText error={records.error} />
        {records.data?.length === 0 && <p className="text-muted">아직 기록이 없습니다.</p>}
        {summary.count > 0 && (
          <dl className="panel grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="mono-label">방문 기록</dt>
              <dd className="font-semibold">{`${summary.count}건`}</dd>
            </div>
            <div>
              <dt className="mono-label">평균 별점</dt>
              <dd className="font-semibold">{summary.averageRating === null ? '없음' : `${summary.averageRating.toFixed(1)}점`}</dd>
            </div>
            <div>
              <dt className="mono-label">마지막 방문</dt>
              <dd className="font-semibold">{summary.lastVisited && formatDate(summary.lastVisited)}</dd>
            </div>
          </dl>
        )}
        {records.data?.map((record) => (
          <RecordCard
            key={record.id}
            record={record}
            actions={
              <button type="button" className="button" onClick={() => setRecordForm({ record })}>
                기록 수정
              </button>
            }
          />
        ))}
      </section>

      {editing && (
        <Modal title="장소 수정" onClose={() => setEditing(false)}>
          <PlaceForm initial={place} onDone={() => setEditing(false)} />
        </Modal>
      )}
      {recordForm && (
        <Modal title={recordForm.record ? '기록 수정' : '새 기록'} onClose={() => setRecordForm(undefined)}>
          <RecordForm placeId={place.id} kind={place.kind} record={recordForm.record} onDone={() => setRecordForm(undefined)} />
        </Modal>
      )}
    </div>
  );
};
