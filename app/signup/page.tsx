"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSignup = async () => {
    const name = fullName.trim();
    const em = email.trim();

    if (!name) return alert("사용자명을 입력하세요.");
    if (!em || !password) return alert("이메일/비밀번호를 입력하세요.");
    if (password.length < 6) return alert("비밀번호는 6자 이상을 권장합니다.");

    try {
      setLoading(true);

      // ✅ metadata에 full_name 저장 (나중에 로그인 후 프로필 생성에 사용 가능)
      const { data, error } = await supabase.auth.signUp({
        email: em,
        password,
        options: {
          data: { full_name: name },
        },
      });

      if (error) return alert("회원가입 실패: " + error.message);

      // ✅ 핵심: 이메일 인증이 켜져 있으면 session이 null일 수 있음
      // 이 상태에서는 RLS 때문에 profiles insert/upsert가 실패할 수 있으니 여기서 DB 쓰기 하지 않음
      if (!data.session) {
        alert("회원가입이 완료되었습니다. 이메일 인증 후 로그인해주세요.");
        router.push("/login");
        return;
      }

      // (이메일 인증이 꺼져 있어서 session이 바로 생기는 경우에만) profiles upsert
      const userId = data.user?.id;
      if (userId) {
        const { error: pErr } = await supabase.from("profiles").upsert(
          {
            id: userId,
            email: em,
            full_name: name,
            approved: false,
          },
          { onConflict: "id" }
        );

        if (pErr) {
          console.error("profiles upsert error:", pErr);
          alert("회원가입은 되었지만 프로필 저장 실패: " + pErr.message);
          router.push("/login");
          return;
        }
      }

      alert("회원가입이 완료되었습니다.");
      router.push("/login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ margin: "0 0 16px 0" }}>회원가입</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 260 }}>
        <input placeholder="사용자명" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <input
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onSignup} disabled={loading} style={{ flex: 1 }}>
            {loading ? "가입중..." : "가입하기"}
          </button>
          <button onClick={() => router.push("/login")} style={{ flex: 1 }}>
            로그인으로
          </button>
        </div>

        <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
          * 회원가입 후 기본은 <b>미승인</b> 상태로 저장됩니다.
        </div>
      </div>
    </div>
  );
}