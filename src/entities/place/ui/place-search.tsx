import { useState, type KeyboardEvent } from 'react';
import type { Place, PlaceDraft } from '@/shared/api';
import { searchKakaoPlaces, type KakaoPlace } from '@/shared/lib';
import { ErrorText } from '@/shared/ui';
import { KindBadge } from './kind-badge';

type Props = { saved?: Place[]; onPick: (place: PlaceDraft) => void };

const toDraft = ({ isRestaurant, ...place }: KakaoPlace): PlaceDraft => ({
  ...place,
  kind: isRestaurant ? 'restaurant' : 'fishing',
});

/** 다른 폼 안에 들어가므로 form을 쓰지 않고 Enter를 직접 처리합니다. */
export const PlaceSearch = ({ saved = [], onPick }: Props) => {
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
  const count = savedMatches.length + results.length;

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
          className="min-h-11 w-full min-w-0 border border-line bg-night px-3 py-2 text-cream placeholder:text-muted"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="button" className="button shrink-0" disabled={pending} onClick={() => void search()}>
          검색
        </button>
      </div>
      <ErrorText error={error} />
      <p role="status" className="text-sm text-muted">
        {pending ? '검색하는 중입니다.' : searched && !error ? `검색 결과 ${count}건` : ''}
      </p>
      {count > 0 && (
        <ul className="max-h-60 divide-y divide-line overflow-y-auto border border-line">
          {savedMatches.map((place) => (
            <li key={place.id}>
              <button type="button" className="result" onClick={() => { onPick(place); clear(); }}>
                <span className="flex items-center gap-2 font-semibold">
                  {place.name} <KindBadge kind={place.kind} />
                </span>
                <span className="text-sm text-muted">저장한 장소 · {place.address}</span>
              </button>
            </li>
          ))}
          {results.map((place) => (
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
