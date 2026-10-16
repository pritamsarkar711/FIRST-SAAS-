"use client";

import { useInitialFetch } from "@/lib/use-initial-fetch";
import { useCallback, useEffect, useState } from "react";
import { MailCheck, Send, FolderCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";

interface MessageRow {
  id: string;
  name: string;
  email: string;
  reason: string;
  message: string;
  status: string;
  reply: string | null;
  createdAt: string;
}

export function MessagesManager() {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/messages");
    const d = await res.json().catch(() => ({}));
    setMessages(d.messages || []);
  }, []);
  useInitialFetch(load);

  async function send(id: string) {
    setBusy(id);
    await fetch("/api/admin/messages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "reply", reply }),
    });
    setBusy("");
    setReply("");
    setMsg("Reply saved and sent by email when SMTP is configured.");
    setOpenId(null);
    void load();
    setTimeout(() => setMsg(""), 2500);
  }

  async function close(id: string) {
    await fetch("/api/admin/messages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "close" }),
    });
    void load();
  }

  const counts = {
    open: messages.filter((m) => m.status === "OPEN").length,
    replied: messages.filter((m) => m.status === "REPLIED").length,
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Contact messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">{counts.open} open · {counts.replied} replied · {messages.length} total</p>
      </div>

      {msg && <p className="flex items-center gap-1.5 rounded-md bg-ok-soft px-3 py-2 text-sm font-semibold text-ok"><FolderCheck className="h-4 w-4" /> {msg}</p>}

      {messages.length === 0 ? (
        <EmptyState
          image="support"
          title="Inbox is empty"
          body="Messages from the public contact form will appear here, grouped by reason."
          size="sm"
        />
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <div key={m.id} className="rounded-lg border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-foreground">{m.reason}</p>
                  <p className="text-sm text-muted-foreground">{m.name} · {m.email} · {new Date(m.createdAt).toLocaleString()}</p>
                </div>
                <span className={cn("rounded-sm px-2 py-0.5 text-xs font-bold",
                  m.status === "OPEN" ? "bg-warn-soft text-warn" : m.status === "REPLIED" ? "bg-ok-soft text-ok" : "bg-muted text-muted-foreground")}>
                  {m.status.toLowerCase()}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{m.message}</p>
              {m.reply && (
                <div className="mt-3 rounded-md bg-secondary/60 p-3.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Your reply</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{m.reply}</p>
                </div>
              )}
              <div className="mt-3 flex gap-2">
                {openId === m.id ? (
                  <div className="w-full">
                    <textarea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write your reply..."
                      className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={() => void send(m.id)} disabled={busy === m.id || reply.trim().length < 2} className="rounded-md font-semibold">
                        <Send className="mr-1.5 h-3.5 w-3.5" /> Send reply
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setOpenId(null); setReply(""); }} className="rounded-md font-semibold">Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={() => { setOpenId(m.id); setReply(m.reply || ""); }} className="rounded-md font-semibold">
                      {m.reply ? "Edit reply" : "Reply"}
                    </Button>
                    {m.status !== "CLOSED" && (
                      <Button size="sm" variant="ghost" onClick={() => void close(m.id)} className="rounded-md font-semibold">Mark closed</Button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
