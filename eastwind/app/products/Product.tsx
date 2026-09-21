import * as React from 'react'
import { AutoLine } from '@altea/altea/client/Lines/AutoLine'
import { EntityLine } from '@altea/altea/client/Lines/EntityLine'
import { EntityTable } from '@altea/altea/client/Lines/EntityTable'
import { TypeContext } from '@altea/altea/client/TypeContext'
import { ProductEntity } from './Product.data'

// The product view. The ML SalesEstimation panel + PredictorEntity are dropped; AdditionalInformation is
// an owned part-array in
// eastwind (ProductEntity_AdditionalInformation), so it's rendered as an EntityTable of key/value rows.
export default function Product(p: { ctx: TypeContext<ProductEntity> }): React.JSX.Element {
  const ctx = p.ctx;
  return (
    <div>
      <AutoLine ctx={ctx.subCtx(p => p.productName)} />
      <AutoLine ctx={ctx.subCtx(p => p.supplier)} />
      <EntityLine ctx={ctx.subCtx(p => p.category)} />
      <AutoLine ctx={ctx.subCtx(p => p.quantityPerUnit)} />
      <AutoLine ctx={ctx.subCtx(p => p.unitPrice)} />
      <AutoLine ctx={ctx.subCtx(p => p.unitsInStock)} />
      <AutoLine ctx={ctx.subCtx(p => p.reorderLevel)} />
      <AutoLine ctx={ctx.subCtx(p => p.discontinued)} />
      <EntityTable ctx={ctx.subCtx(p => p.additionalInformation)} columns={[
        { property: a => a.key },
        { property: a => a.value },
      ]} />
    </div>
  );
}
