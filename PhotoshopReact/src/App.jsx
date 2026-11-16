import { useCallback, useRef, useState } from 'react'
import './App.css'
import Slider from './components/Slider'
import SidebarItem from './components/SidebarItem'
import TopBar from './components/TopBar'
import Toolbar from './components/Toolbar'
import LayersPanel from './components/LayersPanel'
import CanvasStage from './components/CanvasStage'
import { createDefaultOptions } from './utils/filters'
import {
  downloadCanvas,
  flattenLayers,
  getDocSizeForImage,
  loadImageFromFile,
} from './utils/canvas'

// Cada camada guarda só as PROPRIEDADES. Os pixels ficam no <canvas> dela.
//   source: o que desenhar quando a camada nasce (fundo branco, imagem ou nada)
let layerCounter = 0
function createLayer(source, name) {
  layerCounter += 1
  return {
    id: `layer-${layerCounter}`,
    name,
    visible: true,
    opacity: 100,
    options: createDefaultOptions(), // sliders de filtro desta camada
    source,
  }
}

function App() {
  // Documento (tamanho do "papel") e camadas
  const [doc, setDoc] = useState({ width: 800, height: 600 })
  const [layers, setLayers] = useState(() => [createLayer({ type: 'fill', color: '#ffffff' }, 'Fundo')])
  const [activeLayerId, setActiveLayerId] = useState(() => layers[0].id)

  // Ferramentas
  const [tool, setTool] = useState('pencil') // 'pencil' | 'eraser'
  const [color, setColor] = useState('#e63946')
  const [size, setSize] = useState(8)

  // Sliders de filtro (o mesmo conceito do projeto original)
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0)

  // Registro dos <canvas> reais de cada camada: { idDaCamada: <canvas> }
  const canvasRefs = useRef({})
  const displayScaleRef = useRef(1)

  const registerCanvas = useCallback((id, element) => {
    if (element) canvasRefs.current[id] = element
    else delete canvasRefs.current[id]
  }, [])
  const getCanvas = useCallback((id) => canvasRefs.current[id], [])
  const handleScaleChange = useCallback((scale) => {
    displayScaleRef.current = scale
  }, [])

  const activeLayer = layers.find((layer) => layer.id === activeLayerId) ?? layers[0]
  const selectedOption = activeLayer.options[selectedOptionIndex]

  // ---------- Abrir imagem ----------

  // Substitui o documento inteiro: o tamanho passa a ser o da imagem.
  const openImageAsDocument = useCallback((img) => {
    const layer = createLayer({ type: 'image', image: img }, 'Imagem')
    setDoc(getDocSizeForImage(img))
    setLayers([layer])
    setActiveLayerId(layer.id)
    setSelectedOptionIndex(0)
  }, [])

  async function handleOpenImage(file) {
    try {
      openImageAsDocument(await loadImageFromFile(file))
    } catch {
      alert('Não foi possível abrir essa imagem.')
    }
  }

  // Adiciona a imagem como uma camada nova dentro do documento atual.
  async function handleImportLayer(file) {
    try {
      const img = await loadImageFromFile(file)
      const name = file.name.replace(/\.[^.]+$/, '')
      const layer = createLayer({ type: 'image', image: img }, name)
      setLayers((prev) => [...prev, layer])
      setActiveLayerId(layer.id)
    } catch {
      alert('Não foi possível importar essa imagem.')
    }
  }

  // ---------- Baixar imagem ----------

  function handleDownload() {
    const flattened = flattenLayers({
      width: doc.width,
      height: doc.height,
      layers,
      canvasRefs: canvasRefs.current,
      displayScale: displayScaleRef.current,
    })
    downloadCanvas(flattened)
  }

  // ---------- Camadas ----------

  function updateLayer(id, changes) {
    setLayers((prev) => prev.map((layer) => (layer.id === id ? { ...layer, ...changes } : layer)))
  }

  function handleAddLayer() {
    const layer = createLayer(null, `Camada ${layers.length + 1}`) // camada transparente vazia
    setLayers((prev) => {
      // a nova camada entra logo acima da camada ativa
      const activeIndex = prev.findIndex((l) => l.id === activeLayerId)
      const next = [...prev]
      next.splice(activeIndex + 1, 0, layer)
      return next
    })
    setActiveLayerId(layer.id)
  }

  function handleDeleteLayer() {
    if (layers.length <= 1) return
    const index = layers.findIndex((layer) => layer.id === activeLayerId)
    const remaining = layers.filter((layer) => layer.id !== activeLayerId)
    setLayers(remaining)
    setActiveLayerId(remaining[Math.max(0, index - 1)].id)
  }

  function handleMoveLayer(id, direction) {
    setLayers((prev) => {
      const index = prev.findIndex((layer) => layer.id === id)
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function handleRenameLayer(id) {
    const layer = layers.find((l) => l.id === id)
    const name = window.prompt('Novo nome da camada:', layer.name)
    if (name && name.trim()) updateLayer(id, { name: name.trim() })
  }

  // ---------- Sliders de filtro (agora por camada) ----------

  function handleSliderChange({ target }) {
    const options = activeLayer.options.map((option, index) =>
      index === selectedOptionIndex ? { ...option, value: Number(target.value) } : option,
    )
    updateLayer(activeLayer.id, { options })
  }

  return (
    <div className="container">
      <TopBar
        onOpenImage={handleOpenImage}
        onImportLayer={handleImportLayer}
        onDownload={handleDownload}
      />

      <Toolbar
        tool={tool}
        onToolChange={setTool}
        color={color}
        onColorChange={setColor}
        size={size}
        onSizeChange={setSize}
      />

      <CanvasStage
        width={doc.width}
        height={doc.height}
        layers={layers}
        activeLayerId={activeLayer.id}
        tool={tool}
        color={color}
        size={size}
        registerCanvas={registerCanvas}
        getCanvas={getCanvas}
        onScaleChange={handleScaleChange}
      />

      <div className="sidebar">
        <LayersPanel
          layers={layers}
          activeLayerId={activeLayer.id}
          onSelect={setActiveLayerId}
          onAdd={handleAddLayer}
          onDelete={handleDeleteLayer}
          onToggleVisible={(id) => updateLayer(id, { visible: !layers.find((l) => l.id === id).visible })}
          onMove={handleMoveLayer}
          onRename={handleRenameLayer}
          onOpacityChange={(opacity) => updateLayer(activeLayer.id, { opacity })}
        />

        <h3 className="panel-title">{activeLayer.name}</h3>
        <div className="adjustments">
          {activeLayer.options.map((option, index) => (
            <SidebarItem
              key={index}
              name={option.name}
              active={index === selectedOptionIndex}
              handleClick={() => setSelectedOptionIndex(index)}
            />
          ))}
        </div>
      </div>

      <Slider
        min={selectedOption.range.min}
        max={selectedOption.range.max}
        value={selectedOption.value}
        handleChange={handleSliderChange}
      />
    </div>
  )
}

export default App
