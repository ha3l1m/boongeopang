import type { ReactElement } from 'react'
import type { SceneMode } from '../three/sceneMode'
import { BAG, FISH, FISH_FIT } from './BagStage'
import './bongbotScene.css'

/**
 * Robot-kitchen illustration for the order status screen. Frames and patches come from
 * tools/art/build_bongbot_layers.py; the viewBox reuses the 1536x1024 source pixel coordinates.
 * Each step shows its frame (cross-fading from the previous one) and plays its own overlay animation on top.
 */
type Frame = 'received' | 'batter' | 'filling' | 'baking' | 'baked' | 'packed' | 'ready'

const FRAMES: Frame[] = ['received', 'batter', 'filling', 'baking', 'baked', 'packed', 'ready']

const FRAME_OF: Record<SceneMode, Frame> = {
  idle: 'received',
  ordering: 'received',
  received: 'received',
  batter: 'batter',
  filling: 'filling',
  baking: 'baking',
  packed: 'packed',
  ready: 'ready',
}

/**
 * The stage is narrower than the 3:2 art, so only ~900-1100 of 1536 columns show. Each step pans sideways (source pixels,
 * + moves the picture right) to keep its action in view: the gripper on arrival, the pour, the mold, the bag.
 */
const PAN: Record<SceneMode, number> = {
  idle: 70,
  ordering: 70,
  received: 70,
  batter: -30,
  filling: 0,
  baking: 0,
  packed: 0,
  ready: -20,
}

const LAMPS = [
  { x: 1105, y: 138, r: 70 },
  { x: 1252, y: 138, r: 70 },
]

function Ambient() {
  return (
    <g className="bongbot__ambient">
      {LAMPS.map((lamp, i) => (
        <circle
          key={lamp.x}
          cx={lamp.x}
          cy={lamp.y}
          r={lamp.r}
          fill="url(#bongbot-glow)"
          className="bongbot__lamp"
          style={{ animationDelay: `${i * -1.1}s` }}
        />
      ))}
      <ellipse cx="1418" cy="246" rx="120" ry="95" fill="url(#bongbot-glow)" className="bongbot__sign" />
      <ellipse cx="50" cy="420" rx="150" ry="200" fill="url(#bongbot-glow)" className="bongbot__oven" />
    </g>
  )
}

/** Batter spreads out from where the stream lands: left cavity first, then the right one. */
function BatterPour() {
  return (
    <g>
      <mask id="bongbot-batter-mask" maskUnits="userSpaceOnUse" x="740" y="630" width="590" height="130">
        <rect x="740" y="630" width="590" height="130" fill="#fff" />
        <ellipse cx="848" cy="700" rx="170" ry="70" className="bongbot__spread bongbot__spread--a" />
        <ellipse cx="1160" cy="706" rx="170" ry="70" className="bongbot__spread bongbot__spread--b" />
      </mask>
      <image
        href="/art/bongbot/batter-empty.webp"
        x="740"
        y="630"
        width="590"
        height="130"
        mask="url(#bongbot-batter-mask)"
      />
      <path d="M833 600 C836 628 846 652 848 694" className="bongbot__flow" />
      <ellipse cx="850" cy="700" rx="40" ry="10" className="bongbot__ripple" />
      <ellipse cx="850" cy="700" rx="40" ry="10" className="bongbot__ripple bongbot__ripple--late" />
    </g>
  )
}

/**
 * Where each bean pile sits (its patch box, from build_bongbot_layers.py) and the point on the batter it grows up from.
 * The step starts on plain batter; each pile is its own layer that swells up from that point, left cavity first.
 */
const BEAN_PILES = [
  { x: 776, y: 650, width: 192, height: 106, base: '856px 736px' },
  { x: 1062, y: 662, width: 172, height: 94, base: '1148px 738px' },
]

/** Below the nozzle's bottom rim (tools/art NOZZLE_RIM): falling beans are clipped to it so they come out of the tip. */
const BELOW_NOZZLE = '790,643 880,607 880,780 790,780'

/**
 * Whole red beans: the step starts on batter only. Single beans drop out of the nozzle onto the left cavity, the
 * mound heaps up there, and as it grows the bean column builds up from it until it joins the nozzle (revealed
 * bottom-up behind a round-topped mask, so it never shows a straight edge). Then the right mound heaps up.
 */
function FillingPour() {
  return (
    <g>
      <clipPath id="bongbot-below-nozzle">
        <polygon points={BELOW_NOZZLE} />
      </clipPath>
      <clipPath id="bongbot-column-clip">
        <ellipse cx="848" cy="740" rx="34" ry="50" className="bongbot__column-reveal" />
      </clipPath>
      <image href="/art/bongbot/filling-clean.webp" x="760" y="600" width="490" height="170" />
      {BEAN_PILES.map((pile, i) => (
        <image
          key={`pile-${i}`}
          href={`/art/bongbot/beans-${i}.webp`}
          x={pile.x}
          y={pile.y}
          width={pile.width}
          height={pile.height}
          className={`bongbot__pile bongbot__pile--${i}`}
          style={{ transformOrigin: pile.base }}
        />
      ))}
      <image
        href="/art/bongbot/beans-column.webp"
        x="815"
        y="600"
        width="60"
        height="100"
        clipPath="url(#bongbot-column-clip)"
      />
      <g clipPath="url(#bongbot-below-nozzle)">
        {[0, 1, 2].map((i) => (
          <g key={i} className="bongbot__falling-bean" style={{ animationDelay: `${0.3 + i * 0.3}s` }}>
            <ellipse rx="12" ry="14" fill="url(#bongbot-bean)" />
            <ellipse cx="-4" cy="-5" rx="3" ry="5" fill="#FFE4DC" opacity="0.6" />
          </g>
        ))}
      </g>
    </g>
  )
}

/** Wisps of steam; x/y is each wisp's base in source pixels. */
function Steam({ wisps, className = '' }: { wisps: { x: number; y: number }[]; className?: string }) {
  return (
    <g filter="url(#bongbot-steam-blur)" className={className}>
      {wisps.map((w, i) => (
        <path
          key={`${w.x}-${w.y}`}
          className="bongbot__steam"
          style={{ animationDelay: `${i * -0.9}s` }}
          d={`M${w.x} ${w.y} c-18 -24 18 -44 0 -68 s18 -44 0 -68`}
        />
      ))}
    </g>
  )
}

/**
 * Baking storyboard images (tools/art/build_bongbot_layers.py), shown as drawn: each fits the stage width at its own
 * aspect ratio (the stage is narrower than all of them, so nothing is cropped), and the strips above and below take the
 * image's own top and bottom edge colours. `pan` is the glowing round pan (radial-gradient size and centre in image percentages); its pixels are brightened
 * under a soft mask that fades to nothing, so no outline shows.
 */
/**
 * Baking shots (tools/art/build_bongbot_layers.py): square, the supplied image in the middle and codex-extended bokeh and
 * counter above and below, so each one covers the stage with nothing cropped from the mold. `pan` is the glowing round
 * pan (radial-gradient size and centre in shot percentages); its pixels are brightened under a soft mask.
 */
const BAKE_SHOTS = [
  { name: 'open', pan: '36% 7% at 50% 78%' },
  { name: 'closing', pan: '34% 6% at 50% 80%' },
  { name: 'closed', pan: '36% 7% at 50% 73%' },
  { name: 'baked' },
]

/**
 * Baking follows the storyboard as drawn: the filled mold, the lid swinging down, the lid shut with a thump and a
 * sizzle while the hot pan pulses, then the lid opens on two golden fish.
 */
function BakeSequence() {
  return (
    <div className="bongbot__bake-layer" aria-hidden="true">
      {BAKE_SHOTS.map((shot) => (
        <div key={shot.name} className={`bongbot__bake bongbot__bake--${shot.name}`}>
          <div className="bongbot__bake-shot">
            <img src={`/art/bongbot/bake-${shot.name}.webp`} alt="" />
            {shot.pan && (
              <img
                src={`/art/bongbot/bake-${shot.name}.webp`}
                alt=""
                className="bongbot__pan-glow"
                style={{
                  maskImage: `radial-gradient(${shot.pan}, #000 35%, transparent 100%)`,
                }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/** The app's fish (public/art/fish.webp, 360x253) placed in the close-up packing shot, centred on (x, y). */
const FISH_W = 360
const FISH_H = 253
const fishAt = (x: number, y: number, deg: number, scale: number) =>
  `translate(${x} ${y}) rotate(${deg}) scale(${scale}) translate(${-FISH_W / 2} ${-FISH_H / 2})`
const HELD_FISH = fishAt(842, 398, 26, 1.1)
/** Already in the pouch, back to front; only their tops show above the front lip. */
const PILE = [fishAt(660, 575, -24, 0.72), fishAt(925, 578, 18, 0.68), fishAt(795, 590, -6, 0.74)]

/**
 * Close-up packing shot (tools/art/build_bongbot_layers.py): the gripper holds a fish over a pouch that already has a few
 * in it, wiggles it, lets go, and the fish drops in behind the pouch's front lip. Not an overlay, so with reduced motion
 * the still shot keeps the held fish and the pile.
 */
function Packing() {
  return (
    <g className="bongbot__packing">
      <g className="bongbot__bag-pile">
        {PILE.map((transform) => (
          <image key={transform} href="/art/fish.webp" width={FISH_W} height={FISH_H} transform={transform} />
        ))}
      </g>
      <g className="bongbot__drop-fish">
        <g className="bongbot__swing">
          <image href="/art/fish.webp" width={FISH_W} height={FISH_H} transform={HELD_FISH} />
        </g>
      </g>
      <image href="/art/bongbot/packed-front.webp" x="380" y="460" width="780" height="564" />
      <image href="/art/bongbot/packed-fingers.webp" x="560" y="170" width="440" height="305" />
      <g className="bongbot__overlay">
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={star(700 + i * 90, 540 - (i % 2) * 30, 22)}
            className="bongbot__pop"
            style={{ animationDelay: `${3.15 + i * 0.08}s` }}
          />
        ))}
      </g>
    </g>
  )
}

const SPARKLES = [
  { x: 470, y: 590, r: 18 },
  { x: 760, y: 630, r: 14 },
  { x: 425, y: 790, r: 14 },
  { x: 790, y: 770, r: 12 },
  { x: 720, y: 560, r: 12 },
]

function star(x: number, y: number, r: number): string {
  const k = r * 0.28
  return `M${x} ${y - r} Q${x + k} ${y - k} ${x + r} ${y} Q${x + k} ${y + k} ${x} ${y + r} Q${x - k} ${y + k} ${x - r} ${y} Q${x - k} ${y - k} ${x} ${y - r}Z`
}

/**
 * The clay pouch from the confirm page (public/art/bag, drawn in its 1312x1199 source coordinates) standing on the counter
 * where the ready frame's kraft bag was painted out: fish peek out of it while sparkles twinkle and steam rises.
 */
const POUCH = 'translate(440 563) scale(0.4) translate(-235 -337)'
const POUCH_FOOT = { cx: 603, cy: 860 }

function Pouch() {
  return (
    <g className="bongbot__pouch">
      <ellipse {...POUCH_FOOT} rx="170" ry="16" fill="url(#bongbot-pouch-shadow)" />
      <g transform={POUCH}>
        <image href="/art/bag/empty.webp" {...BAG} />
        <g transform={FISH_FIT}>
          {FISH.map((fish, i) => (
            <image
              key={i}
              href={`/art/bag/fish-${i}.webp`}
              x={fish.x}
              y={fish.y}
              width={fish.width}
              height={fish.height}
            />
          ))}
        </g>
        <image href="/art/bag/empty-front.webp" {...BAG} />
      </g>
      <g className="bongbot__overlay">
        {SPARKLES.map((s, i) => (
          <path
            key={i}
            d={star(s.x, s.y, s.r)}
            className="bongbot__twinkle"
            style={{ animationDelay: `${i * -0.37}s` }}
          />
        ))}
        <Steam
          wisps={[
            { x: 560, y: 600 },
            { x: 610, y: 588 },
            { x: 660, y: 600 },
          ]}
        />
      </g>
    </g>
  )
}

/** Fish cavities in the open mold, and the gripper's two bolts (source pixels of received.webp). */
const CAVITIES = [
  { x: 920, y: 690 },
  { x: 1160, y: 690 },
]
const BOLTS = [
  { x: 213, y: 211 },
  { x: 249, y: 211 },
]

/**
 * Order received: the machine powers up. The gripper's bolts blink like status lights, the burner under the mold
 * lights and the empty cavities heat to an orange glow.
 */
function Received() {
  return (
    <g>
      <ellipse cx="1047" cy="850" rx="250" ry="55" fill="url(#bongbot-heat)" className="bongbot__warm-burner" />
      {CAVITIES.map((c) => (
        <ellipse
          key={c.x}
          cx={c.x}
          cy={c.y}
          rx="110"
          ry="40"
          fill="url(#bongbot-heat)"
          className="bongbot__warm-cavity"
        />
      ))}
      {BOLTS.map((b, i) => (
        <circle
          key={b.x}
          cx={b.x}
          cy={b.y}
          r="11"
          className="bongbot__led"
          style={{ animationDelay: `${i * 0.25}s` }}
        />
      ))}
    </g>
  )
}

const OVERLAY: Partial<Record<SceneMode, () => ReactElement>> = {
  idle: Received,
  ordering: Received,
  received: Received,
  batter: BatterPour,
  filling: FillingPour,
}

export function BongbotScene({ mode, cue }: { mode: SceneMode; cue: number }) {
  const frame = FRAME_OF[mode]
  const Overlay = OVERLAY[mode]
  return (
    <>
      <svg
        className={`bongbot bongbot--${mode}`}
        viewBox="0 0 1536 1024"
        preserveAspectRatio="xMidYMid slice"
        role="presentation"
      >
        <defs>
          <radialGradient id="bongbot-glow">
            <stop offset="0" stopColor="#FFE9B0" stopOpacity="0.9" />
            <stop offset="0.5" stopColor="#FFB95C" stopOpacity="0.35" />
            <stop offset="1" stopColor="#FF9A3C" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="bongbot-heat">
            <stop offset="0" stopColor="#FF9A3C" stopOpacity="0.95" />
            <stop offset="0.55" stopColor="#FF7A1A" stopOpacity="0.45" />
            <stop offset="1" stopColor="#FF6A1A" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="bongbot-bean" cx="0.38" cy="0.32" r="0.7">
            <stop offset="0" stopColor="#B54A40" />
            <stop offset="0.6" stopColor="#7E231B" />
            <stop offset="1" stopColor="#4E120D" />
          </radialGradient>
          <filter id="bongbot-steam-blur" x="-60%" y="-30%" width="220%" height="160%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <radialGradient id="bongbot-pouch-shadow">
            <stop offset="0" stopColor="#7A4A1C" stopOpacity="0.35" />
            <stop offset="1" stopColor="#7A4A1C" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g className="bongbot__pan" style={{ transform: `translateX(${PAN[mode]}px)` }}>
          <g className="bongbot__zoom">
            {FRAMES.map((name) => (
              <image
                key={name}
                href={`/art/bongbot/${name}.webp`}
                width="1536"
                height="1024"
                className={`bongbot__frame bongbot__frame--${name}${name === frame ? ' is-on' : ''}`}
              />
            ))}
            <Ambient />
            {Overlay && (
              <g key={`${mode}-${cue}`} className="bongbot__overlay">
                <Overlay />
              </g>
            )}
            {mode === 'packed' && <Packing key={cue} />}
            {mode === 'ready' && <Pouch key={cue} />}
          </g>
        </g>
      </svg>
      {mode === 'baking' && <BakeSequence key={cue} />}
    </>
  )
}
