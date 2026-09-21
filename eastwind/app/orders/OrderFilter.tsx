import * as React from 'react'
import type { ISimpleFilterBuilder } from '@altea/altea/client/SearchControl/SearchControl'
import { type FilterOption, type FilterOptionParsed, extractFilterValue } from '@altea/altea/client/FindOptions'
import { AutoLine } from '@altea/altea/client/Lines/AutoLine'
import { EntityLine } from '@altea/altea/client/Lines/EntityLine'
import { EntityCombo } from '@altea/altea/client/Lines/EntityCombo'
import { TypeContext } from '@altea/altea/client/TypeContext'
import { OrderFilterModel } from './Order.data'

// The Orders SIMPLE FILTER BUILDER. A simple filter
// builder replaces the advanced filter grid with a compact form (customer / employee / order-date range)
// whenever the incoming filters can be represented by it (see `extract` below); otherwise the search falls
// back to the advanced builder. Registered via OrdersClient's `simpleFilterBuilder` (OrderClient.client.tsx).
export default class OrderFilter extends React.Component<{ ctx: TypeContext<OrderFilterModel> }> implements ISimpleFilterBuilder {

  override render(): React.ReactElement {
    const ctx = this.props.ctx.subCtx({ formGroupStyle: "Basic" });
    return (
      <div>
        <div className="row">
          <div className="col-sm-6">
            <EntityCombo ctx={ctx.subCtx(o => o.customer)} />
            <AutoLine ctx={ctx.subCtx(o => o.minOrderDate)} />
          </div>
          <div className="col-sm-6">
            <EntityLine ctx={ctx.subCtx(o => o.employee)} />
            <AutoLine ctx={ctx.subCtx(o => o.maxOrderDate)} />
          </div>
        </div>
      </div>
    );
  }

  // The filters this form contributes to the query — only for the inputs the user actually set.
  getFilters(): FilterOption[] {

    const result: FilterOption[] = [];

    const val = this.props.ctx.value;

    if (val.customer)
      result.push({ token: "Customer", value: val.customer });

    if (val.employee)
      result.push({ token: "Employee", value: val.employee });

    if (val.minOrderDate)
      result.push({ token: "OrderDate", value: val.minOrderDate, operation: "GreaterThanOrEqual" });

    if (val.maxOrderDate)
      result.push({ token: "OrderDate", value: val.maxOrderDate, operation: "LessThan" });

    return result;
  }

  // Rebuild the model from the incoming (parsed) filters, CONSUMING each recognised filter. If any filter
  // is left over the query isn't representable by this form, so it returns undefined and the advanced
  // builder is used instead.
  static extract(fos: FilterOptionParsed[]): OrderFilterModel | undefined {
    const filters = fos.clone();

    const result = OrderFilterModel.create({
      customer: extractFilterValue(filters, "Customer", "EqualTo"),
      employee: extractFilterValue(filters, "Employee", "EqualTo"),
      minOrderDate: extractFilterValue(filters, "OrderDate", "GreaterThanOrEqual"),
      maxOrderDate: extractFilterValue(filters, "OrderDate", "LessThan"),
    });

    if (filters.length)
      return undefined;

    return result;
  }
}
