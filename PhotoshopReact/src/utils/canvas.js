import { buildFilter } from './filters'

// Tamanho máximo (lado maior) de um documento novo, para não travar o navegador.
export const MAX_DOC_SIZE = 2400

// Carrega uma imagem a partir de uma URL (ou blob URL) e devolve uma Promise.
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// Lê um arquivo escolhido no <input type="file">.
export async function loadImageFromFile(file) {
  const url = URL.createObjectURL(file)
  try {
    return await loadImage(url)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Calcula o tamanho do documento para uma imagem (reduz se for gigante).
export function getDocSizeForImage(img) {
  const ratio = Math.min(1, MAX_DOC_SIZE / Math.max(img.naturalWidth, img.naturalHeight))
  return {
    width: Math.round(img.naturalWidth * ratio),
    height: Math.round(img.naturalHeight * ratio),
  }
}

// Desenha a imagem centralizada dentro do canvas, sem distorcer ("contain").
export function drawImageContain(ctx, img, canvasWidth, canvasHeight) {
  const scale = Math.min(canvasWidth / img.naturalWidth, canvasHeight / img.naturalHeight)
  const w = img.naturalWidth * scale
  const h = img.naturalHeight * scale
  ctx.drawImage(img, (canvasWidth - w) / 2, (canvasHeight - h) / 2, w, h)
}

// Limpa o canvas e redesenha o conteúdo "de origem" da camada:
// fundo branco, imagem aberta ou nada (camada transparente).
export function drawLayerSource(ctx, source, width, height) {
  ctx.clearRect(0, 0, width, height)
  if (source?.type === 'fill') {
    ctx.fillStyle = source.color
    ctx.fillRect(0, 0, width, height)
  } else if (source?.type === 'image') {
    drawImageContain(ctx, source.image, width, height)
  }
}

// Junta todas as camadas visíveis em UM canvas novo (de baixo para cima),
// aplicando opacidade e filtros de cada camada. Esse canvas é o que vira PNG.
export function flattenLayers({ width, height, layers, canvasRefs, displayScale }) {
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const ctx = out.getContext('2d')

  for (const layer of layers) {
    if (!layer.visible) continue
    const source = canvasRefs[layer.id]
    if (!source) continue
    ctx.save()
    ctx.globalAlpha = layer.opacity / 100
    // O blur no CSS é medido em pixels da TELA; aqui precisamos de pixels do canvas.
    ctx.filter = buildFilter(layer.options, 1 / displayScale)
    ctx.drawImage(source, 0, 0)
    ctx.restore()
  }
  return out
}

// ---------------------------------------------------------------
// Texto
// ---------------------------------------------------------------

// Altura de cada linha, em múltiplos do tamanho da fonte. A caixa de texto
// na tela usa o MESMO valor, para o texto cair onde o usuário viu.
export const TEXT_LINE_HEIGHT = 1.2

export const FONT_OPTIONS = [
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: 'Impact', value: 'Impact, "Arial Black", sans-serif' },
]

// Escreve um texto (pode ter várias linhas) no canvas, com o canto
// superior esquerdo em (x, y).
export function drawText(ctx, { text, x, y, fontSize, color, fontFamily }) {
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = color
  ctx.font = `${fontSize}px ${fontFamily}`
  ctx.textBaseline = 'middle' // o meio da linha coincide com o da caixa de texto do HTML
  const lineHeight = fontSize * TEXT_LINE_HEIGHT
  text.split('\n').forEach((line, i) => {
    ctx.fillText(line, x, y + (i + 0.5) * lineHeight)
  })
  ctx.restore()
}

// ---------------------------------------------------------------
// Recortar e girar (devolvem um ImageData novo; o canvas original não muda)
// ---------------------------------------------------------------

// Copia só o retângulo { x, y, width, height } de um canvas.
export function cropCanvasToImageData(canvas, { x, y, width, height }) {
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const ctx = out.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(canvas, -x, -y)
  return ctx.getImageData(0, 0, width, height)
}

// Gira o conteúdo do canvas em torno do centro, mantendo o tamanho do canvas
// (o que sair para fora é cortado; o que sobrar fica transparente).
export function rotateCanvasToImageData(canvas, degrees) {
  const { width, height } = canvas
  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const ctx = out.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.translate(width / 2, height / 2)
  ctx.rotate((degrees * Math.PI) / 180)
  ctx.drawImage(canvas, -width / 2, -height / 2)
  return ctx.getImageData(0, 0, width, height)
}

// Faz o navegador baixar um canvas como arquivo PNG.
export function downloadCanvas(canvas, filename = 'imagem-editada.png') {
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/png')
}
