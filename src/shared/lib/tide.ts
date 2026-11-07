// 음력 일자는 브라우저 내장 단기 달력을 씁니다.
const lunarFormat = new Intl.DateTimeFormat('en-u-ca-dangi', { day: 'numeric', timeZone: 'Asia/Seoul' });

const SEVEN = ['7물', '8물', '9물', '10물', '11물', '12물', '13물', '조금', '무시'];
const EIGHT = ['8물', '9물', '10물', '11물', '12물', '13물', '14물', '조금'];

/** 서해는 7물때식, 남해·동해는 8물때식입니다. 해역은 좌표로 어림하므로 경계 근처는 다를 수 있습니다. */
const isWestSea = (latitude: number, longitude: number) => latitude >= 34.3 && longitude < 126.7;

export const getTide = (dateKey: string, latitude: number, longitude: number) => {
  const lunarDay = Number(lunarFormat.format(new Date(`${dateKey}T12:00:00+09:00`)));
  const position = ((lunarDay - 1) % 15) + 1;
  const west = isWestSea(latitude, longitude);
  const named = west ? SEVEN : EIGHT;
  const name = position <= named.length ? named[position - 1] : `${position - named.length}물`;
  return { lunarDay, name, system: west ? '7물때식' : '8물때식' };
};
