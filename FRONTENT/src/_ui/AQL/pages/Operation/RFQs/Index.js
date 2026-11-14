// Sections run in urgency order: my queue, response rate, pipeline, deadline age, work.
export default {
  sections: [
    'PageHeader',
    'MetricCards',
    'LinearProgress',
    'WorkflowFunnel',
    'AgeingBuckets',
    'FilterInput',
    'ListSwitcher'
  ],
  contents: ['List']
}
