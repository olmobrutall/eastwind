import { createRoot } from "react-dom/client";
import { Order, OrderState } from "eastwind/entities/orders";

// Proves the client toolchain: a core entity (transformed by tspc, consumed
// from dist) is importable in the SPA layer and bundled by Vite.
function App() {
    const sample = Order.create({
        state: OrderState.New,
    });
    return (
        <main>
            <h1>eastwind SPA</h1>
            <p>Sample Order state: {OrderState[sample.state]}</p>
        </main>
    );
}

const el = document.getElementById("root");
if (el)
    createRoot(el).render(<App />);
