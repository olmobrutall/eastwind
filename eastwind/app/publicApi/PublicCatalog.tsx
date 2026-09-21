import * as React from "react";
import { Link } from "react-router";
import { ajaxGet } from "@altea/altea/client/Services";
import { useAPI } from "@altea/altea/client/Hooks";
import { toNumberFormat } from "@altea/altea/client/numberFormat";
import * as AppContext from "@altea/altea/client/AppContext";
import { LoginAuthMessage } from "@altea/altea-auth/data/AuthMessages";
import { CatalogMessage } from "../products/Product.data";
import type { CategoryWithProducts } from "./PublicCatalog.data";

// The ANONYMOUS shop window: every active product grouped
// by its category, reachable with no user (the landing page sends a logged-out visitor here).
//
// Worth knowing:
//  - the endpoint is `/api/publicCatalog` (see PublicCatalog.server.ts for why).
//  - the call-to-action is LOG IN, not REGISTER. The `/registerUser` self-service page
//    (Public/RegisterUser.tsx + RegisterUserModel), which is not ported — so the honest counterpart of that
//    button is the login page. `RegisterUserMessage.Register` goes with it.
export default function PublicCatalog(): React.JSX.Element {

    const categories = useAPI(signal => ajaxGet<CategoryWithProducts[]>({ url: "/api/publicCatalog", signal }), []);

    const maxDimensions: React.CSSProperties = { maxWidth: "96px", maxHeight: "96px" };

    const numberFormat = toNumberFormat("0.00");

    return (
        <div id="hero" style={{ background: "url(" + AppContext.toAbsoluteUrl("/background_dark.jpg") + ")", backgroundSize: "cover", backgroundAttachment: "fixed" }}>
            <div className="d-flex flex-column align-items-center position-relative">
                <h1 className="white mt-4">eastwind Product Catalog</h1>
                <Link to={AppContext.toAbsoluteUrl("/auth/login")} className="btn btn-primary">{LoginAuthMessage.Login.niceToString()}</Link>
                {categories && categories.map(c =>
                    <div key={c.category.key()} className="card shadow container m-4">
                        <div className="card-body">
                            <div className="d-flex">
                                {c.picture && <img className="d-flex me-3" style={maxDimensions} src={`data:${c.pictureMimeType};base64,${c.picture}`} alt={c.locCategoryName} />}
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
