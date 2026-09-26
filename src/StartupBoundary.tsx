import { Component, type ReactNode } from "react";

export class StartupBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="cloud-loading" role="alert">
      <h1>KinForge could not open this view</h1>
      <p>Your saved library has not been deleted. Reopen the view to try again.</p>
      <button className="button" onClick={() => location.reload()}>Reopen library</button>
    </main>;
  }
}
