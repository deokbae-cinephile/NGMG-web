/** 함께 낚시하는 두 사람. DB의 check 제약과 같은 값입니다. */
export const ANGLERS = ['김 조사', '류 조사'] as const;
export type Angler = (typeof ANGLERS)[number];
