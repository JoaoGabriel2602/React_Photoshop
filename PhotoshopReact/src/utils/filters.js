// Opções de ajuste (os mesmos sliders que você já tinha).
// Agora cada CAMADA tem a sua própria cópia, por isso usamos uma função
// que devolve uma lista nova a cada chamada.
const DEFAULT_OPTIONS = [
  { name: 'Brightness', property: 'brightness', value: 100, range: { min: 0, max: 200 }, unit: '%' },
  { name: 'Contrast', property: 'contrast', value: 100, range: { min: 0, max: 200 }, unit: '%' },
  { name: 'Saturation', property: 'saturate', value: 100, range: { min: 0, max: 200 }, unit: '%' },
  { name: 'Grayscale', property: 'grayscale', value: 0, range: { min: 0, max: 100 }, unit: '%' },
  { name: 'Sepia', property: 'sepia', value: 0, range: { min: 0, max: 100 }, unit: '%' },
  { name: 'Hue Rotate', property: 'hue-rotate', value: 0, range: { min: 0, max: 360 }, unit: 'deg' },
  { name: 'Blur', property: 'blur', value: 0, range: { min: 0, max: 20 }, unit: 'px' },
]

export function createDefaultOptions() {
  return DEFAULT_OPTIONS.map((option) => ({ ...option, range: { ...option.range } }))
}

// Monta a string de filtro. Serve tanto para o CSS (`style.filter`)
// quanto para o canvas (`ctx.filter`) na hora de exportar.
// `blurScale` converte o blur de "pixels da tela" para "pixels do canvas".
export function buildFilter(options, blurScale = 1) {
  return options
    .map((option) => {
      const value = option.property === 'blur' ? option.value * blurScale : option.value
      return `${option.property}(${value}${option.unit})`
    })
    .join(' ')
}
