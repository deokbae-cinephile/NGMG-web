import { useForm } from 'react-hook-form';
import { CHECKLIST_CATEGORIES, groupByCategory, useChecklist, useChecklistActions } from '@/entities/checklist';
import { ErrorText, Field } from '@/shared/ui';

type Values = { title: string; category: string };

export const DayChecklist = ({ date }: { date: string }) => {
  const { data: items = [], isPending, error } = useChecklist(date);
  const { addDefaults, copyLatest, checkAll, uncheckAll, removeAll, add, toggle, remove } = useChecklistActions(date);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Values>({
    defaultValues: { title: '', category: CHECKLIST_CATEGORIES[0] },
  });
  const done = items.filter((item) => item.checked).length;
  // 마지막으로 한 동작의 결과만 보여 줍니다. 다음 동작이 성공하면 이전 오류는 사라집니다.
  const lastAction = [addDefaults, copyLatest, checkAll, uncheckAll, removeAll, add, toggle, remove].reduce((last, action) =>
    action.submittedAt > last.submittedAt ? action : last,
  );

  const submit = handleSubmit((values) =>
    !add.isPending &&
    add.mutate(
      { ...values, position: Math.max(-1, ...items.map((item) => item.position)) + 1 },
      { onSuccess: () => reset({ title: '', category: values.category }) },
    ),
  );

  return (
    <section aria-labelledby="checklist-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
        <div className="flex items-baseline gap-3">
          <span aria-hidden="true" className="eyebrow">Checklist</span>
          <h3 id="checklist-title" className="title text-lg">장비·준비물</h3>
        </div>
        {items.length > 0 && <p className="mono-label" role="status">{`${items.length}개 중 ${done}개 챙김`}</p>}
      </div>
      <ErrorText error={error ?? lastAction.error} />
      {!isPending && !error && items.length === 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-muted">이 날짜의 준비물이 없습니다.</p>
          <button type="button" className="button" disabled={addDefaults.isPending} onClick={() => addDefaults.mutate()}>
            기본 목록 불러오기
          </button>
          <button type="button" className="button" disabled={copyLatest.isPending} onClick={() => copyLatest.mutate()}>
            이전 목록 복사
          </button>
        </div>
      )}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="button" disabled={checkAll.isPending || done === items.length} onClick={() => checkAll.mutate()}>
            모두 선택
          </button>
          <button type="button" className="button" disabled={uncheckAll.isPending || done === 0} onClick={() => uncheckAll.mutate()}>
            모두 해제
          </button>
          <button
            type="button"
            className="button button-danger ml-auto"
            disabled={removeAll.isPending}
            onClick={() => window.confirm('이 날짜의 준비물을 모두 삭제할까요?') && removeAll.mutate()}
          >
            전체 삭제
          </button>
        </div>
      )}
      {groupByCategory(items).map((group) => (
        <fieldset key={group.category}>
          <legend className="mono-label pb-1">{group.category}</legend>
          <ul>
            {group.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 border-b border-soft">
                <label className="flex min-h-11 min-w-0 flex-1 items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 accent-ink"
                    checked={item.checked}
                    onChange={(event) => toggle.mutate({ id: item.id, checked: event.target.checked })}
                  />
                  <span className={`break-words ${item.checked ? 'text-muted line-through' : ''}`}>{item.title}</span>
                </label>
                <button
                  type="button"
                  className="text-action shrink-0"
                  aria-label={`${item.title} 삭제`}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(item.id)}
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        </fieldset>
      ))}
      <form onSubmit={submit} noValidate className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="sm:flex-1">
          <Field label="준비물 추가" error={errors.title?.message} {...register('title', { required: '준비물 이름을 입력해 주세요.', maxLength: { value: 100, message: '100자까지 입력할 수 있습니다.' } })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`checklist-category-${date}`} className="mono-label">분류</label>
          <select id={`checklist-category-${date}`} className="min-h-11 border border-field bg-surface px-3 text-ink" {...register('category')}>
            {CHECKLIST_CATEGORIES.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="button sm:mt-[1.625rem]" disabled={add.isPending}>추가</button>
      </form>
    </section>
  );
};
