import * as React from 'react'
import { AutoLine } from '@altea/altea/client/Lines/AutoLine'
import { EntityLine } from '@altea/altea/client/Lines/EntityLine'
import { EntityDetail } from '@altea/altea/client/Lines/EntityDetail'
import { EntityStrip } from '@altea/altea/client/Lines/EntityStrip'
import { TextAreaLine } from '@altea/altea/client/Lines/TextAreaLine'
import { TypeContext } from '@altea/altea/client/TypeContext'
import { FileImageLine } from '@altea/altea-files/client/Components/FileImageLine'
import { EmployeeEntity } from './Employee.data'

// Ported from Southwind/Employees/Employee.tsx. Divergences: the Photo is a FileEmbedded rendered by
// FileImageLine, where Southwind holds a Lite<FileEntity> and hand-rolls a fetched <img> (same line
// Category.tsx uses for its picture); Territories is an owned junction part-array
// (EmployeeEntity_Territory) rather than an MList<TerritoryEntity>.
export default function Employee(p: { ctx: TypeContext<EmployeeEntity> }): React.JSX.Element {
  const ctx = p.ctx;
  const ctxBasic = ctx.subCtx({ formGroupStyle: "SrOnly" });
  return (
    <div className="row">
      <div className="col-sm-9">
        <fieldset>
          <legend>Personal Info</legend>
          <div className="row">
            <div className="col-sm-2">
              <AutoLine ctx={ctxBasic.subCtx(p => p.title)} placeholderLabels={true} />
            </div>
            <div className="col-sm-5">
              <AutoLine ctx={ctxBasic.subCtx(p => p.firstName)} placeholderLabels={true} />
            </div>
            <div className="col-sm-5">
              <AutoLine ctx={ctxBasic.subCtx(p => p.lastName)} placeholderLabels={true} />
            </div>
          </div>

          <AutoLine ctx={ctx.subCtx(p => p.birthDate)} />
          <AutoLine ctx={ctx.subCtx(p => p.homePhone)} />
        </fieldset>

        <EntityDetail ctx={ctx.subCtx(p => p.address)} />

        <fieldset>
          <legend>Company data</legend>
          <AutoLine ctx={ctx.subCtx(e => e.titleOfCourtesy)} />
          <EntityLine ctx={ctx.subCtx(e => e.reportsTo)} />
          <AutoLine ctx={ctx.subCtx(e => e.hireDate)} />
          <AutoLine ctx={ctx.subCtx(e => e.extension)} />
          <EntityStrip ctx={ctx.subCtx(e => e.territories)} />
        </fieldset>
      </div>

      <div className="col-sm-3">
        <FileImageLine ctx={ctx.subCtx(e => e.photo)} imageHtmlAttributes={{ style: { maxWidth: "100%" } }} />
        <AutoLine ctx={ctx.subCtx(e => e.photoPath)} />
        <div>
          <TextAreaLine ctx={ctx.subCtx(e => e.notes, { formGroupStyle: "Basic" })} valueHtmlAttributes={{ rows: 10, className: "notes" }} />
        </div>
      </div>
    </div>
  );
}
