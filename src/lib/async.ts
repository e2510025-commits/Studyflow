/** Bound a UI read without changing the underlying Firestore subscription or data. */
export function withTimeout<T>(operation: Promise<T>, milliseconds = 15_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("読み込みがタイムアウトしました")), milliseconds);
  });
  return Promise.race([operation, deadline]).finally(() => clearTimeout(timer));
}
