"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

/* ===================== 타입 ===================== */

type Project = {
  id: string;
  project_code: string;
  name: string;
  status: "진행" | "보류" | "완료";
};

type Stage = {
  id: string;
  name: string;
  sort_order: number;
};

type UpdateRow = {
  project_id: string;
  stage_id: string;
  plan_date: string | null;
  approve_date: string | null;
  assignee: string | null;
};

/* ===================== 날짜 유틸 ===================== */

function toISODate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* ===================== 색상 로직 ===================== */
/*
완료(승인일 있음) → 녹색
현재 < 계획 → 파랑(진행)
현재 = 계획 → 주황(경고)
현재 > 계획 → 빨강(초과)

계획 없음:
- assignee === 'N/A'        → 미정(회색)
- assignee !== 'N/A'(NULL 포함) → 누락(노랑)
*/

const COLORS = {
  done: "#4caf50",     // 완료
  progress: "#0000ff", // 진행(파랑)
  warn: "#ff9800",     // 경고
  over: "#ff4d4f",     // 초과
  undetermined: "#cfcfcf", // 미정(회색)
  missing: "#ffe66b",      // 누락(노랑)
} as const;

function normalizeAssignee(a?: string | null) {
  return (a ?? "").trim();
}

function getColor(plan?: string | null, approve?: string | null, assignee?: string | null) {
  // 1) 승인일 있으면 완료(최우선)
  if (approve) return COLORS.done;

  // 2) 계획일 없으면: 미정/누락 분기
  if (!plan) {
    const a = normalizeAssignee(assignee);
    if (a === "N/A") return COLORS.undetermined; // 미정
    return COLORS.missing; // 누락 (NULL/"" 포함해서 N/A가 아니면 모두)
  }

  // 3) 계획일 있으면 날짜 비교
  const today = toISODate(new Date());
  const p = plan.slice(0, 10);

  if (today < p) return COLORS.progress;
  if (today === p) return COLORS.warn;
  return COLORS.over;
}

/* ===================== 스타일 ===================== */

const border = "1px solid #bbb";

const thBase: React.CSSProperties = {
  border,
  background: "#f2f2f2",
  textAlign: "center",
  fontSize: "12pt",
  height: 48,
};

const tdBase: React.CSSProperties = {
  border,
  textAlign: "center",
  verticalAlign: "middle",
  height: 45,
  fontSize: "12pt",
};

function thStickyLeft(left: number, width: number): React.CSSProperties {
  return {
    ...thBase,
    position: "sticky",
    left,
    zIndex: 5,
    width,
    minWidth: width,
    maxWidth: width,
  };
}

function tdStickyLeft(left: number, width: number): React.CSSProperties {
  return {
    ...tdBase,
    position: "sticky",
    left,
    background: "white",
    zIndex: 3,
    width,
    minWidth: width,
    maxWidth: width,
  };
}

/* ===================== 원 표시 ===================== */

function Circle({ color }: { color: string }) {
  return (
    <div
      style={{
        width: 22,
        height: 22,
        borderRadius: "50%",
        background: color,
        border: "2px solid #333",
      }}
    />
  );
}

/* ===================== 메인 ===================== */

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<"진행" | "보류" | "완료">("진행");

  /* ===================== 데이터 로딩 ===================== */

  useEffect(() => {
    (async () => {
      const p = await supabase
        .from("projects")
        .select("id, project_code, name, status")
        .eq("status", statusFilter)
        .order("project_code"); // 필요하면 .order("project_code", { ascending: false }) 로 변경

      const projectList = (p.data ?? []) as Project[];
      setProjects(projectList);

      const s = await supabase.from("stages").select("id, name, sort_order").order("sort_order");
      setStages((s.data ?? []) as Stage[]);

      const ids = projectList.map((x) => x.id);
      if (ids.length === 0) {
        setUpdates([]);
        return;
      }

      const u = await supabase
        .from("stage_updates")
        .select("project_id, stage_id, plan_date, approve_date, assignee")
        .in("project_id", ids);

      setUpdates((u.data ?? []) as UpdateRow[]);
    })();
  }, [statusFilter]);

  /* ===================== Map 변환 ===================== */

  const map = useMemo(() => {
    const m = new Map<string, Map<string, UpdateRow>>();
    for (const u of updates) {
      if (!m.has(u.project_id)) m.set(u.project_id, new Map());
      m.get(u.project_id)!.set(u.stage_id, u);
    }
    return m;
  }, [updates]);

  /* ===================== 화면 ===================== */

  return (
    <div style={{ padding: 10 }}>
      <h2 style={{ marginBottom: 10 }}>대시보드 (프로젝트 단계 현황)</h2>

      {/* 상단: 입력 이동 + 상태필터 + 조회 */}
      <div style={{ marginBottom: 12, display: "flex", gap: 20, alignItems: "center" }}>
        <a href="/input">입력화면으로 이동</a>

        <div>
          상태:
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{ marginLeft: 6 }}
          >
            <option value="진행">진행</option>
            <option value="보류">보류</option>
            <option value="완료">완료</option>
          </select>
        </div>

        <div>조회 {projects.length}건</div>
      </div>

      {/* 범례 */}
      <div style={{ marginBottom: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Legend color={COLORS.done} label="완료" />
        <Legend color={COLORS.progress} label="진행" />
        <Legend color={COLORS.warn} label="경고" />
        <Legend color={COLORS.over} label="초과" />
        <Legend color={COLORS.undetermined} label="계획없음" />
        <Legend color={COLORS.missing} label="누락" />
      </div>

      {/* 테이블 */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "100%" }}>
          <thead>
            <tr>
              <th style={thStickyLeft(0, 100)}>코드</th>
              <th style={thStickyLeft(100, 500)}>프로젝트명</th>

              {stages.map((s) => (
                <th key={s.id} style={thBase}>
                  {s.id}. {s.name}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {projects.map((p) => {
              const sm = map.get(p.id) ?? new Map<string, UpdateRow>();

              return (
                <tr key={p.id}>
                  <td style={tdStickyLeft(0, 140)}>
                    <a href={`/input?projectId=${p.id}`}>{p.project_code}</a>
                  </td>

                  <td style={tdStickyLeft(90, 260)}>
                    <a
                      href={`/input?projectId=${p.id}`}
                      style={{
                        color: "inherit",
                        textDecoration: "underline",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                      title="입력화면으로 이동"
                    >
                      {p.name}
                    </a>
                  </td>

                  {stages.map((s) => {
                    const r = sm.get(s.id);

                    const color = getColor(r?.plan_date, r?.approve_date, r?.assignee);

                    return (
                      <td
                        key={s.id}
                        style={{
                          ...tdBase,
                          width: 70,
                          minWidth: 70,
                          maxWidth: 70,
                          padding: 0,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            height: "100%",
                          }}
                        >
                          <Circle color={color} />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===================== 범례 ===================== */

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: color,
          border: "1px solid #333",
        }}
      />
      <span>{label}</span>
    </div>
  );
}
