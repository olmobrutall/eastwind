import * as React from 'react'
import { AutoLine } from '@altea/altea/client/Lines/AutoLine'
import { TypeContext } from '@altea/altea/client/TypeContext'
import { useForceUpdate } from '@altea/altea/client/Hooks'
import { AddressEmbedded } from './Customer.data'

// Ported from Southwind/Customers/Address.tsx (faithful — AddressEmbedded maps 1:1 in eastwind).
export default function Address(p: { ctx: TypeContext<AddressEmbedded>, inheritStyle?: boolean }): React.JSX.Element {
  const ctx = p.inheritStyle ? p.ctx : p.ctx.subCtx({ formGroupStyle: "SrOnly", placeholderLabels: true });
  const forceUpdate = useForceUpdate();
  return (
    <div>
      <AutoLine ctx={ctx.subCtx(a => a.address)} />
      <div className="row">
        <div className="col-sm-6"><AutoLine ctx={ctx.subCtx(a => a.city)} /></div>
        <div className="col-sm-6"><AutoLine ctx={ctx.subCtx(a => a.region)} /></div>
      </div>
      <div className="row">
        <div className="col-sm-6"><AutoLine ctx={ctx.subCtx(a => a.postalCode)} mandatory={ctx.value.country != "Ireland"} /></div>
        <div className="col-sm-6"><AutoLine ctx={ctx.subCtx(a => a.country)} onChange={forceUpdate} /></div>
      </div>
    </div>
  );
}
