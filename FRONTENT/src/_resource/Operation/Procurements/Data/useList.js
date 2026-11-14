/**
 * Selects Procurements rows from their existing Progress field.
 * InFlight: every row except COMPLETED and CANCELLED.
 * Completed: rows whose Progress equals COMPLETED.
 * Cancelled: rows whose Progress equals CANCELLED.
 * Keeps the shared filter evaluator's case and missing-value rules, and source order.
 * No display fields or local controls. Item display lives in APP.Resources.ListViews.
 */
import { prepareFilter, evaluatePreparedFilter } from 'src/utils/tokenEvaluator'

const inFlight = prepareFilter(
  { type: 'condition', column: 'Progress', operator: 'nin', value: ['COMPLETED', 'CANCELLED'] },
  {}, { strictColumn: false }
)
const completed = prepareFilter(
  { type: 'condition', column: 'Progress', operator: 'eq', value: 'COMPLETED' },
  {}, { strictColumn: false }
)
const cancelled = prepareFilter(
  { type: 'condition', column: 'Progress', operator: 'eq', value: 'CANCELLED' },
  {}, { strictColumn: false }
)

export default {
  InFlight: rows => rows.filter(row => evaluatePreparedFilter(inFlight, row)),
  Completed: rows => rows.filter(row => evaluatePreparedFilter(completed, row)),
  Cancelled: rows => rows.filter(row => evaluatePreparedFilter(cancelled, row))
}
