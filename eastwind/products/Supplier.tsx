import * as React from 'react'
import { AutoLine } from '@altea/altea/client/Lines/AutoLine'
import { EntityDetail } from '@altea/altea/client/Lines/EntityDetail'
import { TypeContext } from '@altea/altea/client/TypeContext'
import { SupplierEntity } from './Product.data'

// Ported from Southwind/Products/Supplier.tsx (faithful — SupplierEntity maps 1:1).
export default function Supplier(p: { ctx: TypeContext<SupplierEntity> }): React.JSX.Element {
  const ctx = p.ctx;
  return (
    <div>
      <AutoLine ctx={ctx.subCtx(s => s.companyName)} />
      <AutoLine ctx={ctx.subCtx(s => s.contactName)} />
      <AutoLine ctx={ctx.subCtx(s => s.contactTitle)} />
      <EntityDetail ctx={ctx.subCtx(s => s.address)} />
      <AutoLine ctx={ctx.subCtx(s => s.phone)} />
      <AutoLine ctx={ctx.subCtx(s => s.fax)} />
      <AutoLine ctx={ctx.subCtx(s => s.homePage)} />
    </div>
  );
}
