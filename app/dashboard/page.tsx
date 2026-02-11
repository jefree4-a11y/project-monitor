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
현재 < 계획 → 노랑(진행)
현재 = 계획 → 주황(경고)
현재 > 계획 → 빨강(초과)
계획 없음 → 회색
*/

function getColor(plan?: string | null, approve?: string | null) {
  if (approve) return "#2e7d32"; // 완료(녹색)
  if (!plan) return "#cfcfcf";   // 미정(회색)

  const today = toISODate(new Date());
  const p = plan.slice(0, 10);

  if (today < p) return "#ffe66b";   // 진행(노랑)
  if (today === p) return "#ff9800"; // 경고(주황)
  return "#ff4d4f";                  // 초과(빨강)
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
  height: 58,
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
  const [statusFilter, setStatusFilter] =
    useState<"진행" | "보류" | "완료">("진행");

  /* ===================== 데이터 로딩 ===================== */

  useEffect(() => {
    (async () => {
      const p = await supabase
        .from("projects")
        .select("id, project_code, name, status")
        .eq("status", statusFilter)
        .order("project_code");

      const projectList = (p.data ?? []) as Project[];
      setProjects(projectList);

      const s = await supabase
        .from("stages")
        .select("id, name, sort_order")
        .order("sort_order");

      setStages((s.data ?? []) as Stage[]);

      const ids = projectList.map((x) => x.id);
      if (ids.length === 0) {
        setUpdates([]);
        return;
      }

      const u = await supabase
        .from("stage_updates")
        .select("project_id, stage_id, plan_date, approve_date")
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

      <h2 style={{ marginBottom: 10 }}>
        대시보드 (프로젝트 단계 현황)
      </h2>

      {/* 상태 필터 + 입력 이동 */}
      <div style={{ marginBottom: 12, display: "flex", gap: 20 }}>
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
      <div style={{ marginBottom: 12, display: "flex", gap: 10 }}>
        <Legend color="#2e7d32" label="완료" />
        <Legend color="#ffe66b" label="진행" />
        <Legend color="#ff9800" label="경고" />
        <Legend color="#ff4d4f" label="초과" />
        <Legend color="#cfcfcf" label="미정" />
      </div>

      {/* 테이블 */}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            borderCollapse: "collapse",
            tableLayout: "fixed",
            width: "100%",
          }}
        >
          <thead>
            <tr>
              <th style={thStickyLeft(0, 140)}>코드</th>
              <th style={thStickyLeft(140, 280)}>프로젝트명</th>

              {stages.map((s) => (
                <th key={s.id} style={thBase}>
                  {s.id}. {s.name}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {projects.map((p) => {
              const sm = map.get(p.id) ?? new Map();

              return (
                <tr key={p.id}>
                  <td style={tdStickyLeft(0, 140)}>
                    <a href={`/input?projectId=${p.id}`}>
                      {p.project_code}
                    </a>
                  </td>

                  <td style={tdStickyLeft(140, 280)}>
                    {p.name}
                  </td>

                  {stages.map((s) => {
                    const r = sm.get(s.id);
                    const color = getColor(
                      r?.plan_date,
                      r?.approve_date
                    );

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
                        {/* ⭐ 가운데 정렬 핵심 */}
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
