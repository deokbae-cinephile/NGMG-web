import { useState, type KeyboardEvent } from 'react';
import type { Place, PlaceDraft } from '@/shared/api';
import { searchKakaoPlaces, type KakaoPlace } from '@/shared/lib';
import { ErrorText, IconButton } from '@/shared/ui';
import { KindBadge } from './kind-badge';

/** unavailable: 저장한 장소를 고를 수 없는 이유(예: 일정 날짜가 휴무일). 있으면 그 장소는 누를 수 없고 이유를 보여 줍니다. */
type Props = { saved?: Place[]; onPick: (place: PlaceDraft) => void; unavailable?: (place: Place) => string | undefined };

const toDraft = ({ isRestaurant, ...place }: KakaoPlace): PlaceDraft => ({
  ...place,
  kind: isRestaurant ? 'restaurant' : 'fishing',
});

/** 다른 폼 안에 들어가므로 form을 쓰지 않고 Enter를 직접 처리합니다. */
export const PlaceSearch = ({ saved = [], onPick, unavailable }: Props) => {
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState('');
  const [results, setResults] = useState<KakaoPlace[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [pending, setPending] = useState(false);

  const search = async () => {
    const text = query.trim();
    if (!text || pending) return;
    setPending(true);
    setError(null);
    setResults([]);
    setSearched(text);
    try {
      setResults(await searchKakaoPlaces(text));
    } catch (cause) {
      setError(cause as Error);
    } finally {
      setPending(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    void search();
  };

  const savedMatches = searched ? saved.filter((place) => place.name.toLowerCase().includes(searched.toLowerCase())) : [];
  // 이미 저장한 장소(같은 이름, 약 50m 안)는 Kakao 결과에서 빼고 저장한 장소로만 고르게 합니다. 중복 저장과 휴무 제한 우회를 막습니다.
  const isSaved = (place: KakaoPlace) =>
    saved.some((item) => item.name === place.name && Math.abs(item.latitude - place.latitude) < 0.0005 && Math.abs(item.longitude - place.longitude) < 0.0005);
  const newResults = results.filter((place) => !isSaved(place));
  const count = savedMatches.length + newResults.length;

  const clear = () => {
    setSearched('');
    setResults([]);
    setQuery('');
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="search"
          aria-label="장소 검색"
          placeholder="주소나 장소 이름"
          className="min-h-11 w-full min-w-0 border border-field bg-surface px-3 py-2 text-ink placeholder:text-muted"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <IconButton icon="search" label="검색" disabled={pending} onClick={() => void search()} />
      </div>
      <ErrorText error={error} />
      <p role="status" className="text-sm text-muted">
        {pending ? '검색하는 중입니다.' : searched && !error ? `검색 결과 ${count}건` : ''}
      </p>
      {count > 0 && (
        <ul className="max-h-60 divide-y divide-line overflow-y-auto border border-line">
          {savedMatches.map((place) => (
            <li key={place.id}>
              <button type="button" className="result" disabled={Boolean(unavailable?.(place))} aria-describedby={unavailable?.(place) ? `closed-${place.id}` : undefined} onClick={() => { onPick(place); clear(); }}>
                <span className="flex items-center gap-2 font-semibold">
                  {place.name} <KindBadge kind={place.kind} />
                </span>
                <span className="text-sm text-muted">저장한 장소 · {place.address}</span>
                {unavailable?.(place) && (
                  <span id={`closed-${place.id}`} className="text-sm text-danger">{`${unavailable(place)}라 이 일정에는 고를 수 없습니다.`}</span>
                )}
              </button>
            </li>
          ))}
          {newResults.map((place) => (
            <li key={`${place.name}-${place.latitude}-${place.longitude}`}>
              <button type="button" className="result" onClick={() => { onPick(toDraft(place)); clear(); }}>
                <span className="font-semibold">{place.name}</span>
                <span className="text-sm text-muted">{place.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
