const featureModules = import.meta.glob('./features/*.js', { eager: true })

const FEATURES = Object.keys(featureModules).sort().map((path) => {
  const name = path.split('/').pop().replace(/\.js$/, '')
  if (typeof featureModules[path]?.default !== 'function') {
    throw new Error(`[useFeatureChain] features/${name}.js must default-export a function(records, config).`)
  }
  return { name, apply: featureModules[path].default }
})

export function runFeatures (records, config) {
  let rows = records
  for (const feature of FEATURES) {
    rows = feature.apply(rows, config)
    if (!Array.isArray(rows)) {
      throw new TypeError(`[useFeatureChain] Feature "${feature.name}" must return an array, got ${typeof rows}`)
    }
  }
  return rows
}
