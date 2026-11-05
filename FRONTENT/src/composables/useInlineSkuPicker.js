import { computed, ref } from 'vue'

export const useInlineSkuPicker = (props, emit, options) => {
  const searchQuery = ref('')
  const filteredOptions = computed(() => {
    const query = String(searchQuery.value || '').trim().toLowerCase()
    if (!query) return options.value
    return options.value.filter((option) => {
      const text = typeof props.searchBy === 'function' ? props.searchBy(option) : option[props.searchBy || 'label']
      return String(text ?? '').toLowerCase().includes(query)
    })
  })

  const isSelected = (code) => Object.hasOwn(props.modelValue || {}, code)
  const valueFor = (code) => isSelected(code) ? props.modelValue[code] : props.value
  const selectedCodes = computed(() => Object.keys(props.modelValue || {}))

  const setSelected = (codes) => {
    if (props.disable || props.loading) return
    emit('update:modelValue', Object.fromEntries(codes.map((code) => [code, valueFor(code)])))
  }

  const setValue = (code, value) => {
    if (props.disable || props.loading) return
    if (!isSelected(code) && String(value ?? '') === String(props.value ?? '')) return
    emit('update:modelValue', { ...props.modelValue, [code]: value })
  }

  return { searchQuery, filteredOptions, selectedCodes, valueFor, setSelected, setValue }
}
