// 把裁剪区域绘制到 256×256 画布，输出 JPEG Blob。
const OUTPUT_SIZE = 256;
const OUTPUT_QUALITY = 0.9;

export default function cropImage(imageSrc, croppedAreaPixels) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const context = canvas.getContext("2d");
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
