import './grandpaScene.css'

/** Wisps of steam rising off the fish breads in the bag; x is the wisp's base in the source's pixel coordinates. */
const STEAM = [
  { x: 615, y: 465, delay: 0 },
  { x: 785, y: 420, delay: -0.84 },
  { x: 705, y: 445, delay: -1.68 },
  { x: 650, y: 480, delay: -2.52 },
  { x: 750, y: 430, delay: -3.36 },
]

/**
 * Grandpa from the supplied illustration, happily stomping with his bag of hot fish breads. Layers come from
 * tools/art/build_grandpa_layers.py: the ground stays still, the body leans and the shoes lift
 * under the trouser hems.
 */
export function GrandpaScene() {
  return (
    <svg className="login__hug login__grandpa grandpa" viewBox="0 0 1199 1312" role="presentation">
      <defs>
        <filter id="grandpa-shadow-blur" x="-20%" y="-100%" width="140%" height="300%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        {/* Soft white wisps with a faint warm rim, so steam still reads over the white beard. */}
        <filter id="grandpa-steam-blur" x="-60%" y="-30%" width="220%" height="160%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="7" result="rim" />
          <feFlood floodColor="#B0682E" floodOpacity="0.32" />
          <feComposite in2="rim" operator="in" result="warm" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="wisp" />
          <feMerge>
            <feMergeNode in="warm" />
            <feMergeNode in="wisp" />
          </feMerge>
        </filter>
      </defs>
      {/* Ground: the page colour shows through; floor shadow and dust stay put while grandpa moves. */}
      <image href="/art/grandpa/shadow.webp" x="0" y="1080" width="1199" height="232" />
      <ellipse cx="450" cy="1222" rx="104" ry="13" className="grandpa__shadow grandpa__shadow--l" />
      <ellipse cx="712" cy="1218" rx="104" ry="13" className="grandpa__shadow grandpa__shadow--r" />
      <ellipse cx="450" cy="1222" rx="96" ry="12" className="grandpa__dust grandpa__dust--l" />
      <ellipse cx="712" cy="1218" rx="96" ry="12" className="grandpa__dust grandpa__dust--r" />
      <g className="grandpa__shoe grandpa__shoe--l">
        <image href="/art/grandpa/shoe-l.webp" x="340" y="1112" width="220" height="120" />
      </g>
      <g className="grandpa__shoe grandpa__shoe--r">
        <image href="/art/grandpa/shoe-r.webp" x="600" y="1108" width="222" height="120" />
      </g>
      <g className="grandpa__sway">
        <image href="/art/grandpa/body.webp" x="0" y="0" width="1199" height="1312" />
        <g filter="url(#grandpa-steam-blur)">
          {STEAM.map((wisp) => (
            <path
              key={wisp.x}
              className="grandpa__steam"
              style={{ animationDelay: `${wisp.delay}s` }}
              d={`M${wisp.x} ${wisp.y} c-22 -28 22 -50 0 -78 s22 -50 0 -78`}
            />
          ))}
        </g>
      </g>
    </svg>
  )
}
