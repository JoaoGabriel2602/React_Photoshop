const TOOLS = [
  { id: 'pencil', label: 'Lápis'},
  { id: 'eraser', label: 'Borracha'},
]

export default function Toolbar({ tool, onToolChange, color, onColorChange, size, onSizeChange }) {
  return (
    <aside className="toolbar">
      {TOOLS.map((item) => (
        <button
          key={item.id}
          className={`tool-button ${tool === item.id ? 'active' : ''}`}
          onClick={() => onToolChange(item.id)}
          title={item.label}
        >
          <span className="tool-icon">{item.icon}</span>
          {item.label}
        </button>
      ))}

      <label className="tool-field">
        Cor
        <input
          type="color"
          value={color}
          onChange={(event) => onColorChange(event.target.value)}
          disabled={tool === 'eraser'}
        />
      </label>

      <label className="tool-field">
        Tamanho: {size}px
        <input
          type="range"
          min="1"
          max="100"
          value={size}
          onChange={(event) => onSizeChange(Number(event.target.value))}
        />
      </label>
    </aside>
  )
}
