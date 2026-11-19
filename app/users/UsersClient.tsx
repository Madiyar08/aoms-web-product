"use client";
import { useEffect, useState, type FormEvent } from "react";
type User = { id: string; username: string; displayName: string; role: string; active: boolean; createdAt: string };
const ROLE_LABELS: Record<string,string> = { super_admin: "Super Admin", operations_manager: "Операционный менеджер", inspector: "Проверяющий", viewer: "Просмотр" };
export default function UsersClient() {
  const [users,setUsers] = useState<User[]>([]); const [error,setError] = useState(""); const [busy,setBusy] = useState(false);
  async function load(){ const r=await fetch("/api/admin-users",{cache:"no-store"}); const j=await r.json(); if(!r.ok) throw new Error(j.error||"Ошибка загрузки"); setUsers(j.users); }
  useEffect(()=>{load().catch(e=>setError(e.message));},[]);
  async function create(e: FormEvent<HTMLFormElement>){ e.preventDefault(); const formElement = e.currentTarget; setBusy(true); setError(""); const form=new FormData(formElement); const r=await fetch("/api/admin-users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(form))}); const j=await r.json(); setBusy(false); if(!r.ok){setError(j.error||"Ошибка");return;} formElement.reset(); await load(); }
  async function toggle(user:User){ setError(""); const r=await fetch("/api/admin-users",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:user.id,active:!user.active})}); const j=await r.json(); if(!r.ok){setError(j.error||"Ошибка");return;} await load(); }
  return <div className="space-y-6">
    <form onSubmit={create} className="rounded-xl border border-line bg-white p-5 grid gap-3 md:grid-cols-2">
      <h2 className="md:col-span-2 font-semibold">Создать учётную запись</h2>
      <input name="username" required minLength={3} maxLength={40} placeholder="Логин (латиница)" className="input" />
      <input name="displayName" required maxLength={80} placeholder="Имя сотрудника" className="input" />
      <select name="role" className="input"><option value="operations_manager">Операционный менеджер</option><option value="inspector">Проверяющий</option><option value="viewer">Просмотр</option><option value="super_admin">Super Admin</option></select>
      <input name="password" required minLength={12} type="password" placeholder="Пароль (минимум 12 символов)" className="input" />
      <button disabled={busy} className="md:col-span-2 rounded-lg bg-ink text-white py-2 text-sm disabled:opacity-50">{busy?"Создание…":"Создать пользователя"}</button>
    </form>
    {error && <p className="rounded-lg bg-red-50 text-red-700 p-3 text-sm">{error}</p>}
    <div className="rounded-xl border border-line bg-white overflow-x-auto"><table className="w-full text-sm text-left"><thead className="border-b border-line text-neutral-500"><tr><th className="p-3">Пользователь</th><th className="p-3">Роль</th><th className="p-3">Статус</th><th className="p-3">Действие</th></tr></thead><tbody className="divide-y divide-line">{users.map(u=><tr key={u.id}><td className="p-3"><b>{u.displayName}</b><div className="text-xs text-neutral-400">@{u.username}</div></td><td className="p-3">{ROLE_LABELS[u.role]||u.role}</td><td className="p-3">{u.active?"Активен":"Отключён"}</td><td className="p-3"><button onClick={()=>toggle(u)} className="text-xs underline">{u.active?"Отключить":"Включить"}</button></td></tr>)}</tbody></table></div>
    <p className="text-xs text-neutral-400">Пароли хранятся в виде scrypt-хеша. Удаление пользователей заменено отключением, чтобы сохранять историю аудита.</p>
  </div>;
}
