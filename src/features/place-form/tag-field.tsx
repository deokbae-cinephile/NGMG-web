import { useId, useState } from 'react';

type Props = { value: string[]; suggestions: string[]; onChange: (tags: string[]) => void };

const MAX_TAGS = 20;
const clean = (tag: string) => tag.replace(/^#/, '').trim().slice(0, 20);

/** 추천 태그는 눌러서 넣고 빼며, 직접 입력한 태그는 Enter나 쉼표로 더합니다. */
export const TagField = ({ value, suggestions, onChange }: Props) => {
  const id = useId();
  const [draft, setDraft] = useState('');
  const toggle = (tag: string) => onChange(value.includes(tag) ? value.filter((item) => item !== tag) : [...value, tag].slice(0, MAX_TAGS));
  const addDraft = () => {
    const tags = draft.split(',').map(clean).filter((tag) => tag && !value.includes(tag));
    if (tags.length) onChange([...value, ...tags].slice(0, MAX_TAGS));
    setDraft('');
  };
  const custom = value.filter((tag) => !suggestions.includes(tag));

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mono-label pb-1.5">태그</legend>
      <div className="flex flex-wrap gap-2">
        {[...suggestions, ...custom].map((tag) => (
          <button key={tag} type="button" className="button min-h-9 px-3 text-sm" aria-pressed={value.includes(tag)} onClick={() => toggle(tag)}>
            {`#${tag}`}
          </button>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <label htmlFor={id} className="mono-label">태그 직접 입력</label>
          <input
            id={id}
            value={draft}
            placeholder="예: 감성돔, 일출"
            className="min-h-11 w-full border border-field bg-surface px-3 py-2"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault();
                addDraft();
              }
            }}
          />
        </div>
        <button type="button" className="button shrink-0" onClick={addDraft}>
          태그 추가
        </button>
      </div>
      <p className="text-sm text-muted">{`누른 태그는 형광색으로 표시됩니다. ${MAX_TAGS}개까지 달 수 있습니다.`}</p>
    </fieldset>
  );
};
