/** 클립보드에 복사합니다. 실패하면 false를 돌려줍니다. */
export const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export const kakaoMapLink = (place: { name: string; latitude: number; longitude: number }) =>
  `https://map.kakao.com/link/map/${encodeURIComponent(place.name)},${place.latitude},${place.longitude}`;

/** 휴대폰 공유 창을 열고, 지원하지 않는 브라우저에서는 내용을 복사합니다. */
export const sharePlace = async (place: { name: string; address: string; latitude: number; longitude: number }) => {
  const text = [place.name, place.address].filter(Boolean).join('\n');
  const url = kakaoMapLink(place);
  if (navigator.share) {
    try {
      await navigator.share({ title: place.name, text, url });
      return 'shared' as const;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled' as const;
    }
  }
  return (await copyText(`${text}\n${url}`)) ? ('copied' as const) : ('failed' as const);
};
