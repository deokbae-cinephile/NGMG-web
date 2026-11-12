const toJpeg = (bitmap: ImageBitmap, maxSize: number, quality: number) => {
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('사진을 변환하지 못했습니다.'))), 'image/jpeg', quality);
  });
};

/** 사진의 가로·세로(픽셀)만 읽습니다. 전체를 풀지 않아 큰 사진도 가볍습니다. 못 읽으면 undefined입니다. */
const imageSize = (file: File) =>
  new Promise<{ width: number; height: number } | undefined>((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      resolve(undefined);
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });

/** 풀어 둘 최대 가로(px). 2억 화소 사진(약 16000px)을 그대로 풀면 휴대폰 메모리가 모자라므로, 이 크기로 줄여 풀고 나서 1600px로 만듭니다. */
const DECODE_MAX = 3200;

/** 사진을 한 번만 읽어 원본(긴 변 1600px)과 썸네일(thumbSize)을 함께 만듭니다. */
export const compressImageWithThumb = async (file: File, thumbSize: number): Promise<{ full: Blob; thumb: Blob }> => {
  const size = await imageSize(file);
  // 큰 사진은 줄여서 풉니다(가로만 주면 세로는 비율대로). 줄여 풀기를 못 하는 브라우저는 그대로 풉니다.
  const decode = (options: ImageBitmapOptions) => createImageBitmap(file, { imageOrientation: 'from-image', ...options });
  const bitmap = await (size && size.width > DECODE_MAX ? decode({ resizeWidth: DECODE_MAX, resizeQuality: 'high' }).catch(() => decode({})) : decode({})).catch(() => {
    throw new Error(`이 브라우저에서 읽을 수 없는 사진입니다(고효율 HEIC 사진이면 휴대폰 카메라 설정에서 끄거나 JPG로 바꿔 올려 주세요): ${file.name}`);
  });
  try {
    const [full, thumb] = await Promise.all([toJpeg(bitmap, 1600, 0.82), toJpeg(bitmap, thumbSize, 0.75)]);
    return { full, thumb };
  } finally {
    bitmap.close();
  }
};
