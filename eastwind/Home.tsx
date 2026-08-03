import { Link } from "react-router";

// Landing page: links into the search page for each defined query. These keys match the queries the
// server registers (see /api/reflection/metadata → queries); Finder renders them generically via
// executeQuery, so no per-entity view is required to "see what works".
const QUERIES = ["Order", "Product", "Person", "Company", "Employee", "Shipper", "Supplier", "Category", "Region", "Territory"];

export default function Home() {
    return (
        <div>
            <h1 className="display-6">eastwind</h1>
            <p className="text-muted">Southwind ported onto the altea framework. Pick a query:</p>
            <ul className="list-unstyled">
                {QUERIES.map(q => (
                    <li key={q} className="mb-1">
                        <Link to={`/find/${q}`}>{q}</Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
