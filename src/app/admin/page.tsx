import { redirect } from "next/navigation";

export default function AdminPage() {
  // /admin não é dashboard de métricas; redireciona para o painel editorial.
  redirect("/admin/analises-ia");
}
