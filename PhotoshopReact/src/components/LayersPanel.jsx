import Icon from './Icon'
import Slider from './Slider'

export default function LayersPanel({
  layers,
  activeLayerId,
  onSelect,
  onAdd,
  onDelete,
  onToggleVisible,
  onMove,
  onRename,
  onOpacityChange,
  onOpacityCommit,
}) {
  const activeLayer = layers.find((layer) => layer.id === activeLayerId)

  // No array, o índice 0 é a camada de BAIXO.
  // Na lista mostramos de cima para baixo, como no Photoshop.
  const topToBottom = [...layers].reverse()

  return (
    <section className="glass panel layers-panel">
      <h3 className="panel-title">Camadas</h3>

      <ul className="layers-list">
        {topToBottom.map((layer) => (
          <li
            key={layer.id}
            className={`layer-row ${layer.id === activeLayerId ? 'active' : ''}`}
            onClick={() => onSelect(layer.id)}
          >
            <button
              className="icon-button"
              title={layer.visible ? 'Esconder camada' : 'Mostrar camada'}
              onClick={(event) => {
                event.stopPropagation()
                onToggleVisible(layer.id)
              }}
            >
              <Icon name={layer.visible ? 'eye' : 'eyeOff'} size={16} />
            </button>

            <span
              className="layer-name"
              title="Duplo clique para renomear"
              onDoubleClick={() => onRename(layer.id)}
            >
              {layer.name}
            </span>

            <button
              className="icon-button"
              title="Subir camada"
              onClick={(event) => {
                event.stopPropagation()
                onMove(layer.id, 1)
              }}
            >
              <Icon name="up" size={16} />
            </button>
            <button
              className="icon-button"
              title="Descer camada"
              onClick={(event) => {
                event.stopPropagation()
                onMove(layer.id, -1)
              }}
            >
              <Icon name="down" size={16} />
            </button>
          </li>
        ))}
      </ul>

      <div className="button-row">
        <button className="btn" onClick={onAdd}>
          <Icon name="plus" size={16} />
          Nova
        </button>
        <button className="btn" onClick={onDelete} disabled={layers.length <= 1}>
          <Icon name="trash" size={16} />
          Excluir
        </button>
      </div>

      {activeLayer && (
        <Slider
          label="Opacidade"
          min={0}
          max={100}
          value={activeLayer.opacity}
          unit="%"
          onChange={onOpacityChange}
          onCommit={onOpacityCommit}
        />
      )}
    </section>
  )
}