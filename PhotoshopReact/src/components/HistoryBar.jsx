import Icon from './Icon'

export default function HistoryBar({ onUndo, onRedo, canUndo, canRedo }) {
  return (
    <div className="glass history-bar">
      <button className="icon-button" onClick={onUndo} disabled={!canUndo} title="Desfazer a última ação">
        <Icon name="undo" size={18} />
      </button>
      <button className="icon-button" onClick={onRedo} disabled={!canRedo} title="Refazer a ação desfeita">
        <Icon name="redo" size={18} />
      </button>
    </div>
  )
}