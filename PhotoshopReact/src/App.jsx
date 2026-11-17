import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import './App.css'
import HistoryBar from './components/HistoryBar'
import ToolMenu from './components/ToolMenu'
import LayersPanel from './components/LayersPanel.jsx'
import EffectsPanel from './components/EffectsPanel'
import FilePanel from './components/FilePanel.jsx'
import CanvasStage from './components/CanvasStage'
import { createDefaultOptions } from './utils/filters'
import {
  downloadCanvas,
  drawLayerSource,
  flattenLayers,
  getDocSizeForImage,
  loadImageFromFile,
} from './utils/canvas.js'
import { canRedo, canUndo, createHistory, pushSnapshot } from './utils/history'

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
  // Estado inicial: um papel branco de 800x600 com uma camada "Fundo"
  const [initial] = useState(() => {
    const layer = createLayer({ type: 'fill', color: '#ffffff' }, 'Fundo')
    return { doc: { width: 800, height: 600 }, layers: [layer], activeLayerId: layer.id }
  })

  // Documento (tamanho do "papel") e camadas
  const [doc, setDoc] = useState(initial.doc)
  const [layers, setLayers] = useState(initial.layers)
  const [activeLayerId, setActiveLayerId] = useState(initial.activeLayerId)

  // Ferramentas
  const [tool, setTool] = useState('pencil') // 'pencil' | 'eraser'
  const [color, setColor] = useState('#e63946')
  const [size, setSize] = useState(8)

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

  // ---------------------------------------------------------------
  // Histórico (desfazer / refazer)
  // ---------------------------------------------------------------

  // stateRef sempre aponta para o estado MAIS RECENTE (doc, layers, activeLayerId).
  // Funções que rodam depois de um `await`, ou várias vezes seguidas, leem daqui
  // para não usar um valor velho.
  const stateRef = useRef(initial)
  useLayoutEffect(() => {
    stateRef.current = { doc, layers, activeLayerId }
  }, [doc, layers, activeLayerId])

  const historyRef = useRef(null)
  if (historyRef.current === null) {
    historyRef.current = createHistory({ ...initial, pixels: {} })
  }
  const pendingRestoreRef = useRef(null) // snapshot esperando para ter os pixels aplicados
  // Pixels do último snapshot restaurado. Canvases que nascem DEPOIS de um
  // desfazer/refazer leem daqui para já começar com o desenho certo.
  const restoredPixelsRef = useRef({})
  const getRestoredPixels = useCallback((id) => restoredPixelsRef.current[id], [])
  const [restoreTick, setRestoreTick] = useState(0)
  const [historyFlags, setHistoryFlags] = useState({ canUndo: false, canRedo: false })

  const syncHistoryFlags = useCallback(() => {
    setHistoryFlags({
      canUndo: canUndo(historyRef.current),
      canRedo: canRedo(historyRef.current),
    })
  }, [])

  // Salva o estado atual no histórico.
  // `pixelUpdates` = pixels novos de uma camada que acabou de ser desenhada.
  const commit = useCallback(
    (state, pixelUpdates = null) => {
      const history = historyRef.current
      const top = history.stack[history.index]

      // nada mudou desde o último snapshot -> não cria passo vazio
      if (!pixelUpdates && top.doc === state.doc && top.layers === state.layers) return

      // reaproveita os pixels do snapshot anterior (só das camadas que ainda existem)
      const ids = new Set(state.layers.map((layer) => layer.id))
      const pixels = {}
      for (const [id, image] of Object.entries({ ...top.pixels, ...pixelUpdates })) {
        if (ids.has(id)) pixels[id] = image
      }

      pushSnapshot(history, {
        doc: state.doc,
        layers: state.layers,
        activeLayerId: state.activeLayerId,
        pixels,
      })
      syncHistoryFlags()
    },
    [syncHistoryFlags],
  )

  // Chamado pelo CanvasStage quando o usuário solta o mouse depois de um traço:
  // copiamos os pixels da camada desenhada e guardamos no histórico.
  const handleStrokeEnd = useCallback(
    (layerId) => {
      const canvas = canvasRefs.current[layerId]
      if (!canvas) return
      const image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
      commit(stateRef.current, { [layerId]: image })
    },
    [commit],
  )

  // Para sliders: a mudança ao vivo não entra no histórico; só quando o usuário solta.
  const commitCurrent = useCallback(() => commit(stateRef.current), [commit])

  // Aplica um snapshot: restaura as propriedades via estado do React e,
  // depois que o React atualizar a tela, os pixels (effect logo abaixo).
  const restoreSnapshot = useCallback(
    (snapshot) => {
      // A camada ativa também volta ao que era naquele momento
      // (ex.: refazer "nova camada" seleciona a camada nova).
      stateRef.current = {
        doc: snapshot.doc,
        layers: snapshot.layers,
        activeLayerId: snapshot.activeLayerId,
      }
      pendingRestoreRef.current = snapshot
      restoredPixelsRef.current = snapshot.pixels
      setDoc(snapshot.doc)
      setLayers(snapshot.layers)
      setActiveLayerId(snapshot.activeLayerId)
      setRestoreTick((tick) => tick + 1)
      syncHistoryFlags()
    },
    [syncHistoryFlags],
  )

  const undo = useCallback(() => {
    const history = historyRef.current
    if (!canUndo(history)) return
    history.index -= 1
    restoreSnapshot(history.stack[history.index])
  }, [restoreSnapshot])

  const redo = useCallback(() => {
    const history = historyRef.current
    if (!canRedo(history)) return
    history.index += 1
    restoreSnapshot(history.stack[history.index])
  }, [restoreSnapshot])

  // Depois que o React renderizou as camadas do snapshot (e criou os <canvas>
  // que faltavam), devolvemos os pixels de cada uma.
  useEffect(() => {
    const snapshot = pendingRestoreRef.current
    if (!snapshot) return
    pendingRestoreRef.current = null

    for (const layer of snapshot.layers) {
      const canvas = canvasRefs.current[layer.id]
      if (!canvas) continue
      const ctx = canvas.getContext('2d')
      const pixels = snapshot.pixels[layer.id]
      if (pixels) ctx.putImageData(pixels, 0, 0) // camada que foi desenhada
      else drawLayerSource(ctx, layer.source, canvas.width, canvas.height) // intacta
    }
  }, [restoreTick])

  // Troca o estado inteiro (doc + camadas + camada ativa) e, por padrão,
  // registra no histórico. Todas as ações de camada passam por aqui.
  function applyState(next, { record = true } = {}) {
    stateRef.current = next
    setDoc(next.doc)
    setLayers(next.layers)
    setActiveLayerId(next.activeLayerId)
    if (record) commit(next)
  }

  // ---------- Abrir imagem ----------

  // Substitui o documento inteiro: o tamanho passa a ser o da imagem.
  function openImageAsDocument(img) {
    const layer = createLayer({ type: 'image', image: img }, 'Imagem')
    applyState({ doc: getDocSizeForImage(img), layers: [layer], activeLayerId: layer.id })
  }

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
      const current = stateRef.current
      applyState({ ...current, layers: [...current.layers, layer], activeLayerId: layer.id })
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

  // `options` = { record: false } para mudanças "ao vivo" (arrastar slider).
  function updateLayer(id, changes, options) {
    const current = stateRef.current
    applyState(
      {
        ...current,
        layers: current.layers.map((layer) => (layer.id === id ? { ...layer, ...changes } : layer)),
      },
      options,
    )
  }

  function handleAddLayer() {
    const current = stateRef.current
    const layer = createLayer(null, `Camada ${current.layers.length + 1}`) // transparente
    // a nova camada entra logo acima da camada ativa
    const activeIndex = current.layers.findIndex((l) => l.id === current.activeLayerId)
    const next = [...current.layers]
    next.splice(activeIndex + 1, 0, layer)
    applyState({ ...current, layers: next, activeLayerId: layer.id })
  }

  function handleDeleteLayer() {
    const current = stateRef.current
    if (current.layers.length <= 1) return
    const index = current.layers.findIndex((layer) => layer.id === current.activeLayerId)
    const remaining = current.layers.filter((layer) => layer.id !== current.activeLayerId)
    applyState({
      ...current,
      layers: remaining,
      activeLayerId: remaining[Math.max(0, index - 1)].id,
    })
  }

  function handleMoveLayer(id, direction) {
    const current = stateRef.current
    const index = current.layers.findIndex((layer) => layer.id === id)
    const target = index + direction
    if (target < 0 || target >= current.layers.length) return
    const next = [...current.layers]
    ;[next[index], next[target]] = [next[target], next[index]]
    applyState({ ...current, layers: next })
  }

  function handleRenameLayer(id) {
    const layer = layers.find((l) => l.id === id)
    const name = window.prompt('Novo nome da camada:', layer.name)
    if (name && name.trim()) updateLayer(id, { name: name.trim() })
  }

  // ---------- Efeitos (sliders de filtro, por camada) ----------

  // Arrastar o slider muda ao vivo; só entra no histórico quando o usuário solta.
  function handleEffectChange(index, value) {
    const options = activeLayer.options.map((option, i) => (i === index ? { ...option, value } : option))
    updateLayer(activeLayer.id, { options }, { record: false })
  }

  function handleResetEffects() {
    updateLayer(activeLayer.id, { options: createDefaultOptions() })
  }

  return (
    <div className="app">
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
        getRestoredPixels={getRestoredPixels}
        onScaleChange={handleScaleChange}
        onStrokeEnd={handleStrokeEnd}
      />

      <HistoryBar onUndo={undo} onRedo={redo} canUndo={historyFlags.canUndo} canRedo={historyFlags.canRedo} />

      <aside className="sidebar">
        <LayersPanel
          layers={layers}
          activeLayerId={activeLayer.id}
          onSelect={setActiveLayerId}
          onAdd={handleAddLayer}
          onDelete={handleDeleteLayer}
          onToggleVisible={(id) => updateLayer(id, { visible: !layers.find((l) => l.id === id).visible })}
          onMove={handleMoveLayer}
          onRename={handleRenameLayer}
          onOpacityChange={(opacity) => updateLayer(activeLayer.id, { opacity }, { record: false })}
          onOpacityCommit={commitCurrent}
        />

        <EffectsPanel
          layerName={activeLayer.name}
          options={activeLayer.options}
          onChange={handleEffectChange}
          onCommit={commitCurrent}
          onReset={handleResetEffects}
        />

        <FilePanel onOpenImage={handleOpenImage} onImportLayer={handleImportLayer} onDownload={handleDownload} />
      </aside>

      <ToolMenu
        tool={tool}
        onToolChange={setTool}
        color={color}
        onColorChange={setColor}
        size={size}
        onSizeChange={setSize}
      />
    </div>
  )
}

export default App