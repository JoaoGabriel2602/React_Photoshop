// onCommit (opcional): chamado quando o usuário SOLTA o slider (mouse/toque)
// ou termina de usar as setas do teclado. É nesse momento que a mudança entra
// no histórico de desfazer, em vez de a cada pixel arrastado.
export default function Slider({min, max, value, handleChange, onCommit}) {
  return (
    <div className="slider-container">
      <input
        type="range"
        className="slider"
        min={min}
        max={max}
        value={value}
        onChange={handleChange}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
       />
    </div>
  )
}
