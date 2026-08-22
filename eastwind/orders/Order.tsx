import * as React from 'react'
import { AutoLine } from '@altea/altea/client/Lines/AutoLine'
import { EntityLine } from '@altea/altea/client/Lines/EntityLine'
import { EntityCombo } from '@altea/altea/client/Lines/EntityCombo'
import { EntityDetail } from '@altea/altea/client/Lines/EntityDetail'
import { EntityTable } from '@altea/altea/client/Lines/EntityTable'
import { EnumLine } from '@altea/altea/client/Lines/EnumLine'
import { FormGroup } from '@altea/altea/client/Lines/FormGroup'
import { FormControlReadonly } from '@altea/altea/client/Lines/FormControlReadonly'
import { type ChangeEvent } from '@altea/altea/client/Lines/LineBase'
import { type int, Decimal } from '@altea/altea/data/basics'
import { TypeContext } from '@altea/altea/client/TypeContext'
import { useForceUpdate } from '@altea/altea/client/Hooks'
import { Navigator } from '@altea/altea/client/Navigator'
import { toNumberFormat } from '@altea/altea/client/numberFormat'
import { CustomerEntity } from '../customers/Customer.data'
import { OrderEntity, OrderLineEntity, OrderState } from './Order.data'

// Ported from Southwind/Orders/Order.tsx. Divergences:
//   - `details` is a plain OrderLineEntity[] (not MList<OrderDetailEmbedded>) — no `.element`; the row's
//     subtotal / order total come from the entity methods subTotalPrice() / totalPrice().
//   - OrderDetailMixin (discountCode column) is omitted in eastwind → that column is dropped.
//   - the subtotal column's header reads the translated member (OrderLineEntity.nicePropertyName) rather
//     than an inlined English literal.
//   - luxon `DateTime.toRelative()` helpText is dropped (altea has no relative-time helper yet).
//   - `AddressEmbedded.New({...address})` → `customer.address.clone()`; `order.modified = true` is dropped
//     (altea tracks dirtiness by snapshot, so the mutation is detected automatically).
export default function Order(p: { ctx: TypeContext<OrderEntity> }): React.JSX.Element {
  const forceUpdate = useForceUpdate();

  function handleCustomerChange(c: ChangeEvent): void {
    const order = p.ctx.value;
    const customer = c.newValue as CustomerEntity | null;
    order.shipAddress = customer == null ? null! : customer.address.clone();
    forceUpdate();
  }

  function handleProductChange(detail: OrderLineEntity): void {
    detail.quantity = 1 as int;
    detail.unitPrice = new Decimal(0);
    forceUpdate();

    if (detail.product)
      Navigator.API.fetch(detail.product)
        .then(prod => detail.unitPrice = prod.unitPrice)
        .then(() => forceUpdate());
  }

  const ctx2 = p.ctx.subCtx({ labelColumns: { sm: 2 } });
  const ctx4 = p.ctx.subCtx({ labelColumns: { sm: 4 } });
  const o = ctx4.value;
  const formatNumber = toNumberFormat("0.00");

  return (
    <div>
      <div className="row">
        <div className="col-sm-6">
          <EntityLine ctx={ctx2.subCtx(o => o.customer)} onChange={handleCustomerChange} />
          <EntityDetail ctx={ctx2.subCtx(o => o.shipAddress)} />
        </div>
        <div className="col-sm-6">
          <AutoLine ctx={ctx4.subCtx(o => o.shipName)} />
          {ctx2.value.isLegacy && <AutoLine ctx={ctx4.subCtx(o => o.isLegacy)} />}
          <EnumLine ctx={ctx4.subCtx(o => o.state)} valueHtmlAttributes={{ style: { color: stateColor(o.state) } }} />
          <AutoLine ctx={ctx4.subCtx(o => o.orderDate)} />
          <AutoLine ctx={ctx4.subCtx(o => o.requiredDate)} onChange={() => forceUpdate()} />
          <AutoLine ctx={ctx4.subCtx(o => o.shippedDate)} hideIfNull={true} />
          <AutoLine ctx={ctx4.subCtx(o => o.cancelationDate)} hideIfNull={true} />
          <EntityCombo ctx={ctx4.subCtx(o => o.shipVia)} />
        </div>
      </div>
      <EntityTable ctx={ctx2.subCtx(o => o.details)} onChange={() => forceUpdate()} columns={[
        { property: a => a.product, headerHtmlAttributes: { style: { width: "35%" } }, template: dc => <EntityLine ctx={dc.subCtx(a => a.product)} onChange={() => handleProductChange(dc.value)} /> },
        { property: a => a.quantity, headerHtmlAttributes: { style: { width: "10%" } }, template: dc => <AutoLine ctx={dc.subCtx(a => a.quantity)} onChange={() => forceUpdate()} /> },
        { property: a => a.unitPrice, headerHtmlAttributes: { style: { width: "10%" } }, template: dc => <AutoLine ctx={dc.subCtx(a => a.unitPrice)} readOnly={true} /> },
        { property: a => a.discount, headerHtmlAttributes: { style: { width: "10%" } }, template: dc => <AutoLine ctx={dc.subCtx(a => a.discount)} onChange={() => forceUpdate()} /> },
        {
          // A JSX ATTRIBUTE, so the STRING overload: the quote-transformer does not rewrite lambdas here,
          // and `nicePropertyName(a => a.subTotalPrice())` would throw for want of its `__quoted` tree.
          header: OrderLineEntity.nicePropertyName("subTotalPrice"), headerHtmlAttributes: { style: { width: "10%" } },
          template: dc =>
            <FormGroup ctx={dc}>
              {id => <div className={dc.inputGroupClass}>
                <FormControlReadonly ctx={dc} id={id}>
                  {formatNumber.format(dc.value.subTotalPrice().toNumber())}
                </FormControlReadonly>
                <span className="input-group-text">€</span>
              </div>
              }
            </FormGroup>
        },
      ]} />
      <div className="row">
        <div className="col-sm-4">
          <EntityLine ctx={ctx4.subCtx(o => o.employee)} />
        </div>
        <div className="col-sm-4">
          <AutoLine ctx={ctx4.subCtx(o => o.freight)} />
        </div>
        <div className="col-sm-4">
          <FormGroup ctx={ctx4} label="Total Price">
            {id => <div className={ctx4.inputGroupClass}>
              <FormControlReadonly ctx={ctx4} id={id} className="total-price">
                {/* `Number(...)`, not `.toNumber()`: an EMPTY details array makes `sum` answer the plain
                    number 0 (it picks the Decimal path off the first value, and there is none) — which a
                    brand-new order has, e.g. the one a workflow's CreateNew strategy builds. */}
                {formatNumber.format(Number(ctx4.value.totalPrice()))}
              </FormControlReadonly>
              <span className="input-group-text">€</span>
            </div>
            }
          </FormGroup>
        </div>
      </div>
    </div>
  );
}

function stateColor(s: OrderState | string | null | undefined): string | undefined {
  const name = typeof s === "number" ? OrderState[s] : s;
  switch (name) {
    case "New":
    case "Ordered": return "#33cc33";
    case "Shipped": return "#0066ff";
    case "Canceled": return "#ff0000";
  }
  return undefined;
}
