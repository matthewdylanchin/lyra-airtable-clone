import { CreateBaseDebug } from "./_components/CreateBaseDebug";
import { TableDebug } from "./_components/TableDebug";

export default function HomePage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Lyra Airtable Clone</h1>
      <CreateBaseDebug />
      <TableDebug />
    </main>
  );
}
