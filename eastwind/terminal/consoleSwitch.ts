import * as readline from "node:readline";

// A small port of Signum.Utilities' ConsoleSwitch (old/Framework/Signum.Utilities/ConsoleSwitch.cs):
// a keyed menu of actions with descriptions and optional separators. `choose()` prints the options,
// reads a line, and returns the matching value — or undefined on empty input / EOF (so a
// non-interactive/piped stdin exits the loop cleanly instead of hanging). Case-insensitive keys.
// Omitted vs the C# original (not needed by the terminal yet): pagination ("+"), Levenshtein
// "did you mean?", and comma/hyphen multi-selection ranges.

interface Option<V> { key: string; description: string; value: V; }

export interface Chosen<V> { key: string; description: string; value: V; }

export class ConsoleSwitch<V> {
    private readonly options: Option<V>[] = [];
    private readonly separators = new Map<number, string>(); // option-index → separator label

    constructor(private readonly welcome = "Select one of the following options:") { }

    separator(label: string): this {
        this.separators.set(this.options.length, label);
        return this;
    }

    add(key: string, description: string, value: V): this {
        this.options.push({ key, description, value });
        return this;
    }

    private print(): void {
        console.log(this.welcome);
        this.options.forEach((o, i) => {
            const sep = this.separators.get(i);
            if (sep != null) { console.log(); console.log(sep); }
            console.log(` ${o.key} - ${o.description}`);
        });
    }

    // Multi-choice (Signum's ChooseMultipleWithDescription): a comma/hyphen selection like "1-6,9"
    // either from argv (non-interactive) or read from the console. Returns the picked options with
    // their descriptions (so a runner can log each), or undefined on empty input / EOF.
    async chooseMultipleWithDescription(args?: string[]): Promise<Chosen<V>[] | undefined> {
        if (args != null && args.length > 0)
            return this.parseSelection(args.join(" "));

        this.print();
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        try {
            const line = (await ask(rl, "Enter your selections separated by comma or hyphen (nothing to exit): ")).trim();
            if (line === "") return undefined;
            return this.parseSelection(line);
        } finally {
            rl.close();
        }
    }

    private parseSelection(text: string): Chosen<V>[] {
        const result: Chosen<V>[] = [];
        for (const partRaw of text.split(",")) {
            const part = partRaw.trim();
            if (part === "") continue;
            if (part.includes("-")) {
                const [a, b] = part.split("-").map(s => s.trim());
                const from = a === "" ? 0 : this.indexOf(a);
                const to = b === "" ? this.options.length - 1 : this.indexOf(b);
                for (let i = from; i <= to; i++) result.push(this.toChosen(i));
            } else {
                result.push(this.toChosen(this.indexOf(part)));
            }
        }
        return result;
    }

    private indexOf(key: string): number {
        const i = this.options.findIndex(o => o.key.toLowerCase() === key.toLowerCase());
        if (i < 0) throw new Error(`No option with key '${key}' found`);
        return i;
    }

    private toChosen(i: number): Chosen<V> {
        const o = this.options[i];
        return { key: o.key, description: o.description, value: o.value };
    }

    // Single choice. Returns the chosen value, or undefined on empty input / EOF.
    async choose(): Promise<V | undefined> {
        this.print();
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        try {
            for (;;) {
                const input = (await ask(rl, "Enter your selection (nothing to exit): ")).trim();
                if (input === "") return undefined;
                const found = this.options.find(o => o.key.toLowerCase() === input.toLowerCase());
                if (found != null) return found.value;
                console.log(`No option with key '${input}' found.`);
                this.print();
            }
        } finally {
            rl.close();
        }
    }
}

// Signum's MigrationLogic.ExecuteLoadProcess: run an action, logging its description before and the
// elapsed time after — so load steps self-describe instead of hand-written console.log pairs.
export async function executeLoadProcess(description: string, action: () => Promise<void>): Promise<void> {
    console.log(`— ${description}`);
    const start = Date.now();
    await action();
    console.log(`  ✓ ${description} (${Date.now() - start} ms)`);
}

// Promise wrapper over readline.question that also resolves to "" on EOF ('close'), so a piped /
// non-TTY stdin ends the menu instead of leaving the promise pending.
function ask(rl: readline.Interface, prompt: string): Promise<string> {
    return new Promise<string>(resolve => {
        let answered = false;
        const onClose = (): void => { if (!answered) resolve(""); };
        rl.once("close", onClose);
        rl.question(prompt, answer => { answered = true; rl.removeListener("close", onClose); resolve(answer); });
    });
}
