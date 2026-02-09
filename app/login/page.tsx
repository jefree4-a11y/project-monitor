"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const router = useRouter();

  async function signUp() {
    const { error } = await supabase.auth.signUp({ email, password: pw });
    if (error) return alert(error.message);
    alert("회원가입 완료. 이제 로그인하세요.");
  }

  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) return alert(error.message);
    router.push("/input");
  }

  return (
    <div style={{ padding: 24, maxWidth: 420 }}>
      <h2>로그인</h2>

      <input
        placeholder="이메일"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "100%", marginBottom: 8 }}
      />
      <input
        placeholder="비밀번호"
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        style={{ width: "100%", marginBottom: 12 }}
      />

      <button onClick={signIn} style={{ marginRight: 8 }}>로그인</button>
      <button onClick={signUp}>회원가입</button>
    </div>
  );
}
