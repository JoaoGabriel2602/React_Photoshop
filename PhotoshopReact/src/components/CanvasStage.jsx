import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { buildFilter } from '../utils/filters'
import { drawImageContain } from '../utils/canvas'

// ---------------------------------------------------------------
// Uma camada = um <canvas>. Os pixels vivem DENTRO do canvas
// (não no estado do React), por isso o React só guarda as
// propriedades da camada (nome, opacidade, filtros...).
// ---------------------------------------------------------------
const LayerCanvas = memo(function LayerCanvas({ layer, width, height, zIndex, registerCanvas }) {
  const canvasRef = useRef(null)
  const { source } = layer

  // Avisa o App qual é o <canvas> desta camada (usado ao desenhar e ao exportar).
  useEffect(() => {
    registerCanvas(layer.id, canvasRef.current)
    return () => registerCanvas(layer.id, null)
  }, [layer.id, registerCanvas])

  // Desenha o conteúdo inicial: fundo branco ou uma imagem aberta pelo usuário.
  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d')
    ctx.clearRect(0, 0, width, height)
    if (source?.type === 'fill') {
      ctx.fillStyle = source.color
      ctx.fillRect(0, 0, width, height)
    } else if (source?.type === 'image') {
      drawImageContain(ctx, source.image, width, height)
    }
  }, [source, width, height])

  return (
    <canvas
      ref={canvasRef}
      className="layer-canvas"
      width={width}
      height={height}
      style={{
        zIndex,
        opacity: layer.opacity / 100,
        display: layer.visible ? 'block' : 'none',
        filter: buildFilter(layer.options),
      }}
    />
  )
})

// ---------------------------------------------------------------
// A "mesa de trabalho": empilha os canvases e captura o mouse/toque.
// ---------------------------------------------------------------
export default function CanvasStage({
  width,
  height,
  layers,
  activeLayerId,
  tool,
  color,
  size,
  registerCanvas,
  getCanvas,
  onScaleChange,
}) {
  const areaRef = useRef(null)
  const cursorRef = useRef(null)
  const lastPointRef = useRef(null) // último ponto do traço (null = não está desenhando)
  const [scale, setScale] = useState(1)

  // Calcula o zoom para a imagem caber na área disponível.
  useLayoutEffect(() => {
    const area = areaRef.current
    const update = () => {
      const padding = 32
      const fit = Math.min(
        (area.clientWidth - padding) / width,
        (area.clientHeight - padding) / height,
      )
      setScale(Math.max(fit, 0.05))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(area)
    return () => observer.disconnect()
  }, [width, height])

  useEffect(() => {
    onScaleChange(scale)
  }, [scale, onScaleChange])

  // Converte a posição do mouse (pixels da tela) em pixels do canvas.
  function getPoint(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left) * (width / rect.width),
      y: (event.clientY - rect.top) * (height / rect.height),
    }
  }

  // Lápis e borracha usam o MESMO traço; a diferença é o modo de composição:
  //  - source-over     -> pinta por cima
  //  - destination-out -> apaga os pixels (deixa transparente)
  function prepareBrush(ctx) {
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = size
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  function getActiveContext() {
    const layer = layers.find((l) => l.id === activeLayerId)
    if (!layer || !layer.visible) return null // não desenha em camada escondida
    return getCanvas(layer.id)?.getContext('2d') ?? null
  }

  function moveBrushCursor(event) {
    const cursor = cursorRef.current
    if (!cursor) return
    const rect = event.currentTarget.getBoundingClientRect()
    const diameter = Math.max(size * scale, 4)
    cursor.style.display = 'block'
    cursor.style.width = `${diameter}px`
    cursor.style.height = `${diameter}px`
    cursor.style.transform = `translate(${event.clientX - rect.left - diameter / 2}px, ${
      event.clientY - rect.top - diameter / 2
    }px)`
  }

  function handlePointerDown(event) {
    if (event.button !== 0) return
    const ctx = getActiveContext()
    if (!ctx) return

    event.currentTarget.setPointerCapture(event.pointerId) // continua desenhando mesmo saindo da área
    const point = getPoint(event)

    // Um clique simples deve deixar uma "bolinha".
    ctx.save()
    prepareBrush(ctx)
    ctx.beginPath()
    ctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    lastPointRef.current = point
  }

  function handlePointerMove(event) {
    moveBrushCursor(event)
    if (!lastPointRef.current) return
    const ctx = getActiveContext()
    if (!ctx) return

    const point = getPoint(event)
    ctx.save()
    prepareBrush(ctx)
    ctx.beginPath()
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    ctx.restore()
    lastPointRef.current = point
  }

  function stopDrawing() {
    lastPointRef.current = null
  }

  function hideBrushCursor() {
    if (cursorRef.current) cursorRef.current.style.display = 'none'
  }

  return (
    <div className="stage-area" ref={areaRef}>
      <div className="stage" style={{ width: width * scale, height: height * scale }}>
        {layers.map((layer, index) => (
          <LayerCanvas
            key={layer.id}
            layer={layer}
            width={width}
            height={height}
            zIndex={index}
            registerCanvas={registerCanvas}
          />
        ))}

        {/* Camada invisível por cima de tudo que recebe o mouse */}
        <div
          className="stage-overlay"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          onPointerLeave={hideBrushCursor}
        >
          <div className="brush-cursor" ref={cursorRef} />
        </div>
      </div>
    </div>
  )
}
