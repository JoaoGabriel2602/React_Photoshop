export default function Slider({ label, min, max, value, unit = '', onChange, onCommit }) {
  return (
    <label className="slider-field">
      <span className="slider-head">
        <span>{label}</span>
        <output>{value}{unit}</output>
      </span>
      <input
        type="range"
        className="glass-range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
      />
    </label>
  )
}
