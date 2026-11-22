import Slider from './Slider'

// Traduz as propriedades dos filtros para os nomes exibidos no painel.
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

      {/* Cada filtro vira um slider, e suas mudanças são enviadas ao App. */}
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

      {/* O App restaura os valores padrão da camada ativa. */}
      <button className="btn" onClick={onReset}>
        Redefinir efeitos
      </button>
    </section>
  )
}