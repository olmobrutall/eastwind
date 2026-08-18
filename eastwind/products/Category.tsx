import * as React from 'react'
import { AutoLine } from '@altea/altea/client/Lines/AutoLine'
import { TypeContext } from '@altea/altea/client/TypeContext'
import { FileLine } from '@altea/altea-files/client/Components/FileLine'
import { blobUrl } from '@altea/altea-files/client/Components/FileDownloader'
import { FilesClient } from '@altea/altea-files/client/FilesClient'
import { CategoryEntity } from './Product.data'

// Ported from Southwind/Products/Category.tsx — including the Picture FileLine + preview now that
// @altea/altea-files is ported. The picture is a FileEmbedded (bytes in the row), so the preview reads either
// the in-memory bytes (a file just picked) or the download URL of the saved row.
export default function Category(p: { ctx: TypeContext<CategoryEntity> }): React.JSX.Element {
  const ctx = p.ctx.subCtx({ labelColumns: { sm: 3 } });
  const picture = ctx.value.picture;

  const previewUrl = React.useMemo(() => {
    if (picture == null)
      return undefined;
    if (picture.binaryFile != null)
      return blobUrl(picture.binaryFile, picture.fileName);
    return ctx.value.id == null ? undefined : FilesClient.fileUrl(picture, ctx.value, "picture");
  }, [picture, picture?.binaryFile, ctx.value.id]);

  return (
    <div>
      <AutoLine ctx={ctx.subCtx(c => c.categoryName)} />
      <AutoLine ctx={ctx.subCtx(c => c.description)} />
      <FileLine ctx={ctx.subCtx(c => c.picture)} accept="image/*" />
      {previewUrl &&
        <div className="row">
          <div className="offset-sm-3 col-sm-9">
            <img src={previewUrl} alt={picture!.fileName} style={{ maxHeight: 200, maxWidth: "100%" }} />
          </div>
        </div>}
    </div>
  );
}
