"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Project = { id: string; project_code: string; name: string; status: "진행" | "보류" | "완료" };
type Stage = { id: string; name: string; sort_order: number };
type UpdateRow = {
  project_id: string;
  stage_id: string;
  plan_date: string | null;
  actual_date: string | null;
  approve_date: string | null;
};

function fmt(date?: string | null) {
  if (!date) return "";
  const d = new Date(date);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function toISODate(d: Date) {
  // 로컬 타임 기준 YYYY-MM-DD
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** ✅ 원형 점 색상: 승인(녹색) > (오늘 vs 계획일) 노/주/빨 > 계획없음 회색 */
function getDotColor(plan?: string | null, approve?: string | null) {
  if (approve) return "#2e7d32"; // green

  if (!plan) return "#cfcfcf"; // gray

  const today = toISODate(new Date()); // "YYYY-MM-DD"
  const p = plan.slice(0, 10);

  if (today < p) return "#ffd400"; // yellow (진행)
  if (today === p) return "#ff9800"; // orange (경고)
  return "#ff3b30"; // red (초과)
}

function dotStyle(color: string): React.CSSProperties {
  return {
    width: 18,
    height: 18,
    borderRadius: 999,
    background: color,
    border: "1px solid #000",
    display: "inline-block",
  };
}

/** 스타일들 */
const border = "1px solid #bbb";

const thStageGroup: React.CSSProperties = {
  border,
  padding: "2px 4px",
  background: "#f2f2f2",
  textAlign: "center",
  whiteSpace: "nowrap",
  position: "sticky",
  top: 0,
  zIndex: 2,
  height: 30,
  fontSize: "10pt",
  lineHeight: "26px",
};

const tdCell: React.CSSProperties = {
  border,
  padding: "2px 4px",
  textAlign: "center",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  fontSize: "10pt",
};

function thStickyLeft(leftPx: number, width: number): React.CSSProperties {
  return {
    border,
    padding: "2px 4px",
    background: "#f2f2f2",
    textAlign: "center",
    position: "sticky",
    left: leftPx,
    zIndex: 5,
    width,
    minWidth: width,
    maxWidth: width,
    whiteSpace: "nowrap",
    top: 0,
    fontSize: "10pt",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
}

function tdStickyLeft(leftPx: number, width: number): React.CSSProperties {
  return {
    border,
    padding: "2px 4px",
    background: "white",
    position: "sticky",
    left: leftPx,
    zIndex: 3,
    width,
    minWidth: width,
    maxWidth: width,
    whiteSpace: "nowrap",
    fontSize: "10pt",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<"진행" | "보류" | "완료">("진행"); // ✅ 기본 진행

  // ✅ 상태 필터에 따라 프로젝트/업데이트 다시 조회
  useEffect(() => {
    (async () => {
      // 1) projects: 상태 필터 적용
      const p = await supabase
        .from("projects")
        .select("id, project_code, name, status")
        .eq("status", statusFilter)
        .order("project_code");

      const projectList = (p.data ?? []) as Project[];
      setProjects(projectList);

      // 2) stages
      const s = await supabase.from("stages").select("id, name, sort_order").order("sort_order");
      setStages((s.data ?? []) as Stage[]);

      // 3) updates: 현재 조회된 프로젝트만
      const ids = projectList.map((x) => x.id);
      if (ids.length === 0) {
        setUpdates([]);
        return;
      }

      // ✅ 원형표시에는 plan/approve만 있어도 되지만, tooltip용으로 actual도 유지
      const u = await supabase
        .from("stage_updates")
        .select("project_id, stage_id, plan_date, actual_date, approve_date")
        .in("project_id", ids);

      setUpdates((u.data ?? []) as UpdateRow[]);
    })();
  }, [statusFilter]);

  // project_id -> (stage_id -> row)
  const map = useMemo(() => {
    const m = new Map<string, Map<string, UpdateRow>>();
    for (const u of updates) {
      if (!m.has(u.project_id)) m.set(u.project_id, new Map());
      m.get(u.project_id)!.set(u.stage_id, u);
    }
    return m;
  }, [updates]);

  return (
    <div style={{ padding: 8, zoom: 0.9 }}>
      <h2 style={{ margin: "0 0 12px" }}>대시보드 (프로젝트 단계 현황)</h2>

      {/* 범례 + 입력화면 이동 + 상태필터 */}
      <div
        style={{
          marginBottom: 12,
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <span style={{ padding: "4px 8px", background: "#cfcfcf", borderRadius: 4 }}>미입력</span>
        <span style={{ padding: "4px 8px", background: "#ffd400", borderRadius: 4 }}>진행</span>
        <span style={{ padding: "4px 8px", background: "#ff9800", borderRadius: 4, fontWeight: 700 }}>경고</span>
        <span style={{ padding: "4px 8px", background: "#ff3b30", color: "white", borderRadius: 4, fontWeight: 700 }}>
          초과
        </span>
        <span style={{ padding: "4px 8px", background: "#2e7d32", color: "white", borderRadius: 4, fontWeight: 700 }}>
          완료
        </span>

        {/* 입력화면 이동 */}
        <a href="/input" style={{ marginLeft: 12 }}>
          입력화면으로 이동
        </a>

        {/* 상태 필터 (오른쪽 배치) */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 60 }}>
          <span>상태:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{ padding: "2px 6px" }}
          >
            <option value="진행">진행</option>
            <option value="보류">보류</option>
            <option value="완료">완료</option>
          </select>

          <span style={{ color: "#666" }}>(조회 {projects.length})</span>
        </div>
      </div>

      {/* 스크롤 컨테이너 */}
      <div style={{ overflowX: "auto", border: "1px solid #ccc" }}>
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            tableLayout: "fixed",
            fontSize: "10pt",
          }}
        >
          <thead>
            {/* ✅ 단계당 1칸만 표시 */}
            <tr>
              <th style={thStickyLeft(0, 60)}>코드</th>
              <th style={thStickyLeft(60, 160)}>프로젝트명</th>

              {stages.map((s) => (
                <th key={s.id} style={thStageGroup}>
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
                  <td style={tdStickyLeft(0, 60)}>
                    <a
                      href={`/input?projectId=${p.id}`}
                      style={{ color: "inherit", textDecoration: "underline", fontWeight: 700 }}
                      title="입력화면으로 이동"
                    >
                      {p.project_code}
                    </a>
                  </td>

                  <td style={tdStickyLeft(60, 160)}>{p.name}</td>

                  {stages.map((s) => {
                    const r = sm.get(s.id);
                    const color = getDotColor(r?.plan_date, r?.approve_date);

                    const tooltip = `계획:${fmt(r?.plan_date) || "-"} / 실적:${fmt(r?.actual_date) || "-"} / 승인:${fmt(
                      r?.approve_date
                    ) || "-"}`;

                    return (
                      <td key={s.id} style={{ ...tdCell, textAlign: "center" }}>
                        <span style={dotStyle(color)} title={tooltip} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 10, color: "#666" }}>* 상태 필터 기본값은 “진행”이며, 선택한 상태의 프로젝트만 조회됩니다.</p>
    </div>
  );
}
