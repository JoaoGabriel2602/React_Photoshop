import { useRef } from 'react'
import Icon from './Icon'

export default function FilePanel({ onOpenImage, onImportLayer, onDownload }) {
  const inputRef = useRef(null)
  const modeRef = useRef('open') // 'open' = novo documento | 'layer' = nova camada

  function pickFile(mode) {
    modeRef.current = mode
    inputRef.current.click()
  }

  function handleFileChange(event) {
    const file = event.target.files[0]
    event.target.value = '' // permite escolher o mesmo arquivo de novo depois
    if (!file) return
    if (modeRef.current === 'open') onOpenImage(file)
    else onImportLayer(file)
  }

  return (
    <section className="glass panel file-panel">
      <h3 className="panel-title">Arquivo</h3>

      <button className="btn" onClick={() => pickFile('open')}>
        <Icon name="folder" size={16} />
        Abrir imagem
      </button>
      <button className="btn" onClick={() => pickFile('layer')}>
        <Icon name="layers" size={16} />
        Importar como camada
      </button>
      <button className="btn primary" onClick={onDownload}>
        <Icon name="download" size={16} />
        Exportar PNG
      </button>

      <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFileChange} />
    </section>
  )
}