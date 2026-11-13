const toJpeg = (bitmap: ImageBitmap, maxSize: number, quality: number) => {
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        // 캔버스 메모리를 바로 돌려줍니다. 아이폰 사파리는 캔버스 메모리 합계에 한도가 있어, 사진을 여러 장 올리면 변환이 실패할 수 있습니다.
        canvas.width = 0;
        canvas.height = 0;
        if (blob) resolve(blob);
        else reject(new Error('사진을 변환하지 못했습니다.'));
      },
      'image/jpeg',
      quality,
    );
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
const compress = async (file: File, thumbSize: number): Promise<{ full: Blob; thumb: Blob }> => {
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

let decoding: Promise<unknown> = Promise.resolve();

/**
 * 사진을 줄여 원본과 썸네일을 만듭니다. 풀기·줄이기는 한 장씩 차례로 합니다.
 * 여러 장을 함께 올릴 때(기록 사진 3장씩) 큰 사진을 동시에 풀면 휴대폰 메모리가 그만큼 더 필요하므로, 올리기만 함께 진행합니다.
 */
export const compressImageWithThumb = (file: File, thumbSize: number) => {
  const turn = decoding.then(() => compress(file, thumbSize));
  decoding = turn.catch(() => undefined); // 한 장이 실패해도 다음 사진은 이어서 풉니다.
  return turn;
};

/**
 * 사진 파일의 저장 경로용 이름: 수정 시각·크기·이름 해시·순서. 같은 저장(같은 파일·같은 순서)이면 같은 이름이라 다시 올려도 중복되지 않고,
 * 연속 촬영처럼 크기·시각이 같은 사진끼리도 겹치지 않습니다. 한글·공백은 경로에 넣지 않습니다.
 */
export const photoFileKey = (file: File, index = 0) => {
  const hash = [...file.name].reduce((value, char) => (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0, 7).toString(36);
  return `${file.lastModified}-${file.size}-${hash}-${index}`;
};

const fileKeys = new WeakMap<File, string>();
let lastFileKey = 0;

/** 고른 파일마다 한 번 정해지는 목록 key. 앞의 사진을 빼도 뒤 사진의 미리보기를 다시 만들지 않습니다. */
export const fileKey = (file: File) => {
  let key = fileKeys.get(file);
  if (!key) {
    lastFileKey += 1;
    key = `file-${lastFileKey}`;
    fileKeys.set(file, key);
  }
  return key;
};
