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

/** 사진을 한 번만 읽어 원본(긴 변 1600px)과 썸네일(thumbSize)을 함께 만듭니다. */
export const compressImageWithThumb = async (file: File, thumbSize: number): Promise<{ full: Blob; thumb: Blob }> => {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => {
    throw new Error(`이 브라우저에서 읽을 수 없는 사진입니다: ${file.name}`);
  });
  try {
    const [full, thumb] = await Promise.all([toJpeg(bitmap, 1600, 0.82), toJpeg(bitmap, thumbSize, 0.75)]);
    return { full, thumb };
  } finally {
    bitmap.close();
  }
};
