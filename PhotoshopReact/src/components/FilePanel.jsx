import { useRef, useState } from 'react'
import Icon from './Icon'
import { AI_SIZES } from '../utils/aiImage'

export default function FilePanel({ onOpenImage, onImportLayer, onGenerateImage, onDownload }) {
  const inputRef = useRef(null)
  const modeRef = useRef('open') // 'open' = novo documento | 'layer' = nova camada

  // Gerar com I.A.
  const [aiOpen, setAiOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [sizeId, setSizeId] = useState(AI_SIZES[0].id)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  async function handleGenerate(event) {
    event.preventDefault()
    const text = prompt.trim()
    if (!text || loading) return

    setLoading(true)
    setError('')
    try {
      const size = AI_SIZES.find((item) => item.id === sizeId)
      await onGenerateImage(text, size)
      setAiOpen(false) // deu certo: a imagem já abriu no canvas
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="glass panel file-panel">
      <h3 className="panel-title">Arquivo</h3>

      <button className="btn" onClick={() => pickFile('open')}>
        <Icon name="folder" size={16} />
        Abrir imagem
      </button>
      <button className="btn" onClick={() => setAiOpen((open) => !open)} aria-expanded={aiOpen}>
        <Icon name="sparkles" size={16} />
        Gerar imagem com I.A.
      </button>

      {aiOpen && (
        <form className="ai-form" onSubmit={handleGenerate}>
          <input
            className="text-input"
            type="text"
            value={prompt}
            maxLength={400}
            placeholder="Descreva a imagem..."
            disabled={loading}
            autoFocus
            onChange={(event) => setPrompt(event.target.value)}
          />
          <select
            className="select-input"
            value={sizeId}
            disabled={loading}
            onChange={(event) => setSizeId(event.target.value)}
          >
            {AI_SIZES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <button className="btn primary" type="submit" disabled={loading || !prompt.trim()}>
            <Icon name="sparkles" size={16} />
            {loading ? 'Gerando…' : 'Gerar'}
          </button>
          {error && (
            <p className="ai-error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}

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
