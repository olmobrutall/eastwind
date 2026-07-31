import { Link } from "react-router";

export default function NotFound() {
    return (
        <div>
            <h3>Page not found</h3>
            <Link to="/">Back home</Link>
        </div>
    );
}
