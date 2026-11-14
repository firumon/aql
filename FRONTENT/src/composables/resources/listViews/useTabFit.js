import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'

const MORE_FALLBACK = 110

export function useTabFit ({ tabs, rowRef, moreRef }) {
  const $q = useQuasar()
  const isDrag = computed(() => !!$q.platform.is.mobile)
  const hiddenNames = ref([])
  let observer = null

  const sameList = (a, b) => a.length === b.length && a.every((name, index) => name === b[index])

  const refit = () => {
    const row = rowRef.value
    if (!row) return
    if (isDrag.value) {
      if (hiddenNames.value.length) hiddenNames.value = []
      return
    }
    const items = [...row.querySelectorAll('[data-name]')]
    if (!items.length) {
      if (hiddenNames.value.length) hiddenNames.value = []
      return
    }
    const style = getComputedStyle(row)
    const available = row.clientWidth -
      (parseFloat(style.paddingLeft) + parseFloat(style.paddingRight))
    const gap = parseFloat(style.columnGap || style.gap) || 0
    const names = items.map(item => item.getAttribute('data-name'))
    const widths = items.map(item => item.getBoundingClientRect().width)
    const total = widths.reduce((sum, width) => sum + width, 0) + gap * (items.length - 1)
    if (total <= available) {
      if (hiddenNames.value.length) hiddenNames.value = []
      return
    }
    const moreEl = moreRef?.value || null
    const moreWidth = (moreEl ? moreEl.getBoundingClientRect().width : 0) || MORE_FALLBACK
    let budget = available - moreWidth - gap
    let used = 0
    const keep = []
    const hidden = []
    for (let i = 0; i < names.length; i++) {
      const cost = widths[i] + (keep.length ? gap : 0)
      if (used + cost <= budget) {
        used += cost
        keep.push(names[i])
      } else {
        hidden.push(names[i])
      }
    }
    if (!keep.length && names.length) {
      keep.push(names[0])
      hidden.shift()
    }
    if (!sameList(hiddenNames.value, hidden)) hiddenNames.value = hidden
  }

  watch(tabs, () => nextTick(refit))
  watch(hiddenNames, () => nextTick(refit))
  watch(isDrag, () => nextTick(refit))

  onMounted(() => {
    nextTick(refit)
    observer = new ResizeObserver(() => refit())
    if (rowRef.value) observer.observe(rowRef.value)
  })
  onBeforeUnmount(() => {
    observer?.disconnect()
    observer = null
  })

  return { isDrag, hiddenNames, refit }
}
