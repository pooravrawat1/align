// One contour drives the shader mask, the optical rim and the HTML HUD clip.
export const VISOR_PATH = 'M 62 232 C 62 131 390 40 800 40 C 1210 40 1538 131 1538 232 L 1538 522 C 1538 615 1508 654 1410 679 L 1057 753 C 962 773 932 707 910 669 C 886 625 854 607 800 607 C 746 607 714 625 690 669 C 668 707 638 773 543 753 L 190 679 C 92 654 62 615 62 522 Z';

export const ROOM_IMAGE = '/assets/hero-room-v3.webp';
export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const smooth = (from: number, to: number, value: number) => {
  const t = clamp((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};

export const JOURNEY = { discover: .4, network: 1 } as const;

const leg = (start: number, end: number, from: number, to: number) => [start + (end - start) * from, start + (end - start) * to] as const;
// Ranges are local to each leg; the same playhead drives geometry and typography.
export const JOURNEY_TRACKS = {
  heroExit: leg(0, .4, 0, .18), jordanExit: leg(0, .4, .10, .26),
  lens: leg(0, .4, .04, .78), camera: leg(0, .4, .08, .78),
  worldDim: [.26, .72],
  savedShell: [.28, .72], networkIn: [.64, .88],
  portrait: [.5, .7], savedIn: [.74, .94],
  connectionIn: [.88, 1],
} as const;

export function journeyState(progress: number) {
  const p = clamp(progress);
  const at = (range: readonly [number, number]) => smooth(...range, p);
  const collapse = 0;
  const network = at(JOURNEY_TRACKS.savedShell);
  return {
    approach: at(JOURNEY_TRACKS.lens), camera: at(JOURNEY_TRACKS.camera),
    reason: network, collapse, network,
    chip: collapse * (1 - network),
    portrait: at(JOURNEY_TRACKS.portrait),
    identityDetail: clamp(1 - smooth(0, .3, collapse) + smooth(.68, .85, network)),
    reflection: Math.sin(Math.PI * smooth(0, .12, p / JOURNEY.discover)) * (1 - at(JOURNEY_TRACKS.lens)),
  };
}

export function matchLayout(width: number, height: number, image: ReturnType<typeof roomLayout>, state: ReturnType<typeof journeyState>) {
  const { reason, collapse, network } = state;
  const headX = image.left + image.width * .586;
  const headY = image.top + image.height * .411;
  const cardWidth = 218 + reason * (width < 1200 ? 62 : 112);
  const edgeInset = width * (width < 1200 ? .14 - reason * .09 : .14);
  const initialX = width < 700 ? clamp(headX - 76, 22, width - cardWidth - 22) : clamp(headX + 65, 24, width - cardWidth - edgeInset);
  const initialY = width < 700 ? Math.max(128, headY - 150) : Math.max(height * .29, headY - 120);
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  return {
    x: mix(mix(initialX, clamp(headX + 26, 24, width - 108), collapse), Math.min(width * .64, width * .95 - 380), network),
    y: mix(mix(initialY, clamp(headY - 22, 110, height - 52), collapse), Math.max(104, height * .49 - 224), network),
    width: mix(mix(cardWidth, 84, collapse), 380, network),
    height: mix(mix(76 + reason * 198, 28, collapse), 448, network),
  };
}

export function roomLayout(width: number, height: number, aspect: number, approach = 0) {
  const baseWidth = Math.max(width, height * aspect);
  const imageWidth = baseWidth * (1 + approach * .065);
  const imageHeight = imageWidth / aspect;
  return {
    width: imageWidth,
    height: imageHeight,
    // Zoom toward Maya; the photo and its labels always share this transform.
    left: (width - baseWidth) * (width < 700 ? .59 : .5) - (imageWidth - baseWidth) * .586,
    top: (height - baseWidth / aspect) * .5 - (imageHeight - baseWidth / aspect) * .411,
  };
}
