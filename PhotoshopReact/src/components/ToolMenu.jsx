import { useState } from 'react'
import Icon from './Icon'
import Slider from './Slider'

const TOOLS = [
  { id: 'pencil', label: 'Lápis', icon: 'pencil' },
  { id: 'eraser', label: 'Borracha', icon: 'eraser' },
]

// Um botão redondo no canto inferior esquerdo.
// Clicou: abre as ferramentas. Clicou de novo: fecha.
export default function ToolMenu({ tool, onToolChange, color, onColorChange, size, onSizeChange }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="tool-menu">
      {open && (
        <div className="glass tool-panel" id="tool-panel">
          <div className="tool-options">
            {TOOLS.map((item) => (
              <button
                key={item.id}
                className={`tool-button ${tool === item.id ? 'active' : ''}`}
                onClick={() => onToolChange(item.id)}
                aria-pressed={tool === item.id}
              >
                <Icon name={item.icon} size={22} />
                {item.label}
              </button>
            ))}
          </div>

          <label className="slider-field">
            <span className="slider-head">
              <span>Cor</span>
            </span>
            <input
              type="color"
              className="color-input"
              value={color}
              onChange={(event) => onColorChange(event.target.value)}
              disabled={tool === 'eraser'}
            />
          </label>

          <Slider label="Tamanho" min={1} max={100} value={size} unit="px" onChange={onSizeChange} />
        </div>
      )}

      <button
        className="glass fab"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="tool-panel"
        title={open ? 'Fechar ferramentas' : 'Abrir ferramentas'}
      >
        <Icon name={open ? 'close' : 'menu'} size={24} />
      </button>
    </div>
  )
}