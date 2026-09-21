import * as React from 'react'
import { AutoLine } from '@altea/altea/client/Lines/AutoLine'
import { TypeContext } from '@altea/altea/client/TypeContext'
import SearchControl from '@altea/altea/client/SearchControl/SearchControl'
import { CompanyEntity } from './Customer.data'
import { OrderEntity } from '../orders/Order.data'

export default function Company(p: { ctx: TypeContext<CompanyEntity> }): React.JSX.Element {
  const ctx = p.ctx;
  return (
    <div>
      <AutoLine ctx={ctx.subCtx(c => c.companyName)} />
      <AutoLine ctx={ctx.subCtx(c => c.contactName)} />
      <AutoLine ctx={ctx.subCtx(c => c.contactTitle)} />
      <h2>{OrderEntity.nicePluralName()}</h2>
      <SearchControl findOptions={OrderEntity.findOptions(token => ({
        filterOptions: [token(a => a.customer).filter("EqualTo", ctx.value)]
      }))} showSimpleFilterBuilder={false} />
    </div>
  );
}
