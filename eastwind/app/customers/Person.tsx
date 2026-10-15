import * as React from 'react'
import { AutoLine } from '@altea/altea/client/Lines/AutoLine'
import { TypeContext } from '@altea/altea/client/TypeContext'
import SearchControl from '@altea/altea/client/SearchControl/SearchControl'
import { PersonEntity } from './Customer.data'
import { OrderEntity } from '../orders/Order.data'

// The person view. The CorruptMixin checkbox is dropped
// (eastwind is mixin-free / extension-free).
export default function Person(p: { ctx: TypeContext<PersonEntity> }): React.JSX.Element {
  const ctx = p.ctx;
  const ctxBasic = ctx.subCtx({ formGroupStyle: "Basic" });
  return (
    <div>
      <div className="sf-row">
        <div className="sm:col-span-2">
          <AutoLine ctx={ctxBasic.subCtx(p => p.title)} />
        </div>
        <div className="sm:col-span-4">
          <AutoLine ctx={ctxBasic.subCtx(p => p.firstName)} />
        </div>
        <div className="sm:col-span-4">
          <AutoLine ctx={ctxBasic.subCtx(p => p.lastName)} />
        </div>
        <div className="sm:col-span-2">
          <AutoLine ctx={ctxBasic.subCtx(p => p.dateOfBirth)} />
        </div>
      </div>

      <h2 className="mt-6">{OrderEntity.nicePluralName()}</h2>
      <SearchControl findOptions={OrderEntity.findOptions(token => ({
        filterOptions: [token(a => a.customer).filter("EqualTo", ctx.value)]
      }))} showSimpleFilterBuilder={false} />
    </div>
  );
}
