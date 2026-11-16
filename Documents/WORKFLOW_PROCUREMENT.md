# 📦 Procurement & Warehouse Inventory Workflow

## Purpose
This document is the canonical business and software workflow specification for supply chain, inbound procurement, product variants, and warehouse inventory management in AQL.

---

## 1. Supply Chain & Inbound Lifecycle

The procurement and inbound inventory cycle governs how stock is ordered from suppliers, imported into the UAE, inspected at the warehouse, and made available for commercial distribution:

```mermaid
graph TD
    PR[1. Purchase Requisition] --> RFQ[2. RFQ Dispatch to Suppliers]
    RFQ --> SQ[3. Supplier Quotation Response]
    SQ --> PO[4. Purchase Order Issuance]
    PO --> REC[5. PO Receiving & Quality Inspection]
    REC --> GRN[6. Goods Receipt Note (GRN)]
    GRN --> STK[7. Warehouse Stock Posting (WarehouseStorages)]
```

---

## Purchase Requisition states and form

A PR uses `Open`, `Partially Quoted`, `Fully Quoted`, `Closed`, and `Cancelled`. New PRs start
as `Open` and `Active`. Only active PRs that are not closed or cancelled can be edited.
Items use the same quote states, without `Closed`.

The PR form context has no step state. Its draft check needs a required date and at least one active
item. Each item needs an SKU and a number of at least 1 for its quantity. The same
SKU cannot appear twice. The opening PR date is today. The opening required date
is seven days from today, unless the caller gives another date.

The parent and items are live page nodes. Item picks and quantity changes update
those nodes as the user acts. Removing a saved item queues its deactivation.
Removing a new item drops it. Submit checks the live nodes. It does not rebuild them.
The PR payload no longer creates a Procurement or writes approval stamps.

The six list keys are `MyOpen`, `AllOpen`, `PartiallyQuoted`, `FullyQuoted`, `Closed`, and
`Cancelled`. My Open is the default. It shows the user's active Open PRs. All Open
needs RFQ create rights and shows all loaded active Open PRs. In the other four
lists, RFQ creators see all matching active PRs. Other users see their own PRs.
My Open shows the PR date without the owner name. All Open shows both.
Open and quote lists show the oldest first. Closed shows the newest first.
Cancelled shows the newest cancellation first, with the normal PR date sort fallback
when the stamp is missing. It shows the owner, who cancelled it, and the cancellation date. See
[PR sheet fields](SHEET_PROCUREMENT_STRUCTURE.md#purchase-requisition-fields).

The Index shows Open, Partially Quoted, Past Required Date, and Fully Quoted in a
2 by 2 grid. It hides the grid when all four counts are zero. The user bars group
active non-closed PRs by user and quote state, with the largest totals first.
Search and list tabs do not change these counts. Counts and user bars cover only
the user's PRs, unless the user has RFQ create rights. Row edit needs PR update
rights and either the same creator or RFQ create rights. Cancel on Index and View needs an active Open PR, Cancel rights, and either
the same creator or RFQ create rights. Cancel needs a reason. It sets Progress to
`Cancelled` and saves `ProgressCancelledAt`, `ProgressCancelledBy`, and
`ProgressCancelledComment`. Closed and Cancelled are terminal states.

Add and Edit show the required date and SKU picker in one step. Submit checks the
live parent and items, then saves them and opens View. View shows Code, PR Date,
Required By, Requested By, progress, item quantities, quote quantities, RFQ codes,
and non-blank Remarks. Remarks keep their line breaks. Owners do not see a Remarks
input. A non-owner editing an existing PR sees a required Remarks textarea. It
starts with the saved text, which can be kept or extended. Submit rejects blank
or space-only Remarks for a non-owner. Add and owner edits do not need Remarks.
The old Review and Revisions pages and their cards have been removed.

The View Items card shows the SKU, requested and quoted quantities, unit, line
progress, and linked RFQ codes. Its footer shows line count and both quantity totals.
The Workflow Timeline shows Created, Quoted when reached, and Closed or Cancelled
when reached. It keeps that stage order. Quote history uses active lines. Full quote
means the PR is Fully Quoted or every active line has a positive requested quantity
that is fully covered. The quote time comes from the latest linked RFQ date, with
its creation time as a fallback. Without a valid linked date it uses the PR update time.
Linked RFQ users are shown once each. Cancel shows its saved user, time, and reason.
Comments keep their line breaks.

RFQ read rights make RFQ chips open the RFQ View page. Without those rights, chips
stay neutral and cannot open a page. The View does not load or show RFQ details
without read rights. With read rights, it reloads RFQs on mount only when the loaded
list is empty and no reload is in progress. All three cards share one View context.


Known gap: RFQ code still imports removed PR approval exports and uses old PR item
fields. Those callers are reserved for a later phase. The PR resource files do
now provide the allocation builders below. RFQ pages will use them in Phase 4.


### PR quote allocation nodes

`usePurchaseRequisitionPayload.js` has two pure builders. Both take `rfqCode`,
`requisitions` (the parent PR rows), `items` (all sibling item rows for each affected
PR), and `allocations`. Pass the current saved rows each time. The caller must
load the full sibling set; a selected-item list alone cannot give a full rollup.

- `buildRequisitionRfqAllocationNodes`: each allocation is `{ itemCode, quantity }`.
  The quantity is the amount to add for this RFQ.
- `buildRequisitionRfqQuoteEditNodes`: each allocation is
  `{ itemCode, previousQuantity, quantity }`. These are this RFQ's old and new
  shares on the item. Use `quantity: 0` for removal or cancellation. Pass each
  item once. Several items and several PRs may be passed in one call.

Both return a Node array for `pageState.applyNodes`. Bad input returns
`[{ valid: false, message }]`. An empty allocation list returns `[]`.
The two bulk nodes use role `rfqAllocation` and need update rights on their own
resources. A fresh call replaces those nodes. Mount the RFQ create node first,
so its new code can be used by the item nodes.

Missing, inactive, or closed parents block the whole call. Selected items must
be active. Quote totals may go above the requested quantity. Edits add the new
share and subtract the old share, with zero as the lower limit. A zero total is
Open. A total at or above the requested amount is Fully Quoted. Other totals
are Partially Quoted.

RFQ codes are trimmed and kept once. A saved RFQ code is added when its new
share is above zero, and removed when that share is zero. Other RFQ codes stay.
A new code may be a batch ref object or a `$ref:RFQs.latest.code` string.
`batchRefList` carries that ref and the old codes to GAS for the join.
Editing or reversing an old share needs a saved RFQ code.

Each parent uses all its active items, including untouched siblings. It is Fully
Quoted when all are full, Open when all have zero quotes, and Partially Quoted
otherwise. Inactive items and items marked for deactivation do not count.


### PR visibility and access

Both PR resources seed policy `77333`. The first digit allows same, child, and
parent regions. Owner rights stay at 7. Peer, downline, and upline rights are 3,
which keeps execute rights and adds update rights. These rights apply to the
resource; they cannot depend on RFQ permissions. The shared PR edit rule adds
that check. A PR must be active and not closed, update must be allowed, and the
user must own the PR or have `RFQs:create`.

All lists and counts cover only rows loaded under PR read rights and server
region checks. All Open does not mean every region in the system. The PR region
source reads its `AccessRegion` code and uses the saving user's region as a
fallback. PR items have no region column and no region check of their own.

There are core access limits. The client denies updates across unrelated
designation branches (`relationIndex === -1`). A policy digit cannot change
that. Its owner slot also covers users with the same designation, rather than
checking the creator ID. The PR edit rule still checks the creator ID itself.
A sibling or unrelated region is outside policy 7. A blank user region or row
region has Universe access on the server. These rules have no RFQ-create bypass.
GAS row checks use regions; they do not enforce the client designation digits,
the PR owner/RFQ-create edit rule, or the non-owner Remarks check. PR read and
update resource rights are still needed. The Remarks rule is a frontend rule.

`ListViews`, `AccessPolicy`, and `AccessRegionSource` are protected sync columns.
A normal resource sync fills them only when blank. Existing non-blank values
need an admin update to use these seeds. The sheet also needs the Remarks
column. After metadata changes, refresh the app's sign-in data. Local code
changes alone do not change live sheets or saved access rules.

---

## 2. Core Entities & Data Architecture

| Entity | Role & Scope | Key State Column & Allowed Values |
|---|---|---|
| `Products` | Master product definitions with variant configuration | `Status` (`Active`, `Inactive`), `VariantTypes` (CSV) |
| `SKUs` | Individual inventory items / variants under a product | `ProductCode`, `Variant1`..`Variant5`, `Status` |
| `Suppliers` | Supplier profiles, currency, and contact info | `Status` (`Active`, `Inactive`) |
| `PurchaseRequisitions` | Internal purchase requests | `Progress` (`Open`, `Partially Quoted`, `Fully Quoted`, `Closed`, `Cancelled`) |
| `RFQs` | Request for Quotation sent to suppliers | `Progress` (`Draft`, `Sent`, `Closed`, `Cancelled`) |
| `SupplierQuotations` | Captured supplier pricing responses | `Progress` (`Received`, `Accepted`, `Rejected`) |
| `PurchaseOrders` | Official purchase order contracts issued to suppliers | `Progress` (`DRAFT`, `PO_ISSUED`, `GOODS_RECEIVING`, `GRN_GENERATED`, `COMPLETED`, `CANCELLED`) |
| `PurchaseOrderItems` | Line items under a Purchase Order | `ItemCode`, `OrderedQty`, `UnitPrice` |
| `POReceivings` | Editable inspection layer before GRN finalization | `Progress` (`DRAFT`, `CONFIRMED`, `GRN_GENERATED`, `CANCELLED`) |
| `POReceivingItems` | Inspection counts (received, damaged, rejected, short) | `ReceivedQty`, `DamagedQty`, `RejectedQty` |
| `GoodsReceipts` | Finalized read-only Goods Receipt Notes (GRN) | `Status` (`Active`, `Inactive`) |
| `GoodsReceiptItems` | Final accepted quantities posted to stock | `AcceptedQty` |
| `StockMovements` | Transactional warehouse stock ledger | `ReferenceType` (`GRN`, `OutletRestock`, `DirectEntry`, `Adjustment`), `QtyChange` |
| `WarehouseStorages` | Live SKU balances per warehouse location | `WarehouseCode`, `StorageName`, `SKU`, `Quantity` |

---

## 3. Detailed Workflow Modules

### 3.1 Product Variant Management (`Products` & `SKUs`)
- **Variant Schema**: `Products.VariantTypes` holds a comma-separated list of variant attribute names (e.g. `Color, Size, Material`).
- **Dynamic SKU Mapping**: Position in CSV maps directly to `SKUs.Variant1` through `SKUs.Variant5`.
- **Composite Add/Edit UX**: Creating or editing a product dynamically generates variant input tables based on `VariantTypes`.

### 3.2 RFQ Supplier Dispatch & Quotations
1. **Requisition**: Purchasing need is identified based on inventory stock-out risk. Requisitions use [AqlInlineSkuPicker.vue](file:///f:/AQL/FRONTENT/src/components/shared/AqlInlineSkuPicker.vue) for click-and-go SKU selection without typing.
2. **RFQ Dispatch**: RFQ is created and dispatched to eligible suppliers for competitive bidding.
3. **Quotation Capture**: Received quotes are entered into `SupplierQuotations` for comparison (unit cost, lead time, payment terms).

### 3.3 Purchase Order Module (`PurchaseOrders`)
1. **PO Generation**: A Purchase Order is generated from the winning quotation (`Progress = DRAFT`).
2. **Issuance (`PO_ISSUED`)**: Upon management approval, the PO is issued to the supplier and shipment tracking begins.
3. **Inbound Tracking**: Monitors port arrival, customs clearance, and container delivery to the central warehouse.

### 3.4 PO Receiving & Quality Inspection (`POReceivings`)
1. **Receiving Initiation**: Users open `/operation/po-receivings/_add` and select an active Purchase Order.
2. **Inspection Entry**: Staff inspect incoming cartons, recording `ReceivedQty`, `DamagedQty`, and `RejectedQty` in `POReceivingItems`.
3. **Draft Resumption**: Active drafts can be saved (`compositeSave`) and resumed across shifts.
4. **Confirmation**: Executing the `Confirm` action validates counts and sets receiving progress to `CONFIRMED`.

### 3.5 Goods Receipt Note Generation (`GoodsReceipts`)
1. **GRN Finalization**: Executing `GenerateGRN` AdditionalAction creates an immutable `GoodsReceipts` record and copies accepted quantities into `GoodsReceiptItems`.
2. **Procurement State Transition**: Linked `PurchaseOrders` progress advances to `GRN_GENERATED` and then `COMPLETED`.
3. **Invalidation Protection**: Inactivating a GRN (`Status = Inactive`) rolls the receiving record back to `CONFIRMED` and returns procurement status to `GOODS_RECEIVING`.

### 3.6 Warehouse Stock Posting (`StockMovements` & `WarehouseStorages`)
1. **GRN Stock Entry**: Eligible finalized GRNs are posted to warehouse stock from `/operation/stock-movements/grn-entry`.
2. **Stock Movements Ledger**: Creates positive `StockMovements.QtyChange` rows with `ReferenceType = GRN` and `ReferenceCode = GoodsReceipts.Code`.
3. **Balance Update**: The backend post-write hook updates `WarehouseStorages` in real time, making stock immediately available for outlet refill allocations.
4. **Direct Stock Entry**: For manual corrections or initial stock intake, the direct stock register allows authenticated stock adjustments with audit logging.

---

## 4. Architectural Boundaries

- **Backend Hook Enforcement**: Stock posting, GRN generation, and status cascades are strictly governed by backend post-write hooks (`GAS/resourceApi.gs`).
- **Frontend Layering**: Adheres to `Documents/CORE_ARCHITECTURE_RULES.md`; multi-record writes execute via atomic batch requests without manual client-side cache duplication.

---

## Maintenance Rule
Update this document whenever procurement approval rules, receiving inspection contracts, or warehouse inventory posting logic change.
