"use client";

import React, { useEffect, useState } from "react";
import AuthenticatedLayout from "./components/AuthenticatedLayout";
import axiosInstance from "@/utils/axiosInstance";
import { useAuth } from "./authContext";
import { useToast } from "@/hooks/use-toast";

type RequestRow = any;
type ProductRow = { id: string; name: string; sku: string };

const Home = React.memo(() => {
  const { isAuthLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [services, setServices] = useState<Array<{ id: number; codigo: string; designacao: string }>>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [requestingServiceId, setRequestingServiceId] = useState<number | null>(null);
  const [items, setItems] = useState<Array<{ productId: string; quantity: number }>>([
    { productId: "", quantity: 1 },
  ]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/requests", { params: { mine: 1 } });
      setRequests(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const loadServices = async () => {
    try {
      const res = await axiosInstance.get("/requesting-services", { params: { includeInactive: 0 } });
      setServices(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setServices([]);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await axiosInstance.get("/products");
      setProducts(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setProducts([]);
    }
  };

  useEffect(() => {
    if (!isAuthLoading) {
      loadRequests();
      loadServices();
      loadProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading]);

  const addItem = () => setItems((s) => [...s, { productId: "", quantity: 1 }]);
  const removeItem = (idx: number) => setItems((s) => s.filter((_, i) => i !== idx));
  const updateItem = (idx: number, patch: Partial<{ productId: string; quantity: number }>) => {
    setItems((s) => s.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const { toast } = useToast();

  const createRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestingServiceId) {
      toast({ title: "Erro", description: "Selecione o serviço requisitante", variant: "destructive" });
      return;
    }
    const validItems = items.filter((it) => it.productId && Number.isFinite(it.quantity) && it.quantity > 0);
    if (validItems.length === 0) {
      toast({ title: "Erro", description: "Adicione pelo menos um item válido", variant: "destructive" });
      return;
    }

    try {
      const payload = {
        requestingServiceId,
        title: title.trim() || undefined,
        notes: notes.trim() || undefined,
        items: validItems.map((it) => ({ productId: it.productId, quantity: it.quantity })),
      } as any;

      await axiosInstance.post("/requests", payload);
      setTitle("");
      setNotes("");
      setItems([{ productId: "", quantity: 1 }]);
      await loadRequests();
      toast({ title: "Requisição criada", description: "A sua requisição foi criada." });
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Falha ao criar requisição";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-4">Home</h1>

        <section className="mb-6">
          <h2 className="text-lg font-medium mb-2">Nova Requisição</h2>
          <form onSubmit={createRequest} className="space-y-3">
            <div>
              <label className="block text-sm">Serviço requisitante</label>
              <select
                value={String(requestingServiceId ?? "")}
                onChange={(e) => setRequestingServiceId(Number(e.target.value) || null)}
                className="mt-1 w-full rounded border px-2 py-1"
              >
                <option value="">-- selecione --</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>{s.codigo} — {s.designacao}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm">Título</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" />
            </div>

            <div>
              <label className="block text-sm">Notas</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Itens</label>
              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      value={it.productId}
                      onChange={(e) => updateItem(idx, { productId: e.target.value })}
                      className="flex-1 rounded border px-2 py-1"
                    >
                      <option value="">-- selecione produto --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={String(it.quantity)}
                      onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 1 })}
                      className="w-24 rounded border px-2 py-1"
                    />
                    <button type="button" onClick={() => removeItem(idx)} className="text-sm text-rose-600">Remover</button>
                  </div>
                ))}

                <div>
                  <button type="button" onClick={addItem} className="rounded bg-gray-200 px-3 py-1">Adicionar item</button>
                </div>
              </div>
            </div>

            <div>
              <button type="submit" className="rounded bg-blue-600 text-white px-4 py-2">Criar</button>
            </div>
          </form>
        </section>

        <section>
          <h2 className="text-lg font-medium mb-2">Minhas Requisições</h2>
          <div className="rounded border bg-white p-4">
            {loading ? (
              <div>Carregando...</div>
            ) : requests.length === 0 ? (
              <div>Sem requisições</div>
            ) : (
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr>
                    <th className="text-left p-2">GTMI</th>
                    <th className="text-left p-2">Título</th>
                    <th className="text-left p-2">Estado</th>
                    <th className="text-left p-2">Criado</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r: any) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-2">{r.gtmiNumber}</td>
                      <td className="p-2">{r.title ?? "—"}</td>
                      <td className="p-2">{r.status}</td>
                      <td className="p-2">{new Date(r.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </AuthenticatedLayout>
  );
});

Home.displayName = "Home";

export default Home;
