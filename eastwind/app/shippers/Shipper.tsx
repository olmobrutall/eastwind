import * as React from 'react'
import { AutoLine } from '@altea/altea/client/Lines/AutoLine'
import { TypeContext } from '@altea/altea/client/TypeContext'
import SearchControl from '@altea/altea/client/SearchControl/SearchControl'
import { ShipperEntity } from './Shipper.data'
import { OrderEntity } from '../orders/Order.data'

export default function Shipper(p: { ctx: TypeContext<ShipperEntity> }): React.JSX.Element {
  const ctx = p.ctx;
  return (
    <div>
      <AutoLine ctx={ctx.subCtx(s => s.companyName)} />
      <AutoLine ctx={ctx.subCtx(s => s.phone)} />
      <h2>{OrderEntity.nicePluralName()}</h2>
      <SearchControl findOptions={OrderEntity.findOptions(token => ({
        filterOptions: [token(a => a.shipVia).filter("EqualTo", ctx.value)]
      }))} showSimpleFilterBuilder={false} />
    </div>
  );
}
