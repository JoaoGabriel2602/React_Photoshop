import { loadImageFromFile } from './canvas.js'

// Geração de imagem por I.A. (Pollinations, API gen.pollinations.ai).
//
// O Pollinations exige uma chave de API. Para a chave não ficar visível no navegador,
// o pedido vai para /api/ai-image/... e o servidor do Vite (vite.config.js) repassa
// para o Pollinations acrescentando a chave guardada em .env.local.
const API_URL = '/api/ai-image'
const TIMEOUT_MS = 90_000 // a geração pode demorar alguns segundos

// Formatos oferecidos no painel (largura x altura da imagem gerada).
export const AI_SIZES = [
  { id: 'square', label: 'Quadrado (768 × 768)', width: 768, height: 768 },
  { id: 'landscape', label: 'Paisagem (768 × 432)', width: 768, height: 432 },
  { id: 'portrait', label: 'Retrato (432 × 768)', width: 432, height: 768 },
]

// Pega um pedaço curto da resposta de erro do serviço, para mostrar o motivo real.
async function readErrorDetail(response) {
  try {
    const text = (await response.text()).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    return text.slice(0, 160)
  } catch {
    return ''
  }
}

function explainHttpError(status, detail) {
  const extra = detail ? ` Detalhe: ${detail}` : ''
  if (status === 401) {
    return `Chave de API ausente ou inválida. Crie o arquivo .env.local com POLLINATIONS_API_KEY e reinicie o npm run dev.${extra}`
  }
  if (status === 402 || status === 429) {
    return `Sem saldo ou limite de uso atingido no Pollinations. Espere um pouco e tente de novo.${extra}`
  }
  if (status === 403) {
    return `O Pollinations recusou o pedido (403). Confira se a chave tem permissão para gerar imagens.${extra}`
  }
  if (status === 404) {
    return 'Rota de I.A. não encontrada. Use o projeto com "npm run dev" ou "npm run preview" (o repasse da chave fica no servidor do Vite).'
  }
  return `O serviço de I.A. respondeu com erro (${status}).${extra}`
}

// Gera uma imagem a partir de um texto e devolve um <img> já carregado,
// igual ao que loadImageFromFile devolve para uma foto aberta do computador.
//
// Baixamos como arquivo (fetch -> blob) e passamos pelo MESMO caminho de uma foto
// importada. Assim os pixels são "locais" e o canvas nunca fica bloqueado para
// pintar, aplicar filtros ou exportar PNG.
export async function generateAiImage(prompt, { width, height }) {
  const seed = Math.floor(Math.random() * 1_000_000) // seed nova = imagem nova a cada clique
  const url = `${API_URL}/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      throw new Error(explainHttpError(response.status, await readErrorDetail(response)))
    }

    const blob = await response.blob()
    if (!blob.type.startsWith('image/')) {
      throw new Error('O serviço de I.A. não devolveu uma imagem. Tente de novo.')
    }
    return await loadImageFromFile(blob)
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('A geração demorou demais. Tente de novo em instantes.')
    }
    if (error instanceof TypeError) {
      throw new Error('Não foi possível conectar ao serviço de I.A. Verifique sua internet.')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}
