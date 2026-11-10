import './factoryScene.css'

/**
 * Splash image slots. Paste an image link into a slot to show that layer; an empty string hides it.
 * Nothing is drawn by default: the splash is just the black background, the logo and the two buttons.
 */
export const SPLASH_ART = {
  backdrop: '',
  plate: '',
  press: '',
  tray: '',
}

/** Splash illustration: only the slots that have a link are rendered. */
export function FactoryScene() {
  const { backdrop, plate, press, tray } = SPLASH_ART
  return (
    <svg className="factory" viewBox="150 0 1070 1040" role="presentation">
      {backdrop && <image href={backdrop} x="-920" y="-1040" width="3210" height="3120" preserveAspectRatio="none" />}
      {plate && <image href={plate} x="150" y="0" width="1070" height="1040" />}
      {tray && <image href={tray} x="525" y="860" width="290" height="85" />}
      {press && <image href={press} x="740" y="545" width="190" height="165" />}
    </svg>
  )
}
