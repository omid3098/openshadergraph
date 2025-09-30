import toast from "react-hot-toast";

/**
 * Show a success notification
 */
export function notifySuccess(message: string, description?: string) {
  const fullMessage = description ? `${message}\n${description}` : message;
  toast.success(fullMessage, {
    duration: 3000,
    position: "bottom-right",
  });
}

/**
 * Show an error notification
 */
export function notifyError(message: string, error?: unknown) {
  let fullMessage = message;
  
  if (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    fullMessage = `${message}\n${errorMsg}`;
  }
  
  toast.error(fullMessage, {
    duration: 5000,
    position: "bottom-right",
  });
}

/**
 * Show an info notification
 */
export function notifyInfo(message: string) {
  toast(message, {
    duration: 3000,
    position: "bottom-right",
    icon: "ℹ️",
  });
}

/**
 * Show a warning notification
 */
export function notifyWarning(message: string) {
  toast(message, {
    duration: 4000,
    position: "bottom-right",
    icon: "⚠️",
    style: {
      background: "#f59e0b",
      color: "#fff",
    },
  });
}

/**
 * Show a loading notification
 * Returns a function to dismiss the notification
 */
export function notifyLoading(message: string): () => void {
  const id = toast.loading(message, {
    position: "bottom-right",
  });
  
  return () => toast.dismiss(id);
}

/**
 * Show a promise-based notification
 * Automatically shows loading, success, or error based on promise state
 */
export function notifyPromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((err: unknown) => string);
  }
): Promise<T> {
  return toast.promise(
    promise,
    messages,
    {
      position: "bottom-right",
    }
  );
}
