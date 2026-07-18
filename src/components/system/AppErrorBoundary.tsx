import React from "react";

type State = { hasError: boolean; requestId: string };

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false, requestId: "" };

  static getDerivedStateFromError(): State {
    return { hasError: true, requestId: crypto.randomUUID() };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[APP_ERROR_BOUNDARY]", this.state.requestId, error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-white px-6 text-center">
        <section className="max-w-md">
          <h1 className="text-xl font-semibold text-slate-900">The application could not continue.</h1>
          <p className="mt-2 text-sm text-slate-600">Reload the page. Your saved cloud progress is not removed.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 min-h-10 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white"
          >
            Reload application
          </button>
          <p className="mt-4 text-xs text-slate-400">Reference: {this.state.requestId}</p>
        </section>
      </main>
    );
  }
}
