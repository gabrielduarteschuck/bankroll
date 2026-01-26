"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useTheme } from "@/contexts/ThemeContext";

type Toast = { type: "success" | "error"; message: string } | null;

type Multipla = {
  id: string;
  titulo: string;
  descricao: string;
  odd_total: number;
  quantidade_jogos: number;
  image_url: string | null;
  link_bilhete: string | null;
  is_published: boolean;
  is_archived: boolean;
  created_at: string;
};

export default function AdminMultiplasPage() {
  const router = useRouter();
  const { theme } = useTheme();

  const textPrimary = theme === "dark" ? "text-white" : "text-zinc-900";
  const textSecondary = theme === "dark" ? "text-zinc-400" : "text-zinc-600";
  const textTertiary = theme === "dark" ? "text-zinc-500" : "text-zinc-500";
  const cardBorder = theme === "dark" ? "border-zinc-800" : "border-zinc-200";
  const inputBg = theme === "dark" ? "bg-zinc-900/40" : "bg-white";
  const inputBorder = theme === "dark" ? "border-zinc-700" : "border-zinc-300";
  const inputText = theme === "dark" ? "text-white" : "text-zinc-900";

  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(false);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [oddTotal, setOddTotal] = useState("");
  const [quantidadeJogos, setQuantidadeJogos] = useState("");
  const [linkBilhete, setLinkBilhete] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [multiplas, setMultiplas] = useState<Multipla[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    void (async () => {
      setChecking(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace("/dashboard");
          return;
        }

        const { data: isAdminRpc, error: rpcErr } = await supabase.rpc("is_admin", {
          user_id: user.id,
        });

        if (!rpcErr && isAdminRpc === true) {
          setIsAdmin(true);
        } else {
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("is_admin, role")
            .eq("id", user.id)
            .single();

          if (error) {
            router.replace("/dashboard");
            return;
          }

          const ok = profile?.is_admin === true || profile?.role === "admin";
          setIsAdmin(ok);
          if (!ok) router.replace("/dashboard");
        }
      } catch (err: any) {
        const name = String(err?.name || "");
        const msg = String(err?.message || "");
        if (name === "AbortError" || msg.toLowerCase().includes("aborted")) {
          return;
        }
        console.error("Erro ao verificar admin:", err);
        router.replace("/dashboard");
      } finally {
        setChecking(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void loadMultiplas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  async function loadMultiplas() {
    setLoadingList(true);
    try {
      const { data } = await supabase
        .from("multiplas")
        .select("*")
        .order("created_at", { ascending: false });

      setMultiplas((data || []) as Multipla[]);
    } catch {
      setMultiplas([]);
    } finally {
      setLoadingList(false);
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  async function uploadImage(file: File): Promise<string | null> {
    try {
      setUploadingImage(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `multiplas/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Erro no upload:', uploadError);
        return null;
      }

      const { data } = supabase.storage.from('images').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err) {
      console.error('Erro no upload:', err);
      return null;
    } finally {
      setUploadingImage(false);
    }
  }

  function clearForm() {
    setTitulo("");
    setDescricao("");
    setOddTotal("");
    setQuantidadeJogos("");
    setLinkBilhete("");
    setImageFile(null);
    setImagePreview(null);
    setEditingId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!titulo.trim()) {
      setToast({ type: "error", message: "Título é obrigatório." });
      return;
    }

    const oddNum = parseFloat(oddTotal.replace(",", "."));
    if (!Number.isFinite(oddNum) || oddNum < 1) {
      setToast({ type: "error", message: "Odd inválida." });
      return;
    }

    const qtdNum = parseInt(quantidadeJogos, 10);
    if (!Number.isFinite(qtdNum) || qtdNum < 1) {
      setToast({ type: "error", message: "Quantidade de jogos inválida." });
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setToast({ type: "error", message: "Usuário não autenticado." });
        return;
      }

      // Upload da imagem se houver
      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const payload: any = {
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        odd_total: oddNum,
        quantidade_jogos: qtdNum,
        link_bilhete: linkBilhete.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (imageUrl) {
        payload.image_url = imageUrl;
      }

      if (editingId) {
        // Atualizar
        const { error } = await supabase
          .from("multiplas")
          .update(payload)
          .eq("id", editingId);

        if (error) {
          setToast({ type: "error", message: "Erro ao atualizar." });
          return;
        }
        setToast({ type: "success", message: "✅ Múltipla atualizada!" });
      } else {
        // Criar nova - já publicada automaticamente
        payload.created_by = user.id;
        payload.is_published = true;
        payload.published_at = new Date().toISOString();

        const { error } = await supabase.from("multiplas").insert(payload);

        if (error) {
          const msg = String(error.message || "");
          if (msg.toLowerCase().includes("multiplas")) {
            setToast({
              type: "error",
              message: "Tabela multiplas não existe. Aplique a migration no Supabase.",
            });
          } else {
            setToast({ type: "error", message: "Erro ao criar múltipla." });
          }
          return;
        }
        setToast({ type: "success", message: "✅ Múltipla criada!" });
      }

      clearForm();
      await loadMultiplas();
    } finally {
      setLoading(false);
    }
  }

  async function togglePublish(id: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from("multiplas")
        .update({
          is_published: !currentStatus,
          published_at: !currentStatus ? new Date().toISOString() : null,
        })
        .eq("id", id);

      if (error) {
        setToast({ type: "error", message: "Erro ao atualizar status." });
        return;
      }

      setToast({
        type: "success",
        message: !currentStatus ? "✅ Múltipla publicada!" : "Múltipla despublicada.",
      });
      await loadMultiplas();
    } catch {
      setToast({ type: "error", message: "Erro ao atualizar." });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta múltipla?")) return;

    try {
      const { error } = await supabase.from("multiplas").delete().eq("id", id);

      if (error) {
        setToast({ type: "error", message: "Erro ao excluir." });
        return;
      }

      setToast({ type: "success", message: "Múltipla excluída." });
      await loadMultiplas();
    } catch {
      setToast({ type: "error", message: "Erro ao excluir." });
    }
  }

  async function handleRestore(id: string) {
    try {
      const { error } = await supabase
        .from("multiplas")
        .update({
          is_archived: false,
          is_published: true,
          published_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        setToast({ type: "error", message: "Erro ao restaurar." });
        return;
      }

      setToast({ type: "success", message: "Múltipla restaurada e publicada!" });
      await loadMultiplas();
    } catch {
      setToast({ type: "error", message: "Erro ao restaurar." });
    }
  }

  function handleEdit(m: Multipla) {
    setTitulo(m.titulo);
    setDescricao(m.descricao || "");
    setOddTotal(m.odd_total.toString());
    setQuantidadeJogos(m.quantidade_jogos.toString());
    setLinkBilhete(m.link_bilhete || "");
    setImagePreview(m.image_url);
    setImageFile(null);
    setEditingId(m.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (checking) {
    return (
      <div className="space-y-6">
        <div className={`h-7 w-64 rounded-lg animate-pulse ${theme === "dark" ? "bg-zinc-800" : "bg-zinc-200"}`} />
        <div className={`h-64 rounded-3xl border ${cardBorder} ${theme === "dark" ? "bg-zinc-900/40" : "bg-white"} animate-pulse`} />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 px-4">
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg ${
              toast.type === "success"
                ? theme === "dark"
                  ? "bg-emerald-900/20 border-emerald-800 text-emerald-200"
                  : "bg-emerald-50 border-emerald-200 text-emerald-800"
                : theme === "dark"
                ? "bg-red-900/20 border-red-800 text-red-200"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      <div>
        <h1 className={`text-2xl font-semibold ${textPrimary}`}>Gerador de Múltiplas</h1>
        <p className={`mt-1 text-sm ${textSecondary}`}>
          Gerencie as múltiplas exclusivas para assinantes Premium.
        </p>
      </div>

      {/* Formulário */}
      <div
        className={`relative overflow-hidden rounded-3xl border p-6 sm:p-8 ${
          theme === "dark"
            ? "border-amber-500/30 bg-zinc-950 shadow-2xl shadow-amber-500/10"
            : "border-amber-300 bg-white shadow-xl"
        }`}
      >
        <div
          className={`pointer-events-none absolute -top-28 right-0 h-72 w-72 rounded-full blur-3xl ${
            theme === "dark" ? "bg-amber-500/10" : "bg-amber-500/15"
          }`}
        />

        <div className="relative">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className={`text-sm font-semibold ${theme === "dark" ? "text-amber-200" : "text-amber-800"}`}>
                {editingId ? "Editar Múltipla" : "Nova Múltipla"}
              </div>
              <div className={`mt-1 text-xs ${textTertiary}`}>
                Conteúdo exclusivo para assinantes Premium.
              </div>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={clearForm}
                className={`text-sm font-medium px-3 py-1.5 rounded-lg ${
                  theme === "dark" ? "text-zinc-400 hover:bg-zinc-800" : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                Cancelar edição
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Título</label>
                <input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex: Múltipla NBA - 3 jogos"
                  className={`w-full p-3 rounded-xl border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-amber-500`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Odd Total</label>
                <input
                  value={oddTotal}
                  onChange={(e) => setOddTotal(e.target.value.replace(/[^\d,.-]/g, ""))}
                  inputMode="decimal"
                  placeholder="Ex: 5.50"
                  className={`w-full p-3 rounded-xl border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-amber-500`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Quantidade de Jogos</label>
                <input
                  value={quantidadeJogos}
                  onChange={(e) => setQuantidadeJogos(e.target.value.replace(/\D/g, ""))}
                  inputMode="numeric"
                  placeholder="Ex: 3"
                  className={`w-full p-3 rounded-xl border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-amber-500`}
                />
              </div>

              <div className="md:col-span-2">
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Descrição</label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={3}
                  placeholder="Descreva os jogos e palpites da múltipla..."
                  className={`w-full p-3 rounded-xl border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-amber-500`}
                />
              </div>

              <div className="md:col-span-2">
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Imagem do Bilhete</label>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className={`w-full p-3 rounded-xl border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-amber-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-500 file:text-white hover:file:bg-amber-600`}
                    />
                    <div className={`mt-2 text-xs ${textTertiary}`}>
                      Formatos: JPG, PNG, WebP. Max: 5MB.
                    </div>
                  </div>
                  {imagePreview && (
                    <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-zinc-700">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => { setImageFile(null); setImagePreview(null); }}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Link do Bilhete</label>
                <input
                  value={linkBilhete}
                  onChange={(e) => setLinkBilhete(e.target.value)}
                  placeholder="https://..."
                  className={`w-full p-3 rounded-xl border ${inputBorder} ${inputBg} ${inputText} focus:outline-none focus:ring-2 focus:ring-amber-500`}
                />
                <div className={`mt-2 text-xs ${textTertiary}`}>Link para a casa de apostas.</div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading || uploadingImage}
                className={`h-12 px-6 rounded-xl font-semibold cursor-pointer transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  theme === "dark"
                    ? "bg-amber-600 text-white hover:bg-amber-500 shadow-lg shadow-amber-500/20"
                    : "bg-amber-600 text-white hover:bg-amber-700 shadow-md"
                }`}
              >
                {uploadingImage ? "Enviando imagem..." : loading ? "Salvando..." : editingId ? "Atualizar" : "Criar Múltipla"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Lista de múltiplas */}
      <div className={`rounded-3xl border ${cardBorder} ${theme === "dark" ? "bg-zinc-900/40" : "bg-white"} overflow-hidden`}>
        <div className={`px-6 py-4 border-b ${cardBorder}`}>
          <h2 className={`text-lg font-semibold ${textPrimary}`}>Múltiplas Cadastradas</h2>
        </div>

        {loadingList ? (
          <div className="p-8 text-center">
            <div className={`w-8 h-8 mx-auto border-2 rounded-full animate-spin ${
              theme === "dark" ? "border-zinc-700 border-t-white" : "border-zinc-200 border-t-zinc-900"
            }`} />
          </div>
        ) : multiplas.length === 0 ? (
          <div className={`p-8 text-center ${textSecondary}`}>
            Nenhuma múltipla cadastrada ainda.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {multiplas.map((m) => (
              <div key={m.id} className={`p-4 sm:p-6 flex flex-col sm:flex-row gap-4 ${theme === "dark" ? "hover:bg-zinc-800/50" : "hover:bg-zinc-50"}`}>
                {m.image_url && (
                  <div className="w-full sm:w-32 h-24 rounded-xl overflow-hidden flex-shrink-0">
                    <img src={m.image_url} alt={m.titulo} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className={`font-semibold ${textPrimary}`}>{m.titulo}</h3>
                      <p className={`text-sm ${textSecondary} mt-1 line-clamp-2`}>{m.descricao}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {m.is_archived && (
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          theme === "dark" ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700"
                        }`}>
                          Arquivada
                        </span>
                      )}
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        m.is_published
                          ? "bg-emerald-500/20 text-emerald-500"
                          : "bg-zinc-500/20 text-zinc-500"
                      }`}>
                        {m.is_published ? "Publicada" : "Rascunho"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <span className={`text-xs ${textTertiary}`}>
                      Odd: <span className={`font-semibold ${textPrimary}`}>{m.odd_total.toFixed(2)}</span>
                    </span>
                    <span className={`text-xs ${textTertiary}`}>
                      Jogos: <span className={`font-semibold ${textPrimary}`}>{m.quantidade_jogos}</span>
                    </span>
                    <span className={`text-xs ${textTertiary}`}>
                      {new Date(m.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    {m.is_archived ? (
                      <button
                        onClick={() => handleRestore(m.id)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                          theme === "dark" ? "bg-amber-600 text-white hover:bg-amber-500" : "bg-amber-600 text-white hover:bg-amber-700"
                        }`}
                      >
                        Restaurar
                      </button>
                    ) : (
                      <button
                        onClick={() => togglePublish(m.id, m.is_published)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                          m.is_published
                            ? theme === "dark" ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                            : theme === "dark" ? "bg-emerald-600 text-white hover:bg-emerald-500" : "bg-emerald-600 text-white hover:bg-emerald-700"
                        }`}
                      >
                        {m.is_published ? "Despublicar" : "Publicar"}
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(m)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                        theme === "dark" ? "bg-zinc-800 text-zinc-300 hover:bg-zinc-700" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                      }`}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                        theme === "dark" ? "bg-red-900/30 text-red-400 hover:bg-red-900/50" : "bg-red-50 text-red-600 hover:bg-red-100"
                      }`}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
