export default function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <main className="w-full px-6 py-8">
      <h1 className="mb-6 text-xl font-semibold">{title}</h1>
      <p className="border-y border-line py-12 text-center text-sm text-muted">{message}</p>
    </main>
  );
}
