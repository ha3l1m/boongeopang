import './factoryScene.css'

/** Layers cut from the illustration by tools/art/build_factory_layers.py; the viewBox uses the source's pixel coordinates. */
const FISH_COUNT = 4
const FISH_LOOP_S = 12
const BULBS = [{ x: 375, y: 452 }, { x: 429, y: 455 }, { x: 484, y: 457 }]
const GROOVE_YS = Array.from({ length: 11 }, (_, i) => 736 + i * 16)

/** Bungeoppang machine that keeps stamping fish: press, conveyor, then a hop into the tray. */
export function FactoryScene() {
  return (
    <svg className="factory" viewBox="150 0 1070 1040" role="presentation">
      <defs>
        <radialGradient id="factory-glow">
          <stop offset="0" stopColor="#FFE9B0" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#FFB95C" stopOpacity="0.4" />
          <stop offset="1" stopColor="#FF9A3C" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="factory-steam">
          <stop offset="0" stopColor="#FFF8EC" stopOpacity="0.75" />
          <stop offset="1" stopColor="#FFF8EC" stopOpacity="0" />
        </radialGradient>
        <clipPath id="factory-belt">
          <polygon points="744,761 962,758 1073,857 860,871" />
        </clipPath>
      </defs>

      <image href="/art/factory/backdrop.webp" x="-920" y="-1040" width="3210" height="3120" preserveAspectRatio="none" />
      <image href="/art/factory/plate.webp" x="150" y="0" width="1070" height="1040" />

      <g clipPath="url(#factory-belt)">
        <g className="factory__slats">
          {GROOVE_YS.map((y) => (
            <g key={y} transform={`rotate(-2.5 900 ${y})`}>
              <line x1="680" x2="1120" y1={y} y2={y} className="factory__groove" />
              <line x1="680" x2="1120" y1={y + 2.4} y2={y + 2.4} className="factory__slat-edge" />
            </g>
          ))}
        </g>
      </g>

      <g className="factory__ripples">
        <ellipse cx="426" cy="681" rx="70" ry="9" className="factory__ripple" />
        <ellipse cx="426" cy="681" rx="70" ry="9" className="factory__ripple factory__ripple--late" />
      </g>
      <ellipse cx="416" cy="650" rx="135" ry="115" fill="url(#factory-glow)" className="factory__tank-glow" />
      {BULBS.map((bulb, i) => (
        <circle
          key={bulb.x}
          cx={bulb.x}
          cy={bulb.y}
          r="52"
          fill="url(#factory-glow)"
          className="factory__bulb"
          style={{ animationDelay: `${i * -0.7}s` }}
        />
      ))}

      {Array.from({ length: FISH_COUNT }, (_, i) => (
        <g
          key={i}
          className={`factory__fish factory__fish--${i}`}
          style={{ animationDelay: `${(i * FISH_LOOP_S) / FISH_COUNT - FISH_LOOP_S}s` }}
        >
          <ellipse
            cx="2"
            cy="32"
            rx="46"
            ry="9"
            className="factory__fish-shadow"
            style={{ animationDelay: `${(i * FISH_LOOP_S) / FISH_COUNT - FISH_LOOP_S}s` }}
          />
          <image href="/art/factory/fish.webp" x="-57" y="-42" width="115" height="85" />
        </g>
      ))}

      <image href="/art/factory/tray-front.webp" x="525" y="860" width="290" height="85" />

      <ellipse cx="838" cy="704" rx="105" ry="48" fill="url(#factory-glow)" className="factory__flash" />
      <g className="factory__press">
        <image href="/art/factory/press.webp" x="740" y="545" width="190" height="165" />
      </g>
      <circle cx="782" cy="690" r="26" fill="url(#factory-steam)" className="factory__puff" />
      <circle cx="902" cy="686" r="22" fill="url(#factory-steam)" className="factory__puff factory__puff--late" />
    </svg>
  )
}
