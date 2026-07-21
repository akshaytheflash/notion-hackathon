import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--color-ink)" }}>
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold" style={{ color: "var(--color-text)" }}>404</h1>
        <p className="mb-4 text-xl" style={{ color: "var(--color-dim)" }}>Oops! Page not found</p>
        <Link
          to="/"
          className="text-sm font-mono underline transition-opacity hover:opacity-80"
          style={{ color: "var(--color-signal-cyan)" }}
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
