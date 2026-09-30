import * as React from "react";
import { toNumberFormat } from "@altea/altea/client/numberFormat";
import * as AppContext from "@altea/altea/client/AppContext";
import { LoginAuthMessage } from "@altea/altea-auth/data/AuthMessages";
import { CatalogMessage } from "../products/Product.data";
import type { PublicCatalogData } from "./PublicCatalog.data";

// The ANONYMOUS shop window: every active product grouped by its category, reachable with no user.
//
// This component is SERVER-RENDERED and then hydrated — PublicCatalog.ssr.ts renders it to HTML,
// publicCatalogEntry.client.tsx rehydrates it — which is why it looks the way it does. Everything it needs
// is a PROP, and it reads nothing ambient:
//
//  - it does not FETCH. `useAPI` resolves in an effect, which never runs on the server, so a component
//    that fetched its own data would server-render an empty page — the one thing SSR exists to prevent.
//    The payload is loaded by the logic layer and travels in the document; see SsrHost.
//  - it takes the CULTURE, and passes it to `toNumberFormat` explicitly. Without a locale `Intl` falls
//    back to the ambient default, which is the BROWSER's locale on one side and the SERVER MACHINE's on
//    the other — so every price cell would differ between the two renders and hydration would fail. (The
//    translated names resolve the same way on both sides because the entry loads the reflection metadata
//    for this same culture before it hydrates.)
//  - the call to action is a plain `<a>`, not a react-router `<Link>`. This document is not the SPA and
//    has no router; logging in leaves for the SPA, which is a real navigation either way.
export interface PublicCatalogProps {
    data: PublicCatalogData;
}

export default function PublicCatalog({ data }: PublicCatalogProps): React.JSX.Element {

    const maxDimensions: React.CSSProperties = { maxWidth: "96px", maxHeight: "96px" };

    const numberFormat = toNumberFormat("0.00", data.culture);

    return (
        <div id="hero" style={{ background: "url(" + AppContext.toAbsoluteUrl("/background_dark.jpg", data.baseName) + ")", backgroundSize: "cover", backgroundAttachment: "fixed" }}>
            <div className="d-flex flex-column align-items-center position-relative">
                <h1 className="white mt-4">eastwind Product Catalog</h1>
                <a href={AppContext.toAbsoluteUrl("/auth/login", data.baseName)} className="btn btn-primary">{LoginAuthMessage.Login.niceToString()}</a>
                {data.categories.map(c =>
                    <div key={c.category.key()} className="card shadow container m-4">
                        <div className="card-body">
                            <div className="d-flex">
                                {c.pictureUrl && <img className="d-flex me-3" style={maxDimensions} src={AppContext.toAbsoluteUrl(c.pictureUrl, data.baseName)} alt={c.locCategoryName} />}
                                <div className="flex-grow-1">
                                    <h4 className="mt-0">{c.locCategoryName}</h4>
                                    {c.locDescription}
                                </div>
                            </div>

                            <table className="table table-hover">
                                <thead>
                                    <tr>
                                        <th>{CatalogMessage.productName.niceToString()}</th>
                                        <th>{CatalogMessage.unitPrice.niceToString()}</th>
                                        <th>{CatalogMessage.quantityPerUnit.niceToString()}</th>
                                        <th>{CatalogMessage.unitsInStock.niceToString()}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {c.products.orderBy(a => a.id).orderBy(a => a.reorderLevel).map(p => <tr key={String(p.id)}>
                                        <td>{p.productName}</td>
                                        {/* `Number(...)` rather than `.toNumber()`: a Decimal-typed value arrives as a
                                            decimal.js Decimal or its numeric string, and Number() coerces either —
                                            the same coercion the framework's own Decimal cell formatter uses. */}
                                        <td>{numberFormat.format(Number(p.unitPrice))} $</td>
                                        <td>{p.quantityPerUnit}</td>
                                        <td>{p.unitsInStock}</td>
                                    </tr>)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
