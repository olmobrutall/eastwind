import { Link } from "react-router";
import { getDefinedQueries } from "@altea/altea/client/Reflection";

// Landing page: links into the search page for each query the CURRENT ROLE can see. The list comes from
// the reflection blob (role-filtered server-side by TypeAuthLogic), so a limited role sees fewer
// queries. Re-rendered on login/logout because MainPublic remounts the tree on resetUI.
export default function Home() {
    const queries = getDefinedQueries().sort((a, b) => a.localeCompare(b));
    return (
        <div>
            <h1 className="display-6">eastwind</h1>
            <p className="text-muted">Southwind ported onto the altea framework. Pick a query:</p>
            <ul className="list-unstyled">
                {queries.map(q => (
                    <li key={q} className="mb-1">
                        <Link to={`/find/${q}`}>{q}</Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
