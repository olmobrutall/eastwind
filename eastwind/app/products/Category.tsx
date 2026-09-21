import * as React from 'react'
import { AutoLine } from '@altea/altea/client/Lines/AutoLine'
import { TypeContext } from '@altea/altea/client/TypeContext'
import { FileImageLine } from '@altea/altea-files/client/Components/FileImageLine'
import { CategoryEntity } from './Product.data'

// The category view — including the Picture line now that @altea/altea-files is
// ported. The picture is a FileEmbedded (bytes in the row), and FileImageLine is the line for exactly that:
// the uploader while it is empty, then a thumbnail (click → full size) with a remove button over it. It reads
// either the in-memory bytes (a file just picked) or the saved row's download URL, so the hand-rolled preview
// this view used to carry is gone.
export default function Category(p: { ctx: TypeContext<CategoryEntity> }): React.JSX.Element {
  const ctx = p.ctx.subCtx({ labelColumns: { sm: 3 } });

  return (
    <div>
      <AutoLine ctx={ctx.subCtx(c => c.categoryName)} />
      <AutoLine ctx={ctx.subCtx(c => c.description)} />
      <FileImageLine ctx={ctx.subCtx(c => c.picture)} imageHtmlAttributes={{ style: { maxWidth: 200 } }} />
    </div>
  );
}
