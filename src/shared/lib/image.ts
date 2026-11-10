/** 업로드 전에 긴 변 1600px(썸네일은 maxSize를 작게)의 JPEG로 줄입니다. 사진 방향은 브라우저가 맞춰 줍니다. */
export const compressImage = async (file: File, maxSize = 1600, quality = 0.82): Promise<Blob> => {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => {
    throw new Error(`이 브라우저에서 읽을 수 없는 사진입니다: ${file.name}`);
  });
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('사진을 변환하지 못했습니다.'))), 'image/jpeg', quality);
  });
};
