# PROCUREMENT Sheet Structure

## Purpose
This document describes the procurement-related sheet families used for purchasing workflow.

## Purchase Requisition fields

- `PurchaseRequisitions`: `Code, PRDate, RequiredDate, Username, Remarks, Progress, ProgressCancelledAt, ProgressCancelledBy, ProgressCancelledComment, Status, AccessRegion, CreatedAt, UpdatedAt, Revision, CreatedBy, UpdatedBy`.
- Parent progress: `Open`, `Partially Quoted`, `Fully Quoted`, `Closed`, `Cancelled`. The default is `Open`.
- Cancel saves the time in `ProgressCancelledAt` (`datetime`), the user in `ProgressCancelledBy` (`text`), and the required reason in `ProgressCancelledComment` (`textarea`). Closed and Cancelled PRs cannot be edited.
- `PurchaseRequisitionItems`: `Code, PurchaseRequisitionCode, SKU, Quantity, QuotedQuantity, RFQCodes, Progress, Status, CreatedAt, UpdatedAt, Revision, CreatedBy, UpdatedBy`.
- Item progress: `Open`, `Partially Quoted`, `Fully Quoted`. Defaults: `Quantity: 1`, `QuotedQuantity: 0`, `RFQCodes: ''`, `Progress: 'Open'`, `Status: 'Active'`.
- `Username` stores the creator's name. Editing a PR keeps that name. Older blank names stay blank.
- Item status uses `Active` and `Inactive`. A saved item keeps its code. Removing it queues deactivation in the composite save.
- The parent no longer has procurement, warehouse, type, priority, or approval stamp fields. Items no longer have description or UOM fields.
- `Remarks` is a textarea. Add and owner edits do not need it. A non-owner edit needs non-blank remarks. View shows saved remarks with line breaks.
- The six PR list keys are `MyOpen`, `AllOpen`, `PartiallyQuoted`, `FullyQuoted`, `Closed`, and `Cancelled`. `MyOpen` is the default and has no view permission gate. `AllOpen` needs `RFQs:create`.
- PRs and PR items seed `AccessPolicy: '77333'`. The PR region source uses `AccessRegion` and the saving user's region. PR items have no region column, so their blank region source gives no row region check.
- These seeds do not bypass PR read/update rights or region limits. See [PR visibility and access](WORKFLOW_PROCUREMENT.md#pr-visibility-and-access).
- See [PR states and form](WORKFLOW_PROCUREMENT.md#purchase-requisition-states-and-form) for the live node rules and known caller gaps.

## Current Procurement Resources
- `Procurements`
- `PurchaseRequisitions`
- `PurchaseRequisitionItems`
- `RFQs`
- `RFQItems`
- `RFQSuppliers`
- `SupplierQuotations`
- `SupplierQuotationItems`
- `PurchaseOrders`
- `PurchaseOrderItems`
- `POReceivings`
- `POReceivingItems`
- `GoodsReceipts`
- `GoodsReceiptItems`
- `POFulfillments`

## Structural Expectations
- parent/child workflow sheets are used across the procurement process
- workflow/progress tracking may require action/progress columns depending on current configuration

## RFQ Supplier Assignment/Send Lifecycle

- `RFQSuppliers.Progress` uses `ASSIGNED`, `SENT`, `RESPONDED`, and `CANCELLED`. Assignment, send, reply, and cancel times, users, and comments use their matching columns. `ProgressCancelledComment` is a `textarea`.
- **Manage Suppliers**: `ManageSuppliers` is the single supplier action at `/operation/rfqs/{code}/manage-suppliers`. It is shown for `DRAFT`, `ASSIGNED`, and `SENT`. A `CLOSED` or `CANCELLED` RFQ is read-only on this page.
- **Assigned Suppliers**: This card lists all `Status: Active` supplier rows on the RFQ, including `CANCELLED` rows. Non-`RESPONDED` rows can move between `ASSIGNED`, `SENT`, and `CANCELLED`. `RESPONDED` rows are locked. Cancel needs a `Cancellation Reason`, saved to `ProgressCancelledComment`. Moving back to `ASSIGNED` clears `SentDate` and all send, reply, and cancel stamps and comments. Moving to `SENT` keeps an existing send date, or uses today if blank. It saves send stamps and clears reply and cancel stamps and comments.
- **Add New Suppliers**: This card offers active master `Suppliers` with no active supplier row on this RFQ. Existing `CANCELLED` rows stay in the first card and are not offered here. New rows start as `ASSIGNED`. Adding them moves a `DRAFT` RFQ to `ASSIGNED`. The unique pair is `RFQCode+SupplierCode`.
- **RFQ State**: After supplier status changes, only active, non-cancelled rows count. Any `SENT` or `RESPONDED` row means `RFQs.Progress = SENT`. Otherwise, any `ASSIGNED` row means `ASSIGNED`. No such rows means `DRAFT`.
- **Procurement State**: When at least one active, non-cancelled row remains and all are `SENT` or `RESPONDED`, the linked procurement can advance to `RFQ_SENT_TO_SUPPLIERS`. Its own state rules still apply. When the RFQ drops to `ASSIGNED` or `DRAFT`, a procurement at `RFQ_SENT_TO_SUPPLIERS` rolls back to `RFQ_GENERATED`.
- **Supplier Reply**: A first saved quotation changes the matching supplier row to `RESPONDED` and saves `ProgressRespondedAt`, `ProgressRespondedBy`, and `ProgressRespondedComment`. `SupplierQuotations.ResponseDate` stores the supplier's stated reply date. If the send was not recorded, the send comment says it was inferred and `SentDate` stays blank.
- **Close**: `Close` moves an RFQ from `SENT` to `CLOSED`. Optional `Closing Remarks` is saved from `Comment` to `ProgressClosedComment`. The action saves `ProgressClosedAt` and `ProgressClosedBy`. PO creation can also close an RFQ after full item coverage.
- **Cancel**: The RFQ View dialog can cancel `DRAFT`, `ASSIGNED`, or `SENT` RFQs. An active quotation or an active, non-cancelled purchase order blocks it. A reason is required. Cancel reverses PR items' `QuotedQuantity` and `RFQCodes`. It leaves `RFQSuppliers` rows untouched in their current `Progress` state. It cancels the linked `Procurements` row and saves `ProgressCancelledAt`, `ProgressCancelledBy`, and `ProgressCancelledComment`.

## Procurement, RFQ, and RFQ Item Sheets
- All three sheets use five audit columns at the end: `CreatedAt`, `UpdatedAt`, `Revision`, `CreatedBy`, and `UpdatedBy`.
- **Procurements** has 15 columns: `Code, Progress, ProgressCancelledAt, ProgressCancelledBy, ProgressCancelledComment, InitiatedDate, CreatedUser, CreatedRole, Status, AccessRegion`, then five audit columns.
- **RFQs** has 39 columns: 34 business, state, and region columns, then five audit columns. The 34 columns are `Code, ProcurementCode, PurchaseRequisitionCodes, RFQDate, QuotationSubmissionDeadline, RequiredBy, WarehouseCode, Type, TypeReferenceCode, Priority, Username, Remarks, Progress, ProgressClosedComment, ProgressClosedAt, ProgressClosedBy, ProgressCancelledAt, ProgressCancelledBy, ProgressCancelledComment`, 13 requirement columns (`RequirementPrice`, `RequirementPackaging`, `RequirementPaymentTerms`, `RequirementCreditPeriod`, `RequirementShippingTerms`, `RequirementLeadTime`, `RequirementQuotationValidity`, `RequirementShipmentGrouping`, `RequirementExtraCharges`, `RequirementRefundableTaxAmount`, `RequirementItemAvailability`, `RequirementPartialOrderAcceptance`, `RequirementQuality`), `Status`, and `AccessRegion`.
- RFQs require `ProcurementCode`, `RFQDate`, `QuotationSubmissionDeadline`, `RequiredBy`, `WarehouseCode`, `Type`, `Priority`, and `Username`. `PurchaseRequisitionCodes` is an optional CSV of PR codes. Progress values are `DRAFT`, `ASSIGNED`, `SENT`, `CLOSED`, and `CANCELLED`. Type options are `STOCK`, `PROJECT`, `SALES`, and `ASSET`. Priority options are `Low`, `Medium`, `High`, and `Urgent`.
- The RFQ region source checks `WarehouseCode` through `Warehouses`, then uses the user as a fallback. RFQ settings include 13 names, including Quality, in `RFQRequirements`, `DefaultQuotationSubmissionDays` set to 14, and `DefaultRequiredByDays` set to 30. The five list views are `Drafts`, `Assigned`, `Sent` (labelled `Out for Quoting`), `Closed`, and `Cancelled`. Each has `actions: false`. `Assigned` needs `manageSuppliers`. `Sent` needs `any,manageSuppliers,close,cancel`.
- `RequirementQuality` is the scaled Quality rule. It compares item quality to the requested specification. Higher is better (`order: asc`).
- The Select Requirements list keeps catalogue order. Its Weight input uses 0 to turn a requirement off and 1 to 10 to turn it on. A checkbox starts at weight 1. The option step keeps its separate 1 to 10 input.
- Step 1 has two contents: Select From Pending PRs and Items to Quote. The PR card hides when there are no eligible PRs or PR read access is missing. PR chips show time left or time overdue from RequiredDate. Item quantity and delete sit on the first line. Description uses two rows below. The supplier picker shows No Supplier Selected until a supplier is picked.
- Requirement values are stored as JSON in their matching `Requirement*` columns. A value has `name`, `type`, and `weight`. Scaled values also have `order`; fixed values have `options`. `SupplierQuotations.CriteriaResponses` answer shapes, scoring rules, and saved scores remain open and pending.
- **RFQItems** has 14 columns: `Code, RFQCode, PurchaseRequisitionItemCodes, SKU, Quantity, UOM, Description, Allocations, Status`, then five audit columns. Its code prefix is `RFQI`, parent is `RFQs`, required headers are `Code,RFQCode,SKU,Quantity`, and defaults are `Status: Active` and `Quantity: 1`. The form fills `UOM` from the SKU and does not let users edit it. `Allocations` stores JSON with PR item codes as keys and allocated quantities as values; `excess` stores quantity not allocated to a PR item.

## Supplier Quotation Response Capture
- **Header Sheet**: `SupplierQuotations` stores normalized supplier responses with `Code`, `ProcurementCode`, `RFQCode`, `SupplierCode`, `ResponseType`, response/term fields, `AllowPartialPO`, `SupplierQuotationReference`, `CriteriaResponses` (JSON-string storage for supplier answers; JSON shapes, scoring formula, and score persistence remain open and not implemented yet), controlled `ExtraChargesBreakup` JSON, `TotalAmount`, `Progress`, reject tracking columns, response recording columns, `Status`, `AccessRegion`, and audit columns.
- **Item Sheet**: `SupplierQuotationItems` stores quoted line rows with `SupplierQuotationCode`, `PurchaseRequisitionItemCode`, `SKU`, `Description`, `Quantity`, `UnitPrice`, `TotalPrice`, item lead/delivery fields, `Remarks`, `Status`, and audit columns.
- **Response Types**: `QUOTED` requires all RFQ purchase requisition items to have quote data; `PARTIAL` permits missing item rows; `DECLINED` requires a decline reason and does not require item rows.
- **First Save Workflow**: New capture requires the matching active `RFQSuppliers` row to be `ASSIGNED` or `SENT`. Saving the first reply marks that row `RESPONDED`, stamps `ProgressRespondedAt`, `ProgressRespondedBy` and `ProgressRespondedComment`, and may advance the linked procurement to `QUOTATIONS_RECEIVED`. If the send was not recorded, it stamps `ProgressSentAt`, `ProgressSentBy` and a `ProgressSentComment` saying the send was inferred from the reply; `SentDate` stays blank because the send date is unknown. Later quotation edits do not repeat the supplier or procurement progress writes. Each node carries the rights needed for its own resource.
- **Reject Action**: `SupplierQuotations` supports a `Reject` additional action only from `RECEIVED`; it sets `Progress = REJECTED` and records `ProgressRejectedComment`, `ProgressRejectedAt`, and `ProgressRejectedBy`.

## Purchase Order
- **Header Sheet**: `PurchaseOrders` stores `Code`, `ProcurementCode`, `SupplierQuotationCode`, `SupplierCode`, `PODate`, `ShipToWarehouseCode`, `Progress`, progress tracking triplets for `Sent`, `Acknowledged`, `Accepted`, and `Cancelled`, then `Currency`, `SubtotalAmount`, `ExtraChargesBreakup`, `TotalAmount`, `Remarks`, `Status`, `AccessRegion`, audit columns.
- **Item Sheet**: `PurchaseOrderItems` stores `Code`, `PurchaseOrderCode`, `SupplierQuotationItemCode`, `SKU`, `Description`, `UOM`, `QuotedQuantity`, `OrderedQuantity`, `UnitPrice`, `SupplierItemCode`, `Remarks`, `Status`, audit columns.
- **Purchase Order Features**: `AllowPartialPO` decides if users can partially order. Remaining quantities compute in frontend from `SupplierQuotationItems.Quantity - SUM(PurchaseOrderItems.OrderedQuantity)`. Closed POs consume ordered quantity, Cancelled do not. Generates via standard generic APIs. Progress is tracked via `AdditionalActions`. Creating a PO updates the source quotation to `ACCEPTED` and can close the source RFQ through confirmation when RFQ quantities are fully covered. Confirmed RFQ close records `ProgressClosedComment` as `<user_name>/system: "Complete purchase order created, hence closing RFQ"` with action audit fields. Cancelling a PO marks matching `RFQSuppliers` as `CANCELLED`; if no other active non-cancelled PO exists for a `PO_ISSUED` procurement, the procurement returns to `QUOTATIONS_RECEIVED`. If the RFQ was `CLOSED`, it returns to `SENT` and clears `ProgressClosedComment`.

## PO Receiving And Goods Receipts
- **PO Receiving Header**: `POReceivings` stores `Code`, `ProcurementCode`, `PurchaseOrderCode`, inspection metadata, `Progress` (`DRAFT`, `CONFIRMED`, `GRN_GENERATED`, `CANCELLED`), action audit triplets for confirmation/cancellation/GRN generation, remarks, status, region, and audit columns.
- **PO Receiving Items**: `POReceivingItems` stores `ExpectedQty`, `ReceivedQty`, `DamagedQty`, `RejectedQty`, and rejection notes. Accepted, short, and excess quantities are frontend-derived and not stored.
- **Goods Receipts**: `GoodsReceipts` stores finalized GRN headers linked to `ProcurementCode`, `PurchaseOrderCode`, and `POReceivingCode`; invalidation is represented by `Status = Inactive`.
- **Goods Receipt Items**: `GoodsReceiptItems.Qty` stores accepted quantity only, derived as `max(ReceivedQty - DamagedQty - RejectedQty, 0)` at GRN generation.
- **Procurement Progress**: saving a PO receiving draft can move `PO_ISSUED` to `GOODS_RECEIVING`; generating GRN moves procurement to `GRN_GENERATED`; invalidating a GRN rolls the receiving back to `CONFIRMED` and procurement to `GOODS_RECEIVING` unless procurement is already `COMPLETED`.

## Canonical Detail Owners
- Workflow detail: [WORKFLOW_OUTLET_OPERATIONS.md](F:/AQL/Documents/WORKFLOW_OUTLET_OPERATIONS.md)
- Resource metadata rules: [SCHEMA_RESOURCE_COLUMNS.md](F:/AQL/Documents/SCHEMA_RESOURCE_COLUMNS.md)

## Maintenance Rule
Update this file when:
- a procurement sheet is added, removed, or repurposed
- procurement structure expectations change materially
