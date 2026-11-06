type Props = { count: number }

/** Small serving tray: each pick drops a fish onto it (the top one re-mounts per pick), up to three shown. */
export function FishTray({ count }: Props) {
  const shown = Math.min(count, 3)
  return (
    <div className="tray" aria-hidden="true">
      <div className="tray__fish">
        {Array.from({ length: shown }, (_, i) => (
          <span key={i === shown - 1 ? `new-${count}` : i} className="tray__one">
            <img src="/art/fish.webp" width={30} height={21} alt="" />
          </span>
        ))}
      </div>
      <span className="tray__plate" />
    </div>
  )
}
