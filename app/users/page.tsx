import UsersClient from "./UsersClient";
import { currentAdminRole, roleHasPermission } from "@/lib/access-control";
export const dynamic = "force-dynamic";
export default function UsersPage(){ const role=currentAdminRole(); if(!role || !roleHasPermission(role,"users:manage")) return <div className="rounded-xl border border-line bg-white p-6 text-sm text-neutral-500">Управление пользователями доступно только Super Admin.</div>; return <div><div className="mb-6"><h1 className="font-display text-2xl font-medium text-ink">Пользователи и роли</h1><p className="text-sm text-neutral-500 mt-1">Персональные учётные записи административной панели.</p></div><UsersClient /></div>; }
