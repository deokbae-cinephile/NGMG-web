export const photoAlt = (date: string, index: number) => `${date} 기록 사진 ${index + 1} (새 창에서 크게 보기)`;

/** 누르면 새 창에서 크게 보는 기록 사진 */
export const PhotoLink = ({ url, alt }: { url: string; alt: string }) => (
  <a href={url} target="_blank" rel="noreferrer" className="block">
    <img src={url} alt={alt} loading="lazy" className="aspect-[4/3] w-full border border-line bg-surface object-cover" />
  </a>
);
