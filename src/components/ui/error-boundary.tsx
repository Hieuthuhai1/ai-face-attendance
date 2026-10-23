"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      const err = this.state.error;
      const errMsg = err?.message || "Lỗi không xác định";
      const errStack = err?.stack || "";
      // Rút gọn stack trace để hiển thị
      const shortStack = errStack.split("\n").slice(0, 3).join("\n");

      return (
        <Card className="w-full max-w-md mx-auto mt-8 border-red-200 bg-red-50 p-6 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <Icon name="alert-triangle" size={32} className="text-red-600" />
            </div>
            <div className="text-left max-w-xs">
              <h3 className="text-lg font-semibold text-red-800">Đã có lỗi xảy ra</h3>
              <p className="mt-2 text-sm text-red-700 font-mono whitespace-pre-wrap bg-red-50 p-2 rounded border border-red-200">
                {errMsg}
              </p>
              {shortStack && (
                <details className="mt-2 text-xs text-red-600">
                  <summary className="cursor-pointer">Xem chi tiết (stack trace)</summary>
                  <pre className="mt-1 text-left bg-red-100 p-2 rounded overflow-auto max-h-32">{shortStack}</pre>
                </details>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={this.handleRetry} variant="secondary">
                <Icon name="refresh" size={16} className="mr-2" />
                Thử lại
              </Button>
              <Button onClick={() => window.location.reload()} variant="outline">
                <Icon name="rotate-ccw" size={16} className="mr-2" />
                Tải lại trang
              </Button>
            </div>
          </div>
        </Card>
      );
    }

    return this.props.children;
  }
}