// 把裁剪区域绘制到 256×256 画布，输出 JPEG Blob。
const OUTPUT_SIZE = 256;
const OUTPUT_QUALITY = 0.9;

export interface CroppedAreaPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function cropImage(
  imageSrc: string,
  croppedAreaPixels: CroppedAreaPixels
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const context = canvas.getContext("2d");
      if (!context) {
        // 极少数环境拿不到 2d 上下文：以前会同步抛错，让 Promise 永远挂住
        reject(new Error("图片处理失败"));
        return;
      }
      context.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE
      );
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("图片处理失败"))),
        "image/jpeg",
        OUTPUT_QUALITY
      );
    };
    image.onerror = () => reject(new Error("图片加载失败"));
    image.src = imageSrc;
  });
}
