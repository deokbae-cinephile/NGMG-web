/** 기록이 있는 해에 올해를 더해 최근 순으로 둡니다. 기록이 없으면 올해만 보여 줍니다. */
export const withThisYear = (years: number[] = []) => [...new Set([...years, new Date().getFullYear()])].sort((a, b) => b - a);
