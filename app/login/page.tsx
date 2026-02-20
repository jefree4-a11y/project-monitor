"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    if (!email.trim() || !password) return alert("이메일/비밀번호를 입력하세요.");

    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) return alert("로그인 실패: " + error.message);

      // 로그인 후 이동 (원하시는 경로로)
      router.push("/input");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ margin: "0 0 16px 0" }}>로그인</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 220 }}>
        <input
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <input
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onLogin} disabled={loading} style={{ flex: 1 }}>
            {loading ? "로그인..." : "로그인"}
          </button>

          {/* ✅ 회원가입 버튼 */}
          <button onClick={() => router.push("/signup")} style={{ flex: 1 }}>
            회원가입
          </button>
        </div>
      </div>
    </div>
  );
}