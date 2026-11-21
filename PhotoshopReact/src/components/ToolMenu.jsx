import { useState } from 'react'
import Icon from './Icon'
import Slider from './Slider'
import { FONT_OPTIONS } from '../utils/canvas'

const TOOLS = [
  { id: 'pencil', label: 'Lápis', icon: 'pencil' },
  { id: 'eraser', label: 'Borracha', icon: 'eraser' },
  { id: 'text', label: 'Texto', icon: 'text' },
  { id: 'select', label: 'Seleção', icon: 'select' },
  { id: 'rotate', label: 'Girar', icon: 'rotate' },
]

// Dica curta de cada ferramenta que não é de desenho livre.
const HINTS = {
  text: 'Clique na imagem e digite. Use os botões Aplicar ou Cancelar no topo da imagem.',
  select:
    'Arraste na imagem para selecionar. Arraste DENTRO da seleção para mover o conteúdo. Use os botões no topo para apagar ou recortar.',
  rotate: 'Arraste na imagem para girar. Use os botões Aplicar ou Cancelar no topo.',
}

// Os dois tipos de seleção (como no Paint).
const SELECT_MODES = [
  { id: 'rect', label: 'Retângulo' },
  { id: 'free', label: 'Forma livre' },
]

// Um botão redondo no canto inferior esquerdo.
// Clicou: abre as ferramentas. Clicou de novo: fecha.
export default function ToolMenu({
  tool,
  onToolChange,
  color,
  onColorChange,
  size,
  onSizeChange,
  fontSize,
  onFontSizeChange,
  fontFamily,
  onFontFamilyChange,
  selectMode,
  onSelectModeChange,
  rotateAll,
  onRotateAllChange,
}) {
  const [open, setOpen] = useState(false)

  const isBrush = tool === 'pencil' || tool === 'eraser'
  const showColor = isBrush || tool === 'text'

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

          {showColor && (
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
          )}

          {isBrush && (
            <Slider label="Tamanho" min={1} max={100} value={size} unit="px" onChange={onSizeChange} />
          )}

          {tool === 'text' && (
            <>
              <label className="slider-field">
                <span className="slider-head">
                  <span>Fonte</span>
                </span>
                <select
                  className="select-input"
                  value={fontFamily}
                  onChange={(event) => onFontFamilyChange(event.target.value)}
                >
                  {FONT_OPTIONS.map((font) => (
                    <option key={font.value} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </label>

              <Slider
                label="Tamanho da fonte"
                min={8}
                max={300}
                value={fontSize}
                unit="px"
                onChange={onFontSizeChange}
              />
            </>
          )}

          {tool === 'select' && (
            <div className="mode-options">
              {SELECT_MODES.map((mode) => (
                <button
                  key={mode.id}
                  className={`tool-button mode-button ${selectMode === mode.id ? 'active' : ''}`}
                  onClick={() => onSelectModeChange(mode.id)}
                  aria-pressed={selectMode === mode.id}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          )}

          {tool === 'rotate' && (
            <label className="check-field">
              <input
                type="checkbox"
                checked={rotateAll}
                onChange={(event) => onRotateAllChange(event.target.checked)}
              />
              Girar todas as camadas
            </label>
          )}

          {HINTS[tool] && <p className="tool-hint">{HINTS[tool]}</p>}
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
