import { useRef } from 'react'

export default function TopBar({ onOpenImage, onImportLayer, onDownload }) {
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
    <header className="topbar">
      <strong className="topbar-title">PhotoshopReact</strong>

      <button className="topbar-button" onClick={() => pickFile('open')}>
        Abrir imagem
      </button>
      <button className="topbar-button" onClick={() => pickFile('layer')}>
        Importar como camada
      </button>
      <button className="topbar-button primary" onClick={onDownload}>
        Baixar PNG
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleFileChange}
      />
    </header>
  )
}
