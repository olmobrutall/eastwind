import { createRoot } from "react-dom/client";
import { Order } from "my-app/entities/orders";

// Proves the client toolchain: a core entity (transformed by tspc, consumed
// from dist) is importable in the SPA layer and bundled by Vite.
function App() {
    const sample = new Order().init({
        amount: 42
    });
    return (
        <main>
            <h1>my-app SPA</h1>
            <p>Sample Order amount: {sample.amount}</p>
        </main>
    );
}

const el = document.getElementById("root");
if (el)
    createRoot(el).render(<App />);
