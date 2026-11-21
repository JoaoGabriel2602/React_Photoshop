import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { buildFilter } from '../utils/filters'
import { drawLayerSource, drawText, TEXT_LINE_HEIGHT } from '../utils/canvas'

const MIN_SELECTION = 4 // menor seleção aceita, em pixels do canvas

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

// Traz qualquer ângulo para o intervalo de -180 a 180 graus.
const normalizeAngle = (angle) => ((((angle + 180) % 360) + 360) % 360) - 180

// ---------------------------------------------------------------
// Geometria da seleção. Toda seleção é um polígono (lista de pontos em
// pixels do canvas): o "Retângulo" tem 4 pontos, a "Forma livre" tem
// um ponto para cada trecho que o mouse percorreu.
// ---------------------------------------------------------------

// Menor retângulo que contém todos os pontos.
function getBounds(points) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

// O ponto está dentro do polígono? (teste do "raio", vale para qualquer forma)
function pointInPolygon(point, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside
    }
  }
  return inside
}

// Texto do atributo "d" de um <path> SVG (usado no contorno tracejado).
function pointsToPath(points, close) {
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ')
  return close ? `${path} Z` : path
}

// Desenha o contorno da seleção no contexto (para recortar o desenho com clip()).
function traceSelection(ctx, points) {
  ctx.beginPath()
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
  ctx.closePath()
}

// Apaga a área selecionada. Na camada de fundo (cor sólida) fica a cor do fundo,
// como no Paint; nas outras, fica transparente.
function eraseSelection(ctx, points, layer) {
  const { width, height } = ctx.canvas
  ctx.save()
  traceSelection(ctx, points)
  ctx.clip()
  if (layer.source?.type === 'fill') {
    ctx.fillStyle = layer.source.color
    ctx.fillRect(0, 0, width, height)
  } else {
    ctx.clearRect(0, 0, width, height)
  }
  ctx.restore()
}

// ---------------------------------------------------------------
// Uma camada = um <canvas>. Os pixels vivem DENTRO do canvas
// (não no estado do React), por isso o React só guarda as
// propriedades da camada (nome, opacidade, filtros...).
// ---------------------------------------------------------------
const LayerCanvas = memo(function LayerCanvas({
  layer,
  width,
  height,
  zIndex,
  previewAngle,
  registerCanvas,
  getRestoredPixels,
}) {
  const canvasRef = useRef(null)
  const { source } = layer

  // Avisa o App qual é o <canvas> desta camada (usado ao desenhar e ao exportar).
  useEffect(() => {
    registerCanvas(layer.id, canvasRef.current)
    return () => registerCanvas(layer.id, null)
  }, [layer.id, registerCanvas])

  // Desenha o conteúdo inicial do canvas. Se esta camada está voltando por um
  // "desfazer/refazer" (por ex. uma camada excluída que foi recuperada), usamos os
  // pixels guardados no histórico; senão, o fundo branco / a imagem de origem.
  // (Fazemos isso AQUI, e não no App, porque em modo dev o React remonta o
  // componente logo depois e um redesenho apagaria os pixels restaurados.)
  useEffect(() => {
    // willReadFrequently: guardamos os pixels (getImageData) a cada traço,
    // então avisamos o navegador para otimizar a leitura.
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true })
    const restored = getRestoredPixels(layer.id)
    if (restored) {
      ctx.putImageData(restored, 0, 0)
    } else {
      drawLayerSource(ctx, source, width, height)
    }
  }, [layer.id, source, width, height, getRestoredPixels])

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
        // Prévia da rotação: só o CSS gira; os pixels só mudam quando o usuário aplica.
        transform: previewAngle ? `rotate(${previewAngle}deg)` : undefined,
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
  fontSize,
  fontFamily,
  selectMode,
  rotateAll,
  restoreTick,
  registerCanvas,
  getCanvas,
  getRestoredPixels,
  onScaleChange,
  onStrokeEnd,
  onCropApply,
  onRotateApply,
}) {
  const areaRef = useRef(null)
  const cursorRef = useRef(null)
  const lastPointRef = useRef(null) // último ponto do traço (null = não está desenhando)
  const strokeLayerRef = useRef(null) // camada em que o traço atual está sendo feito
  const [scale, setScale] = useState(1)

  // Texto: a "caixa" que o usuário está digitando { x, y, layerId } (em pixels do canvas).
  // Guardamos também numa ref para ler o valor mais novo dentro de eventos.
  const textareaRef = useRef(null)
  const textDraftRef = useRef(null)
  const [textDraft, setTextDraft] = useState(null)

  // Seleção: { points, open } (open = ainda sendo desenhada à mão livre) e o arrasto em andamento.
  const selectDragRef = useRef(null)
  const [selection, setSelection] = useState(null)

  // Rotação: o ângulo atual (graus) e o arrasto em andamento.
  const rotateDragRef = useRef(null)
  const [angle, setAngle] = useState(0)

  // Calcula o zoom para a imagem caber na área disponível.
  useLayoutEffect(() => {
    const area = areaRef.current
    const update = () => {
      const padding = 96
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

  // Trocou de ferramenta, o documento mudou de tamanho ou houve desfazer/refazer:
  // a seleção antiga não vale mais.
  useEffect(() => {
    setSelection(null)
    selectDragRef.current = null
  }, [tool, width, height, restoreTick])

  // Trocou de ferramenta ou de camada: rotação e texto "pela metade" são descartados.
  useEffect(() => {
    setAngle(0)
    rotateDragRef.current = null
    textDraftRef.current = null
    setTextDraft(null)
  }, [tool, activeLayerId])

  const isBrush = tool === 'pencil' || tool === 'eraser'
  const selectionBounds = selection ? getBounds(selection.points) : null
  const selectionReady =
    tool === 'select' &&
    selection !== null &&
    !selection.open &&
    selectionBounds.w >= MIN_SELECTION &&
    selectionBounds.h >= MIN_SELECTION
  const textReady = tool === 'text' && textDraft !== null
  const rotateReady = tool === 'rotate' && Math.abs(normalizeAngle(angle)) > 0.05
  const hasPending = textReady || rotateReady

  // Converte a posição do mouse (pixels da tela) em pixels do canvas.
  function getPoint(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left) * (width / rect.width),
      y: (event.clientY - rect.top) * (height / rect.height),
    }
  }

  // Igual ao getPoint, mas nunca sai de dentro do documento.
  function getClampedPoint(event) {
    const point = getPoint(event)
    return { x: clamp(point.x, 0, width), y: clamp(point.y, 0, height) }
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

  function getActiveLayer() {
    return layers.find((l) => l.id === activeLayerId)
  }

  function getActiveContext() {
    const layer = getActiveLayer()
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

  // ---------------------------------------------------------------
  // Lápis / borracha
  // ---------------------------------------------------------------
  function startStroke(event) {
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
    strokeLayerRef.current = activeLayerId
  }

  function moveStroke(event) {
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

  // Ao soltar o mouse o traço termina: avisamos o App para salvar no histórico.
  function stopDrawing() {
    if (!lastPointRef.current) return
    lastPointRef.current = null
    onStrokeEnd(strokeLayerRef.current)
  }

  function hideBrushCursor() {
    if (cursorRef.current) cursorRef.current.style.display = 'none'
  }

  // ---------------------------------------------------------------
  // Texto: clique na imagem -> aparece uma caixa para digitar.
  // Os botões "Aplicar" / "Cancelar" da barra do topo escrevem ou descartam o texto.
  // ---------------------------------------------------------------
  function closeTextBox() {
    textDraftRef.current = null
    setTextDraft(null)
  }

  function commitText() {
    const draft = textDraftRef.current
    if (!draft) return // já foi confirmado/cancelado
    const text = textareaRef.current?.value ?? ''
    closeTextBox()
    if (!text.trim()) return

    const ctx = getCanvas(draft.layerId)?.getContext('2d')
    if (!ctx) return
    drawText(ctx, { text, x: draft.x, y: draft.y, fontSize, color, fontFamily })
    onStrokeEnd(draft.layerId) // guarda os pixels no histórico
  }

  function startText(event) {
    // Com a caixa aberta, clicar na imagem não faz nada: só os botões confirmam ou cancelam.
    if (textDraftRef.current) return
    const layer = getActiveLayer()
    if (!layer || !layer.visible) return // não escreve em camada escondida

    const point = getPoint(event)
    const draft = { x: point.x, y: point.y, layerId: activeLayerId }
    textDraftRef.current = draft
    setTextDraft(draft)
  }

  // A caixa cresce junto com o que é digitado.
  function growTextBox(event) {
    const box = event.target
    box.style.height = 'auto'
    box.style.height = `${box.scrollHeight}px`
    box.style.width = '0px'
    box.style.width = `${box.scrollWidth + 4}px`
  }

  // ---------------------------------------------------------------
  // Seleção (como no Paint):
  //  - arrastar fora da seleção cria uma nova (Retângulo ou Forma livre);
  //  - arrastar DENTRO da seleção move o que está dentro dela.
  // ---------------------------------------------------------------
  function startSelect(event) {
    const point = getPoint(event)
    event.currentTarget.setPointerCapture(event.pointerId)

    if (selection && !selection.open && pointInPolygon(point, selection.points)) {
      startMoveSelection(point)
      return
    }

    // seleção nova: o ponto inicial é o primeiro vértice
    const start = getClampedPoint(event)
    selectDragRef.current = { mode: 'new', start, points: [start] }
    setSelection({ open: selectMode === 'free', points: [start, start, start, start] })
  }

  // Levanta o conteúdo da seleção: guarda uma cópia da camada SEM esse pedaço (base)
  // e o pedaço sozinho (piece). Durante o arrasto é só redesenhar base + piece mais adiante.
  function startMoveSelection(point) {
    const points = selection.points
    const bounds = getBounds(points)
    const layer = getActiveLayer()
    const canvas = layer && layer.visible ? getCanvas(layer.id) : null

    let lift = null
    if (canvas) {
      // origem inteira (sem frações), para o pedaço não ficar borrado
      const originX = Math.floor(bounds.x)
      const originY = Math.floor(bounds.y)

      const piece = document.createElement('canvas')
      piece.width = Math.max(1, Math.ceil(bounds.x + bounds.w) - originX)
      piece.height = Math.max(1, Math.ceil(bounds.y + bounds.h) - originY)
      const pieceCtx = piece.getContext('2d')
      pieceCtx.translate(-originX, -originY)
      traceSelection(pieceCtx, points)
      pieceCtx.clip()
      pieceCtx.drawImage(canvas, 0, 0)

      const base = document.createElement('canvas')
      base.width = canvas.width
      base.height = canvas.height
      const baseCtx = base.getContext('2d')
      baseCtx.drawImage(canvas, 0, 0)
      eraseSelection(baseCtx, points, layer)

      lift = { layerId: layer.id, base, piece, originX, originY }
    }

    selectDragRef.current = { mode: 'move', start: point, points, bounds, lift, moved: false }
  }

  function moveSelect(event) {
    const drag = selectDragRef.current

    // sem arrasto: só troca o cursor (setinhas de mover quando está sobre a seleção)
    if (!drag) {
      const over = selection && !selection.open && pointInPolygon(getPoint(event), selection.points)
      event.currentTarget.style.cursor = over ? 'move' : 'crosshair'
      return
    }

    if (drag.mode === 'new') {
      const end = getClampedPoint(event)
      if (selectMode === 'rect') {
        const s = drag.start
        setSelection({
          open: false,
          points: [
            { x: s.x, y: s.y },
            { x: end.x, y: s.y },
            { x: end.x, y: end.y },
            { x: s.x, y: end.y },
          ],
        })
      } else {
        // forma livre: só guarda um novo ponto quando o mouse andou um pouco
        const last = drag.points[drag.points.length - 1]
        if (Math.hypot(end.x - last.x, end.y - last.y) * scale >= 2) {
          drag.points.push(end)
          setSelection({ open: true, points: [...drag.points] })
        }
      }
      return
    }

    // mover: o deslocamento é limitado para a seleção não sair do papel
    const point = getPoint(event)
    const { bounds, start, lift } = drag
    const dx = Math.round(clamp(point.x - start.x, -bounds.x, width - bounds.x - bounds.w))
    const dy = Math.round(clamp(point.y - start.y, -bounds.y, height - bounds.y - bounds.h))
    if (dx !== 0 || dy !== 0) drag.moved = true

    if (lift) {
      const ctx = getCanvas(lift.layerId)?.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, width, height)
        ctx.drawImage(lift.base, 0, 0)
        ctx.drawImage(lift.piece, lift.originX + dx, lift.originY + dy)
      }
    }
    setSelection({ open: false, points: drag.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) })
  }

  function endSelect() {
    const drag = selectDragRef.current
    if (!drag) return
    selectDragRef.current = null

    if (drag.mode === 'move') {
      if (drag.moved && drag.lift) onStrokeEnd(drag.lift.layerId) // entra no histórico
      return
    }

    // seleção nova terminou: fecha a forma livre e descarta se ficou pequena demais
    setSelection((current) => {
      if (!current || current.points.length < 3) return null
      const bounds = getBounds(current.points)
      if (bounds.w < MIN_SELECTION || bounds.h < MIN_SELECTION) return null
      return { open: false, points: current.points }
    })
  }

  // Botão "Apagar": limpa o que está dentro da seleção, na camada ativa.
  function clearSelectionArea() {
    const layer = getActiveLayer()
    if (!selection || !layer || !layer.visible) return
    const ctx = getCanvas(layer.id)?.getContext('2d')
    if (!ctx) return
    eraseSelection(ctx, selection.points, layer)
    onStrokeEnd(layer.id)
  }

  // Botão "Recortar": o documento inteiro passa a ter o tamanho da seleção.
  function cropToSelection() {
    if (!selectionReady) return
    const { x: bx, y: by, w, h } = selectionBounds
    const x = clamp(Math.round(bx), 0, width - 1)
    const y = clamp(Math.round(by), 0, height - 1)
    const right = clamp(Math.round(bx + w), x + 1, width)
    const bottom = clamp(Math.round(by + h), y + 1, height)
    setSelection(null)
    onCropApply({ x, y, width: right - x, height: bottom - y })
  }

  // ---------------------------------------------------------------
  // Rotação: arraste ao redor do centro da imagem.
  // ---------------------------------------------------------------
  function getMouseAngle(event, center) {
    return (Math.atan2(event.clientY - center.y, event.clientX - center.x) * 180) / Math.PI
  }

  function startRotate(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    event.currentTarget.setPointerCapture(event.pointerId)
    rotateDragRef.current = { center, last: getMouseAngle(event, center), raw: angle }
  }

  function moveRotate(event) {
    const drag = rotateDragRef.current
    if (!drag) return
    const current = getMouseAngle(event, drag.center)

    // soma só a variação desde o último movimento (evita saltos ao cruzar ±180°)
    let diff = current - drag.last
    if (diff > 180) diff -= 360
    if (diff < -180) diff += 360
    drag.last = current
    drag.raw += diff

    setAngle(drag.raw)
  }

  function endRotate() {
    rotateDragRef.current = null
  }

  function applyRotate() {
    if (!rotateReady) return
    const degrees = angle
    setAngle(0)
    onRotateApply(degrees)
  }

  // ---------------------------------------------------------------
  // Eventos do mouse (cada ferramenta tem o seu comportamento)
  // ---------------------------------------------------------------
  function handlePointerDown(event) {
    if (event.button !== 0) return
    if (tool === 'text') startText(event)
    else if (tool === 'select') startSelect(event)
    else if (tool === 'rotate') startRotate(event)
    else startStroke(event)
  }

  function handlePointerMove(event) {
    if (tool === 'select') moveSelect(event)
    else if (tool === 'rotate') moveRotate(event)
    else if (isBrush) moveStroke(event)
  }

  function handlePointerUp() {
    if (tool === 'select') endSelect()
    else if (tool === 'rotate') endRotate()
    else stopDrawing()
  }

  // Botões "Aplicar" / "Cancelar" da barra do topo (texto e rotação).
  function applyPending() {
    if (textReady) commitText()
    else if (rotateReady) applyRotate()
  }

  function cancelPending() {
    closeTextBox()
    setAngle(0)
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
            previewAngle={tool === 'rotate' && (rotateAll || layer.id === activeLayerId) ? angle : 0}
            registerCanvas={registerCanvas}
            getRestoredPixels={getRestoredPixels}
          />
        ))}

        {/* Moldura da rotação: um retângulo tracejado girando + a cruz do centro */}
        {tool === 'rotate' && (
          <div className="rotate-guide" style={{ transform: `rotate(${angle}deg)` }} />
        )}

        {/* Contorno tracejado da seleção ("formigas marchando") */}
        {tool === 'select' && selection && (
          <svg
            className="selection-outline"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
          >
            <path className="ants-base" d={pointsToPath(selection.points, !selection.open)} />
            <path className="ants-dash" d={pointsToPath(selection.points, !selection.open)} />
          </svg>
        )}

        {/* Camada invisível por cima de tudo que recebe o mouse */}
        <div
          className={`stage-overlay tool-${tool}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={hideBrushCursor}
          // No texto, impede que o clique roube o foco da caixa recém-criada.
          onMouseDown={tool === 'text' ? (event) => event.preventDefault() : undefined}
        >
          {isBrush && <div className="brush-cursor" ref={cursorRef} />}
        </div>

        {tool === 'text' && textDraft && (
          <textarea
            ref={textareaRef}
            className="text-box"
            autoFocus
            rows={1}
            spellCheck={false}
            style={{
              left: textDraft.x * scale,
              top: textDraft.y * scale,
              fontSize: fontSize * scale,
              fontFamily,
              color,
              lineHeight: TEXT_LINE_HEIGHT,
            }}
            onInput={growTextBox}
          />
        )}
      </div>

      {/* Barra do topo: dicas e botões de cada ferramenta (texto, seleção e rotação) */}
      {(tool === 'text' || tool === 'select' || tool === 'rotate') && (
        <div className="glass stage-actions">
          {selectionReady ? (
            <>
              <span className="stage-actions-info">
                {Math.round(selectionBounds.w)} × {Math.round(selectionBounds.h)} px
              </span>
              <button className="btn" onClick={() => setSelection(null)}>
                <Icon name="close" size={16} />
                Desmarcar
              </button>
              <button className="btn" onClick={clearSelectionArea}>
                <Icon name="trash" size={16} />
                Apagar
              </button>
              <button className="btn primary" onClick={cropToSelection}>
                <Icon name="crop" size={16} />
                Recortar
              </button>
            </>
          ) : hasPending ? (
            <>
              {rotateReady && (
                <span className="stage-actions-info">
                  {Math.round(normalizeAngle(angle) * 10) / 10}°
                </span>
              )}
              <button className="btn" onClick={cancelPending}>
                <Icon name="close" size={16} />
                Cancelar
              </button>
              <button className="btn primary" onClick={applyPending}>
                <Icon name="check" size={16} />
                Aplicar
              </button>
            </>
          ) : (
            <span className="stage-actions-info">
              {tool === 'text'
                ? 'Clique na imagem para escrever'
                : tool === 'select'
                  ? selectMode === 'free'
                    ? 'Arraste na imagem desenhando a forma que quer selecionar'
                    : 'Arraste na imagem para selecionar um retângulo'
                  : 'Arraste sobre a imagem para girar'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
