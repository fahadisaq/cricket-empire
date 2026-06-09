import { Component, type ReactNode } from "react";

interface State { error: Error | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("App crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: "monospace", color: "#fca5a5", background: "#0b0e14", minHeight: "100vh" }}>
          <h2 style={{ color: "#f87171" }}>Something crashed</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: "pre-wrap", color: "#94a3b8", fontSize: 12 }}>{this.state.error.stack}</pre>
          <button onClick={() => location.reload()} style={{ marginTop: 16, padding: "8px 16px", background: "#16a34a", color: "white", border: 0, borderRadius: 8, cursor: "pointer" }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
