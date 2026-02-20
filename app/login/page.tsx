"use client";

import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

function sanitizeRedirect(path: string | null) {
  // 보안: 외부 URL로 리다이렉트 방지
  if (!path) return "/dashboard";
  if (!path.startsWith("/")) return "/dashboard";
  return path;
}

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();

  // ✅ proxy.ts에서 redirectTo를 쓰고, 예전 호환용으로 next도 같이 지원
  const redirectTo = useMemo(() => {
    const r = sp.get("redirectTo") || sp.get("next");
    return sanitizeRedirect(r);
  }, [sp]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ 이메일 인증 대기 UI
  const [needConfirm, setNeedConfirm] = useState(false);

  // ✅ 재발송 쿨타임
  const [cooldown, setCooldown] = useState(0);

  const emailTrim = useMemo(() => email.trim(), [email]);

  const startCooldown = (seconds: number) => {
    setCooldown(seconds);
    const timer = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const onLogin = async () => {
    if (loading) return;
    if (!emailTrim || !password) return alert("이메일/비밀번호를 입력하세요.");

    try {
      setLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: emailTrim,
        password,
      });

      if (error) {
        const msg = (error.message || "").toLowerCase();

        if (msg.includes("email not confirmed")) {
          setNeedConfirm(true);
          startCooldown(60);
          return;
        }

        if (msg.includes("rate limit")) {
          alert("요청이 너무 많아 잠시 제한되었습니다. 1~2분 후 다시 시도하세요.");
          return;
        }

        alert("로그인 실패: " + error.message);
        return;
      }

      // ✅ 로그인 성공: 원래 가려던 곳으로
      router.replace(redirectTo);
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    if (!emailTrim) return alert("이메일을 입력하세요.");
    if (cooldown > 0) return;

    try {
      setLoading(true);

      const { error } = await supabase.auth.resend({
        type: "signup",
        email: emailTrim,
      });

      if (error) {
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("rate limit")) {
          startCooldown(120);
          alert("요청이 많아 잠시 제한되었습니다. 잠시 후 다시 시도하세요.");
          return;
        }
        alert("재발송 실패: " + error.message);
        return;
      }

      alert("인증메일을 재발송했습니다. 메일함/스팸함을 확인하세요.");
      startCooldown(60);
    } finally {
      setLoading(false);
    }
  };

  const goSignup = () => {
    // 회원가입 후에도 돌아오게 하고 싶으면 redirectTo를 같이 넘김
    router.push(`/signup?redirectTo=${encodeURIComponent(redirectTo)}`);
  };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ margin: "0 0 16px 0" }}>로그인</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 320 }}>
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

        {/* ✅ 인증 대기 안내 */}
        {needConfirm && (
          <div
            style={{
              border: "1px solid #ddd",
              padding: 10,
              borderRadius: 8,
              background: "#fafafa",
              fontSize: 13,
              lineHeight: "18px",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>이메일 인증이 필요합니다</div>
            <div>가입 시 받은 인증메일을 먼저 확인해주세요.</div>
            <div style={{ opacity: 0.8 }}>메일이 안 오면 스팸함도 확인하세요.</div>

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={onResend} disabled={loading || cooldown > 0} style={{ flex: 1 }}>
                {cooldown > 0 ? `${cooldown}s 후 재발송` : "인증메일 재발송"}
              </button>
              <button
                onClick={() => setNeedConfirm(false)}
                disabled={loading}
                style={{ width: 90 }}
                title="안내 숨기기"
              >
                닫기
              </button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onLogin} disabled={loading} style={{ flex: 1 }}>
            {loading ? "로그인..." : "로그인"}
          </button>

          <button onClick={goSignup} disabled={loading} style={{ flex: 1 }}>
            회원가입
          </button>
        </div>

        {needConfirm && (
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            같은 이메일로 회원가입을 다시 누르면 메일 발송 제한(rate limit)이 걸릴 수 있어요. <br />
            위 “재발송”을 사용하세요.
          </div>
        )}

        <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
          로그인 성공 후 이동: <code>{redirectTo}</code>
        </div>
      </div>
    </div>
  );
}