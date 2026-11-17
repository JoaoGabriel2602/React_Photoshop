import Slider from './Slider'

// Nomes em português (as chaves são o `property` de cada opção em utils/filters.js)
const LABELS = {
  brightness: 'Brilho',
  contrast: 'Contraste',
  saturate: 'Saturação',
  grayscale: 'Tons de cinza',
  sepia: 'Sépia',
  'hue-rotate': 'Matiz',
  blur: 'Desfoque',
}

export default function EffectsPanel({ layerName, options, onChange, onCommit, onReset }) {
  return (
    <section className="glass panel effects-panel">
      <h3 className="panel-title">Efeitos de “{layerName}”</h3>

      <div className="effects-list">
        {options.map((option, index) => (
          <Slider
            key={option.property}
            label={LABELS[option.property] ?? option.name}
            min={option.range.min}
            max={option.range.max}
            value={option.value}
            unit={option.unit}
            onChange={(value) => onChange(index, value)}
            onCommit={onCommit}
          />
        ))}
      </div>

      <button className="btn" onClick={onReset}>
        Redefinir efeitos
      </button>
    </section>
  )
}