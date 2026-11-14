// Sections run in urgency order: my queue, GRN rate, pipeline, backlog age, work.
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
