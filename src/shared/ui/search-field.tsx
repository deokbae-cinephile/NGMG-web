import { Field } from './field';

/**
 * 화면마다 같은 모양·동작의 찾기 칸(지도 장소, 전체 기록, 도감).
 * 이름표는 화면에서 감추고 칸 안의 안내 글자로 보여 주며(화면 읽기 프로그램은 이름표를 읽음),
 * 따로 '찾기' 단추 없이 입력하는 대로 찾습니다. 서버에서 찾는 곳은 부르는 쪽에서 잠깐 기다렸다가 찾습니다.
 */
export const SearchField = ({ label, placeholder = label, value, onChange }: { label: string; placeholder?: string; value: string; onChange: (value: string) => void }) => (
  <div role="search">
    <Field label={label} hideLabel placeholder={placeholder} type="search" value={value} onChange={(event) => onChange(event.target.value)} />
  </div>
);
