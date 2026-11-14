import { h, isVNode, toRaw } from 'vue'

export function isComponentDef (value) {
  return !!value && typeof value === 'object' && !isVNode(value) &&
    !!(value.render || value.setup || value.template || value.__file)
}

function Renderable (props, { attrs, slots }) {
  const { slotFn, value, is, valueProp, item } = props
  if (slotFn) return slotFn({ item })
  if (value === false || value === null || value === undefined || value === '') return null
  if (isComponentDef(value)) {
    return h(toRaw(value), { item, class: attrs.class, style: attrs.style }, slots)
  }
  const resolved = typeof value === 'function'
    ? value(item)
    : (item && typeof item === 'object' && value in item) ? item[value] : value

  if (resolved === false || resolved === null || resolved === undefined || resolved === '') return null
  if (isVNode(resolved)) return resolved
  if (!is) return resolved

  return valueProp
    ? h(is, { ...attrs, [valueProp]: resolved })
    : h(is, attrs, { default: () => resolved })
}

Renderable.props = {
  slotFn:    { type: Function, default: null },
  value:     { default: null },
  is:        { default: null },
  valueProp: { type: String, default: null },
  item:      { default: null }
}
Renderable.inheritAttrs = false

export default Renderable
