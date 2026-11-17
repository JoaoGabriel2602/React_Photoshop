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
    <section className="layers-panel">
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
              {layer.visible}
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
              ▲
            </button>
            <button
              className="icon-button"
              title="Descer camada"
              onClick={(event) => {
                event.stopPropagation()
                onMove(layer.id, -1)
              }}
            >
              ▼
            </button>
          </li>
        ))}
      </ul>

      <div className="layers-actions">
        <button className="topbar-button" onClick={onAdd}>
          Novo
        </button>
        <button className="topbar-button" onClick={onDelete} disabled={layers.length <= 1}>
          Excluir
        </button>
      </div>

      {activeLayer && (
        <label className="tool-field">
          Opacidade: {activeLayer.opacity}%
          <input
            type="range"
            min="0"
            max="100"
            value={activeLayer.opacity}
            onChange={(event) => onOpacityChange(Number(event.target.value))}
            onPointerUp={onOpacityCommit}
            onKeyUp={onOpacityCommit}
          />
        </label>
      )}
    </section>
  )
}
