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
