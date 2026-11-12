import { useCallback, useEffect, useRef, useState } from 'react';

export type Expanded = 'map' | 'list';

/** 방문 기록에 남긴 확대 상태 */
const readExpanded = (): Expanded | undefined => {
  const value = (history.state as { mapExpanded?: unknown } | null)?.mapExpanded;
  return value === 'map' || value === 'list' ? value : undefined;
};

/**
 * 지도 확대(지도를 화면 전체로) / 목록 확대(장소 목록이 지도 위를 꽉 채움). Esc나 '작게' 단추로 돌아옵니다.
 * 확대 상태는 방문 기록(history.state.mapExpanded)과 맞춥니다. 휴대폰 뒤로 가기는 확대만 닫고, 앞으로 가기는 다시 엽니다.
 * 확대한 칸 밖(머리글·메뉴·다른 칸)은 inert로 막고, 줄이면 초점을 그 화면을 연 단추로 돌려 둡니다.
 */
export const useExpanded = () => {
  const [expanded, setExpanded] = useState<Expanded | undefined>(readExpanded);
  const mapToggle = useRef<HTMLButtonElement>(null);
  const listToggle = useRef<HTMLButtonElement>(null);
  // 뒤로 가기를 보낸 뒤 popstate를 받기 전까지는 다시 보내지 않습니다(빠르게 두 번 누르면 이전 화면까지 가지 않게).
  const goingBack = useRef(false);
  useEffect(() => {
    const onHistory = () => {
      goingBack.current = false;
      setExpanded(readExpanded());
    };
    window.addEventListener('popstate', onHistory);
    return () => window.removeEventListener('popstate', onHistory);
  }, []);
  // 줄인 뒤에는 키보드 초점을 그 화면을 연 단추로 돌려 둡니다(다른 작업으로 넘어갈 때는 빼고). 상태가 바뀐 뒤 효과에서 옮깁니다.
  const refocus = useRef(true);
  const afterCollapse = useRef<() => void>(undefined); // 줄인 뒤 할 일(새 장소 창 열기)
  const previous = useRef(expanded);
  useEffect(() => {
    const before = previous.current;
    previous.current = expanded;
    if (!before || expanded) return;
    const target = before === 'map' ? mapToggle.current : listToggle.current;
    if (refocus.current) target?.focus({ preventScroll: true });
    refocus.current = true;
    afterCollapse.current?.();
    afterCollapse.current = undefined;
  }, [expanded]);
  const expand = (kind: Expanded) => {
    if (readExpanded()) history.replaceState({ ...history.state, mapExpanded: kind }, '');
    else history.pushState({ mapExpanded: kind }, '');
    setExpanded(kind);
  };
  /** 작게 단추·Esc·다른 작업: 쌓은 기록이 있으면 뒤로 가서(popstate가 줄임) 기록을 남기지 않습니다. */
  const collapse = useCallback((focusToggle = true) => {
    if (goingBack.current) return;
    refocus.current = focusToggle;
    if (readExpanded()) {
      goingBack.current = true;
      history.back();
    } else setExpanded(undefined);
  }, []);
  const toggle = (kind: Expanded) => (expanded === kind ? collapse() : expand(kind));
  /** 확대 중이면 먼저 줄인 뒤 합니다(확대 중에는 뒤쪽이 막혀 창을 쓸 수 없음). */
  const afterCollapsing = (task: () => void) => {
    // 주소 조회 중에 확대를 닫았을 수 있으므로, 렌더 때의 값이 아니라 지금의 확대 상태(previous, 효과에서 갱신)를 봅니다.
    if (!previous.current) return task();
    afterCollapse.current = task;
    collapse(false);
  };
  const expandedPane = useRef<HTMLElement | null>(null);
  const setExpandedPane = useCallback((node: HTMLElement | null) => {
    expandedPane.current = node;
  }, []);
  useEffect(() => {
    if (!expanded) return;
    // 확대 화면이 덮은 뒤쪽(머리글·메뉴·다른 칸)은 inert로 막아 Tab 초점이 가려진 곳으로 나가지 않게 합니다.
    const blocked: Element[] = [];
    for (let node: Element | null = expandedPane.current; node && node !== document.body; node = node.parentElement) {
      for (const sibling of node.parentElement?.children ?? []) {
        if (sibling === node || sibling.hasAttribute('inert') || sibling.tagName === 'SCRIPT') continue;
        sibling.setAttribute('inert', '');
        blocked.push(sibling);
      }
    }
    // 확대 중의 Esc는 확대만 닫습니다. 지도의 Esc(말풍선 닫기·선택 풀기)보다 먼저 받아 넘기지 않습니다.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
      event.stopPropagation();
      collapse();
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      blocked.forEach((element) => element.removeAttribute('inert'));
    };
  }, [expanded, collapse]);
  /** 확대한 칸에 붙일 ref(그 칸이 확대 중일 때만) */
  const paneRef = (kind: Expanded) => (expanded === kind ? setExpandedPane : undefined);
  return { expanded, collapse, toggle, afterCollapsing, paneRef, mapToggle, listToggle };
};
