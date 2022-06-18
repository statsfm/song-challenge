import { Canvas } from 'canvas-constructor/skia';

const maxWidth = 643;

const maxFontSize = (canvas: Canvas, text: string, fontSize: number, font: string) => {
  canvas.setTextFont(`${fontSize}pt ${font}`);
  const minFontSize = 50;
  let width: number = canvas.measureText(text).width;
  if (width > maxWidth) {
    let newfontSize = fontSize;
    let decrement = 1;
    let newWidth;
    while (width > maxWidth) {
      newfontSize -= decrement;
      if (newfontSize < minFontSize) {
        return minFontSize;
      }
      canvas.setTextFont(`${newfontSize}pt ${font}`);
      newWidth = canvas.measureText(text).width;
      if (newWidth < maxWidth && decrement === 1) {
        decrement = 0.1;
        newfontSize += 1;
      } else {
        width = newWidth;
      }
    }
    return newfontSize;
  }
  return fontSize;
};

export function createSongChallengeCanvas(challengeName: string, challengeDescription: string) {

  const canvas = new Canvas(1000, 1000)
    .setColor('#191414')
    .printRectangle(0, 0, 1000, 1000)
    .setColor('#1ED761')
    .printRoundedRectangle(
      232.5,
      314.5,
      535.5,
      15,
      9
    )
    .setTextFont('75pt ProductSansBold')
    .setTextAlign('center')
    .setColor('#FFFFFF');

  const textFontSize = maxFontSize(canvas, challengeName, 75, 'ProductSansBold');

  canvas
    .setTextFont(`${textFontSize}pt ProductSansBold`)
    .printText(challengeName, 500, 261.5)
    .setTextSize(100)
    .printWrappedText(challengeDescription, 500, 481.5, maxWidth);
  return canvas.toBuffer('png');
}
