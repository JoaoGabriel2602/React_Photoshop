// Histórico de desfazer/refazer baseado em "fotografias" (snapshots) do documento.
//
// Cada snapshot guarda:
//   doc           -> tamanho do documento
//   layers        -> propriedades das camadas (nome, opacidade, filtros...)
//   activeLayerId -> camada selecionada
//   pixels        -> { idDaCamada: ImageData } só das camadas que foram desenhadas
//
// Os objetos ImageData são COMPARTILHADOS entre snapshots: se um traço mexe só
// na camada A, as outras camadas reaproveitam o mesmo ImageData do snapshot
// anterior. Isso economiza muita memória.

export const MAX_STEPS = 30 // no máximo 30 snapshots
export const MAX_BYTES = 400 * 1024 * 1024 // ~400 MB de pixels guardados

export function createHistory(firstSnapshot) {
  return { stack: [firstSnapshot], index: 0 }
}

export const canUndo = (history) => history.index > 0
export const canRedo = (history) => history.index < history.stack.length - 1

// Soma os bytes dos ImageData (sem contar duas vezes os compartilhados).
function countBytes(stack) {
  const seen = new Set()
  let total = 0
  for (const snapshot of stack) {
    for (const image of Object.values(snapshot.pixels)) {
      if (seen.has(image)) continue
      seen.add(image)
      total += image.data.byteLength
    }
  }
  return total
}

// Adiciona um snapshot depois do atual. O que estava "à frente" (refazer)
// é descartado, igual ao Paint. Os mais antigos saem quando passa do limite.
export function pushSnapshot(history, snapshot) {
  history.stack.splice(history.index + 1)
  history.stack.push(snapshot)
  history.index = history.stack.length - 1

  while (
    history.stack.length > 1 &&
    (history.stack.length > MAX_STEPS || countBytes(history.stack) > MAX_BYTES)
  ) {
    history.stack.shift()
    history.index -= 1
  }
}
