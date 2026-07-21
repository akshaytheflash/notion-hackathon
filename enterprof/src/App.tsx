import { Component, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { routers } from "./router";

const queryClient = new QueryClient();
const router = createBrowserRouter(routers);

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#0B1D33", color: "#e6e9ef", fontFamily: "monospace" }}>
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Something went wrong</h1>
            <p style={{ color: "#8a93a8", marginBottom: "1rem" }}>{this.state.error.message}</p>
            <button
              onClick={() => { this.setState({ error: null }); window.location.href = "/"; }}
              style={{ padding: "0.5rem 1.5rem", backgroundColor: "#45d9c8", color: "#0f1218", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontFamily: "monospace" }}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <RouterProvider router={router} />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
