import { forwardRef, useEffect, useId, useImperativeHandle, useRef, type ReactNode } from 'react';
import { ROOM_IMAGE, VISOR_PATH, clamp, journeyState, roomLayout, matchLayout } from './visorGeometry';

export interface VisorHandle { setProgress: (progress: number) => void }

const fragmentShader = `
  uniform sampler2D uPhoto;
  uniform sampler2D uMask;
  uniform vec2 uResolution;
  uniform vec4 uImage;
  uniform vec4 uLens;
  uniform vec2 uPointer;
  uniform float uExpansion;
  uniform float uReflection;
  varying vec2 vUv;

  float maskAt(vec2 uv) {
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
    return texture2D(uMask, vec2(uv.x, 1.0 - uv.y)).r;
  }
  vec2 photoUv(vec2 pixel) {
    vec2 uv = (pixel - uImage.xy) / uImage.zw;
    return vec2(uv.x, 1.0 - uv.y);
  }
  void main() {
    vec2 pixel = vec2(vUv.x, 1.0 - vUv.y) * uResolution;
    vec2 local = (pixel - uLens.xy) / uLens.zw;
    float lens = maskAt(local);
    float edge = lens * (1.0 - maskAt((local - .5) * 1.075 + .5));
    vec2 radial = local - .5;
    // Refraction lives at the rim. The center and exterior share exact photo coordinates.
    vec2 offset = radial * edge * 9.0 * (1.0 - smoothstep(.8, 1.0, uExpansion) * .35);
    vec2 uv = photoUv(pixel + offset);
    vec2 split = radial * edge * .0018;
    vec3 color = vec3(
      texture2D(uPhoto, uv + split).r,
      texture2D(uPhoto, uv).g,
      texture2D(uPhoto, uv - split).b
    );
    vec3 photo = texture2D(uPhoto, photoUv(pixel)).rgb;
    float gray = dot(photo, vec3(.2126, .7152, .0722));
    vec3 outside = mix(vec3(gray), photo, .08) * vec3(.37, .39, .43);
    float glint = pow(max(0.0, 1.0 - abs(local.x + local.y * .36 - .3 - uPointer.x * .08)), 14.0);
    color = color * (1.0 - edge * .11) + edge * glint * (1.0 + uReflection * 1.4) * vec3(.10, .14, .15);
    gl_FragColor = vec4(mix(outside, color, lens), 1.0);
  }
`;

export const VisorScene = forwardRef<VisorHandle, { children: ReactNode }>(function VisorScene({ children }, ref) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const progress = useRef(0);
  const invalidate = useRef<() => void>(() => {});
  const id = `visor-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  useImperativeHandle(ref, () => ({ setProgress(value) { progress.current = value; invalidate.current(); } }), []);

  useEffect(() => {
    const host = root.current!;
    const surface = canvas.current!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
    let disposed = false;
    let visible = true;
    let frame = 0;
    let width = 1, height = 1, aspect = 16 / 9;
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    let drawGpu: (() => void) | undefined;
    let disposeGpu: (() => void) | undefined;
    let resizeGpu: (() => void) | undefined;
    let updateGpu: ((image: ReturnType<typeof roomLayout>, lens: number[], expansion: number, reflection: number) => void) | undefined;

    const fallbackPhoto = host.querySelector<SVGImageElement>('[data-photo]')!;
    const fullPhoto = host.querySelector<HTMLImageElement>('.qv-photo')!;
    const contour = host.querySelector<SVGPathElement>('[data-contour]')!;
    const rim = host.querySelector<SVGGElement>('[data-rim]')!;
    const rootSvg = host.querySelector<SVGSVGElement>('.qv-optics')!;
    const match = host.querySelector<HTMLElement>('.qv-match')!;

    function layout() {
      const p = progress.current;
      const state = journeyState(p);
      const { approach: expansion, camera, reason, collapse, network, chip, portrait, identityDetail, reflection } = state;
      const baseWidth = width < 700 ? Math.max(width * 1.4, height * 1.18) : Math.min(width * .94, height * (width >= 900 ? 1.4 : 1.72));
      // The nose relief must clear the bottom edge even on tall desktop viewports.
      const expandedWidth = Math.max(baseWidth * 2.75, height * 4.3);
      const lensWidth = baseWidth + (expandedWidth - baseWidth) * expansion;
      const lensHeight = lensWidth / 2;
      const drift = (1 - expansion) * (reduced.matches ? 0 : 1);
      const left = width / 2 - lensWidth / 2 + pointer.x * 19 * drift;
      // Reserve the lower band for the headline instead of crossing it with the rim.
      const centerY = width < 700 ? .38 : width >= 900 ? .4 + .07 * expansion : .47;
      const top = height * centerY - lensHeight / 2 + pointer.y * 11 * drift;
      const image = roomLayout(width, height, aspect, camera);
      const transform = `translate(${left} ${top}) scale(${lensWidth / 1600})`;
      contour.setAttribute('transform', transform);
      rim.setAttribute('transform', transform);
      // The physical rim leaves the frame with the lens instead of dissolving.
      rim.style.opacity = '1';
      rim.querySelector('[data-reflection]')?.setAttribute('stroke-opacity', String(.17 + reflection * .45));
      rootSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      for (const [key, value] of Object.entries({ x: image.left, y: image.top, width: image.width, height: image.height })) {
        fallbackPhoto.setAttribute(key, String(value));
      }
      Object.assign(fullPhoto.style, { left: `${image.left}px`, top: `${image.top}px`, width: `${image.width}px`, height: `${image.height}px` });

      // These anchors use image coordinates; lens movement never moves a person or label.
      const card = matchLayout(width, height, image, state);
      host.style.setProperty('--match-x', `${card.x}px`);
      host.style.setProperty('--match-y', `${card.y}px`);
      host.style.setProperty('--match-width', `${card.width}px`);
      host.style.setProperty('--match-height', `${card.height}px`);
      host.style.setProperty('--chip', String(chip));
      host.style.setProperty('--identity-detail', String(identityDetail));
      host.style.setProperty('--saved', String(portrait));
      host.dataset.expanded = network === 1 ? 'true' : 'false';
      // Clip scene shading, not the glass ancestor: glass must sample the photo.
      host.style.setProperty('--visor-shade-clip', expansion === 1 ? 'none' : `url(#${id})`);
      host.style.setProperty('--match-expanded', String(Math.max(reason * (1 - collapse), network)));
      const role = match.querySelector<HTMLElement>('.qv-match-identity small')!;
      role.style.visibility = identityDetail === 0 ? 'hidden' : 'visible';
      host.style.setProperty('--jordan-x', `${image.left + image.width * .25}px`);
      host.style.setProperty('--jordan-y', `${image.top + image.height * .36}px`);
      host.style.setProperty('--rim-light', `${65 + pointer.x * 12}%`);
      updateGpu?.(image, [left, top, lensWidth, lensHeight], expansion, reflection);
    }

    function render() {
      frame = 0;
      if (disposed || !visible || document.hidden) return;
      pointer.x += (pointer.targetX - pointer.x) * .11;
      pointer.y += (pointer.targetY - pointer.y) * .11;
      layout();
      drawGpu?.();
      if (Math.abs(pointer.x - pointer.targetX) + Math.abs(pointer.y - pointer.targetY) > .001) requestRender();
    }
    function requestRender() { if (!frame && !disposed && visible && !document.hidden) frame = requestAnimationFrame(render); }
    invalidate.current = requestRender;

    function resize() {
      width = host.clientWidth;
      height = host.clientHeight;
      resizeGpu?.();
      layout();
      requestRender();
    }
    function onPointer(event: PointerEvent) {
      if (!finePointer.matches || reduced.matches || progress.current > .55) return;
      const bounds = host.getBoundingClientRect();
      pointer.targetX = clamp((event.clientX - bounds.left) / width * 2 - 1, -1, 1);
      pointer.targetY = clamp((event.clientY - bounds.top) / height * 2 - 1, -1, 1);
      requestRender();
    }
    function resetPointer() { pointer.targetX = 0; pointer.targetY = 0; requestRender(); }
    const stage = host.parentElement!;
    stage.addEventListener('pointermove', onPointer);
    stage.addEventListener('pointerleave', resetPointer);
    reduced.addEventListener('change', resetPointer);
    document.addEventListener('visibilitychange', requestRender);
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; requestRender(); });
    intersection.observe(host);
    resize();

    async function initialize() {
      const THREE = await import('three');
      if (disposed) return;
      const photo = await new THREE.TextureLoader().loadAsync(ROOM_IMAGE);
      if (disposed) { photo.dispose(); return; }
      aspect = photo.image.width / photo.image.height;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try { renderer = new THREE.WebGLRenderer({ canvas: surface, antialias: false, alpha: false, powerPreference: 'low-power' }); }
      catch { photo.dispose(); resize(); return; }
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = 2400; maskCanvas.height = 1200;
      const context = maskCanvas.getContext('2d')!;
      context.fillStyle = 'black'; context.fillRect(0, 0, 2400, 1200);
      context.scale(1.5, 1.5); context.fillStyle = 'white'; context.fill(new Path2D(VISOR_PATH));
      const mask = new THREE.CanvasTexture(maskCanvas);
      mask.generateMipmaps = false;
      mask.minFilter = THREE.LinearFilter;
      const uniforms = {
        uPhoto: { value: photo }, uMask: { value: mask },
        uResolution: { value: new THREE.Vector2(width, height) },
        uImage: { value: new THREE.Vector4() }, uLens: { value: new THREE.Vector4() },
        uPointer: { value: new THREE.Vector2() }, uExpansion: { value: 0 }, uReflection: { value: 0 },
      };
      const material = new THREE.ShaderMaterial({
        uniforms, fragmentShader,
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        depthTest: false, depthWrite: false,
      });
      const geometry = new THREE.PlaneGeometry(2, 2);
      const scene = new THREE.Scene();
      scene.add(new THREE.Mesh(geometry, material));
      const camera = new THREE.Camera();
      updateGpu = (image, lens, expansion, reflection) => {
        uniforms.uResolution.value.set(width, height);
        uniforms.uImage.value.set(image.left, image.top, image.width, image.height);
        uniforms.uLens.value.set(lens[0], lens[1], lens[2], lens[3]);
        uniforms.uPointer.value.set(pointer.x, pointer.y);
        uniforms.uExpansion.value = expansion;
        uniforms.uReflection.value = reflection;
      };
      resizeGpu = () => renderer.setSize(width, height, false);
      drawGpu = () => { renderer.render(scene, camera); host.dataset.renderer = 'webgl'; };
      disposeGpu = () => { photo.dispose(); mask.dispose(); geometry.dispose(); material.dispose(); renderer.dispose(); };
      resize();
    }
    void initialize().catch(() => { /* The aligned SVG composition remains visible if WebGL is unavailable. */ });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      invalidate.current = () => {};
      observer.disconnect(); intersection.disconnect();
      stage.removeEventListener('pointermove', onPointer);
      stage.removeEventListener('pointerleave', resetPointer);
      reduced.removeEventListener('change', resetPointer);
      document.removeEventListener('visibilitychange', requestRender);
      disposeGpu?.();
      delete host.dataset.renderer;
    };
  }, []);

  return <div className="qv-scene" ref={root}>
    <img className="qv-photo" src={ROOM_IMAGE} alt="" fetchPriority="high" />
    <svg className="qv-optics" aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <clipPath id={id} clipPathUnits="userSpaceOnUse"><path d={VISOR_PATH} data-contour /></clipPath>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2=".7" y2="1">
          <stop offset="0" stopColor="#f0f6f4" /><stop offset=".25" stopColor="#a7b5bc" />
          <stop offset=".46" stopColor="#394d53" /><stop offset=".72" stopColor="#e6edec" /><stop offset="1" stopColor="#82949c" />
        </linearGradient>
      </defs>
      <image data-photo href={ROOM_IMAGE} preserveAspectRatio="none" clipPath={`url(#${id})`} className="qv-fallback-color" />
    </svg>
    <canvas ref={canvas} className="qv-canvas" aria-hidden="true" />
    <svg className="qv-rim" aria-hidden="true">
      <g data-rim>
        <path d={VISOR_PATH} fill="none" stroke="#030809" strokeWidth="10" />
        <path d={VISOR_PATH} fill="none" stroke={`url(#${id}-edge)`} strokeWidth="2.5" />
        <path d={VISOR_PATH} fill="none" stroke="#f0ffff" strokeOpacity=".17" data-reflection strokeWidth="1" transform="translate(0 3)" />
      </g>
    </svg>
    <div className="qv-hud">{children}</div>
  </div>;
});
