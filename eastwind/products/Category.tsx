import * as React from 'react'
import { AutoLine } from '@altea/altea/client/Lines/AutoLine'
import { TypeContext } from '@altea/altea/client/TypeContext'
import { CategoryEntity } from './Product.data'

// Ported from Southwind/Products/Category.tsx. Divergence: Southwind's Picture (Signum.Files FileLine +
// preview img) is dropped — eastwind is extension-free and CategoryEntity has no picture field.
export default function Category(p: { ctx: TypeContext<CategoryEntity> }): React.JSX.Element {
  const ctx = p.ctx.subCtx({ labelColumns: { sm: 3 } });
  return (
    <div>
      <AutoLine ctx={ctx.subCtx(c => c.categoryName)} />
      <AutoLine ctx={ctx.subCtx(c => c.description)} />
    </div>
  );
}
